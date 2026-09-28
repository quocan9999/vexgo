import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import {
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../../../src/common/time/business-date.js';
import {
  createFarePriceTestContext,
  type FarePriceTestContext,
} from './fare-price-test-context.js';

const VALID_FROM = '2099-09-01';
const VALID_TO = '2099-09-30';

describe('Fare Price target-state status HTTP and database behavior', () => {
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
  } = {}) {
    return context.prisma.bangGia.create({
      data: {
        giaNiemYet: new Prisma.Decimal(options.listedPrice ?? 250000),
        tuNgay: new Date(`${options.validFrom ?? VALID_FROM}T00:00:00.000Z`),
        denNgay: options.validTo === null
          ? null
          : new Date(`${options.validTo ?? VALID_TO}T00:00:00.000Z`),
        trangThai: options.status ?? 'TAM_NGUNG',
        nhaXeId: context.busCompanyId,
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
      },
    });
  }

  function setStatus(id: number, status: unknown) {
    return request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${id}/status`)
      .send({ status });
  }

  it.each([
    ['HOAT_DONG', 'TAM_NGUNG', 'TAM_NGUNG'],
    ['TAM_NGUNG', 'HOAT_DONG', 'CHUA_HIEU_LUC'],
  ] as const)('changes target status from %s to %s without changing price/date identity', async (initial, target, state) => {
    const current = await insertFare({ status: initial });
    const response = await setStatus(current.bangGiaId, target).expect(200);

    expect(response.body.data).toMatchObject({
      farePriceId: current.bangGiaId,
      listedPrice: 250000,
      validFrom: VALID_FROM,
      validTo: VALID_TO,
      status: target,
      effectiveState: state,
      route: { routeId: context.routeId },
      vehicleType: { vehicleTypeId: context.vehicleTypeId },
    });
    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: current.bangGiaId },
    });
    expect(saved.giaNiemYet.toString()).toBe('250000');
    expect(saved.tuNgay.toISOString().slice(0, 10)).toBe(VALID_FROM);
    expect(saved.denNgay?.toISOString().slice(0, 10)).toBe(VALID_TO);
  });

  it.each(['HOAT_DONG', 'TAM_NGUNG'] as const)(
    'treats a same-state target %s as an idempotent no-op',
    async (status) => {
      const current = await insertFare({ status });
      const response = await setStatus(current.bangGiaId, status).expect(200);

      expect(response.body.data).toMatchObject({
        farePriceId: current.bangGiaId,
        status,
        listedPrice: 250000,
        validFrom: VALID_FROM,
        validTo: VALID_TO,
      });
      const saved = await context.prisma.bangGia.findUniqueOrThrow({
        where: { bangGiaId: current.bangGiaId },
      });
      expect(saved.updatedAt.getTime()).toBe(current.updatedAt.getTime());
    },
  );

  it('returns 200 for same-state active requests even if another overlapping active row exists', async () => {
    const current = await insertFare({ status: 'HOAT_DONG' });
    await insertFare({ status: 'HOAT_DONG', listedPrice: 300000 });

    const response = await setStatus(current.bangGiaId, 'HOAT_DONG').expect(200);
    expect(response.body.data.status).toBe('HOAT_DONG');
    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: current.bangGiaId },
    });
    expect(saved.updatedAt.getTime()).toBe(current.updatedAt.getTime());
  });

  it.each([
    ['0', 400, 'VALIDATION_ERROR'],
    ['-1', 400, 'VALIDATION_ERROR'],
    ['abc', 400, 'VALIDATION_ERROR'],
    ['1e3', 400, 'VALIDATION_ERROR'],
    ['2147483648', 400, 'VALIDATION_ERROR'],
    ['2147483647', 404, 'FARE_PRICE_NOT_FOUND'],
  ])('validates target status path ID %s', async (id, statusCode, errorCode) => {
    const response = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${id}/status`)
      .send({ status: 'TAM_NGUNG' })
      .expect(statusCode);
    expect(response.body.error).toBe(errorCode);
  });

  it.each([
    {},
    { status: null },
    { status: '' },
    { status: 'ACTIVE' },
    { status: 'HET_HIEU_LUC' },
    { status: 'CHUA_HIEU_LUC' },
    { status: 'DANG_HIEU_LUC' },
    { status: 'DANG_AP_DUNG' },
    { status: 'HOAT_DONG', listedPrice: 300000 },
  ])('rejects malformed target status body %j', async (body) => {
    const current = await insertFare();
    const response = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}/status`)
      .send(body)
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: current.bangGiaId },
    });
    expect(saved.trangThai).toBe('TAM_NGUNG');
  });

  it.each([
    ['touches the active end date', VALID_FROM, VALID_TO, '2099-09-30', '2099-10-31'],
    ['overlaps an open-ended active interval', VALID_FROM, null, '2099-10-01', '2099-10-31'],
  ])('rejects activation when it %s', async (_name, otherFrom, otherTo, targetFrom, targetTo) => {
    await insertFare({ validFrom: otherFrom, validTo: otherTo, status: 'HOAT_DONG' });
    const target = await insertFare({ validFrom: targetFrom, validTo: targetTo, status: 'TAM_NGUNG' });

    const response = await setStatus(target.bangGiaId, 'HOAT_DONG').expect(409);
    expect(response.body).toEqual({
      statusCode: 409,
      error: 'FARE_PRICE_OVERLAP',
      message: 'Không thể kích hoạt vì khoảng hiệu lực bị trùng với một bảng giá đang hoạt động.',
    });
    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: target.bangGiaId },
    });
    expect(saved.trangThai).toBe('TAM_NGUNG');
  });

  it('allows an adjacent activation and ignores another suspended fare', async () => {
    await insertFare({ status: 'HOAT_DONG' });
    await insertFare({ status: 'TAM_NGUNG', listedPrice: 300000 });
    const target = await insertFare({
      status: 'TAM_NGUNG',
      validFrom: '2099-10-01',
      validTo: '2099-10-31',
    });

    const response = await setStatus(target.bangGiaId, 'HOAT_DONG').expect(200);
    expect(response.body.data).toMatchObject({
      status: 'HOAT_DONG',
      effectiveState: 'CHUA_HIEU_LUC',
    });
  });

  it.each([
    ['upcoming', '2099-09-01', '2099-09-30', 'CHUA_HIEU_LUC'],
    ['expired', '2000-09-01', '2000-09-30', 'HET_HIEU_LUC'],
  ])('allows an inactive %s fare to activate without shifting its dates', async (_name, validFrom, validTo, effectiveState) => {
    const target = await insertFare({ status: 'TAM_NGUNG', validFrom, validTo });
    const response = await setStatus(target.bangGiaId, 'HOAT_DONG').expect(200);

    expect(response.body.data).toMatchObject({
      status: 'HOAT_DONG',
      effectiveState,
      validFrom,
      validTo,
    });
  });

  it('allows an inactive fare within the current business date range to activate', async () => {
    const config = context.app.get(ConfigService);
    const businessDate = getBusinessDate(
      resolveBusinessTimeZone(config.get<string>('BUSINESS_TIME_ZONE')),
    );
    const businessYear = businessDate.slice(0, 4);
    const validFrom = `${businessYear}-01-01`;
    const validTo = `${businessYear}-12-31`;
    const target = await insertFare({
      status: 'TAM_NGUNG',
      validFrom,
      validTo,
    });

    const response = await setStatus(target.bangGiaId, 'HOAT_DONG').expect(200);
    expect(response.body.data).toMatchObject({
      status: 'HOAT_DONG',
      effectiveState: 'DANG_HIEU_LUC',
      validFrom,
      validTo,
    });
  });

  it('deactivates a fare without checking or changing other overlapping business fields', async () => {
    const target = await insertFare({ status: 'HOAT_DONG' });
    await insertFare({ status: 'HOAT_DONG', listedPrice: 300000 });

    const response = await setStatus(target.bangGiaId, 'TAM_NGUNG').expect(200);
    expect(response.body.data).toMatchObject({
      status: 'TAM_NGUNG',
      effectiveState: 'TAM_NGUNG',
      listedPrice: 250000,
      validFrom: VALID_FROM,
      validTo: VALID_TO,
    });
  });
});
