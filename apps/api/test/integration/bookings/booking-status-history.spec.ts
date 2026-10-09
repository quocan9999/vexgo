import { createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
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

  beforeAll(async () => {
    process.env.PAYMENT_DEMO_MODE = 'true';

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

    app = moduleRef.createNestApplication();
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
    const account = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8496${suffix.slice(0, 7)}`,
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
      await prisma.ghe.deleteMany({ where: { xeId: vehicleId } });
      await prisma.xe.deleteMany({ where: { xeId: vehicleId } });
      await prisma.loaiXe.deleteMany({ where: { loaiXeId: vehicleTypeId } });
      await prisma.tuyenXe.deleteMany({ where: { tuyenXeId: routeId } });
      await prisma.nhaXe.deleteMany({ where: { nhaXeId: busCompanyId } });

      if (customerId) {
        await prisma.khachHang.deleteMany({ where: { khachHangId: customerId } });
        await prisma.taiKhoan.deleteMany({ where: { taiKhoanId: customerPrincipal.taiKhoanId } });
      }
    } finally {
      delete process.env.PAYMENT_DEMO_MODE;
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
    expect(dbBooking?.ves).toHaveLength(3);

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
