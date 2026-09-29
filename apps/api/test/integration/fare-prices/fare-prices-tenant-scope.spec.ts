import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import {
  createFarePriceTestContext,
  type FarePriceTestContext,
} from './fare-price-test-context.js';

const VALID_FROM = '2099-09-01';
const VALID_TO = '2099-09-30';

type TenantFixture = {
  nhaXeId: number;
  routeId: number;
  vehicleTypeId: number;
  close: () => Promise<void>;
};

describe('Fare Price tenant authorization', () => {
  let context: FarePriceTestContext;

  beforeAll(async () => {
    context = await createFarePriceTestContext();
  }, 30_000);

  afterAll(async () => {
    await context?.close();
  }, 30_000);

  beforeEach(async () => {
    await context.clearFares();
  });

  async function createOtherTenant(): Promise<TenantFixture> {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    const company = await context.prisma.nhaXe.create({
      data: {
        maNhaXe: `T04-S-${suffix}`,
        tenNhaXe: `Test Fare Scope ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    const route = await context.prisma.tuyenXe.create({
      data: {
        maTuyenXe: `T04-S-${suffix}`,
        diemDi: 'Điểm tenant B',
        diemDen: 'Điểm đến tenant B',
        trangThai: 'HOAT_DONG',
        nhaXeId: company.nhaXeId,
      },
      select: { tuyenXeId: true },
    });
    const vehicleType = await context.prisma.loaiXe.create({
      data: {
        nhaXeId: company.nhaXeId,
        tenLoai: `Test Fare Scope ${suffix}`,
      },
      select: { loaiXeId: true },
    });

    return {
      nhaXeId: company.nhaXeId,
      routeId: route.tuyenXeId,
      vehicleTypeId: vehicleType.loaiXeId,
      async close() {
        await context.prisma.bangGia.deleteMany({ where: { nhaXeId: company.nhaXeId } });
        await context.prisma.tuyenXe.delete({ where: { tuyenXeId: route.tuyenXeId } });
        await context.prisma.loaiXe.delete({ where: { loaiXeId: vehicleType.loaiXeId } });
        await context.prisma.nhaXe.delete({ where: { nhaXeId: company.nhaXeId } });
      },
    };
  }

  async function createFare(
    tenant: Pick<TenantFixture, 'nhaXeId' | 'routeId' | 'vehicleTypeId'>,
    status: 'HOAT_DONG' | 'TAM_NGUNG' = 'TAM_NGUNG',
  ) {
    return context.prisma.bangGia.create({
      data: {
        nhaXeId: tenant.nhaXeId,
        tuyenXeId: tenant.routeId,
        loaiXeId: tenant.vehicleTypeId,
        giaNiemYet: new Prisma.Decimal(250000),
        tuNgay: new Date(`${VALID_FROM}T00:00:00.000Z`),
        denNgay: new Date(`${VALID_TO}T00:00:00.000Z`),
        trangThai: status,
      },
    });
  }

  it('returns list rows and count only from the authenticated tenant', async () => {
    const otherTenant = await createOtherTenant();
    try {
      const ownFare = await createFare({
        nhaXeId: context.busCompanyId,
        routeId: context.routeId,
        vehicleTypeId: context.vehicleTypeId,
      });
      const foreignFare = await createFare(otherTenant);

      const response = await request(context.app.getHttpServer())
        .get('/api/v1/fare-prices')
        .expect(200);

      expect(response.body.data.map((fare: { farePriceId: number }) => fare.farePriceId))
        .toEqual([ownFare.bangGiaId]);
      expect(response.body.data).not.toContainEqual(
        expect.objectContaining({ farePriceId: foreignFare.bangGiaId }),
      );
      expect(response.body.meta.totalItems).toBe(1);
    } finally {
      await otherTenant.close();
    }
  });

  it('returns 404 for foreign fare reads and mutations without changing that fare', async () => {
    const otherTenant = await createOtherTenant();
    try {
      const foreignFare = await createFare(otherTenant);

      const detail = await request(context.app.getHttpServer())
        .get(`/api/v1/fare-prices/${foreignFare.bangGiaId}`)
        .expect(404);
      expect(detail.body.error).toBe('FARE_PRICE_NOT_FOUND');

      const update = await request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${foreignFare.bangGiaId}`)
        .send({ listedPrice: 280000 })
        .expect(404);
      expect(update.body.error).toBe('FARE_PRICE_NOT_FOUND');

      const updateStatus = await request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${foreignFare.bangGiaId}/status`)
        .send({ status: 'HOAT_DONG' })
        .expect(404);
      expect(updateStatus.body.error).toBe('FARE_PRICE_NOT_FOUND');

      const unchanged = await context.prisma.bangGia.findUniqueOrThrow({
        where: { bangGiaId: foreignFare.bangGiaId },
      });
      expect(unchanged.nhaXeId).toBe(otherTenant.nhaXeId);
      expect(unchanged.giaNiemYet.toString()).toBe('250000');
      expect(unchanged.trangThai).toBe('TAM_NGUNG');
    } finally {
      await otherTenant.close();
    }
  });

  it('hides foreign route and vehicle-type IDs from the applicable-fare resolver', async () => {
    const otherTenant = await createOtherTenant();
    try {
      await createFare(otherTenant, 'HOAT_DONG');

      const foreignRoute = await request(context.app.getHttpServer())
        .get('/api/v1/fare-prices/applicable')
        .query({
          routeId: otherTenant.routeId,
          vehicleTypeId: context.vehicleTypeId,
          date: VALID_FROM,
        })
        .expect(404);
      expect(foreignRoute.body.error).toBe('ROUTE_NOT_FOUND');

      const foreignType = await request(context.app.getHttpServer())
        .get('/api/v1/fare-prices/applicable')
        .query({
          routeId: context.routeId,
          vehicleTypeId: otherTenant.vehicleTypeId,
          date: VALID_FROM,
        })
        .expect(404);
      expect(foreignType.body.error).toBe('VEHICLE_TYPE_NOT_FOUND');
    } finally {
      await otherTenant.close();
    }
  });
});
