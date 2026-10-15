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
import { CargoCapacityService } from '../../../src/cargo-capacity/cargo-capacity.service.js';
import { ShipmentPersistenceService } from '../../../src/shipments/shipment-persistence.service.js';
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
  let competingApp: INestApplication;
  let prisma: PrismaService;
  let busCompanyId: number;
  let routeId: number;
  let vehicleTypeId: number;
  let vehicleId: number;
  let bangGiaId: number;
  let cargoTypeId: number;
  let bulkyCargoTypeId: number;
  let senderPointId: number;
  let receiverPointId: number;
  let cargoRateId: number;
  let bulkyCargoRateId: number;
  let tripId: number;
  let tripSeatIds: number[] = [];
  let currentPrincipal: AuthPrincipal | null = null;
  let failAfterShipmentPersistence = false;

  let customerId: number;
  let customerPrincipal: AuthPrincipal;
  let customerPhone: string;

  const standaloneShipmentPayload = (quantity = 1, loaiHangHoaId = cargoTypeId) => ({
    tripId,
    senderPointId,
    receiverPointId,
    sender: { fullName: 'Cargo capacity test', phoneNumber: customerPhone },
    receiver: { fullName: 'Cargo recipient', phoneNumber: '0912345678' },
    items: [{ name: 'Hàng thử nghiệm', loaiHangHoaId, quantity, weight: 1 }],
  });

  const bookingWithCargoPayload = (
    holdToken: string,
    cargoItems: Array<{
      name: string;
      loaiHangHoaId: number;
      quantity: number;
      type?: string;
      length?: number;
      width?: number;
      height?: number;
    }>,
  ) => ({
    tripId,
    seatIds: [tripSeatIds[0]],
    holdToken,
    contact: { fullName: 'Cargo capacity test', phone: customerPhone },
    pickupPoint: 'Bến xe Miền Đông',
    dropoffPoint: 'Bến xe Đà Lạt',
    senderPointId,
    receiverPointId,
    cargoItems: cargoItems.map((item) => ({
      ...item,
      type: item.type ?? 'Vali',
      weight: 1,
      category: 'normal',
    })),
  });

  const shipmentPersistenceProxy = {
    persistInTransaction: async (
      ...args: Parameters<ShipmentPersistenceService['persistInTransaction']>
    ) => {
      const result = await new ShipmentPersistenceService().persistInTransaction(
        ...args,
      );
      if (failAfterShipmentPersistence) {
        throw new Error('Integration fault after cargo persistence');
      }
      return result;
    },
  };

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
      .overrideProvider(ShipmentPersistenceService)
      .useValue(shipmentPersistenceProxy)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    configureApi(app);
    await app.init();

    const competingModuleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccessTokenGuard)
      .useValue(accessTokenGuard)
      .overrideProvider(ShipmentPersistenceService)
      .useValue(shipmentPersistenceProxy)
      .compile();
    competingApp = competingModuleRef.createNestApplication({ rawBody: true });
    configureApi(competingApp);
    await competingApp.init();

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

    const [senderPoint, receiverPoint] = await Promise.all([
      prisma.diemGiaoNhanHang.create({
        data: {
          maDiem: `DG-GUI-${suffix}`,
          tenDiem: `Điểm gửi ${suffix}`,
          diaChi: '1 Đường thử nghiệm',
          tinhThanh: 'TP. Hồ Chí Minh',
          trangThai: 'HOAT_DONG',
          nhaXeId: busCompanyId,
          tuyenXeDiemGiaoNhaps: {
            create: { tuyenXeId: routeId, vaiTro: 'GUI_HANG' },
          },
        },
        select: { diemGiaoNhanHangId: true },
      }),
      prisma.diemGiaoNhanHang.create({
        data: {
          maDiem: `DG-NHAN-${suffix}`,
          tenDiem: `Điểm nhận ${suffix}`,
          diaChi: '2 Đường thử nghiệm',
          tinhThanh: 'Lâm Đồng',
          trangThai: 'HOAT_DONG',
          nhaXeId: busCompanyId,
          tuyenXeDiemGiaoNhaps: {
            create: { tuyenXeId: routeId, vaiTro: 'NHAN_HANG' },
          },
        },
        select: { diemGiaoNhanHangId: true },
      }),
    ]);
    senderPointId = senderPoint.diemGiaoNhanHangId;
    receiverPointId = receiverPoint.diemGiaoNhanHangId;
    const cargoType = await prisma.loaiHangHoa.create({
      data: {
        tenLoai: `Hàng nhẹ ${suffix}`,
        trangThai: 'HOAT_DONG',
        nhomSucChua: 'HANG_NHE',
      },
      select: { loaiHangHoaId: true },
    });
    cargoTypeId = cargoType.loaiHangHoaId;
    const cargoRate = await prisma.bangCuocGuiHang.create({
      data: {
        khoiLuongTu: 0,
        khoiLuongDen: 10,
        mucCuoc: 60000,
        tuNgay: new Date('2020-01-01T00:00:00.000Z'),
        trangThai: 'HOAT_DONG',
        diemGuiId: senderPointId,
        diemNhanId: receiverPointId,
        loaiHangHoaId: cargoTypeId,
      },
      select: { bangCuocGuiHangId: true },
    });
    cargoRateId = cargoRate.bangCuocGuiHangId;

    const bulkyCargoType = await prisma.loaiHangHoa.create({
      data: {
        tenLoai: `Hàng cồng kềnh ${suffix}`,
        trangThai: 'HOAT_DONG',
        nhomSucChua: 'HANG_CONG_KENH',
      },
      select: { loaiHangHoaId: true },
    });
    bulkyCargoTypeId = bulkyCargoType.loaiHangHoaId;
    const bulkyCargoRate = await prisma.bangCuocGuiHang.create({
      data: {
        khoiLuongTu: 0,
        khoiLuongDen: 10,
        mucCuoc: 60000,
        tuNgay: new Date('2020-01-01T00:00:00.000Z'),
        trangThai: 'HOAT_DONG',
        diemGuiId: senderPointId,
        diemNhanId: receiverPointId,
        loaiHangHoaId: bulkyCargoTypeId,
      },
      select: { bangCuocGuiHangId: true },
    });
    bulkyCargoRateId = bulkyCargoRate.bangCuocGuiHangId;

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
        await prisma.lichSuTrangThaiPhieuGuiHang.deleteMany({
          where: { phieuGuiHang: { chuyenXeId: tripId } },
        });
        await prisma.chiTietCuocGuiHang.deleteMany({
          where: { phieuGuiHang: { chuyenXeId: tripId } },
        });
        await prisma.hinhAnhHangHoa.deleteMany({
          where: { hangHoa: { phieuGuiHang: { chuyenXeId: tripId } } },
        });
        await prisma.hangHoa.deleteMany({
          where: { phieuGuiHang: { chuyenXeId: tripId } },
        });
        await prisma.phieuGuiHang.deleteMany({ where: { chuyenXeId: tripId } });
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
      if (cargoRateId) {
        await prisma.bangCuocGuiHang.deleteMany({ where: { bangCuocGuiHangId: cargoRateId } });
      }
      if (bulkyCargoRateId) {
        await prisma.bangCuocGuiHang.deleteMany({ where: { bangCuocGuiHangId: bulkyCargoRateId } });
      }
      if (senderPointId || receiverPointId) {
        await prisma.diemGiaoNhanTuyenXe.deleteMany({
          where: { diemGiaoNhanHangId: { in: [senderPointId, receiverPointId].filter(Boolean) } },
        });
      }
      if (senderPointId || receiverPointId) {
        await prisma.diemGiaoNhanHang.deleteMany({
          where: { diemGiaoNhanHangId: { in: [senderPointId, receiverPointId].filter(Boolean) } },
        });
      }
      if (cargoTypeId) {
        await prisma.loaiHangHoa.deleteMany({ where: { loaiHangHoaId: cargoTypeId } });
      }
      if (bulkyCargoTypeId) {
        await prisma.loaiHangHoa.deleteMany({ where: { loaiHangHoaId: bulkyCargoTypeId } });
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
      await competingApp?.close();
      await app?.close();
    }
  }, 30_000);

  beforeEach(async () => {
    currentPrincipal = null;
    failAfterShipmentPersistence = false;

    if (tripId) {
      await prisma.lichSuTrangThaiPhieuGuiHang.deleteMany({
        where: { phieuGuiHang: { chuyenXeId: tripId } },
      });
      await prisma.chiTietCuocGuiHang.deleteMany({
        where: { phieuGuiHang: { chuyenXeId: tripId } },
      });
      await prisma.hinhAnhHangHoa.deleteMany({
        where: { hangHoa: { phieuGuiHang: { chuyenXeId: tripId } } },
      });
      await prisma.hangHoa.deleteMany({
        where: { phieuGuiHang: { chuyenXeId: tripId } },
      });
      await prisma.phieuGuiHang.deleteMany({ where: { chuyenXeId: tripId } });
    }

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
        sucChuaHangNhe: 10,
        nhanGuiHang: true,
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

  it('uses the same database-backed cargo rate and one-time service fees for booking-attached and standalone shipments', async () => {
    currentPrincipal = customerPrincipal;
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status, JSON.stringify(hold.body)).toBe(201);

    const bookingResponse = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId,
        seatIds: [tripSeatIds[0]],
        holdToken: hold.body.data.holdToken,
        contact: { fullName: 'Cargo integration', phone: customerPhone },
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
        senderPointId,
        receiverPointId,
        cargoItems: [
          {
            name: 'Máy ảnh',
            type: 'Vali',
            loaiHangHoaId: cargoTypeId,
            quantity: 1,
            weight: 2,
            category: 'fragile',
          },
          {
            name: 'Máy tính bảng',
            type: 'Vali',
            loaiHangHoaId: cargoTypeId,
            quantity: 1,
            weight: 3,
            category: 'valuable',
          },
        ],
      });
    expect(bookingResponse.status, JSON.stringify(bookingResponse.body)).toBe(201);
    const booking = bookingResponse.body.data;
    expect(booking.shippingFee).toBe(130000);
    expect(booking.totalAmount).toBe(280000);

    // Guest gửi hàng vẫn độc lập, kể cả khi số điện thoại được khai báo thuộc một tài khoản.
    currentPrincipal = null;
    const standaloneResponse = await request(app.getHttpServer())
      .post('/api/v1/shipments')
      .send({
        tripId,
        senderPointId,
        receiverPointId,
        sender: { fullName: 'Cargo integration', phoneNumber: customerPhone },
        receiver: { fullName: 'Cargo recipient', phoneNumber: '0912345678' },
        items: [
          { name: 'Máy ảnh', loaiHangHoaId: cargoTypeId, quantity: 1, weight: 2 },
          { name: 'Máy tính bảng', loaiHangHoaId: cargoTypeId, quantity: 1, weight: 3 },
        ],
        isFragile: true,
        isValuable: true,
      });
    expect(standaloneResponse.status, JSON.stringify(standaloneResponse.body)).toBe(201);
    expect(standaloneResponse.body.data.pricing).toMatchObject({
      baseFee: 60000,
      serviceFee: 70000,
      totalFee: booking.shippingFee,
    });

    const bookingShipment = await prisma.phieuGuiHang.findUniqueOrThrow({
      where: { phieuGuiHangId: booking.shipment.shipmentId },
      include: {
        chiTietCuocGuiHangs: true,
        hangHoas: true,
        lichSuTrangThais: true,
        donGiaoDich: { include: { phieuDatVe: true, thanhToans: true } },
      },
    });
    const standaloneShipment = await prisma.phieuGuiHang.findUniqueOrThrow({
      where: { phieuGuiHangId: standaloneResponse.body.data.shipmentId },
      include: {
        chiTietCuocGuiHangs: true,
        hangHoas: true,
        lichSuTrangThais: true,
        donGiaoDich: { include: { phieuDatVe: true, thanhToans: true } },
      },
    });
    for (const shipment of [bookingShipment, standaloneShipment]) {
      expect(Number(shipment.cuocChinh)).toBe(60000);
      expect(Number(shipment.phiDichVu)).toBe(70000);
      expect(Number(shipment.tongPhi)).toBe(130000);
      expect(shipment.chiTietCuocGuiHangs).toHaveLength(1);
      expect(Number(shipment.chiTietCuocGuiHangs[0].khoiLuongTinhCuoc)).toBe(5);
      expect(Number(shipment.chiTietCuocGuiHangs[0].soTienCuoc)).toBe(60000);
      expect(shipment.hangHoas).toHaveLength(2);
    }
    expect(bookingShipment.donGiaoDichId).toBe(booking.orderId);
    expect(bookingShipment.donGiaoDich.phieuDatVe?.phieuDatVeId).toBe(
      booking.bookingId,
    );
    expect(bookingShipment.donGiaoDich.khachHangId).toBe(customerId);
    expect(bookingShipment.donGiaoDich.tongTien.toNumber()).toBe(booking.totalAmount);
    expect(bookingShipment.donGiaoDich.thanhToans).toHaveLength(1);
    expect(bookingShipment.chuyenXeId).toBe(tripId);
    expect(bookingShipment.lichSuTrangThais).toMatchObject([
      {
        trangThai: 'MOI_TAO',
        taiKhoanId: customerPrincipal.taiKhoanId,
        ghiChu: 'Tạo phiếu gửi hàng kèm đặt vé',
      },
    ]);
    expect(standaloneShipment.donGiaoDichId).not.toBe(booking.orderId);
    expect(standaloneShipment.donGiaoDich.phieuDatVe).toBeNull();
    expect(standaloneShipment.donGiaoDich.thanhToans).toHaveLength(0);
    expect(standaloneShipment.donGiaoDich.khachHangId).toBeNull();
    expect(standaloneShipment.chuyenXeId).toBe(tripId);
    expect(standaloneShipment.lichSuTrangThais).toMatchObject([
      {
        trangThai: 'MOI_TAO',
        taiKhoanId: null,
        ghiChu: 'Tạo phiếu gửi hàng độc lập',
      },
    ]);

    const orderCount = await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } });
    const failedNoRate = await request(app.getHttpServer())
      .post('/api/v1/shipments')
      .send({
        tripId,
        senderPointId,
        receiverPointId,
        sender: { fullName: 'Cargo integration', phoneNumber: customerPhone },
        receiver: { fullName: 'Cargo recipient', phoneNumber: '0912345678' },
        items: [{ name: 'Thùng quá khổ', loaiHangHoaId: cargoTypeId, quantity: 1, weight: 11 }],
      });
    expect(failedNoRate.status).toBe(409);
    expect(failedNoRate.body.error).toBe('CARGO_RATE_NOT_FOUND');
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(orderCount);
  });

  it('rejects invalid dimensions on standalone shipment and booking cargo without persisting related rows', async () => {
    const countCargoRecords = async () => ({
      orders: await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
      shipments: await prisma.phieuGuiHang.count({ where: { chuyenXeId: tripId } }),
      items: await prisma.hangHoa.count({
        where: { phieuGuiHang: { chuyenXeId: tripId } },
      }),
      feeDetails: await prisma.chiTietCuocGuiHang.count({
        where: { phieuGuiHang: { chuyenXeId: tripId } },
      }),
      histories: await prisma.lichSuTrangThaiPhieuGuiHang.count({
        where: { phieuGuiHang: { chuyenXeId: tripId } },
      }),
    });

    currentPrincipal = null;
    const beforeStandalone = await countCargoRecords();
    const standaloneResponse = await request(app.getHttpServer())
      .post('/api/v1/shipments')
      .send({
        ...standaloneShipmentPayload(),
        items: [
          {
            name: 'Thùng hàng sai kích thước',
            loaiHangHoaId: cargoTypeId,
            quantity: 1,
            weight: 1,
            length: -150,
            width: 50,
            height: 50,
          },
        ],
      });

    expect(standaloneResponse.status).toBe(400);
    expect(standaloneResponse.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(
      standaloneResponse.body.details.some(
        (detail: { message: string }) =>
          detail.message.includes('Kích thước hàng hóa') &&
          detail.message.includes('số hữu hạn lớn hơn 0'),
      ),
    ).toBe(true);
    expect(await countCargoRecords()).toEqual(beforeStandalone);

    currentPrincipal = customerPrincipal;
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status, JSON.stringify(hold.body)).toBe(201);
    const beforeBooking = await countCargoRecords();
    const bookingResponse = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(
        bookingWithCargoPayload(hold.body.data.holdToken, [
          {
            name: 'Thùng hàng sai kích thước',
            loaiHangHoaId: cargoTypeId,
            quantity: 1,
            length: 150,
            width: 50,
          },
        ]),
      );

    expect(bookingResponse.status).toBe(400);
    expect(bookingResponse.body).toMatchObject({
      statusCode: 400,
      error: 'CARGO_DIMENSIONS_INVALID',
      message: expect.stringContaining('Kích thước hàng hóa'),
    });
    expect(await countCargoRecords()).toEqual(beforeBooking);
    const seat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeatIds[0] },
    });
    expect(seat.trangThai).toBe('DANG_GIU');
  });

  it('rolls back booking, payment, consumed hold, and cargo when shared cargo persistence fails after writes', async () => {
    currentPrincipal = customerPrincipal;
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status, JSON.stringify(hold.body)).toBe(201);

    failAfterShipmentPersistence = true;
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(
        bookingWithCargoPayload(hold.body.data.holdToken, [
          { name: 'Hàng cần rollback', loaiHangHoaId: cargoTypeId, quantity: 1 },
        ]),
      );
    failAfterShipmentPersistence = false;

    expect(response.status).toBe(500);
    expect(
      await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
    ).toBe(0);
    expect(
      await prisma.phieuDatVe.count({
        where: { donGiaoDich: { nhaXeId: busCompanyId } },
      }),
    ).toBe(0);
    expect(
      await prisma.ve.count({
        where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
      }),
    ).toBe(0);
    expect(await prisma.phieuGuiHang.count({ where: { chuyenXeId: tripId } })).toBe(0);
    expect(await prisma.hangHoa.count({ where: { phieuGuiHang: { chuyenXeId: tripId } } })).toBe(0);
    expect(
      await prisma.chiTietCuocGuiHang.count({
        where: { phieuGuiHang: { chuyenXeId: tripId } },
      }),
    ).toBe(0);
    expect(
      await prisma.lichSuTrangThaiPhieuGuiHang.count({
        where: { phieuGuiHang: { chuyenXeId: tripId } },
      }),
    ).toBe(0);
    const heldSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeatIds[0] },
    });
    expect(heldSeat.trangThai).toBe('DANG_GIU');
    expect(heldSeat.giuChoId).not.toBeNull();
  });

  it('accepts the last available unit and returns the committed live capacity projection', async () => {
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: { sucChuaHangNhe: 2 },
    });

    const created = await request(app.getHttpServer())
      .post('/api/v1/shipments')
      .send(standaloneShipmentPayload());
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    let capacity = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}/cargo-capacity`);
    expect(capacity.body.data.capacities.parcels).toEqual({
      total: 2,
      used: 1,
      remaining: 1,
    });

    const lastUnit = await request(app.getHttpServer())
      .post('/api/v1/shipments')
      .send(standaloneShipmentPayload());
    expect(lastUnit.status, JSON.stringify(lastUnit.body)).toBe(201);

    capacity = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}/cargo-capacity`);
    expect(capacity.status).toBe(200);
    expect(capacity.body.data).toMatchObject({
      acceptsShipments: true,
      capacities: {
        parcels: { total: 2, used: 2, remaining: 0 },
      },
    });
  });

  it('counts soLuong for a cargo row instead of counting it as one row', async () => {
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: { sucChuaHangNhe: 3 },
    });

    const created = await request(app.getHttpServer())
      .post('/api/v1/shipments')
      .send(standaloneShipmentPayload(2));
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const capacity = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}/cargo-capacity`);
    expect(capacity.body.data.capacities.parcels).toEqual({
      total: 3,
      used: 2,
      remaining: 1,
    });
  });

  it('rejects a request over the remaining capacity without creating partial rows', async () => {
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: { sucChuaHangNhe: 1 },
    });
    const beforeOrders = await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } });

    const response = await request(app.getHttpServer())
      .post('/api/v1/shipments')
      .send(standaloneShipmentPayload(2));

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('CARGO_CAPACITY_EXCEEDED');
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(beforeOrders);
    expect(await prisma.phieuGuiHang.count({ where: { chuyenXeId: tripId } })).toBe(0);
    expect(await prisma.hangHoa.count({ where: { phieuGuiHang: { chuyenXeId: tripId } } })).toBe(0);
  });

  it('serializes competing standalone shipments across two API instances', async () => {
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: { sucChuaHangNhe: 1 },
    });

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/shipments')
        .send(standaloneShipmentPayload()),
      request(competingApp.getHttpServer())
        .post('/api/v1/shipments')
        .send(standaloneShipmentPayload()),
    ]);

    expect(responses.map(({ status }) => status).sort((a, b) => a - b)).toEqual([201, 409]);
    const rejected = responses.find(({ status }) => status === 409);
    expect(rejected?.body.error).toBe('CARGO_CAPACITY_EXCEEDED');
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(1);
    expect(await prisma.phieuGuiHang.count({ where: { chuyenXeId: tripId } })).toBe(1);
    expect(await prisma.hangHoa.count({ where: { phieuGuiHang: { chuyenXeId: tripId } } })).toBe(1);

    const capacity = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}/cargo-capacity`);
    expect(capacity.body.data.capacities.parcels).toEqual({
      total: 1,
      used: 1,
      remaining: 0,
    });
  });

  it('serializes a standalone shipment against a cargo-attached booking across API instances', async () => {
    currentPrincipal = customerPrincipal;
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: { sucChuaHangNhe: 1 },
    });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status, JSON.stringify(hold.body)).toBe(201);
    const holdData = hold.body.data ?? hold.body;

    const bookingRequest = request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(bookingWithCargoPayload(holdData.holdToken, [
        { name: 'Hàng đặt kèm vé', loaiHangHoaId: cargoTypeId, quantity: 1 },
      ]));
    const shipmentRequest = request(competingApp.getHttpServer())
      .post('/api/v1/shipments')
      .send(standaloneShipmentPayload());
    const [booking, shipment] = await Promise.all([bookingRequest, shipmentRequest]);

    expect([booking.status, shipment.status].sort((a, b) => a - b)).toEqual([201, 409]);
    const rejected = booking.status === 409 ? booking : shipment;
    expect(rejected.body.error).toBe('CARGO_CAPACITY_EXCEEDED');
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(1);
    expect(await prisma.phieuGuiHang.count({ where: { chuyenXeId: tripId } })).toBe(1);
    expect(await prisma.hangHoa.count({ where: { phieuGuiHang: { chuyenXeId: tripId } } })).toBe(1);
    expect(await prisma.ve.count({ where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } } }))
      .toBe(booking.status === 201 ? 1 : 0);

    const heldSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeatIds[0] },
    });
    expect(heldSeat.trangThai).toBe(booking.status === 201 ? 'DA_DAT' : 'DANG_GIU');
  });

  it('rolls back a multi-group booking when the last group exceeds its limit', async () => {
    currentPrincipal = customerPrincipal;
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: { sucChuaHangNhe: 1, sucChuaHangCongKenh: 0 },
    });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status, JSON.stringify(hold.body)).toBe(201);
    const holdData = hold.body.data ?? hold.body;

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(bookingWithCargoPayload(holdData.holdToken, [
        { name: 'Hàng nhẹ hợp lệ', loaiHangHoaId: cargoTypeId, quantity: 1 },
        {
          name: 'Hàng cồng kềnh vượt mức',
          loaiHangHoaId: bulkyCargoTypeId,
          quantity: 1,
          type: 'Hàng cồng kềnh',
        },
      ]));

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('CARGO_CAPACITY_EXCEEDED');
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(0);
    expect(await prisma.phieuDatVe.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } })).toBe(0);
    expect(await prisma.ve.count({ where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } } })).toBe(0);
    expect(await prisma.phieuGuiHang.count({ where: { chuyenXeId: tripId } })).toBe(0);
    expect(await prisma.hangHoa.count({ where: { phieuGuiHang: { chuyenXeId: tripId } } })).toBe(0);

    const heldSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeatIds[0] },
    });
    expect(heldSeat.trangThai).toBe('DANG_GIU');
    expect(heldSeat.giuChoId).not.toBeNull();
  });

  it('keeps pending and in-transit shipments in capacity and releases delivered/cancelled shipments', async () => {
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: { sucChuaHangNhe: 1 },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/shipments')
      .send(standaloneShipmentPayload());
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const shipmentId = created.body.data.shipmentId as number;

    for (const status of ['MOI_TAO', 'DA_TIEP_NHAN', 'DANG_VAN_CHUYEN'] as const) {
      await prisma.phieuGuiHang.update({
        where: { phieuGuiHangId: shipmentId },
        data: { trangThai: status },
      });
      const capacity = await request(app.getHttpServer())
        .get(`/api/v1/trips/${tripId}/cargo-capacity`);
      expect(capacity.body.data.capacities.parcels).toEqual({
        total: 1,
        used: 1,
        remaining: 0,
      });
    }

    await prisma.phieuGuiHang.update({
      where: { phieuGuiHangId: shipmentId },
      data: { trangThai: 'DA_GIAO' },
    });
    let capacity = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}/cargo-capacity`);
    expect(capacity.body.data.capacities.parcels).toEqual({
      total: 1,
      used: 0,
      remaining: 1,
    });

    const secondShipment = await request(app.getHttpServer())
      .post('/api/v1/shipments')
      .send(standaloneShipmentPayload());
    expect(secondShipment.status, JSON.stringify(secondShipment.body)).toBe(201);
    await prisma.phieuGuiHang.update({
      where: { phieuGuiHangId: secondShipment.body.data.shipmentId },
      data: { trangThai: 'DA_HUY' },
    });
    capacity = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}/cargo-capacity`);
    expect(capacity.body.data.capacities.parcels).toEqual({
      total: 1,
      used: 0,
      remaining: 1,
    });
  });

  it('rolls back a cargo booking after a failure immediately following the capacity check', async () => {
    currentPrincipal = customerPrincipal;
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: { sucChuaHangNhe: 1 },
    });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status, JSON.stringify(hold.body)).toBe(201);
    const holdData = hold.body.data ?? hold.body;
    const payload = bookingWithCargoPayload(holdData.holdToken, [
      { name: 'Hàng đặt kèm vé', loaiHangHoaId: cargoTypeId, quantity: 1 },
    ]);
    const cargoCapacity = app.get(CargoCapacityService);
    const assertAvailable = cargoCapacity.assertAvailable.bind(cargoCapacity);
    const assertSpy = vi
      .spyOn(cargoCapacity, 'assertAvailable')
      .mockImplementation((snapshot, requested) => {
        assertAvailable(snapshot, requested);
        throw new Error('Injected failure after capacity validation');
      });

    let failedResponse;
    try {
      failedResponse = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(payload);
    } finally {
      assertSpy.mockRestore();
    }

    expect(failedResponse.status).toBe(500);
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(0);
    expect(await prisma.phieuDatVe.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } })).toBe(0);
    expect(await prisma.phieuGuiHang.count({ where: { chuyenXeId: tripId } })).toBe(0);
    const heldSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeatIds[0] },
    });
    expect(heldSeat.trangThai).toBe('DANG_GIU');

    const retried = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(payload);
    expect(retried.status, JSON.stringify(retried.body)).toBe(201);
    const capacity = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}/cargo-capacity`);
    expect(capacity.body.data.capacities.parcels).toEqual({
      total: 1,
      used: 1,
      remaining: 0,
    });
  });

  it('preserves the read shape and rejects cargo when the trip disables shipment intake', async () => {
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: {
        nhanGuiHang: false,
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
      },
    });

    const [capacity, shipment] = await Promise.all([
      request(app.getHttpServer()).get(`/api/v1/trips/${tripId}/cargo-capacity`),
      request(app.getHttpServer())
        .post('/api/v1/shipments')
        .send(standaloneShipmentPayload()),
    ]);

    expect(capacity.status).toBe(200);
    expect(capacity.body.data).toEqual({
      acceptsShipments: false,
      capacities: {
        motorcycles: { total: 0, used: 0, remaining: 0 },
        bulkyGoods: { total: 0, used: 0, remaining: 0 },
        parcels: { total: 0, used: 0, remaining: 0 },
      },
    });
    expect(shipment.status).toBe(409);
    expect(shipment.body.error).toBe('TRIP_DOES_NOT_ACCEPT_CARGO');
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(0);
    expect(await prisma.phieuGuiHang.count({ where: { chuyenXeId: tripId } })).toBe(0);
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
