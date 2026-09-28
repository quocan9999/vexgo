import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
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

  async function insertFare(validFrom: string, validTo: string, listedPrice: number) {
    return context.prisma.bangGia.create({
      data: {
        giaNiemYet: new Prisma.Decimal(listedPrice),
        tuNgay: new Date(`${validFrom}T00:00:00.000Z`),
        denNgay: new Date(`${validTo}T00:00:00.000Z`),
        trangThai: 'HOAT_DONG',
        nhaXeId: context.busCompanyId,
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
      },
    });
  }

  function expectNoActiveOverlap(
    fares: Array<{ tuNgay: Date; denNgay: Date | null }>,
  ) {
    for (let left = 0; left < fares.length; left += 1) {
      for (let right = left + 1; right < fares.length; right += 1) {
        const first = fares[left];
        const second = fares[right];
        const firstEndsAfterSecondStarts =
          first.denNgay === null || first.denNgay.getTime() >= second.tuNgay.getTime();
        const secondEndsAfterFirstStarts =
          second.denNgay === null || second.denNgay.getTime() >= first.tuNgay.getTime();
        expect(firstEndsAfterSecondStarts && secondEndsAfterFirstStarts).toBe(false);
      }
    }
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

  it('prevents two concurrent active updates from creating a shared boundary overlap', async () => {
    const first = await insertFare('2099-01-01', '2099-01-10', 250000);
    const second = await insertFare('2099-01-20', '2099-01-30', 300000);

    const responses = await Promise.all([
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${first.bangGiaId}`)
        .send({ validTo: '2099-01-15' }),
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${second.bangGiaId}`)
        .send({ validFrom: '2099-01-15' }),
    ]);

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(
      responses.find((response) => response.status === 409)?.body.error,
    ).toMatch(/^(FARE_PRICE_OVERLAP|FARE_PRICE_CONCURRENT_MODIFICATION)$/);

    const activeFares = await context.prisma.bangGia.findMany({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
      orderBy: { tuNgay: 'asc' },
    });
    expect(activeFares).toHaveLength(2);
    expectNoActiveOverlap(activeFares);
  }, 30_000);

  it('prevents a concurrent active update and create from committing an overlap', async () => {
    const existing = await insertFare('2099-02-01', '2099-02-10', 250000);

    const responses = await Promise.all([
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${existing.bangGiaId}`)
        .send({ validTo: '2099-02-15' }),
      request(context.app.getHttpServer())
        .post('/api/v1/fare-prices')
        .send(body('2099-02-15', '2099-02-28', 300000)),
    ]);

    expect(responses.filter((response) => response.status === 200 || response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(
      responses.find((response) => response.status === 409)?.body.error,
    ).toMatch(/^(FARE_PRICE_OVERLAP|FARE_PRICE_CONCURRENT_MODIFICATION)$/);

    const activeFares = await context.prisma.bangGia.findMany({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
      orderBy: { tuNgay: 'asc' },
    });
    expectNoActiveOverlap(activeFares);
  }, 30_000);

  it('prevents two concurrent updates from producing a shared inclusive boundary', async () => {
    const first = await insertFare('2099-03-01', '2099-03-10', 250000);
    const second = await insertFare('2099-03-20', '2099-03-30', 300000);

    const responses = await Promise.all([
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${first.bangGiaId}`)
        .send({ validTo: '2099-03-15' }),
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${second.bangGiaId}`)
        .send({ validFrom: '2099-03-15' }),
    ]);

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(
      responses.find((response) => response.status === 409)?.body.error,
    ).toMatch(/^(FARE_PRICE_OVERLAP|FARE_PRICE_CONCURRENT_MODIFICATION)$/);

    const activeFares = await context.prisma.bangGia.findMany({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
      orderBy: { tuNgay: 'asc' },
    });
    expect(activeFares).toHaveLength(2);
    expectNoActiveOverlap(activeFares);
  }, 30_000);

  it('prevents a concurrent create and update from producing a shared boundary', async () => {
    const existing = await insertFare('2099-04-01', '2099-04-10', 250000);

    const responses = await Promise.all([
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${existing.bangGiaId}`)
        .send({ validTo: '2099-04-15' }),
      request(context.app.getHttpServer())
        .post('/api/v1/fare-prices')
        .send(body('2099-04-15', '2099-04-30', 300000)),
    ]);

    expect(responses.filter((response) => response.status === 200 || response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(
      responses.find((response) => response.status === 409)?.body.error,
    ).toMatch(/^(FARE_PRICE_OVERLAP|FARE_PRICE_CONCURRENT_MODIFICATION)$/);

    const activeFares = await context.prisma.bangGia.findMany({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
      orderBy: { tuNgay: 'asc' },
    });
    expectNoActiveOverlap(activeFares);
  }, 30_000);

  it('allows only one of two concurrent overlapping activations', async () => {
    const first = await insertFare('2099-05-01', '2099-05-31', 250000);
    const second = await insertFare('2099-05-15', '2099-06-15', 300000);
    await context.prisma.bangGia.updateMany({
      where: { bangGiaId: { in: [first.bangGiaId, second.bangGiaId] } },
      data: { trangThai: 'TAM_NGUNG' },
    });

    const responses = await Promise.all([
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${first.bangGiaId}/status`)
        .send({ status: 'HOAT_DONG' }),
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${second.bangGiaId}/status`)
        .send({ status: 'HOAT_DONG' }),
    ]);

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(
      responses.find((response) => response.status === 409)?.body.error,
    ).toMatch(/^(FARE_PRICE_OVERLAP|FARE_PRICE_CONCURRENT_MODIFICATION)$/);

    const activeFares = await context.prisma.bangGia.findMany({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
    });
    expect(activeFares).toHaveLength(1);
    expectNoActiveOverlap(activeFares);
  }, 30_000);

  it('prevents concurrent activation and create from committing an overlap', async () => {
    const suspended = await insertFare('2099-06-01', '2099-06-30', 250000);
    await context.prisma.bangGia.update({
      where: { bangGiaId: suspended.bangGiaId },
      data: { trangThai: 'TAM_NGUNG' },
    });

    const responses = await Promise.all([
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${suspended.bangGiaId}/status`)
        .send({ status: 'HOAT_DONG' }),
      request(context.app.getHttpServer())
        .post('/api/v1/fare-prices')
        .send(body('2099-06-15', '2099-07-15', 300000)),
    ]);

    expect(responses.filter((response) => response.status === 200 || response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(
      responses.find((response) => response.status === 409)?.body.error,
    ).toMatch(/^(FARE_PRICE_OVERLAP|FARE_PRICE_CONCURRENT_MODIFICATION)$/);
    const activeFares = await context.prisma.bangGia.findMany({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
    });
    expectNoActiveOverlap(activeFares);
  }, 30_000);

  it('prevents activation and active interval update from committing an overlap', async () => {
    const suspended = await insertFare('2099-07-01', '2099-07-10', 250000);
    const active = await insertFare('2099-07-20', '2099-07-31', 300000);
    await context.prisma.bangGia.update({
      where: { bangGiaId: suspended.bangGiaId },
      data: { trangThai: 'TAM_NGUNG' },
    });

    const responses = await Promise.all([
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${suspended.bangGiaId}/status`)
        .send({ status: 'HOAT_DONG' }),
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${active.bangGiaId}`)
        .send({ validFrom: '2099-07-10' }),
    ]);

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(
      responses.find((response) => response.status === 409)?.body.error,
    ).toMatch(/^(FARE_PRICE_OVERLAP|FARE_PRICE_CONCURRENT_MODIFICATION)$/);
    const activeFares = await context.prisma.bangGia.findMany({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
      orderBy: { tuNgay: 'asc' },
    });
    expectNoActiveOverlap(activeFares);
  }, 30_000);

  it('prevents activation and editing the same suspended fare from bypassing overlap checks', async () => {
    const suspended = await insertFare('2099-08-01', '2099-08-10', 250000);
    await insertFare('2099-08-15', '2099-08-31', 300000);
    await context.prisma.bangGia.update({
      where: { bangGiaId: suspended.bangGiaId },
      data: { trangThai: 'TAM_NGUNG' },
    });

    const responses = await Promise.all([
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${suspended.bangGiaId}/status`)
        .send({ status: 'HOAT_DONG' }),
      request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${suspended.bangGiaId}`)
        .send({ validTo: '2099-08-15' }),
    ]);

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(
      responses.find((response) => response.status === 409)?.body.error,
    ).toMatch(/^(FARE_PRICE_OVERLAP|FARE_PRICE_CONCURRENT_MODIFICATION)$/);
    const activeFares = await context.prisma.bangGia.findMany({
      where: {
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
        trangThai: 'HOAT_DONG',
      },
      orderBy: { tuNgay: 'asc' },
    });
    expectNoActiveOverlap(activeFares);
  }, 30_000);
});
