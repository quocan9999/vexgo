import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createFarePriceTestContext,
  type FarePriceTestContext,
} from './fare-price-test-context.js';

describe('Fare Price concurrent create integrity with MySQL', () => {
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

  function body(validFrom: string, validTo: string, listedPrice: number) {
    return {
      routeId: context.routeId,
      vehicleTypeId: context.vehicleTypeId,
      listedPrice,
      validFrom,
      validTo,
      status: 'HOAT_DONG',
    };
  }

  it('allows only one of two concurrent overlapping active creates', async () => {
    const responses = await Promise.all([
      request(context.app.getHttpServer())
        .post('/api/v1/fare-prices')
        .send(body('2099-09-01', '2099-09-30', 250000)),
      request(context.app.getHttpServer())
        .post('/api/v1/fare-prices')
        .send(body('2099-09-15', '2099-10-15', 300000)),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409)?.body.error).toBe(
      'FARE_PRICE_OVERLAP',
    );
    const activeFares = await context.prisma.bangGia.findMany({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
    });
    expect(activeFares).toHaveLength(1);
  }, 30_000);

  it('retries serializable conflicts so concurrent adjacent creates can both succeed', async () => {
    const responses = await Promise.all([
      request(context.app.getHttpServer())
        .post('/api/v1/fare-prices')
        .send(body('2099-09-01', '2099-09-30', 250000)),
      request(context.app.getHttpServer())
        .post('/api/v1/fare-prices')
        .send(body('2099-10-01', '2099-10-31', 300000)),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 201]);
    const activeFares = await context.prisma.bangGia.findMany({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
      orderBy: { tuNgay: 'asc' },
    });
    expect(activeFares).toHaveLength(2);
    expect(activeFares.map((fare) => fare.tuNgay.toISOString().slice(0, 10))).toEqual([
      '2099-09-01',
      '2099-10-01',
    ]);
  }, 30_000);
});
