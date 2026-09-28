import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

export type FarePriceTestContext = {
  app: INestApplication;
  prisma: PrismaService;
  routeId: number;
  vehicleTypeId: number;
  busCompanyId: number;
  clearFares: () => Promise<void>;
  close: () => Promise<void>;
};

export async function createFarePriceTestContext(): Promise<FarePriceTestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApi(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  const company = await prisma.nhaXe.create({
    data: {
      maNhaXe: `T04-${suffix}`,
      tenNhaXe: `Test Fare Price ${suffix}`,
      trangThai: 'HOAT_DONG',
    },
    select: { nhaXeId: true },
  });

  const route = await prisma.tuyenXe.create({
    data: {
      maTuyenXe: `T04-${suffix}`,
      diemDi: 'Điểm thử',
      diemDen: 'Điểm đích thử',
      trangThai: 'TAM_NGUNG',
      nhaXeId: company.nhaXeId,
    },
    select: { tuyenXeId: true },
  });

  const vehicleType = await prisma.loaiXe.create({
    data: { tenLoai: `Test Fare Type ${suffix}` },
    select: { loaiXeId: true },
  });

  async function clearFares() {
    await prisma.bangGia.deleteMany({
      where: { tuyenXeId: route.tuyenXeId, loaiXeId: vehicleType.loaiXeId },
    });
  }

  async function close() {
    try {
      await clearFares();
      await prisma.tuyenXe.delete({ where: { tuyenXeId: route.tuyenXeId } });
      await prisma.loaiXe.delete({ where: { loaiXeId: vehicleType.loaiXeId } });
      await prisma.nhaXe.delete({ where: { nhaXeId: company.nhaXeId } });
    } finally {
      await app.close();
    }
  }

  return {
    app,
    prisma,
    routeId: route.tuyenXeId,
    vehicleTypeId: vehicleType.loaiXeId,
    busCompanyId: company.nhaXeId,
    clearFares,
    close,
  };
}
