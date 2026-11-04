import { beforeAll, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { MediaService } from '../../../src/media/media.service.js';
import {
  CloudinaryProvider,
  type CloudinaryAsset,
} from '../../../src/media/cloudinary.provider.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import {
  Prisma,
  type TaiNguyenMedia,
} from '../../../src/generated/prisma/client.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

const principal: AuthPrincipal = {
  taiKhoanId: 1,
  sessionId: 'qa',
  roles: ['NHA_XE_ADMIN'],
  permissions: ['vehicle:read', 'vehicle:update'],
  nhanVienId: 2,
  nhaXeId: 3,
};
const requestId = 'd568978a-1c5e-4c67-90ab-b823201098e6';
const mediaId = '83bf055f-f6c4-46b8-9270-63cfc9442aee';
const publicId = `vexgo/test/bus-companies/3/vehicles/14/${mediaId}`;
const asset: CloudinaryAsset = {
  assetId: 'asset001',
  publicId,
  version: 1,
  bytes: 200,
  width: 2,
  height: 2,
  format: 'webp',
  url: `https://res.cloudinary.com/test/image/upload/v1/${publicId}.webp`,
};
let png: Buffer;
beforeAll(async () => {
  png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#cc1111' },
  })
    .png()
    .toBuffer();
});

function record(overrides: Partial<TaiNguyenMedia> = {}): TaiNguyenMedia {
  return {
    taiNguyenMediaId: mediaId,
    yeuCauId: requestId,
    nhaXeId: 3,
    xeId: 14,
    taiKhoanTaoId: 1,
    mucDich: 'ANH_XE',
    trangThai: 'DANG_TAI',
    tenCloud: 'test',
    thuMuc: 'vexgo/test/bus-companies/3/vehicles/14',
    cloudinaryPublicId: publicId,
    cloudinaryAssetId: null,
    sha256: createHash('sha256').update(png).digest('hex'),
    urlCongKhai: null,
    phienBan: null,
    kichThuoc: null,
    chieuRong: null,
    chieuCao: null,
    dinhDang: null,
    daGoLuc: null,
    createdAt: new Date('2026-11-03T00:00:00Z'),
    updatedAt: new Date('2026-11-03T00:00:00Z'),
    ...overrides,
  };
}

function setup() {
  const ready = record({
    trangThai: 'SAN_SANG',
    cloudinaryAssetId: asset.assetId,
    urlCongKhai: asset.url,
  });
  const registry = {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(record()),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(record()),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUniqueOrThrow: vi.fn().mockResolvedValue(ready),
    findMany: vi.fn().mockResolvedValue([ready]),
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ xeId: 14 }]),
    taiNguyenMedia: registry,
  };
  const prisma = {
    xe: { findFirst: vi.fn().mockResolvedValue({ xeId: 14 }) },
    taiNguyenMedia: registry,
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const provider = {
    location: vi.fn().mockReturnValue({
      cloudName: 'test',
      folder: record().thuMuc,
      publicId,
    }),
    upload: vi.fn().mockResolvedValue(asset),
    lookup: vi.fn().mockResolvedValue(asset),
  };
  const service = new MediaService(
    prisma as unknown as PrismaService,
    provider as unknown as CloudinaryProvider,
  );
  const upload = () =>
    service.upload(
      14,
      requestId,
      { buffer: png, size: png.length, mimetype: 'image/png' },
      principal,
    );
  return { service, upload, prisma, provider, registry, tx };
}

describe('vehicle media lifecycle', () => {
  it('reserves under a vehicle row lock before upload and finalizes only the reservation', async () => {
    const { upload, tx, provider, registry, prisma } = setup();
    const result = await upload();
    expect(result.data.status).toBe('SAN_SANG');
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(registry.create.mock.invocationCallOrder[0]).toBeLessThan(
      provider.upload.mock.invocationCallOrder[0]!,
    );
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(registry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trangThai: { in: ['DANG_TAI', 'CHO_DOI_SOAT'] },
        }),
      }),
    );
  });

  it('blocks cross-tenant vehicles before decoding, reserving or uploading', async () => {
    const { upload, prisma, provider } = setup();
    prisma.xe.findFirst.mockResolvedValue(null);
    await expect(upload()).rejects.toMatchObject({
      response: { error: 'MEDIA_VEHICLE_NOT_FOUND' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it('reuses an identical successful request without another provider write', async () => {
    const { upload, registry, provider } = setup();
    registry.findUnique.mockResolvedValue(
      record({ trangThai: 'SAN_SANG', cloudinaryAssetId: asset.assetId }),
    );
    expect((await upload()).data.status).toBe('SAN_SANG');
    expect(provider.upload).not.toHaveBeenCalled();
    expect(registry.create).not.toHaveBeenCalled();
  });

  it('rejects reused request IDs for another image or vehicle and pending requests', async () => {
    for (const change of [
      { sha256: 'b'.repeat(64) },
      { xeId: 99 },
      { trangThai: 'DANG_TAI' },
      { trangThai: 'DA_GO' },
    ]) {
      const { upload, registry, provider } = setup();
      registry.findUnique.mockResolvedValue(record(change));
      await expect(upload()).rejects.toBeInstanceOf(Error);
      expect(provider.upload).not.toHaveBeenCalled();
    }
  });

  it('counts pending uploads toward the 10-image limit', async () => {
    const { upload, registry, provider } = setup();
    registry.count.mockResolvedValue(10);
    await expect(upload()).rejects.toMatchObject({
      response: { error: 'MEDIA_VEHICLE_LIMIT' },
    });
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it('retains uncertain uploads for read-only reconciliation instead of re-posting', async () => {
    const { upload, registry, provider, service } = setup();
    provider.upload.mockRejectedValue(new Error('network disconnected'));
    await expect(upload()).rejects.toMatchObject({
      response: { error: 'MEDIA_UPLOAD_UNCERTAIN' },
    });
    expect(registry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { trangThai: 'CHO_DOI_SOAT' } }),
    );
    registry.findFirst.mockResolvedValue(record({ trangThai: 'CHO_DOI_SOAT' }));
    expect((await service.reconcile(14, mediaId, principal)).data.status).toBe(
      'SAN_SANG',
    );
    expect(provider.lookup).toHaveBeenCalledWith(
      publicId,
      record().sha256,
      'test',
    );
    expect(provider.upload).toHaveBeenCalledOnce();
  });

  it('preserves the reservation when linking the uploaded asset fails', async () => {
    const { upload, registry, provider } = setup();
    registry.updateMany.mockRejectedValue(new Error('DB unavailable'));
    await expect(upload()).rejects.toMatchObject({
      response: { error: 'MEDIA_LINK_UNCERTAIN' },
    });
    expect(provider.upload).toHaveBeenCalledOnce();
    expect(registry.create).toHaveBeenCalledOnce();
  });

  it('does not resurrect a removed image after a delayed provider response', async () => {
    const { upload, registry } = setup();
    registry.updateMany.mockResolvedValue({ count: 0 });
    registry.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        record({ trangThai: 'DA_GO', daGoLuc: new Date() }),
      );
    await expect(upload()).rejects.toMatchObject({
      response: { error: 'MEDIA_STATE_CHANGED' },
    });
  });

  it('soft removal never deletes Cloudinary assets and remains tenant-scoped', async () => {
    const { service, registry, provider } = setup();
    await service.remove(14, mediaId, principal);
    expect(registry.findFirst).toHaveBeenCalledWith({
      where: { taiNguyenMediaId: mediaId, xeId: 14, nhaXeId: 3 },
    });
    expect(registry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { trangThai: 'DA_GO', daGoLuc: expect.any(Date) },
      }),
    );
    expect(provider.upload).not.toHaveBeenCalled();
    expect(provider.lookup).not.toHaveBeenCalled();
  });

  it('public listing returns only ready images and omits internal metadata', async () => {
    const { service, registry } = setup();
    const result = await service.listPublic(14);
    expect(registry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { xeId: 14, mucDich: 'ANH_XE', trangThai: 'SAN_SANG' },
      }),
    );
    expect(result.data[0]).not.toHaveProperty('sha256');
    expect(result.data[0]).not.toHaveProperty('requestId');
    expect(result.data[0]).not.toHaveProperty('taiKhoanTaoId');
  });

  it('maps request-key uniqueness races into a conflict without external upload', async () => {
    const { upload, registry, provider } = setup();
    registry.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(upload()).rejects.toMatchObject({
      response: { error: 'MEDIA_REQUEST_REUSED' },
    });
    expect(provider.upload).not.toHaveBeenCalled();
  });
});
