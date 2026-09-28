import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import {
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../../../src/common/time/business-date.js';
import {
  createFarePriceTestContext,
  type FarePriceTestContext,
} from './fare-price-test-context.js';

const ENDPOINT = '/api/v1/fare-prices/applicable';

describe('Applicable Fare resolution HTTP contract with MySQL', () => {
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

  async function insertFare(options: {
    validFrom?: string;
    validTo?: string | null;
    status?: 'HOAT_DONG' | 'TAM_NGUNG';
    listedPrice?: number;
    routeId?: number;
    vehicleTypeId?: number;
  } = {}) {
    const validFrom = options.validFrom ?? '2026-09-01';
    const validTo = options.validTo === undefined ? '2026-09-30' : options.validTo;
    return context.prisma.bangGia.create({
      data: {
        giaNiemYet: new Prisma.Decimal(options.listedPrice ?? 250000),
        tuNgay: new Date(`${validFrom}T00:00:00.000Z`),
        denNgay: validTo === null ? null : new Date(`${validTo}T00:00:00.000Z`),
        trangThai: options.status ?? 'HOAT_DONG',
        tuyenXeId: options.routeId ?? context.routeId,
        loaiXeId: options.vehicleTypeId ?? context.vehicleTypeId,
      },
    });
  }

  function applicableFareQuery(
    date: string,
    routeId = context.routeId,
    vehicleTypeId = context.vehicleTypeId,
  ) {
    return request(context.app.getHttpServer())
      .get(ENDPOINT)
      .query({ routeId, vehicleTypeId, date });
  }

  async function expectNoApplicableFare(date: string) {
    const response = await applicableFareQuery(date).expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      error: 'APPLICABLE_FARE_NOT_FOUND',
      message: 'Không có bảng giá áp dụng cho tuyến, loại xe và ngày đã chọn.',
    });
    return response;
  }

  it('returns the requested fare with a purpose-specific contract and no current-date state', async () => {
    const fare = await insertFare();
    const before = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: fare.bangGiaId },
    });

    const response = await applicableFareQuery('2026-09-15').expect(200);

    expect(response.body).toEqual({
      data: {
        farePriceId: fare.bangGiaId,
        routeId: context.routeId,
        vehicleTypeId: context.vehicleTypeId,
        listedPrice: 250000,
        currency: 'VND',
        validFrom: '2026-09-01',
        validTo: '2026-09-30',
        applicableOn: '2026-09-15',
      },
    });

    const after = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: fare.bangGiaId },
    });
    expect(after.trangThai).toBe(before.trangThai);
    expect(after.giaNiemYet.toString()).toBe(before.giaNiemYet.toString());
    expect(after.tuNgay.getTime()).toBe(before.tuNgay.getTime());
    expect(after.denNgay?.getTime()).toBe(before.denNgay?.getTime());
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it.each([
    ['validFrom boundary', '2026-09-01'],
    ['inside the interval', '2026-09-15'],
    ['validTo boundary', '2026-09-30'],
  ])('matches an active fare on the %s', async (_label, date) => {
    const fare = await insertFare();
    const response = await applicableFareQuery(date).expect(200);

    expect(response.body.data).toMatchObject({
      farePriceId: fare.bangGiaId,
      applicableOn: date,
    });
  });

  it('does not match a date before validFrom or after validTo', async () => {
    await insertFare();

    await expectNoApplicableFare('2026-08-31');
    await expectNoApplicableFare('2026-10-01');
  });

  it('treats a null validTo as open-ended while keeping validFrom inclusive', async () => {
    const fare = await insertFare({ validTo: null });

    await expectNoApplicableFare('2026-08-31');
    const start = await applicableFareQuery('2026-09-01').expect(200);
    const later = await applicableFareQuery('2098-05-20').expect(200);

    expect(start.body.data).toMatchObject({ farePriceId: fare.bangGiaId });
    expect(later.body.data).toMatchObject({
      farePriceId: fare.bangGiaId,
      validTo: null,
      applicableOn: '2098-05-20',
    });
  });

  it('does not resolve a suspended fare even when its interval contains the requested date', async () => {
    await insertFare({ status: 'TAM_NGUNG' });

    await expectNoApplicableFare('2026-09-15');
  });

  it('matches only the exact route and vehicle type pair', async () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const otherRoute = await context.prisma.tuyenXe.create({
      data: {
        maTuyenXe: `T04-${suffix}`,
        diemDi: 'Điểm thử khác',
        diemDen: 'Điểm đích khác',
        trangThai: 'HOAT_DONG',
        nhaXeId: context.busCompanyId,
      },
      select: { tuyenXeId: true },
    });
    const otherVehicleType = await context.prisma.loaiXe.create({
      data: { tenLoai: `Test Fare Type ${suffix}` },
      select: { loaiXeId: true },
    });

    try {
      await insertFare();

      const otherRouteResponse = await applicableFareQuery(
        '2026-09-15',
        otherRoute.tuyenXeId,
        context.vehicleTypeId,
      ).expect(404);
      const otherTypeResponse = await applicableFareQuery(
        '2026-09-15',
        context.routeId,
        otherVehicleType.loaiXeId,
      ).expect(404);

      expect(otherRouteResponse.body.error).toBe('APPLICABLE_FARE_NOT_FOUND');
      expect(otherTypeResponse.body.error).toBe('APPLICABLE_FARE_NOT_FOUND');
    } finally {
      await context.prisma.tuyenXe.delete({
        where: { tuyenXeId: otherRoute.tuyenXeId },
      });
      await context.prisma.loaiXe.delete({
        where: { loaiXeId: otherVehicleType.loaiXeId },
      });
    }
  });

  it('resolves the requested date rather than the current business date', async () => {
    const config = context.app.get(ConfigService);
    const businessDate = getBusinessDate(
      resolveBusinessTimeZone(config.get<string>('BUSINESS_TIME_ZONE')),
    );
    const requestedYear = Number(businessDate.slice(0, 4)) + 1;
    const validFrom = `${requestedYear}-12-01`;
    const validTo = `${requestedYear}-12-31`;
    const requestedDate = `${requestedYear}-12-15`;
    const fare = await insertFare({ validFrom, validTo });

    const response = await applicableFareQuery(requestedDate).expect(200);

    expect(response.body.data).toMatchObject({
      farePriceId: fare.bangGiaId,
      validFrom,
      validTo,
      applicableOn: requestedDate,
    });
  });

  it('returns APPLICABLE_FARE_NOT_FOUND when valid relations have no matching fare', async () => {
    await expectNoApplicableFare('2026-09-15');
  });

  it('returns ROUTE_NOT_FOUND when routeId does not exist', async () => {
    const response = await applicableFareQuery('2026-09-15', 2_147_483_647).expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'ROUTE_NOT_FOUND',
      message: 'Không tìm thấy tuyến xe.',
    });
  });

  it('returns VEHICLE_TYPE_NOT_FOUND when vehicleTypeId does not exist', async () => {
    const response = await applicableFareQuery(
      '2026-09-15',
      context.routeId,
      2_147_483_647,
    ).expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
  });

  it.each(['0', '-1', '1.5', 'abc', '1e3', '2147483648'])(
    'rejects invalid routeId %s',
    async (routeId) => {
      const response = await request(context.app.getHttpServer())
        .get(ENDPOINT)
        .query({ routeId, vehicleTypeId: context.vehicleTypeId, date: '2026-09-15' })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'routeId' })]),
      );
    },
  );

  it.each(['0', '-1', '2.5', 'abc', '1e3', '2147483648'])(
    'rejects invalid vehicleTypeId %s',
    async (vehicleTypeId) => {
      const response = await request(context.app.getHttpServer())
        .get(ENDPOINT)
        .query({ routeId: context.routeId, vehicleTypeId, date: '2026-09-15' })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'vehicleTypeId' })]),
      );
    },
  );

  it.each([
    ['missing routeId', { vehicleTypeId: '2', date: '2026-09-15' }, 'routeId'],
    ['missing vehicleTypeId', { routeId: '3', date: '2026-09-15' }, 'vehicleTypeId'],
    ['missing date', { routeId: '3', vehicleTypeId: '2' }, 'date'],
    ['DD/MM/YYYY date', { routeId: '3', vehicleTypeId: '2', date: '15/09/2026' }, 'date'],
    ['timestamp date', { routeId: '3', vehicleTypeId: '2', date: '2026-09-15T00:00:00Z' }, 'date'],
    ['impossible calendar date', { routeId: '3', vehicleTypeId: '2', date: '2026-02-30' }, 'date'],
    ['arbitrary date', { routeId: '3', vehicleTypeId: '2', date: 'abc' }, 'date'],
    ['unknown status query', { routeId: '3', vehicleTypeId: '2', date: '2026-09-15', status: 'HOAT_DONG' }, 'status'],
    ['unknown price query', { routeId: '3', vehicleTypeId: '2', date: '2026-09-15', price: '1' }, 'price'],
    ['unknown busCompanyId query', { routeId: '3', vehicleTypeId: '2', date: '2026-09-15', busCompanyId: '1' }, 'busCompanyId'],
    ['unknown customerId query', { routeId: '3', vehicleTypeId: '2', date: '2026-09-15', customerId: '1' }, 'customerId'],
    ['unknown tripId query', { routeId: '3', vehicleTypeId: '2', date: '2026-09-15', tripId: '1' }, 'tripId'],
  ] as const)('rejects %s', async (_label, query, field) => {
    const response = await request(context.app.getHttpServer())
      .get(ENDPOINT)
      .query(query)
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
  });

  it('returns a generic 500 and logs the conflicting ids when multiple fares match', async () => {
    const first = await insertFare();
    const second = await insertFare({
      validFrom: '2026-09-15',
      validTo: '2026-10-15',
      listedPrice: 300000,
    });
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    try {
      const response = await applicableFareQuery('2026-09-20').expect(500);

      expect(response.body).toEqual({
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Đã xảy ra lỗi hệ thống.',
      });
      expect(JSON.stringify(response.body)).not.toContain(String(first.bangGiaId));
      expect(JSON.stringify(response.body)).not.toContain(String(second.bangGiaId));

      const logOutput = errorLog.mock.calls.flat().map(String).join('\n');
      expect(logOutput).toContain('FARE_PRICE_INVARIANT_VIOLATION');
      expect(logOutput).toContain(`routeId=${context.routeId}`);
      expect(logOutput).toContain(`vehicleTypeId=${context.vehicleTypeId}`);
      expect(logOutput).toContain('date=2026-09-20');
      expect(logOutput).toContain(
        `conflictingFareIds=${first.bangGiaId},${second.bangGiaId}`,
      );
    } finally {
      errorLog.mockRestore();
    }
  });
});
