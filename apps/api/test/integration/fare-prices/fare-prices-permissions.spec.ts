import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import {
  createFarePriceTestContext,
  type FarePriceTestContext,
} from './fare-price-test-context.js';

const ENDPOINT = '/api/v1/fare-prices';

describe('Fare Price permission enforcement', () => {
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

  function setPrincipal(
    roles: string[],
    permissions: AuthPrincipal['permissions'],
    nhaXeId: number | null = context.busCompanyId,
    nhanVienId: number | null = 900,
  ) {
    context.setPrincipal({
      taiKhoanId: 700,
      sessionId: 'fare-price-permission-session',
      roles,
      permissions,
      nhanVienId,
      nhaXeId,
    });
  }

  async function insertFarePrice() {
    return context.prisma.bangGia.create({
      data: {
        giaNiemYet: new Prisma.Decimal(250000),
        tuNgay: new Date('2099-01-01T00:00:00.000Z'),
        denNgay: new Date('2099-12-31T00:00:00.000Z'),
        trangThai: 'HOAT_DONG',
        nhaXeId: context.busCompanyId,
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
      },
    });
  }

  function createBody() {
    return {
      routeId: context.routeId,
      vehicleTypeId: context.vehicleTypeId,
      listedPrice: 300000,
      validFrom: '2099-01-01',
      validTo: '2099-12-31',
      status: 'HOAT_DONG',
    };
  }

  it('allows a tenant employee with read permission to list, view, and resolve fares', async () => {
    const fare = await insertFarePrice();
    setPrincipal(['NHAN_VIEN_KINH_DOANH'], ['fare-price:read']);

    const list = await request(context.app.getHttpServer())
      .get(ENDPOINT)
      .expect(200);
    const detail = await request(context.app.getHttpServer())
      .get(`${ENDPOINT}/${fare.bangGiaId}`)
      .expect(200);
    const applicable = await request(context.app.getHttpServer())
      .get(`${ENDPOINT}/applicable`)
      .query({
        routeId: context.routeId,
        vehicleTypeId: context.vehicleTypeId,
        date: '2099-02-01',
      })
      .expect(200);

    expect(list.body.data).toHaveLength(1);
    expect(detail.body.data.farePriceId).toBe(fare.bangGiaId);
    expect(applicable.body.data.farePriceId).toBe(fare.bangGiaId);
  });

  it('allows create permission without granting read permission', async () => {
    setPrincipal(['NHAN_VIEN_KINH_DOANH'], ['fare-price:create']);

    await request(context.app.getHttpServer())
      .post(ENDPOINT)
      .send(createBody())
      .expect(201);

    const deniedRead = await request(context.app.getHttpServer())
      .get(ENDPOINT)
      .expect(403);

    expect(deniedRead.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(await context.prisma.bangGia.count({
      where: { nhaXeId: context.busCompanyId },
    })).toBe(1);
  });

  it('allows update permission without granting read or create permission', async () => {
    const fare = await insertFarePrice();
    setPrincipal(['NHAN_VIEN_CSKH'], ['fare-price:update']);

    const edited = await request(context.app.getHttpServer())
      .patch(`${ENDPOINT}/${fare.bangGiaId}`)
      .send({ listedPrice: 320000 })
      .expect(200);
    const updated = await request(context.app.getHttpServer())
      .patch(`${ENDPOINT}/${fare.bangGiaId}/status`)
      .send({ status: 'TAM_NGUNG' })
      .expect(200);
    const deniedRead = await request(context.app.getHttpServer())
      .get(ENDPOINT)
      .expect(403);
    const deniedCreate = await request(context.app.getHttpServer())
      .post(ENDPOINT)
      .send(createBody())
      .expect(403);

    expect(edited.body.data.listedPrice).toBe(320000);
    expect(updated.body.data.status).toBe('TAM_NGUNG');
    expect(deniedRead.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(deniedCreate.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(await context.prisma.bangGia.count({
      where: { nhaXeId: context.busCompanyId },
    })).toBe(1);
  });

  it('rejects missing permissions before creating operational data', async () => {
    setPrincipal(['NHAN_VIEN_BAN_VE'], []);

    const read = await request(context.app.getHttpServer())
      .get(ENDPOINT)
      .expect(403);
    const create = await request(context.app.getHttpServer())
      .post(ENDPOINT)
      .send(createBody())
      .expect(403);

    expect(read.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(create.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(await context.prisma.bangGia.count({
      where: { nhaXeId: context.busCompanyId },
    })).toBe(0);
  });

  it('fails closed when an employee has permission but no tenant identity', async () => {
    setPrincipal(
      ['NHAN_VIEN_KINH_DOANH'],
      ['fare-price:read'],
      null,
    );

    const response = await request(context.app.getHttpServer())
      .get(ENDPOINT)
      .expect(403);

    expect(response.body.error).toBe('TENANT_SCOPE_REQUIRED');
  });

  it('keeps SUPER_ADMIN outside operational endpoints even with fare permissions', async () => {
    setPrincipal(
      ['SUPER_ADMIN'],
      ['fare-price:read', 'fare-price:create', 'fare-price:update'],
      null,
      null,
    );

    const response = await request(context.app.getHttpServer())
      .get(ENDPOINT)
      .expect(403);

    expect(response.body.error).toBe('ROLE_FORBIDDEN');
  });
});
