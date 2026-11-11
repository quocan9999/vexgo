import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { MediaService } from '../../../src/media/media.service.js';
import {
  CloudinaryProvider,
  type CloudinaryAsset,
} from '../../../src/media/cloudinary.provider.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

const databaseUrl = process.env.MEDIA_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)(
  'Media migration and lifecycle against isolated MySQL',
  () => {
    let prisma: PrismaService;
    let png: Buffer;
    let principal: AuthPrincipal;
    let vehicleId: number;
    let otherVehicleId: number;
    let foreignVehicleId: number;
    let service: MediaService;
    let realProvider: CloudinaryProvider;
    const uploads = vi.fn();

    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        url.hostname !== '127.0.0.1' ||
        url.pathname !== '/vexgo_media_cloudinary_test'
      )
        throw new Error('MEDIA_TEST_REQUIRES_ISOLATED_DATABASE');
      prisma = new PrismaService(
        new ConfigService({ DATABASE_URL: databaseUrl }),
      );
      await prisma.$connect();
      const company = await prisma.nhaXe.create({
        data: {
          maNhaXe: 'MEDIA-QA-1',
          tenNhaXe: 'QA ảnh xe',
          trangThai: 'HOAT_DONG',
        },
      });
      const otherCompany = await prisma.nhaXe.create({
        data: {
          maNhaXe: 'MEDIA-QA-2',
          tenNhaXe: 'QA ảnh xe tenant 2',
          trangThai: 'HOAT_DONG',
        },
      });
      const type = await prisma.loaiXe.create({
        data: { tenLoai: 'QA', nhaXeId: company.nhaXeId },
      });
      const otherType = await prisma.loaiXe.create({
        data: { tenLoai: 'QA', nhaXeId: otherCompany.nhaXeId },
      });
      const createVehicle = (plate: string, tenantId: number, typeId: number) =>
        prisma.xe.create({
          data: {
            bienSoXe: plate,
            nhaXeId: tenantId,
            loaiXeId: typeId,
            trangThai: 'HOAT_DONG',
          },
        });
      vehicleId = (
        await createVehicle('QA-MEDIA-01', company.nhaXeId, type.loaiXeId)
      ).xeId;
      otherVehicleId = (
        await createVehicle('QA-MEDIA-02', company.nhaXeId, type.loaiXeId)
      ).xeId;
      foreignVehicleId = (
        await createVehicle(
          'QA-MEDIA-03',
          otherCompany.nhaXeId,
          otherType.loaiXeId,
        )
      ).xeId;
      const account = await prisma.taiKhoan.create({
        data: {
          soDienThoai: '+84900000001',
          matKhau: 'QA-NO-LOGIN',
          daXacThucSoDienThoai: false,
        },
      });
      principal = {
        taiKhoanId: account.taiKhoanId,
        sessionId: 'isolated-media-test',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['vehicle:read', 'vehicle:update'],
        nhaXeId: company.nhaXeId,
        nhanVienId: 1,
      };
      realProvider = new CloudinaryProvider(
        new ConfigService({
          CLOUDINARY_ENABLED: 'true',
          CLOUDINARY_CLOUD_NAME:
            process.env.CLOUDINARY_CLOUD_NAME ?? 'fixture-cloud',
          CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? 'fixture-key',
          CLOUDINARY_API_SECRET:
            process.env.CLOUDINARY_API_SECRET ?? 'fixture-secret',
          CLOUDINARY_ENVIRONMENT: 'test',
          CLOUDINARY_FOLDER_MODE:
            process.env.CLOUDINARY_FOLDER_MODE ?? 'dynamic',
        }),
      );
      uploads.mockImplementation(
        async (
          _buffer: Buffer,
          publicId: string,
        ): Promise<CloudinaryAsset> => ({
          publicId,
          assetId: randomUUID(),
          url: `https://res.cloudinary.com/fixture-cloud/image/upload/v1/${publicId}.webp`,
          version: 1,
          bytes: 100,
          width: 4,
          height: 3,
          format: 'webp',
        }),
      );
      service = new MediaService(prisma, {
        location: realProvider.location.bind(realProvider),
        upload: uploads,
      } as unknown as CloudinaryProvider);
      png = await sharp({
        create: { width: 4, height: 3, channels: 3, background: '#c81e1e' },
      })
        .png()
        .toBuffer();
    }, 30_000);
    afterAll(async () => {
      await prisma?.$disconnect();
    });
    const file = () => ({
      buffer: png,
      mimetype: 'image/png',
      size: png.length,
    });

    it('persists metadata, replays safely, enforces tenant FK and keeps a soft-removed asset registry', async () => {
      const requestId = randomUUID();
      const created = await service.upload(
        vehicleId,
        requestId,
        file(),
        principal,
      );
      expect(created.data.status).toBe('SAN_SANG');
      const replay = await service.upload(
        vehicleId,
        requestId,
        file(),
        principal,
      );
      expect(replay.data.mediaId).toBe(created.data.mediaId);
      expect(uploads).toHaveBeenCalledOnce();
      const registry = await prisma.taiNguyenMedia.findUniqueOrThrow({
        where: { taiNguyenMediaId: created.data.mediaId },
      });
      await expect(
        prisma.taiNguyenMedia.update({
          where: { taiNguyenMediaId: registry.taiNguyenMediaId },
          data: { kichThuoc: null },
        }),
      ).rejects.toThrow();
      expect(
        (
          await prisma.taiNguyenMedia.findUniqueOrThrow({
            where: { taiNguyenMediaId: registry.taiNguyenMediaId },
          })
        ).kichThuoc,
      ).toBe(100);
      expect(registry.thuMuc).toBe(
        `vexgo/test/bus-companies/${principal.nhaXeId}/vehicles/${vehicleId}`,
      );
      await expect(
        prisma.taiNguyenMedia.update({
          where: { taiNguyenMediaId: registry.taiNguyenMediaId },
          data: { xeId: foreignVehicleId },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await service.remove(vehicleId, registry.taiNguyenMediaId, principal);
      expect((await service.listPublic(vehicleId)).data).toEqual([]);
      const removed = await prisma.taiNguyenMedia.findUniqueOrThrow({
        where: { taiNguyenMediaId: registry.taiNguyenMediaId },
      });
      expect(removed.cloudinaryAssetId).toBe(registry.cloudinaryAssetId);
      expect(removed.daGoLuc).toBeInstanceOf(Date);
    });

    it('serializes simultaneous image reservations so no more than 10 provider uploads are allowed', async () => {
      const previousCalls = uploads.mock.calls.length;
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, () =>
          service.upload(otherVehicleId, randomUUID(), file(), principal),
        ),
      );
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(10);
      const failures = results.filter((result) => result.status === 'rejected');
      expect(failures).toHaveLength(2);
      for (const result of failures)
        if (result.status === 'rejected')
          expect(result.reason).toMatchObject({
            response: { error: 'MEDIA_VEHICLE_LIMIT' },
          });
      expect(uploads.mock.calls.length - previousCalls).toBe(10);
      expect(
        await prisma.taiNguyenMedia.count({
          where: { xeId: otherVehicleId, trangThai: 'SAN_SANG' },
        }),
      ).toBe(10);
    }, 30_000);

    it.skipIf(process.env.MEDIA_LIVE_CLOUDINARY !== '1')(
      'uploads and reads back a real Cloudinary test asset in the exact tenant/vehicle folder',
      async () => {
        const live = new MediaService(prisma, realProvider);
        const result = await live.upload(
          vehicleId,
          randomUUID(),
          file(),
          principal,
        );
        expect(result.data.status).toBe('SAN_SANG');
        const row = await prisma.taiNguyenMedia.findUniqueOrThrow({
          where: { taiNguyenMediaId: result.data.mediaId },
        });
        const actual = await realProvider.lookup(
          row.cloudinaryPublicId,
          row.sha256,
          row.tenCloud,
        );
        expect(actual.assetId).toBe(row.cloudinaryAssetId);
        expect(row.cloudinaryPublicId).toBe(
          `${row.thuMuc}/${row.taiNguyenMediaId}`,
        );
        expect(row.thuMuc).toBe(
          `vexgo/test/bus-companies/${principal.nhaXeId}/vehicles/${vehicleId}`,
        );
        expect((await live.listPublic(vehicleId)).data).toHaveLength(1);
        const response = await fetch(actual.url, {
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toMatch(/^image\/webp/);
        const delivered = await sharp(
          Buffer.from(await response.arrayBuffer()),
        ).metadata();
        expect(delivered.width).toBe(4);
        expect(delivered.height).toBe(3);
        await live.remove(vehicleId, row.taiNguyenMediaId, principal);
        expect((await live.listPublic(vehicleId)).data).toHaveLength(0);
        if (process.env.MEDIA_LIVE_EVIDENCE_FILE)
          await writeFile(
            process.env.MEDIA_LIVE_EVIDENCE_FILE,
            JSON.stringify(
              {
                checkedAt: new Date().toISOString(),
                scope:
                  'service + isolated MySQL + real Cloudinary + CDN; not mobile UI/JWT E2E',
                publicId: row.cloudinaryPublicId,
                assetId: actual.assetId,
                folder: row.thuMuc,
                url: actual.url,
                folderMode: process.env.CLOUDINARY_FOLDER_MODE ?? 'dynamic',
                statusAfterTest: 'DA_GO',
                physicallyRetained: true,
                checks: [
                  'upload',
                  'Cloudinary readback',
                  'folder/publicId/context SHA256',
                  'CDN HTTP 200 WebP 4x3',
                  'public list',
                  'logical unlink',
                ],
              },
              null,
              2,
            ) + '\n',
            { mode: 0o600 },
          );
        console.log(`CLOUDINARY_TEST_ASSET_RETAINED=${row.cloudinaryPublicId}`);
      },
      60_000,
    );
    it('image links do not prevent deletion of an otherwise unused vehicle', async () => {
      expect(
        await prisma.taiNguyenMedia.count({ where: { xeId: otherVehicleId } }),
      ).toBe(10);
      await prisma.xe.delete({ where: { xeId: otherVehicleId } });
      expect(
        await prisma.taiNguyenMedia.count({ where: { xeId: otherVehicleId } }),
      ).toBe(0);
    });
  },
);
