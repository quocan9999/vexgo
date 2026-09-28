import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import {
  createFarePriceTestContext,
  type FarePriceTestContext,
} from './fare-price-test-context.js';

const VALID_FROM = '2099-09-01';
const VALID_TO = '2099-09-30';

describe('Fare Price create HTTP and database behavior', () => {
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

  function body(overrides: Record<string, unknown> = {}) {
    return {
      routeId: context.routeId,
      vehicleTypeId: context.vehicleTypeId,
      listedPrice: 250000,
      validFrom: VALID_FROM,
      validTo: VALID_TO,
      status: 'HOAT_DONG',
      ...overrides,
    };
  }

  async function insertFare(overrides: {
    validFrom?: string;
    validTo?: string | null;
    status?: 'HOAT_DONG' | 'TAM_NGUNG';
  } = {}) {
    return context.prisma.bangGia.create({
      data: {
        giaNiemYet: new Prisma.Decimal(250000),
        tuNgay: new Date(`${overrides.validFrom ?? VALID_FROM}T00:00:00.000Z`),
        denNgay: overrides.validTo === null
          ? null
          : new Date(`${overrides.validTo ?? VALID_TO}T00:00:00.000Z`),
        trangThai: overrides.status ?? 'HOAT_DONG',
        nhaXeId: context.busCompanyId,
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
      },
    });
  }

  it('creates an active fare with the 04.1 English detail contract using an inactive route', async () => {
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body())
      .expect(201);

    expect(response.body.data).toMatchObject({
      farePriceId: expect.any(Number),
      listedPrice: 250000,
      currency: 'VND',
      validFrom: VALID_FROM,
      validTo: VALID_TO,
      status: 'HOAT_DONG',
      effectiveState: 'CHUA_HIEU_LUC',
      route: {
        routeId: context.routeId,
        code: expect.stringMatching(/^T04-/),
        origin: 'Điểm thử',
        destination: 'Điểm đích thử',
      },
      vehicleType: {
        vehicleTypeId: context.vehicleTypeId,
        name: expect.stringMatching(/^Test Fare Type /),
      },
      createdAt: expect.stringMatching(/Z$/),
      updatedAt: expect.stringMatching(/Z$/),
    });
    expect(response.body.data).not.toHaveProperty('bangGiaId');

    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: response.body.data.farePriceId },
    });
    expect(saved.giaNiemYet.toString()).toBe('250000');
    expect(saved.trangThai).toBe('HOAT_DONG');
  });

  it.each([
    ['HOAT_DONG', 'HOAT_DONG'],
    ['TAM_NGUNG', 'TAM_NGUNG'],
  ] as const)('persists an explicit %s status and returns its effective state', async (_status, status) => {
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ status }))
      .expect(201);

    expect(response.body.data.status).toBe(status);
    expect(response.body.data.effectiveState).toBe(
      status === 'TAM_NGUNG' ? 'TAM_NGUNG' : 'CHUA_HIEU_LUC',
    );
  });

  it('accepts an inclusive one-day interval and normalizes omitted validTo to null', async () => {
    const oneDay = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ validFrom: VALID_FROM, validTo: VALID_FROM }))
      .expect(201);
    expect(oneDay.body.data.validTo).toBe(VALID_FROM);

    await context.clearFares();
    const openEnded = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ validTo: undefined }))
      .expect(201);
    expect(openEnded.body.data.validTo).toBeNull();
  });

  it.each([
    ['routeId', { routeId: undefined }],
    ['vehicleTypeId', { vehicleTypeId: undefined }],
    ['listedPrice', { listedPrice: undefined }],
    ['validFrom', { validFrom: undefined }],
    ['status', { status: undefined }],
    ['zero route ID', { routeId: 0 }],
    ['negative route ID', { routeId: -1 }],
    ['fractional route ID', { routeId: 1.5 }],
    ['string route ID', { routeId: '3' }],
    ['zero vehicle type ID', { vehicleTypeId: 0 }],
    ['zero listed price', { listedPrice: 0 }],
    ['negative listed price', { listedPrice: -1 }],
    ['fractional listed price', { listedPrice: 250000.5 }],
    ['string listed price', { listedPrice: '250000' }],
    ['unsafe listed price', { listedPrice: Number.MAX_SAFE_INTEGER + 1 }],
    ['invalid status', { status: 'DANG_HIEU_LUC' }],
    ['unknown field', { unexpected: true }],
    ['invalid date format', { validFrom: '01/09/2099' }],
    ['timestamp instead of date-only', { validFrom: '2099-09-01T00:00:00Z' }],
    ['impossible date', { validFrom: '2099-02-30' }],
    ['invalid validTo', { validTo: '2099-02-30' }],
    ['validTo before validFrom', { validFrom: '2099-09-10', validTo: '2099-09-09' }],
  ])('rejects %s before creating a row', async (_caseName, overrides) => {
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body(overrides))
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(await context.prisma.bangGia.count({
      where: { tuyenXeId: context.routeId, loaiXeId: context.vehicleTypeId },
    })).toBe(0);
  });

  it('rejects a missing route and vehicle type with their resource error codes', async () => {
    const routeResponse = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ routeId: 2147483647 }))
      .expect(404);
    expect(routeResponse.body.error).toBe('ROUTE_NOT_FOUND');

    const typeResponse = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ vehicleTypeId: 2147483647 }))
      .expect(404);
    expect(typeResponse.body.error).toBe('VEHICLE_TYPE_NOT_FOUND');
  });

  it('rejects an active interval that touches an existing active end date', async () => {
    await insertFare();
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ validFrom: VALID_TO, validTo: '2099-10-31' }))
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'FARE_PRICE_OVERLAP',
      message: 'Khoảng hiệu lực bị trùng với một bảng giá đang hoạt động.',
    });
  });

  it('rejects an interval that touches the existing active start date', async () => {
    await insertFare();
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ validFrom: '2099-08-01', validTo: VALID_FROM }))
      .expect(409);

    expect(response.body.error).toBe('FARE_PRICE_OVERLAP');
  });

  it.each([
    ['same interval', VALID_FROM, VALID_TO, VALID_FROM, VALID_TO],
    ['new starts inside', '2099-09-15', '2099-10-15', VALID_FROM, VALID_TO],
    ['new ends inside', '2099-08-15', '2099-09-15', VALID_FROM, VALID_TO],
    ['new contains existing', '2099-08-01', '2099-10-31', VALID_FROM, VALID_TO],
    ['new is contained by existing', '2099-09-10', '2099-09-20', VALID_FROM, VALID_TO],
    ['existing is open-ended', '2099-10-01', '2099-10-31', VALID_FROM, null],
    ['new is open-ended', '2099-09-30', null, VALID_FROM, VALID_TO],
  ])('rejects overlap when %s', async (_caseName, newFrom, newTo, existingFrom, existingTo) => {
    await insertFare({ validFrom: existingFrom, validTo: existingTo });
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ validFrom: newFrom, validTo: newTo }))
      .expect(409);

    expect(response.body.error).toBe('FARE_PRICE_OVERLAP');
    expect(await context.prisma.bangGia.count({
      where: { tuyenXeId: context.routeId, loaiXeId: context.vehicleTypeId },
    })).toBe(1);
  });

  it('allows adjacent active intervals and ignores overlapping suspended rows', async () => {
    await insertFare({ status: 'TAM_NGUNG' });
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ validFrom: '2099-10-01', validTo: '2099-10-31' }))
      .expect(201);

    expect(response.body.data.status).toBe('HOAT_DONG');
    expect(await context.prisma.bangGia.count({
      where: { tuyenXeId: context.routeId, loaiXeId: context.vehicleTypeId },
    })).toBe(2);
  });

  it('allows adjacent active intervals with no shared boundary date', async () => {
    await insertFare();
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ validFrom: '2099-10-01', validTo: '2099-10-31' }))
      .expect(201);

    expect(response.body.data.validFrom).toBe('2099-10-01');
    expect(await context.prisma.bangGia.count({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
    })).toBe(2);
  });

  it('allows a bounded active interval that ends before an existing open-ended interval starts', async () => {
    await insertFare({ validFrom: '2099-09-15', validTo: null });
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ validFrom: '2099-08-01', validTo: '2099-09-14' }))
      .expect(201);

    expect(response.body.data.validTo).toBe('2099-09-14');
  });

  it('allows a suspended create to overlap an active interval', async () => {
    await insertFare();
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/fare-prices')
      .send(body({ status: 'TAM_NGUNG' }))
      .expect(201);

    expect(response.body.data.status).toBe('TAM_NGUNG');
    expect(await context.prisma.bangGia.count({
      where: { tuyenXeId: context.routeId, loaiXeId: context.vehicleTypeId },
    })).toBe(2);
  });

  it('scopes overlap checks to the same route and vehicle type', async () => {
    await insertFare();
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const otherRoute = await context.prisma.tuyenXe.create({
      data: {
        maTuyenXe: `T04-ALT-${suffix}`,
        diemDi: 'Điểm thử khác',
        diemDen: 'Điểm đích khác',
        trangThai: 'HOAT_DONG',
        nhaXeId: context.busCompanyId,
      },
      select: { tuyenXeId: true },
    });

    try {
      const response = await request(context.app.getHttpServer())
        .post('/api/v1/fare-prices')
        .send(body({ routeId: otherRoute.tuyenXeId }))
        .expect(201);
      expect(response.body.data.route.routeId).toBe(otherRoute.tuyenXeId);
    } finally {
      await context.prisma.bangGia.deleteMany({
        where: { tuyenXeId: otherRoute.tuyenXeId },
      });
      await context.prisma.tuyenXe.delete({
        where: { tuyenXeId: otherRoute.tuyenXeId },
      });
    }

    const otherType = await context.prisma.loaiXe.create({
      data: { nhaXeId: context.busCompanyId, tenLoai: `Test Fare Other Type ${suffix}` },
      select: { loaiXeId: true },
    });

    try {
      const response = await request(context.app.getHttpServer())
        .post('/api/v1/fare-prices')
        .send(body({ vehicleTypeId: otherType.loaiXeId }))
        .expect(201);
      expect(response.body.data.vehicleType.vehicleTypeId).toBe(otherType.loaiXeId);
    } finally {
      await context.prisma.bangGia.deleteMany({
        where: { loaiXeId: otherType.loaiXeId },
      });
      await context.prisma.loaiXe.delete({
        where: { loaiXeId: otherType.loaiXeId },
      });
    }
  });

  it('rejects a route and vehicle type owned by different bus companies', async () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const otherCompany = await context.prisma.nhaXe.create({
      data: {
        maNhaXe: `T04-X-${suffix}`,
        tenNhaXe: `Test Fare Tenant ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    const otherType = await context.prisma.loaiXe.create({
      data: {
        nhaXeId: otherCompany.nhaXeId,
        tenLoai: `Test Fare Tenant Type ${suffix}`,
      },
      select: { loaiXeId: true },
    });

    try {
      const response = await request(context.app.getHttpServer())
        .post('/api/v1/fare-prices')
        .send(body({ vehicleTypeId: otherType.loaiXeId }))
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'FARE_PRICE_TENANT_MISMATCH',
        message: 'Tuyến xe và loại xe phải thuộc cùng một nhà xe.',
      });
    } finally {
      await context.prisma.loaiXe.delete({ where: { loaiXeId: otherType.loaiXeId } });
      await context.prisma.nhaXe.delete({ where: { nhaXeId: otherCompany.nhaXeId } });
    }
  });
});
