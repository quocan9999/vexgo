import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import {
  createFarePriceTestContext,
  type FarePriceTestContext,
} from './fare-price-test-context.js';

describe('Fare Price tenant composite foreign keys', () => {
  let context: FarePriceTestContext;
  let otherCompanyId: number;
  let otherRouteId: number;
  let otherVehicleTypeId: number;

  beforeAll(async () => {
    context = await createFarePriceTestContext();
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    const otherCompany = await context.prisma.nhaXe.create({
      data: {
        maNhaXe: `T04-FK-${suffix}`,
        tenNhaXe: `Test Fare FK ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    otherCompanyId = otherCompany.nhaXeId;
    const otherRoute = await context.prisma.tuyenXe.create({
      data: {
        maTuyenXe: `T04-FK-${suffix}`,
        diemDi: 'Điểm FK tenant B',
        diemDen: 'Điểm đến FK tenant B',
        trangThai: 'HOAT_DONG',
        nhaXeId: otherCompanyId,
      },
      select: { tuyenXeId: true },
    });
    otherRouteId = otherRoute.tuyenXeId;
    const otherVehicleType = await context.prisma.loaiXe.create({
      data: { nhaXeId: otherCompanyId, tenLoai: `Test Fare FK ${suffix}` },
      select: { loaiXeId: true },
    });
    otherVehicleTypeId = otherVehicleType.loaiXeId;
  }, 30_000);

  afterAll(async () => {
    if (context) {
      await context.prisma.bangGia.deleteMany({ where: { nhaXeId: context.busCompanyId } });
      await context.prisma.tuyenXe.delete({ where: { tuyenXeId: otherRouteId } });
      await context.prisma.loaiXe.delete({ where: { loaiXeId: otherVehicleTypeId } });
      await context.prisma.nhaXe.delete({ where: { nhaXeId: otherCompanyId } });
      await context.close();
    }
  }, 30_000);

  it('rejects cross-tenant route/type relations on direct database inserts and updates', async () => {
    const baseData = {
      giaNiemYet: new Prisma.Decimal(250000),
      tuNgay: new Date('2099-09-01T00:00:00.000Z'),
      denNgay: new Date('2099-09-30T00:00:00.000Z'),
      trangThai: 'TAM_NGUNG' as const,
      nhaXeId: context.busCompanyId,
    };

    await expect(context.prisma.bangGia.create({
      data: {
        ...baseData,
        tuyenXeId: otherRouteId,
        loaiXeId: context.vehicleTypeId,
      },
    })).rejects.toMatchObject({ code: 'P2003' });

    await expect(context.prisma.bangGia.create({
      data: {
        ...baseData,
        tuyenXeId: context.routeId,
        loaiXeId: otherVehicleTypeId,
      },
    })).rejects.toMatchObject({ code: 'P2003' });

    const validFare = await context.prisma.bangGia.create({
      data: {
        ...baseData,
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
      },
    });

    await expect(context.prisma.bangGia.update({
      where: { bangGiaId: validFare.bangGiaId },
      data: { tuyenXe: { connect: { tuyenXeId: otherRouteId } } },
    })).rejects.toMatchObject({ code: 'P2003' });

    await expect(context.prisma.bangGia.update({
      where: { bangGiaId: validFare.bangGiaId },
      data: { loaiXe: { connect: { loaiXeId: otherVehicleTypeId } } },
    })).rejects.toMatchObject({ code: 'P2003' });

    const unchanged = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: validFare.bangGiaId },
    });
    expect(unchanged.nhaXeId).toBe(context.busCompanyId);
    expect(unchanged.tuyenXeId).toBe(context.routeId);
    expect(unchanged.loaiXeId).toBe(context.vehicleTypeId);
  });
});
