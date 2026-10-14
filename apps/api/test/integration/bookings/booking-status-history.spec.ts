import { createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { SeatHoldsService } from '../../../src/seat-holds/seat-holds.service.js';
import type { MomoWebhookDto } from '../../../src/payments/dto/webhook.dto.js';

const UUID_V1_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildMomoPayload(paymentId: number, options: Partial<MomoWebhookDto> = {}) {
  const secret = 'vexgo_momo_demo_secret';
  const base: MomoWebhookDto = {
    partnerCode: 'MOMO',
    orderId: String(paymentId),
    requestId: `REQ-${paymentId}`,
    amount: 450000,
    orderInfo: `Thanh toan ve #${paymentId}`,
    orderType: 'momo_wallet',
    transId: 987654321,
    resultCode: 0,
    message: 'Thành công',
    payType: 'qr',
    responseTime: Date.now(),
    extraData: String(paymentId),
    accessKey: 'DEMO_ACCESS_KEY',
    ...options,
  };

  const raw = `accessKey=${base.accessKey ?? ''}&amount=${base.amount ?? ''}&extraData=${base.extraData ?? ''}&message=${base.message ?? ''}&orderId=${base.orderId ?? ''}&orderInfo=${base.orderInfo ?? ''}&orderType=${base.orderType ?? ''}&partnerCode=${base.partnerCode ?? ''}&payType=${base.payType ?? ''}&requestId=${base.requestId ?? ''}&responseTime=${base.responseTime ?? ''}&resultCode=${base.resultCode ?? ''}&transId=${base.transId ?? ''}`;
  const signature = createHmac('sha256', secret).update(raw).digest('hex');
  return { ...base, signature };
}

describe('Booking API & Ticket Status History Lifecycle with MySQL (Integration)', () => {
  const sepaySecret = 'booking-sepay-integration-secret';
  const originalSepaySecret = process.env.SEPAY_WEBHOOK_SECRET;
  let app: INestApplication;
  let prisma: PrismaService;
  let busCompanyId: number;
  let routeId: number;
  let vehicleTypeId: number;
  let vehicleId: number;
  let bangGiaId: number;
  let tripId: number;
  let tripSeatIds: number[] = [];
  let currentPrincipal: AuthPrincipal | null = null;

  let customerId: number;
  let customerPrincipal: AuthPrincipal;
  let customerPhone: string;

  beforeAll(async () => {
    process.env.PAYMENT_DEMO_MODE = 'true';
    process.env.SEPAY_WEBHOOK_SECRET = sepaySecret;

    const accessTokenGuard = {
      canActivate(context: ExecutionContext) {
        if (currentPrincipal) {
          context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
            currentPrincipal;
        }
        return true;
      },
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccessTokenGuard)
      .useValue(accessTokenGuard)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    configureApi(app);
    await app.init();

    prisma = app.get(PrismaService);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();

    // 1. Create company, route, vehicle type, vehicle with 3 seats
    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-BK-${suffix}`,
        tenNhaXe: `Booking Test Co ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    busCompanyId = company.nhaXeId;

    const route = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: `TX-BK-${suffix}`,
        diemDi: 'Sài Gòn',
        diemDen: 'Đà Lạt',
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
      },
      select: { tuyenXeId: true },
    });
    routeId = route.tuyenXeId;

    const vehicleType = await prisma.loaiXe.create({
      data: {
        nhaXeId: busCompanyId,
        tenLoai: `Luxury Limousine ${suffix}`,
      },
      select: { loaiXeId: true },
    });
    vehicleTypeId = vehicleType.loaiXeId;

    const vehicle = await prisma.xe.create({
      data: {
        bienSoXe: `49B-${suffix}`,
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
        loaiXeId: vehicleTypeId,
        ghes: {
          create: [
            { soGhe: 'A01', viTri: 'Tầng 1' },
            { soGhe: 'A02', viTri: 'Tầng 1' },
            { soGhe: 'A03', viTri: 'Tầng 1' },
          ],
        },
      },
      include: { ghes: true },
    });
    vehicleId = vehicle.xeId;

    // 2. Create fare pricing for route & vehicle type
    const fare = await prisma.bangGia.create({
      data: {
        nhaXeId: busCompanyId,
        tuyenXeId: routeId,
        loaiXeId: vehicleTypeId,
        giaNiemYet: 150000,
        tuNgay: new Date('2020-01-01T00:00:00.000Z'),
        trangThai: 'HOAT_DONG',
      },
    });
    bangGiaId = fare.bangGiaId;

    // 3. Create customer account
    const phoneSuffix = String(
      Number.parseInt(suffix.slice(0, 7), 16) % 10_000_000,
    ).padStart(7, '0');
    customerPhone = `096${phoneSuffix}`;
    const account = await prisma.taiKhoan.create({
      data: {
        soDienThoai: customerPhone,
        matKhau: '$2b$10$hashedpasswordforexampletest',
        hoTen: `Booking Customer ${suffix}`,
        trangThai: 'HOAT_DONG',
        daXacThucSoDienThoai: true,
        khachHang: {
          create: {
            maKhachHang: `KH-BK-${suffix}`,
          },
        },
      },
      include: { khachHang: true },
    });
    customerId = account.khachHang!.khachHangId;
    customerPrincipal = {
      taiKhoanId: account.taiKhoanId,
      sessionId: `sess-bk-${suffix}`,
      roles: ['CUSTOMER'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };
  }, 30_000);

  afterAll(async () => {
    try {
      if (tripId) {
        await prisma.lichSuTrangThaiVe.deleteMany({
          where: { ve: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } } },
        });
        await prisma.ve.deleteMany({
          where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
        });
        await prisma.lichSuTrangThaiPhieuDatVe.deleteMany({
          where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
        });
        await prisma.thanhToan.deleteMany({
          where: { donGiaoDich: { nhaXeId: busCompanyId } },
        });
        await prisma.phieuDatVe.deleteMany({
          where: { donGiaoDich: { nhaXeId: busCompanyId } },
        });
        await prisma.donGiaoDich.deleteMany({
          where: { nhaXeId: busCompanyId },
        });
        await prisma.gheChuyenXe.deleteMany({ where: { chuyenXeId: tripId } });
        await prisma.giuCho.deleteMany({ where: { chuyenXeId: tripId } });
        await prisma.chuyenXe.deleteMany({ where: { chuyenXeId: tripId } });
      }
      if (bangGiaId) {
        await prisma.bangGia.deleteMany({ where: { bangGiaId } });
      }
      if (vehicleId) {
        await prisma.ghe.deleteMany({ where: { xeId: vehicleId } });
        await prisma.xe.deleteMany({ where: { xeId: vehicleId } });
      }
      if (vehicleTypeId) {
        await prisma.loaiXe.deleteMany({ where: { loaiXeId: vehicleTypeId } });
      }
      if (routeId) {
        await prisma.tuyenXe.deleteMany({ where: { tuyenXeId: routeId } });
      }
      if (busCompanyId) {
        await prisma.nhaXe.deleteMany({ where: { nhaXeId: busCompanyId } });
      }

      if (customerId) {
        await prisma.khachHang.deleteMany({ where: { khachHangId: customerId } });
        await prisma.taiKhoan.deleteMany({ where: { taiKhoanId: customerPrincipal.taiKhoanId } });
      }
    } finally {
      delete process.env.PAYMENT_DEMO_MODE;
      if (originalSepaySecret === undefined) delete process.env.SEPAY_WEBHOOK_SECRET;
      else process.env.SEPAY_WEBHOOK_SECRET = originalSepaySecret;
      await app?.close();
    }
  }, 30_000);

  beforeEach(async () => {
    currentPrincipal = null;

    // Clean up bookings, tickets, and status histories for this bus company
    await prisma.lichSuTrangThaiVe.deleteMany({
      where: { ve: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } } },
    });
    await prisma.ve.deleteMany({
      where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
    });
    await prisma.lichSuTrangThaiPhieuDatVe.deleteMany({
      where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
    });
    await prisma.thanhToan.deleteMany({
      where: { donGiaoDich: { nhaXeId: busCompanyId } },
    });
    await prisma.phieuDatVe.deleteMany({
      where: { donGiaoDich: { nhaXeId: busCompanyId } },
    });
    await prisma.donGiaoDich.deleteMany({
      where: { nhaXeId: busCompanyId },
    });

    if (tripId) {
      await prisma.gheChuyenXe.deleteMany({ where: { chuyenXeId: tripId } });
      await prisma.giuCho.deleteMany({ where: { chuyenXeId: tripId } });
      await prisma.chuyenXe.deleteMany({ where: { chuyenXeId: tripId } });
    }

    // Create a new future trip with 3 seats
    const seats = await prisma.ghe.findMany({
      where: { xeId: vehicleId },
      orderBy: { soGhe: 'asc' },
    });
    const trip = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: `CX-BK-${randomUUID().slice(0, 6).toUpperCase()}`,
        ngayKhoiHanh: new Date('2099-12-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: busCompanyId,
        tuyenXeId: routeId,
        xeId: vehicleId,
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        gheChuyenXes: {
          create: seats.map((g) => ({
            gheId: g.gheId,
            trangThai: 'TRONG',
          })),
        },
      },
      include: {
        gheChuyenXes: {
          orderBy: { gheId: 'asc' },
        },
      },
    });
    tripId = trip.chuyenXeId;
    tripSeatIds = trip.gheChuyenXes.map((s) => s.gheChuyenXeId);
  });

  it.each(['guest', 'customer'])('creates a SePay attempt atomically and settles %s booking only via signed webhook', async (mode) => {
    currentPrincipal = mode === 'customer' ? customerPrincipal : null;
    const hold = await request(app.getHttpServer()).post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status).toBe(201);
    const bookingResponse = await request(app.getHttpServer()).post('/api/v1/bookings').send({
      tripId, seatIds: [tripSeatIds[0]], holdToken: hold.body.data.holdToken,
      contact: { fullName: 'SePay customer', phone: customerPhone },
      pickupPoint: 'Bến xe Miền Đông', dropoffPoint: 'Bến xe Đà Lạt',
    });
    expect(bookingResponse.status, JSON.stringify(bookingResponse.body)).toBe(201);
    const booking = bookingResponse.body.data;
    expect(booking.orderCode).toMatch(/^[A-Z0-9]{1,8}GD[A-F\d]{30}$/);
    const saved = await prisma.phieuDatVe.findUniqueOrThrow({
      where: { phieuDatVeId: booking.bookingId },
      include: { donGiaoDich: { include: { thanhToans: true } } },
    });
    expect(saved.donGiaoDich.khachHangId).toBe(mode === 'guest' ? null : customerId);
    expect(saved.trangThai).toBe('CHO_THANH_TOAN');
    expect(saved.donGiaoDich.trangThai).toBe('CHO_THANH_TOAN');
    expect(saved.donGiaoDich.thanhToans).toHaveLength(1);
    expect(saved.donGiaoDich.thanhToans[0]).toMatchObject({ phuongThuc: 'SEPAY', trangThai: 'DANG_XU_LY' });
    expect(Number(saved.donGiaoDich.thanhToans[0].soTien)).toBe(booking.totalAmount);

    const pendingDetailRequest = request(app.getHttpServer()).get(
      `/api/v1/bookings/${booking.bookingId}/detail`,
    );
    if (mode === 'guest') {
      pendingDetailRequest
        .set('x-booking-code', booking.bookingCode)
        .set('x-booking-phone', customerPhone);
    }
    const pendingDetail = await pendingDetailRequest;
    expect(pendingDetail.status).toBe(200);
    expect(pendingDetail.body.data).toMatchObject({
      status: 'CHO_THANH_TOAN',
      paymentStatus: 'CHO_THANH_TOAN',
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const eventId = Date.now();
    const body = JSON.stringify({ id: eventId, code: 'TRUNCATED', content: booking.orderCode, transferType: 'in', transferAmount: booking.totalAmount });
    const signature = `sha256=${createHmac('sha256', sepaySecret).update(`${timestamp}.${body}`).digest('hex')}`;
    currentPrincipal = null;
    const forged = await request(app.getHttpServer()).post('/api/v1/payments/sepay-webhook')
      .set('Content-Type', 'application/json').set('X-SePay-Timestamp', timestamp)
      .set('X-SePay-Signature', `sha256=${'0'.repeat(64)}`).send(body);
    expect(forged.status).toBe(401);
    const stillPending = await prisma.phieuDatVe.findUniqueOrThrow({ where: { phieuDatVeId: booking.bookingId } });
    expect(stillPending.trangThai).toBe('CHO_THANH_TOAN');
    for (let retry = 0; retry < 2; retry++) {
      const paid = await request(app.getHttpServer()).post('/api/v1/payments/sepay-webhook')
        .set('Content-Type', 'application/json').set('X-SePay-Timestamp', timestamp)
        .set('X-SePay-Signature', signature).send(body);
      expect(paid.status, JSON.stringify(paid.body)).toBe(200);
      expect(paid.body).toEqual({ success: true });
    }
    currentPrincipal = mode === 'customer' ? customerPrincipal : null;
    const detail = await request(app.getHttpServer()).get(`/api/v1/bookings/${booking.bookingId}/detail`)
      .set('x-booking-code', booking.bookingCode).set('x-booking-phone', customerPhone);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      bookingId: booking.bookingId,
      bookingCode: booking.bookingCode,
      orderCode: booking.orderCode,
      totalAmount: booking.totalAmount,
      status: 'DA_THANH_TOAN',
      paymentStatus: 'DA_THANH_TOAN',
    });
    expect(detail.body.data.paymentExpiresAt).toEqual(expect.any(String));
    expect(detail.body.data.serverTime).toEqual(expect.any(String));
    expect(detail.body.data.tickets).toHaveLength(1);
    expect(await prisma.thanhToan.count({ where: { donGiaoDichId: saved.donGiaoDichId } })).toBe(1);
    expect(await prisma.lichSuTrangThaiPhieuDatVe.count({ where: { phieuDatVeId: booking.bookingId, trangThaiMoi: 'DA_THANH_TOAN' } })).toBe(1);
  });

  it('does not expose shipment list or detail to an anonymous caller', async () => {
    currentPrincipal = null;

    const [listResponse, detailResponse] = await Promise.all([
      request(app.getHttpServer()).get('/api/v1/shipments'),
      request(app.getHttpServer()).get('/api/v1/shipments/1'),
    ]);

    expect(listResponse.status).toBe(401);
    expect(detailResponse.status).toBe(401);
    expect(listResponse.body.data).toBeUndefined();
    expect(detailResponse.body.data).toBeUndefined();
  });

  it('rejects a booking without a hold token before creating any booking rows', async () => {
    const beforeOrders = await prisma.donGiaoDich.count({
      where: { nhaXeId: busCompanyId },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId,
        seatIds: [tripSeatIds[0]],
        contact: { fullName: 'Guest', phone: '0901234567' },
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
      });

    expect(response.status).toBe(400);
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(
      beforeOrders,
    );
    expect(await prisma.phieuDatVe.count({
      where: { donGiaoDich: { nhaXeId: busCompanyId } },
    })).toBe(0);
  });

  it('rejects duplicate seats and the legacy seatNumbers alias before mutation', async () => {
    const beforeOrders = await prisma.donGiaoDich.count({
      where: { nhaXeId: busCompanyId },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId,
        seatIds: [tripSeatIds[0], tripSeatIds[0]],
        seatNumbers: ['A01'],
        holdToken: 'unused-token',
        contact: { fullName: 'Guest', phone: '0901234567' },
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'seatNumbers' })]),
    );
    expect(
      await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
    ).toBe(beforeOrders);
  });

  it('rejects a forged token while leaving the real guest hold untouched', async () => {
    const holdResponse = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(holdResponse.status).toBe(201);

    const beforeOrders = await prisma.donGiaoDich.count({
      where: { nhaXeId: busCompanyId },
    });
    const bookingResponse = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId,
        seatIds: [tripSeatIds[0]],
        holdToken: 'forged-token',
        contact: { fullName: 'Guest', phone: '0901234567' },
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
      });

    expect(bookingResponse.status).toBe(409);
    expect(
      await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
    ).toBe(beforeOrders);
    const heldSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeatIds[0] },
    });
    expect(heldSeat.trangThai).toBe('DANG_GIU');
  });

  it('keeps a guest booking separate when its contact phone belongs to a registered customer', async () => {
    currentPrincipal = null;
    const holdResponse = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });

    expect(holdResponse.status).toBe(201);
    const holdToken = (holdResponse.body.data ?? holdResponse.body).holdToken;
    expect(holdToken).toBeTruthy();

    const bookingResponse = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId,
        seatIds: [tripSeatIds[0]],
        holdToken,
        contact: { fullName: 'Guest booking', phone: customerPhone },
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
      });

    expect(bookingResponse.status, JSON.stringify(bookingResponse.body)).toBe(201);
    const bookingData = bookingResponse.body.data ?? bookingResponse.body;
    const savedBooking = await prisma.phieuDatVe.findUniqueOrThrow({
      where: { phieuDatVeId: bookingData.bookingId },
      include: {
        donGiaoDich: {
          include: { khachHang: true },
        },
      },
    });
    expect(savedBooking.donGiaoDich.khachHangId).toBeNull();
    expect(savedBooking.donGiaoDich.khachHang).toBeNull();
    expect(savedBooking.donGiaoDich.soDienThoaiKhachHang).toBe(customerPhone);

    const guestBookingHistory = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
      where: { phieuDatVeId: bookingData.bookingId },
    });
    expect(guestBookingHistory).toHaveLength(1);
    expect(guestBookingHistory[0].nguonThayDoi).toBe('SYSTEM');
    expect(guestBookingHistory[0].taiKhoanId).toBeNull();

    const guestTickets = await prisma.ve.findMany({
      where: { phieuDatVeId: bookingData.bookingId },
    });
    expect(guestTickets).toHaveLength(1);
    const guestTicketHistory = await prisma.lichSuTrangThaiVe.findMany({
      where: { veId: { in: guestTickets.map((ticket) => ticket.veId) } },
    });
    expect(guestTicketHistory).toHaveLength(1);
    expect(
      guestTicketHistory.every(
        (history) =>
          history.nguonThayDoi === 'SYSTEM' && history.taiKhoanId === null,
      ),
    ).toBe(true);

    const guestDetailResponse = await request(app.getHttpServer()).get(
      `/api/v1/bookings/${bookingData.bookingId}/detail`,
    );
    expect(guestDetailResponse.status).toBe(404);
    expect(guestDetailResponse.body.error).toBe('BOOKING_NOT_FOUND');
    expect(guestDetailResponse.body.data).toBeUndefined();

    const guestDetailWithWrongCode = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${bookingData.bookingId}/detail`)
      .set('x-booking-code', `${bookingData.bookingCode}X`)
      .set('x-booking-phone', customerPhone);
    expect(guestDetailWithWrongCode.status).toBe(404);
    expect(guestDetailWithWrongCode.body.data).toBeUndefined();

    const guestDetailWithWrongPhone = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${bookingData.bookingId}/detail`)
      .set('x-booking-code', bookingData.bookingCode)
      .set('x-booking-phone', '0900000000');
    expect(guestDetailWithWrongPhone.status).toBe(404);
    expect(guestDetailWithWrongPhone.body.data).toBeUndefined();

    const guestDetailWithCredentials = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${bookingData.bookingId}/detail`)
      .set('x-booking-code', bookingData.bookingCode)
      .set('x-booking-phone', customerPhone);
    expect(guestDetailWithCredentials.status).toBe(200);
    expect(guestDetailWithCredentials.body.data.passenger.phoneNumber).toBe(
      customerPhone,
    );

    currentPrincipal = customerPrincipal;
    const historyResponse = await request(app.getHttpServer())
      .get('/api/v1/bookings')
      .query({ page: 1, pageSize: 10 });
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data).toEqual([]);

    const detailResponse = await request(app.getHttpServer()).get(
      `/api/v1/bookings/${bookingData.bookingId}`,
    );
    expect(detailResponse.status).toBe(403);
  });

  it('does not let a guest consume a hold owned by an authenticated customer', async () => {
    currentPrincipal = customerPrincipal;
    const holdResponse = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });

    expect(holdResponse.status).toBe(201);
    const holdToken = (holdResponse.body.data ?? holdResponse.body).holdToken;
    const beforeOrders = await prisma.donGiaoDich.count({
      where: { nhaXeId: busCompanyId },
    });

    currentPrincipal = null;
    const bookingResponse = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId,
        seatIds: [tripSeatIds[0]],
        holdToken,
        contact: { fullName: 'Guest attempt', phone: customerPhone },
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
      });

    expect(bookingResponse.status, JSON.stringify(bookingResponse.body)).toBe(403);
    expect(
      await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
    ).toBe(beforeOrders);
    const heldSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeatIds[0] },
    });
    expect(heldSeat.trangThai).toBe('DANG_GIU');
    expect(heldSeat.giuChoId).not.toBeNull();
  });

  it('allows only one booking to consume a hold when requests race', async () => {
    currentPrincipal = customerPrincipal;
    const holdResponse = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(holdResponse.status).toBe(201);
    const holdToken = (holdResponse.body.data ?? holdResponse.body).holdToken;
    const payload = {
      tripId,
      seatIds: [tripSeatIds[0]],
      holdToken,
      contact: { fullName: 'Customer', phone: '0901234567' },
      pickupPoint: 'Bến xe Miền Đông',
      dropoffPoint: 'Bến xe Đà Lạt',
    };

    const responses = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/bookings').send(payload),
      request(app.getHttpServer()).post('/api/v1/bookings').send(payload),
    ]);

    expect(
      responses.map((response) => response.status).sort((left, right) => left - right),
    ).toEqual([201, 409]);
    expect(await prisma.thanhToan.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } })).toBe(1);
    expect(
      await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
    ).toBe(1);
    expect(
      await prisma.phieuDatVe.count({
        where: { donGiaoDich: { nhaXeId: busCompanyId } },
      }),
    ).toBe(1);
    expect(
      await prisma.ve.count({
        where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
      }),
    ).toBe(1);
  });

  it('creates concurrent bookings on distinct holds with unique order and booking codes', async () => {
    currentPrincipal = null;
    const seatIds = tripSeatIds.slice(0, 2);
    expect(seatIds).toHaveLength(2);

    const holdResponses = await Promise.all(
      seatIds.map((seatId) =>
        request(app.getHttpServer())
          .post('/api/v1/seat-holds')
          .send({ tripId, seatIds: [seatId] }),
      ),
    );
    expect(holdResponses.map((response) => response.status)).toEqual([201, 201]);

    const bookingResponses = await Promise.all(
      holdResponses.map((response, index) => {
        const holdToken = (response.body.data ?? response.body).holdToken;
        return request(app.getHttpServer())
          .post('/api/v1/bookings')
          .send({
            tripId,
            seatIds: [seatIds[index]],
            holdToken,
            contact: { fullName: `Guest ${index}`, phone: '0901234567' },
            pickupPoint: 'Bến xe Miền Đông',
            dropoffPoint: 'Bến xe Đà Lạt',
          });
      }),
    );

    expect(bookingResponses.map((response) => response.status)).toEqual([201, 201]);
    const bookings = bookingResponses.map(
      (response) => response.body.data ?? response.body,
    );
    expect(new Set(bookings.map((booking) => booking.bookingCode)).size).toBe(2);
    expect(new Set(bookings.map((booking) => booking.orderCode)).size).toBe(2);
    expect(
      bookings.every((booking) => /^.+-PDV-[A-F\d]{30}$/.test(booking.bookingCode)),
    ).toBe(true);
  });

  it('rolls back hold consumption when a later booking transaction step fails', async () => {
    currentPrincipal = null;
    const holdResponse = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(holdResponse.status).toBe(201);
    const holdToken = (holdResponse.body.data ?? holdResponse.body).holdToken;
    const seatHoldsService = app.get(SeatHoldsService);
    const consumeHold = seatHoldsService.consumeHoldInTx.bind(seatHoldsService);
    const consumeSpy = vi
      .spyOn(seatHoldsService, 'consumeHoldInTx')
      .mockImplementation(async (tx, ...args) => {
        await consumeHold(tx, ...args);
        throw new Error('Injected failure after consuming hold');
      });

    let responseStatus = 0;
    try {
      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send({
          tripId,
          seatIds: [tripSeatIds[0]],
          holdToken,
          contact: { fullName: 'Guest', phone: '0901234567' },
          pickupPoint: 'Bến xe Miền Đông',
          dropoffPoint: 'Bến xe Đà Lạt',
        });
      responseStatus = response.status;
    } finally {
      consumeSpy.mockRestore();
    }

    expect(responseStatus).toBe(500);
    expect(
      await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
    ).toBe(0);
    const heldSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeatIds[0] },
    });
    expect(heldSeat.trangThai).toBe('DANG_GIU');
    expect(heldSeat.giuChoId).not.toBeNull();
    expect(
      await prisma.giuCho.count({
        where: { chuyenXeId: tripId, trangThai: 'DANG_GIU' },
      }),
    ).toBe(1);
  });

  it('POST /api/v1/bookings creates real multi-seat booking with synchronized baseline status history (Finding 5)', async () => {
    // Step 1: Hold all 3 seats via seat-holds API
    currentPrincipal = customerPrincipal;
    const holdRes = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: tripSeatIds });

    expect(holdRes.status).toBe(201);
    const holdToken = (holdRes.body.data ?? holdRes.body).holdToken;
    expect(holdToken).toBeDefined();

    // Verify all 3 seats in DB transitioned to DANG_GIU
    const heldSeats = await prisma.gheChuyenXe.findMany({
      where: { gheChuyenXeId: { in: tripSeatIds } },
    });
    expect(heldSeats).toHaveLength(3);
    for (const seat of heldSeats) {
      expect(seat.trangThai).toBe('DANG_GIU');
    }

    // Step 2: Call POST /api/v1/bookings to book 3 seats
    const bookingRes = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId,
        seatIds: tripSeatIds,
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
        contact: {
          fullName: 'Nguyễn Văn Test',
          phone: '+84968888888',
          email: 'test@vexgo.vn',
        },
        holdToken,
      });

    expect(bookingRes.status).toBe(201);
    const bookingData = bookingRes.body.data ?? bookingRes.body;
    expect(bookingData.bookingId).toBeDefined();
    expect(bookingData.status).toBe('CHO_THANH_TOAN');
    expect(bookingData.totalAmount).toBe(450000); // 3 seats * 150000
    expect(bookingData.seats).toHaveLength(3);

    const bookingId = bookingData.bookingId;

    // Step 3: Assert DB entities
    const dbBooking = await prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: bookingId },
      include: {
        donGiaoDich: true,
        ves: true,
      },
    });
    expect(dbBooking).not.toBeNull();
    expect(dbBooking?.trangThai).toBe('CHO_THANH_TOAN');
    expect(dbBooking?.soLuongVeBanDau).toBe(3);
    expect(Number(dbBooking?.tongTienBanDau)).toBe(450000);
    expect(dbBooking?.donGiaoDich.trangThai).toBe('CHO_THANH_TOAN');
    expect(dbBooking?.donGiaoDich.khachHangId).toBe(customerId);
    expect(dbBooking?.ves).toHaveLength(3);

    currentPrincipal = null;
    const anonymousDetail = await request(app.getHttpServer()).get(
      `/api/v1/bookings/${bookingId}/detail`,
    );
    expect(anonymousDetail.status).toBe(403);

    currentPrincipal = customerPrincipal;
    const ownDetail = await request(app.getHttpServer()).get(
      `/api/v1/bookings/${bookingId}/detail`,
    );
    expect(ownDetail.status).toBe(200);
    expect(ownDetail.body.data.bookingId).toBe(bookingId);

    // All tickets transitioned to DA_DAT
    for (const ticket of dbBooking!.ves) {
      expect(ticket.trangThai).toBe('DA_DAT');
      expect(Number(ticket.giaNiemYet)).toBe(150000);
      expect(Number(ticket.giaThucTe)).toBe(150000);
    }

    // GheChuyenXe transitioned from DANG_GIU to DA_DAT
    const bookedSeats = await prisma.gheChuyenXe.findMany({
      where: { gheChuyenXeId: { in: tripSeatIds } },
    });
    for (const seat of bookedSeats) {
      expect(seat.trangThai).toBe('DA_DAT');
      expect(seat.giuChoId).toBeNull();
    }

    // Step 4: CRUCIAL ASSERTION FOR FINDING 5 - Verify Baseline Status History
    // 4.1 Bảng LichSuTrangThaiPhieuDatVe:
    // - Có đúng 1 bản ghi cho phieuDatVeId
    // - trangThaiCu === null (khởi tạo ban đầu)
    // - trangThaiMoi === 'CHO_THANH_TOAN'
    // - nguonThayDoi === 'CUSTOMER'
    // - taiKhoanId === customerPrincipal.taiKhoanId
    // - maThaoTac khớp định dạng UUID v1
    const bookingHistories = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
      where: { phieuDatVeId: bookingId },
    });
    expect(bookingHistories).toHaveLength(1);
    const bh = bookingHistories[0];
    expect(bh.trangThaiCu).toBeNull();
    expect(bh.trangThaiMoi).toBe('CHO_THANH_TOAN');
    expect(bh.nguonThayDoi).toBe('CUSTOMER');
    expect(bh.taiKhoanId).toBe(customerPrincipal.taiKhoanId);
    expect(bh.maThaoTac).toMatch(UUID_V1_PATTERN);

    // 4.2 Bảng LichSuTrangThaiVe:
    // - Có đúng 3 bản ghi cho 3 vé con
    // - Mỗi vé có trangThaiCu === null, trangThaiMoi === 'DA_DAT'
    // - nguonThayDoi === 'CUSTOMER', taiKhoanId === customerPrincipal.taiKhoanId
    // - Toàn bộ 3 bản ghi vé và 1 bản ghi phiếu đều CHIA SẺ CHUNG MỘT maThaoTac UUID v1
    // - Toàn bộ đều có cùng thời điểm thoiDiem
    const ticketIds = dbBooking!.ves.map((v) => v.veId);
    const ticketHistories = await prisma.lichSuTrangThaiVe.findMany({
      where: { veId: { in: ticketIds } },
    });
    expect(ticketHistories).toHaveLength(3);

    for (const th of ticketHistories) {
      expect(th.trangThaiCu).toBeNull();
      expect(th.trangThaiMoi).toBe('DA_DAT');
      expect(th.nguonThayDoi).toBe('CUSTOMER');
      expect(th.taiKhoanId).toBe(customerPrincipal.taiKhoanId);

      // Invariant: Must share exact same maThaoTac UUID v1 with booking creation
      expect(th.maThaoTac).toBe(bh.maThaoTac);

      // Invariant: Must share exact same timestamp with booking creation
      expect(th.thoiDiem.getTime()).toBe(bh.thoiDiem.getTime());
    }

    // Step 5: Test Full Lifecycle - Create payment and confirm via Webhook
    const payRes = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .send({ bookingId, provider: 'MOMO' });
    expect(payRes.status).toBe(201);
    const paymentId = (payRes.body.data ?? payRes.body).paymentId;

    // Send valid MoMo Webhook
    const webhookPayload = buildMomoPayload(paymentId, { amount: 450000 });
    const hookRes = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(webhookPayload);
    expect(hookRes.status).toBe(201);

    // Verify DB after payment: All records transitioned to DA_THANH_TOAN
    const paidBooking = await prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: bookingId },
      include: { ves: true, donGiaoDich: true },
    });
    expect(paidBooking?.trangThai).toBe('DA_THANH_TOAN');
    expect(paidBooking?.donGiaoDich.trangThai).toBe('DA_THANH_TOAN');
    for (const t of paidBooking!.ves) {
      expect(t.trangThai).toBe('DA_THANH_TOAN');
    }

    // Verify history transitions:
    // PhieuDatVe now has 2 histories: baseline (null -> CHO_THANH_TOAN) + payment (CHO_THANH_TOAN -> DA_THANH_TOAN)
    const allBookingHistories = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
      where: { phieuDatVeId: bookingId },
      orderBy: { thoiDiem: 'asc' },
    });
    expect(allBookingHistories).toHaveLength(2);
    expect(allBookingHistories[1].trangThaiCu).toBe('CHO_THANH_TOAN');
    expect(allBookingHistories[1].trangThaiMoi).toBe('DA_THANH_TOAN');
    expect(allBookingHistories[1].nguonThayDoi).toBe('SYSTEM');

    // Each ticket now has 2 histories: baseline (null -> DA_DAT) + payment (DA_DAT -> DA_THANH_TOAN)
    const allTicketHistories = await prisma.lichSuTrangThaiVe.findMany({
      where: { veId: { in: ticketIds } },
      orderBy: { thoiDiem: 'asc' },
    });
    expect(allTicketHistories).toHaveLength(6);

    const paymentTicketHistories = allTicketHistories.filter(
      (h) => h.trangThaiMoi === 'DA_THANH_TOAN',
    );
    expect(paymentTicketHistories).toHaveLength(3);
    for (const pth of paymentTicketHistories) {
      expect(pth.trangThaiCu).toBe('DA_DAT');
      expect(pth.nguonThayDoi).toBe('SYSTEM');
      expect(pth.maThaoTac).toBe(allBookingHistories[1].maThaoTac);
      expect(pth.thoiDiem.getTime()).toBe(allBookingHistories[1].thoiDiem.getTime());
    }
  });
});
