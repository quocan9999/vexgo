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

type FareOptions = {
  listedPrice?: number;
  validFrom?: string;
  validTo?: string | null;
  status?: 'HOAT_DONG' | 'TAM_NGUNG';
};

describe('Fare Price update HTTP and database behavior', () => {
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

  async function insertFare(options: FareOptions = {}) {
    return context.prisma.bangGia.create({
      data: {
        giaNiemYet: new Prisma.Decimal(options.listedPrice ?? 250000),
        tuNgay: new Date(`${options.validFrom ?? VALID_FROM}T00:00:00.000Z`),
        denNgay: options.validTo === null
          ? null
          : new Date(`${options.validTo ?? VALID_TO}T00:00:00.000Z`),
        trangThai: options.status ?? 'HOAT_DONG',
        tuyenXeId: context.routeId,
        loaiXeId: context.vehicleTypeId,
      },
    });
  }

  it('updates one field, preserves omitted values, and returns the 04.1 detail contract', async () => {
    const current = await insertFare();
    const response = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send({ listedPrice: 280000 })
      .expect(200);

    expect(response.body.data).toMatchObject({
      farePriceId: current.bangGiaId,
      listedPrice: 280000,
      currency: 'VND',
      validFrom: VALID_FROM,
      validTo: VALID_TO,
      status: 'HOAT_DONG',
      effectiveState: 'CHUA_HIEU_LUC',
      route: { routeId: context.routeId },
      vehicleType: { vehicleTypeId: context.vehicleTypeId },
      createdAt: current.createdAt.toISOString(),
    });
    expect(response.body.data).not.toHaveProperty('bangGiaId');

    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: current.bangGiaId },
    });
    expect(saved.giaNiemYet.toString()).toBe('280000');
    expect(saved.tuNgay.toISOString().slice(0, 10)).toBe(VALID_FROM);
    expect(saved.denNgay?.toISOString().slice(0, 10)).toBe(VALID_TO);

    const detail = await request(context.app.getHttpServer())
      .get(`/api/v1/fare-prices/${current.bangGiaId}`)
      .expect(200);
    expect(detail.body.data).toEqual(response.body.data);
  });

  it('updates only validFrom while retaining the current end date and price', async () => {
    const current = await insertFare();
    const response = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send({ validFrom: '2099-09-10' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      listedPrice: 250000,
      validFrom: '2099-09-10',
      validTo: VALID_TO,
    });
  });

  it('uses explicit null to make validTo open-ended and keeps omitted validTo unchanged', async () => {
    const current = await insertFare();
    const opened = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send({ validTo: null })
      .expect(200);
    expect(opened.body.data.validTo).toBeNull();

    await context.clearFares();
    const bounded = await insertFare({ validTo: '2099-10-31' });
    const priceOnly = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${bounded.bangGiaId}`)
      .send({ listedPrice: 260000 })
      .expect(200);
    expect(priceOnly.body.data.validTo).toBe('2099-10-31');
  });

  it('accepts same-value updates and inclusive one-day intervals', async () => {
    const current = await insertFare({ validFrom: VALID_FROM, validTo: VALID_FROM });
    const response = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send({ listedPrice: 250000 })
      .expect(200);

    expect(response.body.data).toMatchObject({
      listedPrice: 250000,
      validFrom: VALID_FROM,
      validTo: VALID_FROM,
    });
  });

  it.each([
    ['empty body', {}],
    ['immutable routeId', { routeId: 99 }],
    ['immutable vehicleTypeId', { vehicleTypeId: 99 }],
    ['immutable status', { status: 'TAM_NGUNG' }],
    ['derived state', { effectiveState: 'HET_HIEU_LUC' }],
    ['unknown field', { unexpected: true }],
    ['valid field mixed with immutable status', { listedPrice: 280000, status: 'HOAT_DONG' }],
    ['zero listed price', { listedPrice: 0 }],
    ['negative listed price', { listedPrice: -1000 }],
    ['fractional listed price', { listedPrice: 250000.5 }],
    ['string listed price', { listedPrice: '250000' }],
    ['null listed price', { listedPrice: null }],
    ['invalid validFrom', { validFrom: '2099-02-30' }],
    ['timestamp validFrom', { validFrom: '2099-09-01T00:00:00Z' }],
    ['invalid validTo', { validTo: '2099-02-30' }],
    ['timestamp validTo', { validTo: '2099-09-30T00:00:00Z' }],
    ['validTo before validFrom', { validFrom: '2099-09-10', validTo: '2099-09-09' }],
  ])('rejects PATCH with %s without changing the row', async (_name, body) => {
    const current = await insertFare();
    const response = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send(body)
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: current.bangGiaId },
    });
    expect(saved.giaNiemYet.toString()).toBe('250000');
    expect(saved.tuNgay.toISOString().slice(0, 10)).toBe(VALID_FROM);
    expect(saved.denNgay?.toISOString().slice(0, 10)).toBe(VALID_TO);
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10', '1.5', '2147483648'])(
    'rejects invalid PATCH path ID %s', async (id) => {
      const response = await request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${id}`)
        .send({ listedPrice: 260000 })
        .expect(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    },
  );

  it('returns FARE_PRICE_NOT_FOUND for a missing record', async () => {
    const response = await request(context.app.getHttpServer())
      .patch('/api/v1/fare-prices/2147483647')
      .send({ listedPrice: 260000 })
      .expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      error: 'FARE_PRICE_NOT_FOUND',
      message: 'Không tìm thấy bảng giá.',
    });
  });

  it('validates the merged candidate before writing', async () => {
    const current = await insertFare();
    const laterStart = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send({ validFrom: '2099-10-01' })
      .expect(400);
    expect(laterStart.body.error).toBe('VALIDATION_ERROR');

    const earlierEnd = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send({ validTo: '2099-08-31' })
      .expect(400);
    expect(earlierEnd.body.error).toBe('VALIDATION_ERROR');

    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: current.bangGiaId },
    });
    expect(saved.tuNgay.toISOString().slice(0, 10)).toBe(VALID_FROM);
    expect(saved.denNgay?.toISOString().slice(0, 10)).toBe(VALID_TO);
  });

  it('does not commit a date change when the persisted price cannot be represented as integer VND', async () => {
    const current = await insertFare({ listedPrice: 250000.5 });
    const response = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send({ validFrom: '2099-09-10' })
      .expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Đã xảy ra lỗi hệ thống.',
    });
    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: current.bangGiaId },
    });
    expect(saved.giaNiemYet.toNumber()).toBe(250000.5);
    expect(saved.tuNgay.toISOString().slice(0, 10)).toBe(VALID_FROM);
  });

  it('excludes itself during active updates but rejects a boundary overlap with another active fare', async () => {
    const current = await insertFare();
    const other = await insertFare({
      validFrom: '2099-10-01',
      validTo: '2099-10-31',
      listedPrice: 300000,
    });

    const selfUpdate = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send({ listedPrice: 275000 })
      .expect(200);
    expect(selfUpdate.body.data.listedPrice).toBe(275000);

    const conflict = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send({ validTo: '2099-10-01' })
      .expect(409);
    expect(conflict.body).toEqual({
      statusCode: 409,
      error: 'FARE_PRICE_OVERLAP',
      message: 'Khoảng hiệu lực bị trùng với một bảng giá đang hoạt động.',
    });

    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: current.bangGiaId },
    });
    expect(saved.denNgay?.toISOString().slice(0, 10)).toBe(VALID_TO);
    expect(other.bangGiaId).not.toBe(current.bangGiaId);
  });

  it('rejects making an active interval open-ended when another active interval follows it', async () => {
    const current = await insertFare();
    await insertFare({
      validFrom: '2099-10-01',
      validTo: '2099-10-31',
      listedPrice: 300000,
    });

    const response = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
      .send({ validTo: null })
      .expect(409);

    expect(response.body.error).toBe('FARE_PRICE_OVERLAP');
    const saved = await context.prisma.bangGia.findUniqueOrThrow({
      where: { bangGiaId: current.bangGiaId },
    });
    expect(saved.denNgay?.toISOString().slice(0, 10)).toBe(VALID_TO);
  });

  it('allows an inactive record to retain an overlapping interval with an active fare', async () => {
    const inactive = await insertFare({ status: 'TAM_NGUNG' });
    await insertFare({ status: 'HOAT_DONG', listedPrice: 300000 });

    const response = await request(context.app.getHttpServer())
      .patch(`/api/v1/fare-prices/${inactive.bangGiaId}`)
      .send({ listedPrice: 260000 })
      .expect(200);

    expect(response.body.data).toMatchObject({
      status: 'TAM_NGUNG',
      listedPrice: 260000,
      validFrom: VALID_FROM,
      validTo: VALID_TO,
    });
  });

  it('preserves a referenced ticket snapshot when price, date, and status change', async () => {
    const current = await insertFare();
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const ticketGraph = await context.prisma.$transaction(async (transaction) => {
      const vehicle = await transaction.xe.create({
        data: {
          bienSoXe: `T04-${suffix}`,
          trangThai: 'HOAT_DONG',
          nhaXeId: context.busCompanyId,
          loaiXeId: context.vehicleTypeId,
        },
        select: { xeId: true },
      });
      const seat = await transaction.ghe.create({
        data: { soGhe: 'T1', viTri: 'A1', xeId: vehicle.xeId },
        select: { gheId: true },
      });
      const trip = await transaction.chuyenXe.create({
        data: {
          maChuyenXe: `T04-${suffix}`,
          ngayKhoiHanh: new Date('2099-09-01T00:00:00.000Z'),
          gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
          trangThai: 'CHUA_KHOI_HANH',
          tuyenXeId: context.routeId,
          xeId: vehicle.xeId,
        },
        select: { chuyenXeId: true },
      });
      const tripSeat = await transaction.gheChuyenXe.create({
        data: {
          trangThai: 'TRONG',
          chuyenXeId: trip.chuyenXeId,
          gheId: seat.gheId,
        },
        select: { gheChuyenXeId: true },
      });
      const account = await transaction.taiKhoan.create({
        data: {
          hoTen: 'Fare Price Test Customer',
          soDienThoai: `099${suffix}`,
          matKhau: 'test-only',
          daXacThucSoDienThoai: false,
          trangThai: 'HOAT_DONG',
        },
        select: { taiKhoanId: true },
      });
      const customer = await transaction.khachHang.create({
        data: {
          maKhachHang: `T04-${suffix}`,
          taiKhoanId: account.taiKhoanId,
        },
        select: { khachHangId: true },
      });
      const transactionRecord = await transaction.donGiaoDich.create({
        data: {
          maDonGiaoDich: `T04-${suffix}`,
          ngayTao: new Date('2099-08-01T00:00:00.000Z'),
          tongTien: new Prisma.Decimal(230000),
          trangThai: 'THANH_CONG',
          tenKhachHang: 'Fare Price Test Customer',
          soDienThoaiKhachHang: `099${suffix}`,
          khachHangId: customer.khachHangId,
          nhaXeId: context.busCompanyId,
        },
        select: { donGiaoDichId: true },
      });
      const booking = await transaction.phieuDatVe.create({
        data: {
          maPhieuDatVe: `T04-${suffix}`,
          ngayDat: new Date('2099-08-01T00:00:00.000Z'),
          soLuongVeBanDau: 1,
          tongTienBanDau: new Prisma.Decimal(230000),
          trangThai: 'DA_DAT',
          donGiaoDichId: transactionRecord.donGiaoDichId,
        },
        select: { phieuDatVeId: true },
      });
      const ticket = await transaction.ve.create({
        data: {
          maVe: `T04-${suffix}`,
          diemDon: 'Điểm thử',
          giaNiemYet: new Prisma.Decimal(250000),
          giaThucTe: new Prisma.Decimal(230000),
          trangThai: 'DA_DAT',
          phieuDatVeId: booking.phieuDatVeId,
          gheChuyenXeId: tripSeat.gheChuyenXeId,
          bangGiaApDungId: current.bangGiaId,
        },
        select: { veId: true },
      });

      return {
        vehicleId: vehicle.xeId,
        seatId: seat.gheId,
        tripId: trip.chuyenXeId,
        tripSeatId: tripSeat.gheChuyenXeId,
        accountId: account.taiKhoanId,
        customerId: customer.khachHangId,
        transactionId: transactionRecord.donGiaoDichId,
        bookingId: booking.phieuDatVeId,
        ticketId: ticket.veId,
      };
    });

    async function expectTicketSnapshotUnchanged() {
      const ticket = await context.prisma.ve.findUniqueOrThrow({
        where: { veId: ticketGraph.ticketId },
      });
      expect(ticket.giaNiemYet.toString()).toBe('250000');
      expect(ticket.giaThucTe.toString()).toBe('230000');
      expect(ticket.bangGiaApDungId).toBe(current.bangGiaId);
    }

    try {
      const response = await request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${current.bangGiaId}`)
        .send({ listedPrice: 300000, validFrom: '2099-09-02' })
        .expect(200);
      expect(response.body.data).toMatchObject({
        listedPrice: 300000,
        validFrom: '2099-09-02',
      });
      await expectTicketSnapshotUnchanged();

      const statusResponse = await request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${current.bangGiaId}/status`)
        .send({ status: 'TAM_NGUNG' })
        .expect(200);
      expect(statusResponse.body.data).toMatchObject({
        farePriceId: current.bangGiaId,
        listedPrice: 300000,
        validFrom: '2099-09-02',
        status: 'TAM_NGUNG',
        effectiveState: 'TAM_NGUNG',
      });
      await expectTicketSnapshotUnchanged();

      const activationResponse = await request(context.app.getHttpServer())
        .patch(`/api/v1/fare-prices/${current.bangGiaId}/status`)
        .send({ status: 'HOAT_DONG' })
        .expect(200);
      expect(activationResponse.body.data).toMatchObject({
        farePriceId: current.bangGiaId,
        listedPrice: 300000,
        status: 'HOAT_DONG',
      });
      await expectTicketSnapshotUnchanged();
    } finally {
      await context.prisma.$transaction(async (transaction) => {
        await transaction.ve.delete({ where: { veId: ticketGraph.ticketId } });
        await transaction.phieuDatVe.delete({ where: { phieuDatVeId: ticketGraph.bookingId } });
        await transaction.donGiaoDich.delete({ where: { donGiaoDichId: ticketGraph.transactionId } });
        await transaction.khachHang.delete({ where: { khachHangId: ticketGraph.customerId } });
        await transaction.taiKhoan.delete({ where: { taiKhoanId: ticketGraph.accountId } });
        await transaction.gheChuyenXe.delete({ where: { gheChuyenXeId: ticketGraph.tripSeatId } });
        await transaction.chuyenXe.delete({ where: { chuyenXeId: ticketGraph.tripId } });
        await transaction.ghe.delete({ where: { gheId: ticketGraph.seatId } });
        await transaction.xe.delete({ where: { xeId: ticketGraph.vehicleId } });
      });
    }
  });
});
