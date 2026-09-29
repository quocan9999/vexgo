import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('vehicle tenant composite foreign keys', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  const companyACode = `SCOPE-A-${suffix}`;
  const companyBCode = `SCOPE-B-${suffix}`;
  const routeCode = `SCOPE-ROUTE-${suffix}`;
  const vehicleTypeAName = `Scope Type A ${suffix}`;
  const vehicleTypeBName = `Scope Type B ${suffix}`;
  const licensePlate = `TS-${suffix}`;
  const tripCode = `SCOPE-TRIP-${suffix}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .compile();
    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
    prisma = app.get(PrismaService);
  }, 30000);

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.$transaction(async (transaction) => {
          await transaction.chuyenXe.deleteMany({
            where: { maChuyenXe: tripCode },
          });
          await transaction.xe.deleteMany({
            where: { bienSoXe: licensePlate },
          });
          await transaction.tuyenXe.deleteMany({
            where: { maTuyenXe: routeCode },
          });
          await transaction.loaiXe.deleteMany({
            where: { tenLoai: { in: [vehicleTypeAName, vehicleTypeBName] } },
          });
          await transaction.nhaXe.deleteMany({
            where: { maNhaXe: { in: [companyACode, companyBCode] } },
          });
        });
      }
    } finally {
      await app?.close();
    }
  });

  it('rejects changing a trip-referenced vehicle to another tenant at the database FK', async () => {
    const companyA = await prisma.nhaXe.create({
      data: {
        maNhaXe: companyACode,
        tenNhaXe: `Scope Company A ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    const companyB = await prisma.nhaXe.create({
      data: {
        maNhaXe: companyBCode,
        tenNhaXe: `Scope Company B ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    const typeA = await prisma.loaiXe.create({
      data: { nhaXeId: companyA.nhaXeId, tenLoai: vehicleTypeAName },
      select: { loaiXeId: true },
    });
    const typeB = await prisma.loaiXe.create({
      data: { nhaXeId: companyB.nhaXeId, tenLoai: vehicleTypeBName },
      select: { loaiXeId: true },
    });
    const routeA = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: routeCode,
        diemDi: 'Điểm A',
        diemDen: 'Điểm B',
        trangThai: 'HOAT_DONG',
        nhaXeId: companyA.nhaXeId,
      },
      select: { tuyenXeId: true },
    });
    const vehicleA = await prisma.xe.create({
      data: {
        bienSoXe: licensePlate,
        trangThai: 'HOAT_DONG',
        nhaXeId: companyA.nhaXeId,
        loaiXeId: typeA.loaiXeId,
      },
      select: { xeId: true },
    });

    await prisma.chuyenXe.create({
      data: {
        maChuyenXe: tripCode,
        ngayKhoiHanh: new Date('2099-09-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: companyA.nhaXeId,
        tuyenXeId: routeA.tuyenXeId,
        xeId: vehicleA.xeId,
      },
      select: { chuyenXeId: true },
    });

    await expect(
      prisma.xe.update({
        where: { xeId: vehicleA.xeId },
        data: { nhaXeId: companyB.nhaXeId, loaiXeId: typeB.loaiXeId },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });

    await expect(
      prisma.xe.findUnique({
        where: { xeId: vehicleA.xeId },
        select: { nhaXeId: true, loaiXeId: true },
      }),
    ).resolves.toEqual({
      nhaXeId: companyA.nhaXeId,
      loaiXeId: typeA.loaiXeId,
    });
  }, 30000);
});
