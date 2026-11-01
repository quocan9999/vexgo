import { createHmac, randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
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
import { PromotionsService } from '../../../src/promotions/promotions.service.js';
import { lockPaymentOrder } from '../../../src/payments/payment-order-lock.js';
import { ShipmentsService } from '../../../src/shipments/shipments.service.js';
import { PaymentsService } from '../../../src/payments/payments.service.js';
import { RefundProcessorService } from '../../../src/payments/refund-processor.service.js';
import type { MomoWebhookDto } from '../../../src/payments/dto/webhook.dto.js';
import {
  assertPrismaUsesVerifiedHistoryDatabase,
  BOOKING_HISTORY_TEST_DATABASE_ENV,
  type HistoryTestDatabaseSession,
  type VerifiedHistoryTestDatabase,
  withVerifiedBookingHistoryTestDatabase,
} from '../../support/booking-history-test-database.js';

const UUID_V1_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createHistoryTestPrismaService(databaseUrl: string | undefined): PrismaService {
  if (!databaseUrl) {
    throw new Error(`${BOOKING_HISTORY_TEST_DATABASE_ENV} is required for this suite.`);
  }

  const configService = {
    getOrThrow: (key: string) => {
      if (key !== 'DATABASE_URL') {
        throw new Error(`Unexpected PrismaService configuration key: ${key}`);
      }
      return databaseUrl;
    },
  } as unknown as ConfigService;

  return new PrismaService(configService);
}

async function readPrismaHistoryTestSession(
  client: PrismaService,
): Promise<HistoryTestDatabaseSession> {
  const [session] = await client.$queryRaw<HistoryTestDatabaseSession[]>`
    SELECT DATABASE() AS schemaName,
           @@hostname AS serverHost,
           @@port AS serverPort,
           @@server_uuid AS serverUuid,
           CURRENT_USER() AS currentUser
  `;
  if (!session) {
    throw new Error('PrismaService did not return its booking history test session.');
  }
  return session;
}
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
  const sepayAccountNumber = '0012345678';
  const originalPaymentDemoMode = process.env.PAYMENT_DEMO_MODE;
  const originalSepaySecret = process.env.SEPAY_WEBHOOK_SECRET;
  const originalSepayAccountNumber = process.env.SEPAY_ACCOUNT_NUMBER;
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
  let bulkyHeavyCargoRateId: number;
  let bulkyCargoRateId: number;
  let tripId: number;
  let tripSeatIds: number[] = [];
  let promotionCode = '';
  let currentPrincipal: AuthPrincipal | null = null;
  let cancellationClient = 0;
  let failAfterShipmentPersistence = false;

  let customerId: number;
  let customerAccountId: number;
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
      weight?: number;
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
      weight: item.weight ?? 1,
      category: 'normal',
    })),
  });

  const createPromotion = async (options: {
    quota?: number;
    amount?: number;
    startsOn?: Date;
    endsOn?: Date;
  } = {}) => {
    promotionCode = `BOOK-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
    return prisma.khuyenMai.create({
      data: {
        tenChuongTrinh: `Booking integration ${promotionCode}`,
        maKhuyenMai: promotionCode,
        phamViApDung: 'DAT_VE',
        hinhThucApDung: 'NHAP_MA',
        loaiGiamGia: 'SO_TIEN',
        giaTriGiam: options.amount ?? 30_000,
        giamToiDa: null,
        giaTriDonToiThieu: null,
        tuNgay: options.startsOn ?? new Date('2020-01-01T00:00:00.000Z'),
        denNgay: options.endsOn ?? new Date('2099-12-31T00:00:00.000Z'),
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
        soLuotToiDa: options.quota ?? 5,
        soLuotDaSuDung: 0,
      },
      select: { khuyenMaiId: true, maKhuyenMai: true },
    });
  };

  const fetchPromotionQuote = async (
    seatIds: number[],
    code: string,
    phone: string,
  ) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({ tripId, seatIds, promotionCode: code, contactPhone: phone });
    return response.status === 201
      ? {
          originalTotal: response.body.data.originalTotal as string,
          discountAmount: response.body.data.discountAmount as string,
          finalTotal: response.body.data.finalTotal as string,
        }
      : null;
  };

  const promotionBookingPayload = async (
    holdToken: string,
    seatIds: number[],
    code: string,
    phone: string,
  ) => {
    const quote = await fetchPromotionQuote(seatIds, code, phone);
    const total = 150_000 * seatIds.length;
    const expectedPromotionQuote = quote ?? {
          originalTotal: String(total),
          discountAmount: '0',
          finalTotal: String(total),
        };
    return {
      tripId,
      seatIds,
      holdToken,
      promotionCode: code,
      expectedPromotionQuote,
      contact: { fullName: 'Promotion integration guest', phone },
      pickupPoint: 'Bến xe Miền Đông',
      dropoffPoint: 'Bến xe Đà Lạt',
    };
  };

  const settleSePayOrder = async (orderCode: string, amount: number) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const eventId = Number.parseInt(
      randomUUID().replaceAll('-', '').slice(0, 12),
      16,
    );
    const webhookBody = JSON.stringify({
      id: eventId,
      transactionDate: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
      accountNumber: sepayAccountNumber,
      content: orderCode,
      transferType: 'in',
      transferAmount: amount,
    });
    const signature = `sha256=${createHmac('sha256', sepaySecret)
      .update(`${timestamp}.${webhookBody}`)
      .digest('hex')}`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments/sepay-webhook')
      .set('Content-Type', 'application/json')
      .set('X-SePay-Timestamp', timestamp)
      .set('X-SePay-Signature', signature)
      .send(webhookBody);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    return eventId;
  };

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

  const bookingMutationSnapshot = async () => {
    const [
      orders,
      bookings,
      tickets,
      payments,
      bookingHistories,
      ticketHistories,
      promotionUsages,
      seatHolds,
      seats,
    ] = await Promise.all([
      prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
      prisma.phieuDatVe.count({
        where: { donGiaoDich: { nhaXeId: busCompanyId } },
      }),
      prisma.ve.count({
        where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
      }),
      prisma.thanhToan.count({
        where: { donGiaoDich: { nhaXeId: busCompanyId } },
      }),
      prisma.lichSuTrangThaiPhieuDatVe.count({
        where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
      }),
      prisma.lichSuTrangThaiVe.count({
        where: {
          ve: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
        },
      }),
      prisma.suDungKhuyenMai.count({
        where: { khuyenMai: { nhaXeId: busCompanyId } },
      }),
      prisma.giuCho.count({ where: { chuyenXeId: tripId } }),
      prisma.gheChuyenXe.findMany({
        where: { chuyenXeId: tripId },
        orderBy: { gheChuyenXeId: 'asc' },
        select: { gheChuyenXeId: true, trangThai: true, giuChoId: true },
      }),
    ]);

    return {
      orders,
      bookings,
      tickets,
      payments,
      bookingHistories,
      ticketHistories,
      promotionUsages,
      seatHolds,
      seats,
    };
  };

  beforeAll(async () => {
    const historyDatabaseEnvironment = { ...process.env };
    const historyDatabaseUrl =
      historyDatabaseEnvironment[BOOKING_HISTORY_TEST_DATABASE_ENV];
    let firstDatabaseVerification!: VerifiedHistoryTestDatabase;
    let secondDatabaseVerification!: VerifiedHistoryTestDatabase;

    const accessTokenGuard = {
      canActivate(context: ExecutionContext) {
        if (currentPrincipal) {
          context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
            currentPrincipal;
        }
        return true;
      },
    };

    const moduleRef = await withVerifiedBookingHistoryTestDatabase(
      historyDatabaseEnvironment,
      async (verifiedDatabase) => {
        firstDatabaseVerification = verifiedDatabase;
        process.env.PAYMENT_DEMO_MODE = 'true';
        process.env.SEPAY_WEBHOOK_SECRET = sepaySecret;
        process.env.SEPAY_ACCOUNT_NUMBER = sepayAccountNumber;

        return Test.createTestingModule({ imports: [AppModule] })
          .overrideProvider(PrismaService)
          .useValue(createHistoryTestPrismaService(historyDatabaseUrl))
          .overrideProvider(AccessTokenGuard)
          .useValue(accessTokenGuard)
          .overrideProvider(ShipmentPersistenceService)
          .useValue(shipmentPersistenceProxy)
          .compile();
      },
    );

    app = moduleRef.createNestApplication({ rawBody: true });
    // Give each regression fixture a separate simulated client; keep the real
    // rate-limit guard and its per-client limit active.
    app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');
    configureApi(app);
    await app.init();

    const competingModuleRef = await withVerifiedBookingHistoryTestDatabase(
      historyDatabaseEnvironment,
      async (verifiedDatabase) => {
        secondDatabaseVerification = verifiedDatabase;
        return Test.createTestingModule({ imports: [AppModule] })
          .overrideProvider(PrismaService)
          .useValue(createHistoryTestPrismaService(historyDatabaseUrl))
          .overrideProvider(AccessTokenGuard)
          .useValue(accessTokenGuard)
          .overrideProvider(ShipmentPersistenceService)
          .useValue(shipmentPersistenceProxy)
          .compile();
      },
    );
    competingApp = competingModuleRef.createNestApplication({ rawBody: true });
    configureApi(competingApp);
    await competingApp.init();

    prisma = app.get(PrismaService);
    assertPrismaUsesVerifiedHistoryDatabase(
      firstDatabaseVerification,
      await readPrismaHistoryTestSession(prisma),
    );
    assertPrismaUsesVerifiedHistoryDatabase(
      secondDatabaseVerification,
      await readPrismaHistoryTestSession(competingApp.get(PrismaService)),
    );

    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    await prisma.$transaction(async (fixtureTx) => {

      // 1. Create company, route, vehicle type, vehicle with 3 seats
      const company = await fixtureTx.nhaXe.create({
        data: {
          maNhaXe: `NX-BK-${suffix}`,
          tenNhaXe: `Booking Test Co ${suffix}`,
          trangThai: 'HOAT_DONG',
        },
        select: { nhaXeId: true },
      });
      busCompanyId = company.nhaXeId;

      const route = await fixtureTx.tuyenXe.create({
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
        fixtureTx.diemGiaoNhanHang.create({
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
        fixtureTx.diemGiaoNhanHang.create({
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
      const cargoType = await fixtureTx.loaiHangHoa.create({
        data: {
          tenLoai: `Hàng nhẹ ${suffix}`,
          trangThai: 'HOAT_DONG',
          nhomSucChua: 'HANG_NHE',
        },
        select: { loaiHangHoaId: true },
      });
      cargoTypeId = cargoType.loaiHangHoaId;
      const cargoRate = await fixtureTx.bangCuocGuiHang.create({
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

      const bulkyCargoType = await fixtureTx.loaiHangHoa.create({
        data: {
          tenLoai: `Hàng cồng kềnh ${suffix}`,
          trangThai: 'HOAT_DONG',
          nhomSucChua: 'HANG_CONG_KENH',
        },
        select: { loaiHangHoaId: true },
      });
      bulkyCargoTypeId = bulkyCargoType.loaiHangHoaId;
      const bulkyCargoRate = await fixtureTx.bangCuocGuiHang.create({
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
      const bulkyHeavyCargoRate = await fixtureTx.bangCuocGuiHang.create({
        data: {
          khoiLuongTu: 45,
          khoiLuongDen: 50,
          mucCuoc: 90_000,
          tuNgay: new Date('2020-01-01T00:00:00.000Z'),
          trangThai: 'HOAT_DONG',
          diemGuiId: senderPointId,
          diemNhanId: receiverPointId,
          loaiHangHoaId: bulkyCargoTypeId,
        },
        select: { bangCuocGuiHangId: true },
      });
      bulkyHeavyCargoRateId = bulkyHeavyCargoRate.bangCuocGuiHangId;

      const vehicleType = await fixtureTx.loaiXe.create({
        data: {
          nhaXeId: busCompanyId,
          tenLoai: `Luxury Limousine ${suffix}`,
        },
        select: { loaiXeId: true },
      });
      vehicleTypeId = vehicleType.loaiXeId;

      const vehicle = await fixtureTx.xe.create({
        data: {
          bienSoXe: `49B-${suffix}`,
          trangThai: 'HOAT_DONG',
          nhaXeId: busCompanyId,
          loaiXeId: vehicleTypeId,
          ghes: {
            create: [
              { maGhe: `seat-a01-${suffix}`.padEnd(32, '0').slice(0, 32), tenGhe: 'A01', viTri: 'Tầng 1' },
              { maGhe: `seat-a02-${suffix}`.padEnd(32, '0').slice(0, 32), tenGhe: 'A02', viTri: 'Tầng 1' },
              { maGhe: `seat-a03-${suffix}`.padEnd(32, '0').slice(0, 32), tenGhe: 'A03', viTri: 'Tầng 1' },
            ],
          },
        },
        include: { ghes: true },
      });
      vehicleId = vehicle.xeId;

      // 2. Create fare pricing for route & vehicle type
      const fare = await fixtureTx.bangGia.create({
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
      const account = await fixtureTx.taiKhoan.create({
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
      customerAccountId = account.taiKhoanId;
      customerId = account.khachHang!.khachHangId;
      customerPrincipal = {
        taiKhoanId: account.taiKhoanId,
        sessionId: `sess-bk-${suffix}`,
        roles: ['CUSTOMER'],
        permissions: [],
        nhanVienId: null,
        nhaXeId: null,
        };
    }, { maxWait: 10_000, timeout: 30_000 });

  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.$transaction(
          async (cleanupTx) => {
            if (tripId) {
              await cleanupTx.suDungKhuyenMai.deleteMany({
                where: { khuyenMai: { nhaXeId: busCompanyId } },
              });
              await cleanupTx.lichSuTrangThaiPhieuGuiHang.deleteMany({
                where: { phieuGuiHang: { chuyenXeId: tripId } },
              });
              await cleanupTx.chiTietCuocGuiHang.deleteMany({
                where: { phieuGuiHang: { chuyenXeId: tripId } },
              });
              await cleanupTx.hinhAnhHangHoa.deleteMany({
                where: { hangHoa: { phieuGuiHang: { chuyenXeId: tripId } } },
              });
              await cleanupTx.hangHoa.deleteMany({
                where: { phieuGuiHang: { chuyenXeId: tripId } },
              });
              await cleanupTx.phieuGuiHang.deleteMany({
                where: { chuyenXeId: tripId },
              });
              await cleanupTx.lichSuTrangThaiVe.deleteMany({
                where: {
                  ve: {
                    phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } },
                  },
                },
              });
              await cleanupTx.thanhToan.deleteMany({
                where: { donGiaoDich: { nhaXeId: busCompanyId } },
              });
              await cleanupTx.ve.deleteMany({
                where: {
                  phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } },
                },
              });
              await cleanupTx.lichSuTrangThaiPhieuDatVe.deleteMany({
                where: {
                  phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } },
                },
              });
              await cleanupTx.phieuDatVe.deleteMany({
                where: { donGiaoDich: { nhaXeId: busCompanyId } },
              });
              await cleanupTx.donGiaoDich.deleteMany({
                where: { nhaXeId: busCompanyId },
              });
              await cleanupTx.khuyenMai.deleteMany({
                where: { nhaXeId: busCompanyId },
              });
              await cleanupTx.gheChuyenXe.deleteMany({
                where: { chuyenXeId: tripId },
              });
              await cleanupTx.giuCho.deleteMany({
                where: { chuyenXeId: tripId },
              });
              await cleanupTx.chuyenXe.deleteMany({
                where: { chuyenXeId: tripId },
              });
            }
            if (bangGiaId) {
              await cleanupTx.bangGia.deleteMany({ where: { bangGiaId } });
            }
            if (cargoRateId) {
              await cleanupTx.bangCuocGuiHang.deleteMany({
                where: { bangCuocGuiHangId: cargoRateId },
              });
            }
            if (bulkyCargoRateId) {
              await cleanupTx.bangCuocGuiHang.deleteMany({
                where: { bangCuocGuiHangId: bulkyCargoRateId },
              });
            }
            if (bulkyHeavyCargoRateId) {
              await cleanupTx.bangCuocGuiHang.deleteMany({
                where: { bangCuocGuiHangId: bulkyHeavyCargoRateId },
              });
            }
            if (senderPointId || receiverPointId) {
              const pointIds = [senderPointId, receiverPointId].filter(
                (id): id is number => id !== undefined,
              );
              await cleanupTx.diemGiaoNhanTuyenXe.deleteMany({
                where: { diemGiaoNhanHangId: { in: pointIds } },
              });
              await cleanupTx.diemGiaoNhanHang.deleteMany({
                where: { diemGiaoNhanHangId: { in: pointIds } },
              });
            }
            if (cargoTypeId) {
              await cleanupTx.loaiHangHoa.deleteMany({
                where: { loaiHangHoaId: cargoTypeId },
              });
            }
            if (bulkyCargoTypeId) {
              await cleanupTx.loaiHangHoa.deleteMany({
                where: { loaiHangHoaId: bulkyCargoTypeId },
              });
            }
            if (vehicleId) {
              await cleanupTx.ghe.deleteMany({ where: { xeId: vehicleId } });
              await cleanupTx.xe.deleteMany({ where: { xeId: vehicleId } });
            }
            if (vehicleTypeId) {
              await cleanupTx.loaiXe.deleteMany({
                where: { loaiXeId: vehicleTypeId },
              });
            }
            if (routeId) {
              await cleanupTx.tuyenXe.deleteMany({
                where: { tuyenXeId: routeId },
              });
            }
            if (busCompanyId) {
              await cleanupTx.nhaXe.deleteMany({
                where: { nhaXeId: busCompanyId },
              });
            }
            if (customerId) {
              await cleanupTx.khachHang.deleteMany({
                where: { khachHangId: customerId },
              });
            }
            if (customerAccountId) {
              await cleanupTx.taiKhoan.deleteMany({
                where: { taiKhoanId: customerAccountId },
              });
            }

            const [remainingCompany, remainingAccount, remainingTrip] =
              await Promise.all([
                busCompanyId
                  ? cleanupTx.nhaXe.count({ where: { nhaXeId: busCompanyId } })
                  : Promise.resolve(0),
                customerAccountId
                  ? cleanupTx.taiKhoan.count({
                      where: { taiKhoanId: customerAccountId },
                    })
                  : Promise.resolve(0),
                tripId
                  ? cleanupTx.chuyenXe.count({ where: { chuyenXeId: tripId } })
                  : Promise.resolve(0),
              ]);
            if (remainingCompany || remainingAccount || remainingTrip) {
              throw new Error(
                'Booking history integration fixture cleanup was incomplete.',
              );
            }
          },
          { maxWait: 10_000, timeout: 30_000 },
        );
      }
    } finally {
      if (originalPaymentDemoMode === undefined)
        delete process.env.PAYMENT_DEMO_MODE;
      else process.env.PAYMENT_DEMO_MODE = originalPaymentDemoMode;
      if (originalSepaySecret === undefined)
        delete process.env.SEPAY_WEBHOOK_SECRET;
      else process.env.SEPAY_WEBHOOK_SECRET = originalSepaySecret;
      if (originalSepayAccountNumber === undefined)
        delete process.env.SEPAY_ACCOUNT_NUMBER;
      else process.env.SEPAY_ACCOUNT_NUMBER = originalSepayAccountNumber;
      await competingApp?.close();
      await app?.close();
    }
  }, 30_000);

  beforeEach(async () => {
    cancellationClient += 1;
    currentPrincipal = null;
    failAfterShipmentPersistence = false;

    let nextTripId = 0;
    let nextTripSeatIds: number[] = [];
    await prisma.$transaction(
      async (fixtureTx) => {
        await fixtureTx.suDungKhuyenMai.deleteMany({
          where: { khuyenMai: { nhaXeId: busCompanyId } },
        });

        if (tripId) {
          await fixtureTx.lichSuTrangThaiPhieuGuiHang.deleteMany({
            where: { phieuGuiHang: { chuyenXeId: tripId } },
          });
          await fixtureTx.chiTietCuocGuiHang.deleteMany({
            where: { phieuGuiHang: { chuyenXeId: tripId } },
          });
          await fixtureTx.hinhAnhHangHoa.deleteMany({
            where: { hangHoa: { phieuGuiHang: { chuyenXeId: tripId } } },
          });
          await fixtureTx.hangHoa.deleteMany({
            where: { phieuGuiHang: { chuyenXeId: tripId } },
          });
          await fixtureTx.phieuGuiHang.deleteMany({
            where: { chuyenXeId: tripId },
          });
        }

        // Clean up bookings, tickets, and status histories for this bus company
        await fixtureTx.lichSuTrangThaiVe.deleteMany({
          where: {
            ve: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
          },
        });
        await fixtureTx.thanhToan.deleteMany({
          where: { donGiaoDich: { nhaXeId: busCompanyId } },
        });
        await fixtureTx.ve.deleteMany({
          where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
        });
        await fixtureTx.lichSuTrangThaiPhieuDatVe.deleteMany({
          where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
        });
        await fixtureTx.phieuDatVe.deleteMany({
          where: { donGiaoDich: { nhaXeId: busCompanyId } },
        });
        await fixtureTx.donGiaoDich.deleteMany({
          where: { nhaXeId: busCompanyId },
        });
        await fixtureTx.khuyenMai.deleteMany({
          where: { nhaXeId: busCompanyId },
        });

        if (tripId) {
          await fixtureTx.gheChuyenXe.deleteMany({
            where: { chuyenXeId: tripId },
          });
          await fixtureTx.giuCho.deleteMany({ where: { chuyenXeId: tripId } });
          await fixtureTx.chuyenXe.deleteMany({
            where: { chuyenXeId: tripId },
          });
        }

        // Create a new future trip with 3 seats
        const seats = await fixtureTx.ghe.findMany({
          where: { xeId: vehicleId },
          orderBy: { tenGhe: 'asc' },
        });
        const trip = await fixtureTx.chuyenXe.create({
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
        nextTripId = trip.chuyenXeId;
        nextTripSeatIds = trip.gheChuyenXes.map((s) => s.gheChuyenXeId);
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    tripId = nextTripId;
    tripSeatIds = nextTripSeatIds;
  });

  it.each(['guest-fixed', 'registered-percent'])(
    'settles a zero-total %s booking atomically without bank payment',
    async (kind) => {
      currentPrincipal =
        kind === 'registered-percent' ? customerPrincipal : null;
      const promotion = await createPromotion({ amount: 150_000 });
      if (kind === 'registered-percent') {
        await prisma.khuyenMai.update({
          where: { khuyenMaiId: promotion.khuyenMaiId },
          data: {
            loaiGiamGia: 'PHAN_TRAM',
            giaTriGiam: 100,
            giamToiDa: 300_000,
          },
        });
      }
      const hold = await request(app.getHttpServer())
        .post('/api/v1/seat-holds')
        .send({ tripId, seatIds: [tripSeatIds[0]] });
      const payload = await promotionBookingPayload(
        hold.body.data.holdToken,
        [tripSeatIds[0]],
        promotion.maKhuyenMai,
        customerPhone,
      );
      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(payload);
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      const booking = response.body.data;
      expect(booking).toMatchObject({
        status: 'DA_THANH_TOAN',
        totalAmount: 0,
        ticketSubtotal: 0,
      });
      expect(booking.tickets[0].status).toBe('DA_THANH_TOAN');
      const order = await prisma.donGiaoDich.findUniqueOrThrow({
        where: { donGiaoDichId: booking.orderId },
        include: { thanhToans: true },
      });
      expect(order.trangThai).toBe('DA_THANH_TOAN');
      expect(order.thanhToans).toEqual([]);
      const bookingHistory = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
        where: { phieuDatVeId: booking.bookingId },
        orderBy: { lichSuTrangThaiPhieuDatVeId: 'asc' },
      });
      expect(
        bookingHistory.map((h) => [h.trangThaiCu, h.trangThaiMoi]),
      ).toEqual([
        [null, 'CHO_THANH_TOAN'],
        ['CHO_THANH_TOAN', 'DA_THANH_TOAN'],
      ]);
      const ticketHistory = await prisma.lichSuTrangThaiVe.findMany({
        where: { veId: booking.tickets[0].veId },
        orderBy: { lichSuTrangThaiVeId: 'asc' },
      });
      expect(ticketHistory.map((h) => [h.trangThaiCu, h.trangThaiMoi])).toEqual(
        [
          [null, 'DA_DAT'],
          ['DA_DAT', 'DA_THANH_TOAN'],
        ],
      );
      for (const h of [bookingHistory[1], ticketHistory[1]]) {
        expect(h).toMatchObject({
          nguonThayDoi: 'SYSTEM',
          lyDo: 'Đơn 0đ – miễn thanh toán',
          maThaoTac: bookingHistory[1].maThaoTac,
        });
        expect(h.thoiDiem).toEqual(bookingHistory[0].thoiDiem);
      }
      expect(
        await app
          .get(PaymentsService)
          .expireBookingIfExpired(
            booking.bookingId,
            new Date(Date.now() + 11 * 60 * 1000),
          ),
      ).toBe(false);
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${booking.bookingId}/detail`)
        .set('x-booking-code', booking.bookingCode)
        .set('x-booking-phone', customerPhone);
      expect(detail.status, JSON.stringify(detail.body)).toBe(200);
      expect(detail.body.data).toMatchObject({
        status: 'DA_THANH_TOAN',
        paymentStatus: 'DA_THANH_TOAN',
        totalAmount: 0,
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
    const webhookBody = JSON.stringify({ id: Date.now(), transactionDate: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), accountNumber: sepayAccountNumber,
      content: booking.orderCode, transferType: 'in', transferAmount: 1 });
    const signature = `sha256=${createHmac('sha256', sepaySecret).update(`${timestamp}.${webhookBody}`).digest('hex')}`;
    const lateWebhook = await request(app.getHttpServer()).post('/api/v1/payments/sepay-webhook')
      .set('Content-Type', 'application/json').set('X-SePay-Timestamp', timestamp)
      .set('X-SePay-Signature', signature).send(webhookBody);
    expect(lateWebhook.status).toBe(409);
    expect(lateWebhook.body.error).toBe('SEPAY_PAYMENT_NOT_FOUND');
    expect(await prisma.thanhToan.count({ where: { donGiaoDichId: booking.orderId } })).toBe(0);
    expect(await prisma.lichSuTrangThaiPhieuDatVe.count({ where: { phieuDatVeId: booking.bookingId } })).toBe(2);
    const retry = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(payload);
      expect(retry.status).toBe(409);
      expect(
        await prisma.suDungKhuyenMai.count({
          where: { khuyenMaiId: promotion.khuyenMaiId },
        }),
      ).toBe(1);
      expect(
        (
          await prisma.khuyenMai.findUniqueOrThrow({
            where: { khuyenMaiId: promotion.khuyenMaiId },
          })
        ).soLuotDaSuDung,
      ).toBe(1);
      expect(
        (
          await prisma.gheChuyenXe.findUniqueOrThrow({
            where: { gheChuyenXeId: tripSeatIds[0] },
          })
        ).trangThai,
      ).toBe('DA_DAT');
    },
  );

  it('cancels free tickets without creating refunds or restoring promotion usage', async () => {
    const promotion = await createPromotion({ amount: 300_000 });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: tripSeatIds.slice(0, 2) });
    const bookingPayload = await promotionBookingPayload(
      hold.body.data.holdToken,
      tripSeatIds.slice(0, 2),
      promotion.maKhuyenMai,
      customerPhone,
    );
    const bookingResponse = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(bookingPayload);
    expect(bookingResponse.status, JSON.stringify(bookingResponse.body)).toBe(
      201,
    );
    const booking = bookingResponse.body.data;
    expect(booking).toMatchObject({ status: 'DA_THANH_TOAN', totalAmount: 0 });
    const tickets = await prisma.ve.findMany({
      where: { phieuDatVeId: booking.bookingId },
      orderBy: { veId: 'asc' },
    });
    expect(tickets).toHaveLength(2);

    const departureSoon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const localParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.BUSINESS_TIME_ZONE || 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(departureSoon);
    const localPart = (type: Intl.DateTimeFormatPartTypes) =>
      localParts.find((part) => part.type === type)?.value;
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: {
        ngayKhoiHanh: new Date(
          `${localPart('year')}-${localPart('month')}-${localPart('day')}T00:00:00.000Z`,
        ),
        gioKhoiHanh: new Date(
          Date.UTC(
            1970,
            0,
            1,
            Number(localPart('hour')),
            Number(localPart('minute')),
          ),
        ),
      },
    });
    const cutoff = await request(app.getHttpServer())
      .post('/api/v1/tickets/cancel')
      .send({
        ticketCode: tickets[0].maVe,
        phoneNumber: customerPhone,
        expectedCancelFeeRate: 0.1,
      });
    expect(cutoff.status).toBe(400);
    expect(cutoff.body.error).toBe('CANCELLATION_CUTOFF_PASSED');
    expect(
      (
        await prisma.gheChuyenXe.findUniqueOrThrow({
          where: { gheChuyenXeId: tripSeatIds[0] },
        })
      ).trangThai,
    ).toBe('DA_DAT');
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: {
        ngayKhoiHanh: new Date('2099-12-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
      },
    });

    const wrongPhone = await request(app.getHttpServer())
      .post('/api/v1/tickets/cancel')
      .send({
        ticketCode: tickets[0].maVe,
        phoneNumber: '0900000000',
        expectedCancelFeeRate: 0.1,
      });
    expect(wrongPhone.status).toBe(404);
    expect(wrongPhone.body.error).toBe('TICKET_NOT_FOUND');

    const cancelFirst = await request(app.getHttpServer())
      .post('/api/v1/tickets/cancel')
      .send({
        ticketCode: tickets[0].maVe,
        phoneNumber: customerPhone,
        expectedCancelFeeRate: 0.1,
      });
    expect(cancelFirst.status, JSON.stringify(cancelFirst.body)).toBe(201);
    expect(cancelFirst.body.data).toMatchObject({
      status: 'HUY',
      cancelFee: 0,
      refundAmount: 0,
      message: 'Hủy vé thành công. Không phát sinh khoản hoàn tiền.',
    });
    expect(
      (
        await prisma.gheChuyenXe.findUniqueOrThrow({
          where: { gheChuyenXeId: tripSeatIds[0] },
        })
      ).trangThai,
    ).toBe('TRONG');
    expect(
      (
        await prisma.gheChuyenXe.findUniqueOrThrow({
          where: { gheChuyenXeId: tripSeatIds[1] },
        })
      ).trangThai,
    ).toBe('DA_DAT');
    expect(
      (
        await prisma.phieuDatVe.findUniqueOrThrow({
          where: { phieuDatVeId: booking.bookingId },
        })
      ).trangThai,
    ).toBe('DA_THANH_TOAN');
    expect(
      (
        await prisma.donGiaoDich.findUniqueOrThrow({
          where: { donGiaoDichId: booking.orderId },
        })
      ).trangThai,
    ).toBe('DA_THANH_TOAN');

    const cancelSecond = await request(app.getHttpServer())
      .post('/api/v1/tickets/cancel')
      .send({
        ticketCode: tickets[1].maVe,
        phoneNumber: customerPhone,
        expectedCancelFeeRate: 0.1,
      });
    expect(cancelSecond.status, JSON.stringify(cancelSecond.body)).toBe(201);
    expect(cancelSecond.body.data).toMatchObject({
      status: 'HUY',
      cancelFee: 0,
      refundAmount: 0,
    });

    const [
      savedBooking,
      savedOrder,
      savedSeats,
      ticketHistories,
      bookingHistory,
    ] = await Promise.all([
      prisma.phieuDatVe.findUniqueOrThrow({
        where: { phieuDatVeId: booking.bookingId },
      }),
      prisma.donGiaoDich.findUniqueOrThrow({
        where: { donGiaoDichId: booking.orderId },
      }),
      prisma.gheChuyenXe.findMany({
        where: { gheChuyenXeId: { in: tripSeatIds.slice(0, 2) } },
        orderBy: { gheChuyenXeId: 'asc' },
      }),
      prisma.lichSuTrangThaiVe.findMany({
        where: { veId: { in: tickets.map((ticket) => ticket.veId) } },
        orderBy: { lichSuTrangThaiVeId: 'asc' },
      }),
      prisma.lichSuTrangThaiPhieuDatVe.findMany({
        where: { phieuDatVeId: booking.bookingId },
        orderBy: { lichSuTrangThaiPhieuDatVeId: 'asc' },
      }),
    ]);
    expect(savedBooking.trangThai).toBe('DA_HUY');
    expect(savedOrder.trangThai).toBe('DA_HUY');
    expect(savedSeats.map((seat) => seat.trangThai)).toEqual([
      'TRONG',
      'TRONG',
    ]);
    const cancellationHistories = ticketHistories.filter(
      (history) => history.trangThaiMoi === 'HUY',
    );
    expect(
      cancellationHistories.map((history) => [
        history.trangThaiCu,
        history.trangThaiMoi,
      ]),
    ).toEqual([
      ['DA_THANH_TOAN', 'HUY'],
      ['DA_THANH_TOAN', 'HUY'],
    ]);
    for (const history of cancellationHistories) {
      expect(history).toMatchObject({
        nguonThayDoi: 'SYSTEM',
        taiKhoanId: null,
        laOverride: false,
      });
      expect(history.maThaoTac).toMatch(UUID_V1_PATTERN);
    }
    expect(
      bookingHistory.map((history) => [
        history.trangThaiCu,
        history.trangThaiMoi,
      ]),
    ).toEqual([
      [null, 'CHO_THANH_TOAN'],
      ['CHO_THANH_TOAN', 'DA_THANH_TOAN'],
      ['DA_THANH_TOAN', 'DA_HUY'],
    ]);
    const finalBookingHistory = bookingHistory[2];
    const lastTicketHistory = cancellationHistories.find(
      (history) => history.veId === tickets[1].veId,
    );
    expect(finalBookingHistory?.nguonThayDoi).toBe('SYSTEM');
    expect(finalBookingHistory?.taiKhoanId).toBeNull();
    expect(finalBookingHistory?.maThaoTac).toBe(lastTicketHistory?.maThaoTac);
    expect(finalBookingHistory?.thoiDiem).toEqual(lastTicketHistory?.thoiDiem);
    expect(
      await prisma.thanhToan.count({
        where: { donGiaoDichId: booking.orderId },
      }),
    ).toBe(0);
    expect(
      await prisma.suDungKhuyenMai.count({
        where: { khuyenMaiId: promotion.khuyenMaiId },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.khuyenMai.findUniqueOrThrow({
          where: { khuyenMaiId: promotion.khuyenMaiId },
        })
      ).soLuotDaSuDung,
    ).toBe(1);
  });

  it('keeps paid orders with no successful payment ineligible for cancellation', async () => {
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    const bookingResponse = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId,
        seatIds: [tripSeatIds[0]],
        holdToken: hold.body.data.holdToken,
        contact: { fullName: 'Paid order test', phone: customerPhone },
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
      });
    expect(bookingResponse.status, JSON.stringify(bookingResponse.body)).toBe(
      201,
    );
    const booking = bookingResponse.body.data;
    await prisma.thanhToan.deleteMany({
      where: { donGiaoDichId: booking.orderId },
    });
    await prisma.phieuDatVe.update({
      where: { phieuDatVeId: booking.bookingId },
      data: { trangThai: 'DA_THANH_TOAN' },
    });
    await prisma.donGiaoDich.update({
      where: { donGiaoDichId: booking.orderId },
      data: { trangThai: 'DA_THANH_TOAN' },
    });
    const ticket = await prisma.ve.findFirstOrThrow({
      where: { phieuDatVeId: booking.bookingId },
    });
    await prisma.ve.update({
      where: { veId: ticket.veId },
      data: { trangThai: 'DA_THANH_TOAN' },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/tickets/cancel')
      .send({
        ticketCode: ticket.maVe,
        phoneNumber: customerPhone,
        expectedCancelFeeRate: 0.1,
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('REFUND_SOURCE_NOT_FOUND');
    expect(
      (await prisma.ve.findUniqueOrThrow({ where: { veId: ticket.veId } }))
        .trangThai,
    ).toBe('DA_THANH_TOAN');
    expect(
      (
        await prisma.gheChuyenXe.findUniqueOrThrow({
          where: { gheChuyenXeId: tripSeatIds[0] },
        })
      ).trangThai,
    ).toBe('DA_DAT');
    expect(
      await prisma.thanhToan.count({
        where: { donGiaoDichId: booking.orderId },
      }),
    ).toBe(0);
  });

  it('still charges SePay for cargo when tickets are free', async () => {
    const promotion = await createPromotion({ amount: 300_000 });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    const expectedPromotionQuote = await fetchPromotionQuote(
      [tripSeatIds[0]],
      promotion.maKhuyenMai,
      customerPhone,
    );
    if (!expectedPromotionQuote) {
      throw new Error('Cargo promotion quote was rejected.');
    }
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        ...bookingWithCargoPayload(hold.body.data.holdToken, [
          { name: 'Cargo', loaiHangHoaId: cargoTypeId, quantity: 1, weight: 2 },
        ]),
        promotionCode: promotion.maKhuyenMai,
        expectedPromotionQuote,
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data).toMatchObject({
      status: 'CHO_THANH_TOAN',
      ticketSubtotal: 0,
      shippingFee: 60_000,
      totalAmount: 60_000,
    });
    const payment = await prisma.thanhToan.findFirstOrThrow({
      where: { donGiaoDichId: response.body.data.orderId },
    });
    expect(payment).toMatchObject({
      phuongThuc: 'SEPAY',
      trangThai: 'DANG_XU_LY',
    });
    expect(Number(payment.soTien)).toBe(60_000);
  });

  async function guardedCargoFixture(free = true, seatCount = 1, paid = true) {
    const promotion = await createPromotion({ amount: free ? 300000 : 30000 });
    const seatIds = tripSeatIds.slice(0, seatCount);
    const hold = await request(app.getHttpServer()).post('/api/v1/seat-holds').send({ tripId, seatIds });
    expect(hold.status).toBe(201);
    const promotionPayload = await promotionBookingPayload(
      hold.body.data.holdToken,
      seatIds,
      promotion.maKhuyenMai,
      customerPhone,
    );
    const response = await request(app.getHttpServer()).post('/api/v1/bookings').send({
      ...bookingWithCargoPayload(hold.body.data.holdToken, [{ name: 'G3B cargo', loaiHangHoaId: cargoTypeId, quantity: 1, weight: 2 }]),
      seatIds,
      promotionCode: promotion.maKhuyenMai,
      expectedPromotionQuote: promotionPayload.expectedPromotionQuote,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const booking = response.body.data as { bookingId: number; orderId: number; orderCode: string; totalAmount: number };
    if (paid) await settleSePayOrder(booking.orderCode, booking.totalAmount);
    const shipment = await prisma.phieuGuiHang.findFirstOrThrow({ where: { donGiaoDichId: booking.orderId } });
    const tickets = await prisma.ve.findMany({ where: { phieuDatVeId: booking.bookingId }, orderBy: { veId: 'asc' } });
    return { booking, promotion, shipment, tickets };
  }

  async function cancellationSnapshot(orderId: number, promotionId: number) {
    return Promise.all([
      prisma.donGiaoDich.findUniqueOrThrow({ where: { donGiaoDichId: orderId }, include: {
        thanhToans: true,
        phieuDatVe: { include: { ves: { include: { gheChuyenXe: true, lichSuTrangThais: true } }, lichSuTrangThais: true, suDungKhuyenMai: true } },
        phieuGuiHang: { include: { hangHoas: true, chiTietCuocGuiHangs: true, lichSuTrangThais: true } },
      } }),
      prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotionId } }),
      app.get(CargoCapacityService).getSnapshot(prisma, tripId),
    ]);
  }

  const cancelRequest = (code: string, phone = customerPhone, rate = 0.1) => request(app.getHttpServer())
    .post('/api/v1/tickets/cancel').set('X-Forwarded-For', `192.0.2.${cancellationClient}`).send({ ticketCode: code, phoneNumber: phone, expectedCancelFeeRate: rate });

  it.each((['MOI_TAO', 'DA_TIEP_NHAN', 'DANG_VAN_CHUYEN', 'DA_GIAO'] as const).flatMap(status =>
    [true, false].flatMap(free => [1, 2].map(seatCount => ({ status, free, seatCount }))),
  ))('blocks cargo $status free=$free seats=$seatCount without any DB side effects', async ({ status, free, seatCount }) => {
    const f = await guardedCargoFixture(free, seatCount);
    await prisma.phieuGuiHang.update({ where: { phieuGuiHangId: f.shipment.phieuGuiHangId }, data: { trangThai: status } });
    const before = await cancellationSnapshot(f.booking.orderId, f.promotion.khuyenMaiId);
    const enqueue = vi.spyOn(app.get(RefundProcessorService), 'enqueueRefund');
    try {
      for (const ticket of f.tickets) {
        const lookup = await request(app.getHttpServer()).post('/api/v1/tickets/lookup').set('X-Forwarded-For', `192.0.2.${cancellationClient}`).send({ ticketCode: ticket.maVe, phoneNumber: customerPhone });
        expect(lookup.status, JSON.stringify(lookup.body)).toBe(200);
        expect(lookup.body.data.cancellation).toMatchObject({ eligible: false, reason: 'ACTIVE_SHIPMENT', refundAmount: 0 });
        const cancelled = await cancelRequest(ticket.maVe);
        expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(409);
        expect(cancelled.body.error).toBe('TICKET_CANCELLATION_ACTIVE_SHIPMENT');
        expect(cancelled.body.message).toMatch(/hàng gửi kèm.*liên hệ nhà xe/i);
      }
      expect(enqueue).not.toHaveBeenCalled();
      expect(await cancellationSnapshot(f.booking.orderId, f.promotion.khuyenMaiId)).toEqual(before);
    } finally { enqueue.mockRestore(); }
  });

  it.each([true, false])('allows cancellation when attached cargo is already cancelled, free=$0', async (free) => {
    const f = await guardedCargoFixture(free);
    await prisma.phieuGuiHang.update({ where: { phieuGuiHangId: f.shipment.phieuGuiHangId }, data: { trangThai: 'DA_HUY' } });
    const usage = await prisma.suDungKhuyenMai.findMany({ where: { phieuDatVeId: f.booking.bookingId } });
    const enqueue = vi.spyOn(app.get(RefundProcessorService), 'enqueueRefund').mockImplementation(() => undefined);
    try {
      const result = await cancelRequest(f.tickets[0].maVe);
      expect(result.status, JSON.stringify(result.body)).toBe(201);
      expect(result.body.data.refundAmount).toBe(free ? 0 : 108000);
      expect(enqueue).toHaveBeenCalledTimes(free ? 0 : 1);
      const payments = await prisma.thanhToan.findMany({ where: { donGiaoDichId: f.booking.orderId } });
      expect(payments).toHaveLength(free ? 1 : 2);
      expect(payments.filter(p => p.loaiGiaoDich === 'HOAN_TIEN')).toHaveLength(free ? 0 : 1);
      expect((await prisma.gheChuyenXe.findUniqueOrThrow({ where: { gheChuyenXeId: f.tickets[0].gheChuyenXeId } })).trangThai).toBe('TRONG');
      expect(await prisma.suDungKhuyenMai.findMany({ where: { phieuDatVeId: f.booking.bookingId } })).toEqual(usage);
      expect((await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: f.promotion.khuyenMaiId } })).soLuotDaSuDung).toBe(1);
    } finally { enqueue.mockRestore(); }
  });

  it('rolls back cancellation writes if history fails after the shipment restriction is cleared', async () => {
    const f = await guardedCargoFixture();
    await prisma.phieuGuiHang.update({ where: { phieuGuiHangId: f.shipment.phieuGuiHangId }, data: { trangThai: 'DA_HUY' } });
    const before = await cancellationSnapshot(f.booking.orderId, f.promotion.khuyenMaiId);
    const transaction = prisma.$transaction.bind(prisma);
    let wroteHistory = false;
    const fault = vi.spyOn(prisma, '$transaction').mockImplementation(((
      callback: (tx: unknown) => Promise<unknown>, options: unknown,
    ) => transaction(async tx => {
      const create = tx.lichSuTrangThaiVe.create.bind(tx.lichSuTrangThaiVe);
      tx.lichSuTrangThaiVe.create = (async (args: Parameters<typeof create>[0]) => {
        await create(args);
        wroteHistory = true;
        throw new Error('G3B injected cancellation history failure');
      }) as unknown as typeof tx.lichSuTrangThaiVe.create;
      return callback(tx);
    }, options as never)) as typeof prisma.$transaction);
    const enqueue = vi.spyOn(app.get(RefundProcessorService), 'enqueueRefund');
    try {
      expect((await cancelRequest(f.tickets[0].maVe)).status).toBe(500);
      expect(wroteHistory).toBe(true);
      expect(enqueue).not.toHaveBeenCalled();
    } finally { fault.mockRestore(); enqueue.mockRestore(); }
    expect(await cancellationSnapshot(f.booking.orderId, f.promotion.khuyenMaiId)).toEqual(before);
  });

  it('keeps wrong-phone verification ahead of the cargo restriction without mutation', async () => {
    const f = await guardedCargoFixture();
    const before = await cancellationSnapshot(f.booking.orderId, f.promotion.khuyenMaiId);
    expect((await cancelRequest(f.tickets[0].maVe, '0900000000')).status).toBe(404);
    expect(await cancellationSnapshot(f.booking.orderId, f.promotion.khuyenMaiId)).toEqual(before);
  });

  it.each(['status', 'payment'] as const)('serializes cancellation against concurrent $0 writes on the shared order', async (writer) => {
    const f = await guardedCargoFixture(true, 1, writer !== 'payment');
    let release!: () => void;
    let acquired!: () => void;
    const locked = new Promise<void>(resolve => { acquired = resolve; });
    const unblock = new Promise<void>(resolve => { release = resolve; });
    const blocker = prisma.$transaction(async tx => {
      expect(await lockPaymentOrder(tx, f.booking.orderId)).toBe(true);
      acquired(); await unblock;
    });
    await locked;
    let cancellationFinished = false;
    const cancellation = cancelRequest(f.tickets[0].maVe).then(result => { cancellationFinished = true; return result; });
    const otherWriter = writer === 'payment'
      ? settleSePayOrder(f.booking.orderCode, f.booking.totalAmount)
      : app.get(ShipmentsService).updateStatus(f.shipment.phieuGuiHangId, { status: 'DA_TIEP_NHAN', note: 'G3B race' }, {
        ...customerPrincipal, roles: ['NHA_XE_ADMIN'], nhaXeId: busCompanyId, nhanVienId: 1,
      });
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(cancellationFinished).toBe(false);
    } finally { release(); }
    await blocker;
    const [cancelled] = await Promise.all([cancellation, otherWriter]);
    expect(cancelled.status).toBe(409);
    expect(cancelled.body.error).toBe('TICKET_CANCELLATION_ACTIVE_SHIPMENT');
    const [order] = await cancellationSnapshot(f.booking.orderId, f.promotion.khuyenMaiId);
    expect(order.trangThai).toBe('DA_THANH_TOAN');
    expect(order.phieuDatVe?.trangThai).toBe('DA_THANH_TOAN');
    expect(order.phieuDatVe?.ves[0].trangThai).toBe('DA_THANH_TOAN');
    expect(order.phieuDatVe?.ves[0].gheChuyenXe.trangThai).toBe('DA_DAT');
    expect(order.thanhToans).toHaveLength(1);
    expect(order.thanhToans[0].trangThai).toBe('THANH_CONG');
    expect(order.phieuGuiHang?.trangThai).toBe(writer === 'status' ? 'DA_TIEP_NHAN' : 'MOI_TAO');
    expect(order.phieuGuiHang?.lichSuTrangThais).toHaveLength(writer === 'status' ? 2 : 1);
    expect(order.phieuDatVe?.ves[0].lichSuTrangThais).toHaveLength(2);
    expect(order.phieuDatVe?.lichSuTrangThais).toHaveLength(2);
  });

  it('still expires unpaid cargo bookings and releases seats/capacity without restoring promotion usage', async () => {
    const f = await guardedCargoFixture(true, 1, false);
    expect(await app.get(PaymentsService).expireBookingIfExpired(f.booking.bookingId, new Date(Date.now() + 11 * 60_000))).toBe(true);
    const [order, promo, capacity] = await cancellationSnapshot(f.booking.orderId, f.promotion.khuyenMaiId);
    expect(order.trangThai).toBe('DA_HUY');
    expect(order.phieuDatVe?.trangThai).toBe('DA_HUY');
    expect(order.phieuDatVe?.ves[0].trangThai).toBe('DA_HUY');
    expect(order.phieuDatVe?.ves[0].gheChuyenXe.trangThai).toBe('TRONG');
    expect(order.phieuGuiHang?.trangThai).toBe('DA_HUY');
    expect(capacity?.capacities.HANG_NHE.used).toBe(0);
    expect(order.phieuDatVe?.suDungKhuyenMai).not.toBeNull();
    expect(promo.soLuotDaSuDung).toBe(1);
    expect(order.thanhToans.filter(p => p.loaiGiaoDich === 'HOAN_TIEN')).toHaveLength(0);
  });

  it('continues to create and enqueue positive ticket refunds after successful payment', async () => {
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    const bookingResponse = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId,
        seatIds: [tripSeatIds[0]],
        holdToken: hold.body.data.holdToken,
        contact: { fullName: 'Paid cancellation test', phone: customerPhone },
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
      });
    expect(bookingResponse.status, JSON.stringify(bookingResponse.body)).toBe(
      201,
    );
    const booking = bookingResponse.body.data;
    const eventId = await settleSePayOrder(
      booking.orderCode,
      booking.totalAmount,
    );
    const ticket = await prisma.ve.findFirstOrThrow({
      where: { phieuDatVeId: booking.bookingId },
    });
    expect(ticket.trangThai).toBe('DA_THANH_TOAN');

    const enqueueRefund = vi.spyOn(
      app.get(RefundProcessorService),
      'enqueueRefund',
    );
    try {
      const cancellation = await request(app.getHttpServer())
        .post('/api/v1/tickets/cancel')
        .send({
          ticketCode: ticket.maVe,
          phoneNumber: customerPhone,
          expectedCancelFeeRate: 0.1,
        });
      expect(cancellation.status, JSON.stringify(cancellation.body)).toBe(201);
      expect(cancellation.body.data).toMatchObject({
        status: 'HUY',
        cancelFee: 15_000,
        refundAmount: 135_000,
        message: 'Hủy vé thành công. Yêu cầu hoàn tiền đang được xử lý.',
      });

      const payments = await prisma.thanhToan.findMany({
        where: { donGiaoDichId: booking.orderId },
        orderBy: { thanhToanId: 'asc' },
      });
      expect(payments).toHaveLength(2);
      expect(payments[0]).toMatchObject({
        loaiGiaoDich: 'THANH_TOAN',
        trangThai: 'THANH_CONG',
        maGiaoDichSePay: String(eventId),
      });
      const refund = payments[1];
      expect(refund).toMatchObject({
        loaiGiaoDich: 'HOAN_TIEN',
        phuongThuc: 'SEPAY',
        trangThai: 'DANG_XU_LY',
        veId: ticket.veId,
      });
      expect(Number(refund.soTien)).toBe(135_000);
      expect(enqueueRefund).toHaveBeenCalledTimes(1);
      expect(enqueueRefund).toHaveBeenCalledWith(refund.thanhToanId);
    } finally {
      enqueueRefund.mockRestore();
    }
  });

  it('rolls back zero-total completion, histories, seats and quota when completion history fails', async () => {
    const promotion = await createPromotion({ amount: 150_000 });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    const transaction = prisma.$transaction.bind(prisma);
    const fault = vi.spyOn(prisma, '$transaction').mockImplementation(((
      callback: (tx: unknown) => Promise<unknown>,
      options: unknown,
    ) =>
      transaction(async (tx) => {
        const history = tx.lichSuTrangThaiVe.create.bind(tx.lichSuTrangThaiVe);
        tx.lichSuTrangThaiVe.create = (async (
          args: Parameters<typeof history>[0],
        ) => {
          const result = await history(args);
          if (args.data.trangThaiMoi === 'DA_THANH_TOAN')
            throw new Error('Fault after real completion history');
          return result;
        }) as unknown as typeof tx.lichSuTrangThaiVe.create;
        return callback(tx);
      }, options as never)) as typeof prisma.$transaction);
    try {
      const payload = await promotionBookingPayload(
        hold.body.data.holdToken,
        [tripSeatIds[0]],
        promotion.maKhuyenMai,
        customerPhone,
      );
      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(payload);
      expect(response.status).toBe(500);
    } finally {
      fault.mockRestore();
    }
    expect(
      await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
    ).toBe(0);
    expect(
      await prisma.suDungKhuyenMai.count({
        where: { khuyenMaiId: promotion.khuyenMaiId },
      }),
    ).toBe(0);
    expect(
      (
        await prisma.khuyenMai.findUniqueOrThrow({
          where: { khuyenMaiId: promotion.khuyenMaiId },
        })
      ).soLuotDaSuDung,
    ).toBe(0);
    const seat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeatIds[0] },
    });
    expect(seat.trangThai).toBe('DANG_GIU');
    expect(seat.giuChoId).not.toBeNull();
  });

  it('quotes a promotion from database prices without changing quota or usage', async () => {
    const promotion = await createPromotion({ amount: 30_000 });
    const beforeOrders = await prisma.donGiaoDich.count({
      where: { nhaXeId: busCompanyId },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({
        tripId,
        seatIds: [tripSeatIds[0]],
        promotionCode: promotion.maKhuyenMai,
        contactPhone: '+84901234567',
      });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data).toMatchObject({
      unitPrice: '150000.00',
      seatCount: 1,
      originalTotal: '150000.00',
      discountAmount: '30000.00',
      finalTotal: '120000.00',
      appliedPromotionCode: promotion.maKhuyenMai,
      phoneEligibilityChecked: true,
      requiresPhoneBeforeBooking: false,
    });
    expect(
      await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
    ).toBe(beforeOrders);
    expect(
      await prisma.suDungKhuyenMai.count({
        where: { khuyenMaiId: promotion.khuyenMaiId },
      }),
    ).toBe(0);
    expect(
      (await prisma.khuyenMai.findUniqueOrThrow({
        where: { khuyenMaiId: promotion.khuyenMaiId },
      })).soLuotDaSuDung,
    ).toBe(0);
  });

  it.each([
    { label: 'number', promotionCode: 123 },
    { label: 'object', promotionCode: {} },
    { label: 'array', promotionCode: [] },
  ])(
    'rejects a malformed promotionCode supplied as a $label without writes',
    async ({ promotionCode: malformedPromotionCode }) => {
      const before = await bookingMutationSnapshot();
      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send({
          tripId,
          seatIds: [tripSeatIds[0]],
          holdToken: 'invalid-validation-only-hold',
          contact: {
            fullName: 'Promotion validation guest',
            phone: '0901234567',
          },
          pickupPoint: 'Bến xe Miền Đông',
          dropoffPoint: 'Bến xe Đà Lạt',
          promotionCode: malformedPromotionCode,
        });

      expect(response.status, JSON.stringify(response.body)).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'promotionCode' }),
        ]),
      );
      expect(await bookingMutationSnapshot()).toEqual(before);
    },
  );

  it.each([
    { label: 'null', includesPromotionCode: true, promotionCode: null },
    { label: 'empty string', includesPromotionCode: true, promotionCode: '' },
    { label: 'whitespace', includesPromotionCode: true, promotionCode: '   ' },
    {
      label: 'omitted code',
      includesPromotionCode: false,
      promotionCode: undefined,
    },
  ])(
    'keeps $label optional and does not require a quote',
    async ({ includesPromotionCode, promotionCode: optionalPromotionCode }) => {
      const before = await bookingMutationSnapshot();
      const payload = {
        tripId,
        seatIds: [tripSeatIds[0]],
        holdToken: 'invalid-validation-only-hold',
        contact: { fullName: 'Optional promotion guest', phone: '0901234567' },
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
        ...(includesPromotionCode
          ? { promotionCode: optionalPromotionCode }
          : {}),
      };
      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(payload);

      expect(response.status, JSON.stringify(response.body)).toBe(409);
      expect(response.body.error).toBe('SEAT_UNAVAILABLE');
      expect(await bookingMutationSnapshot()).toEqual(before);
    },
  );

  it('rejects a requested unknown promotion instead of creating a full-price booking', async () => {
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status).toBe(201);
    const beforeOrders = await prisma.donGiaoDich.count({
      where: { nhaXeId: busCompanyId },
    });

    const payload = await promotionBookingPayload(
      hold.body.data.holdToken,
      [tripSeatIds[0]],
      'UNKNOWN-CODE',
      '0901234567',
    );
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(payload);

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('PROMOTION_CODE_INVALID');
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(beforeOrders);
    expect(await prisma.suDungKhuyenMai.count({ where: { khuyenMai: { nhaXeId: busCompanyId } } })).toBe(0);
  });

  it('rejects a promotion booking without the quote the customer confirmed before writing', async () => {
    const promotion = await createPromotion({ amount: 30_000 });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status).toBe(201);
    const before = {
      orders: await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
      bookings: await prisma.phieuDatVe.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } }),
      payments: await prisma.thanhToan.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } }),
      histories: await prisma.lichSuTrangThaiPhieuDatVe.count({ where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } } }),
      usage: await prisma.suDungKhuyenMai.count({ where: { khuyenMaiId: promotion.khuyenMaiId } }),
      promotion: await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotion.khuyenMaiId } }),
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId,
        seatIds: [tripSeatIds[0]],
        holdToken: hold.body.data.holdToken,
        promotionCode: promotion.maKhuyenMai,
        contact: { fullName: 'Promotion integration guest', phone: '0901234567' },
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
      });

    expect(response.status, JSON.stringify(response.body)).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'expectedPromotionQuote' }),
      ]),
    );
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(before.orders);
    expect(await prisma.phieuDatVe.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } })).toBe(before.bookings);
    expect(await prisma.thanhToan.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } })).toBe(before.payments);
    expect(await prisma.lichSuTrangThaiPhieuDatVe.count({ where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } } })).toBe(before.histories);
    expect(await prisma.suDungKhuyenMai.count({ where: { khuyenMaiId: promotion.khuyenMaiId } })).toBe(before.usage);
    expect(await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotion.khuyenMaiId } })).toEqual(before.promotion);
    expect((await prisma.gheChuyenXe.findUniqueOrThrow({ where: { gheChuyenXeId: tripSeatIds[0] } })).trangThai).toBe('DANG_GIU');
  });

  it('rejects a stale promotion quote and rolls back booking, payment, history, and usage writes', async () => {
    const promotion = await createPromotion({ amount: 30_000 });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status).toBe(201);
    const stalePayload = await promotionBookingPayload(
      hold.body.data.holdToken,
      [tripSeatIds[0]],
      promotion.maKhuyenMai,
      '0901234567',
    );
    expect(stalePayload.expectedPromotionQuote).toMatchObject({
      originalTotal: '150000.00',
      discountAmount: '30000.00',
      finalTotal: '120000.00',
    });
    await prisma.khuyenMai.update({
      where: { khuyenMaiId: promotion.khuyenMaiId },
      data: { giaTriGiam: 50_000 },
    });
    const before = {
      orders: await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
      bookings: await prisma.phieuDatVe.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } }),
      payments: await prisma.thanhToan.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } }),
      histories: await prisma.lichSuTrangThaiPhieuDatVe.count({ where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } } }),
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(stalePayload);

    expect(response.status, JSON.stringify(response.body)).toBe(409);
    expect(response.body.error).toBe('PROMOTION_QUOTE_CHANGED');
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(before.orders);
    expect(await prisma.phieuDatVe.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } })).toBe(before.bookings);
    expect(await prisma.thanhToan.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } })).toBe(before.payments);
    expect(await prisma.lichSuTrangThaiPhieuDatVe.count({ where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } } })).toBe(before.histories);
    expect(await prisma.suDungKhuyenMai.count({ where: { khuyenMaiId: promotion.khuyenMaiId } })).toBe(0);
    expect((await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotion.khuyenMaiId } })).soLuotDaSuDung).toBe(0);
    expect((await prisma.gheChuyenXe.findUniqueOrThrow({ where: { gheChuyenXeId: tripSeatIds[0] } })).trangThai).toBe('DANG_GIU');
  });

  it('requires a guest phone before claiming identity eligibility in quote', async () => {
    const promotion = await createPromotion();
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({ tripId, seatIds: [tripSeatIds[0]], promotionCode: promotion.maKhuyenMai });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data).toMatchObject({
      phoneEligibilityChecked: false,
      requiresPhoneBeforeBooking: true,
      identityChecked: false,
    });
  });

  it('keeps the end date inclusive in the Asia/Ho_Chi_Minh business day', async () => {
    const todayParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const today = new Map(todayParts.map(({ type, value }) => [type, value]));
    const businessDate = `${today.get('year')}-${today.get('month')}-${today.get('day')}`;
    const promotion = await createPromotion({
      startsOn: new Date(`${businessDate}T00:00:00.000Z`),
      endsOn: new Date(`${businessDate}T00:00:00.000Z`),
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({
        tripId,
        seatIds: [tripSeatIds[0]],
        promotionCode: promotion.maKhuyenMai,
        contactPhone: '0901234567',
      });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data.appliedPromotionCode).toBe(promotion.maKhuyenMai);
  });

  it('consumes one use for a two-seat booking and snapshots correct payment and ticket totals', async () => {
    const promotion = await createPromotion({ amount: 30_000 });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0], tripSeatIds[1]] });
    expect(hold.status).toBe(201);

    const payload = await promotionBookingPayload(
      hold.body.data.holdToken,
      [tripSeatIds[0], tripSeatIds[1]],
      promotion.maKhuyenMai,
      '+84901234567',
    );
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(payload);

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const result = response.body.data;
    expect(result).toMatchObject({
      originalTicketSubtotal: 300_000,
      discountAmount: 30_000,
      promotionCode: promotion.maKhuyenMai,
      ticketSubtotal: 270_000,
      totalAmount: 270_000,
    });
    const saved = await prisma.phieuDatVe.findUniqueOrThrow({
      where: { phieuDatVeId: result.bookingId },
      include: { donGiaoDich: { include: { thanhToans: true } }, ves: true },
    });
    expect(saved.khuyenMaiId).toBe(promotion.khuyenMaiId);
    expect(Number(saved.soTienGiamKhuyenMai)).toBe(30_000);
    expect(saved.ves.reduce((sum, ticket) => sum + Number(ticket.giaThucTe), 0)).toBe(270_000);
    expect(Number(saved.donGiaoDich.tongTien)).toBe(270_000);
    expect(Number(saved.donGiaoDich.thanhToans[0].soTien)).toBe(270_000);
    expect(await prisma.suDungKhuyenMai.count({ where: { phieuDatVeId: result.bookingId } })).toBe(1);
    const ledger = await prisma.suDungKhuyenMai.findFirstOrThrow({
      where: { phieuDatVeId: result.bookingId },
    });
    expect(ledger).toMatchObject({
      khuyenMaiId: promotion.khuyenMaiId,
      khachHangId: null,
      soDienThoaiChuanHoa: '0901234567',
    });
    expect(Number(ledger.soTienGiam)).toBe(30_000);
    expect(
      (await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotion.khuyenMaiId } })).soLuotDaSuDung,
    ).toBe(1);
  });

  it('blocks guest-to-registered reuse and ignores a logged-in contact phone override', async () => {
    const promotion = await createPromotion({ quota: 3 });
    const guestHold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    const guestPayload = await promotionBookingPayload(
      guestHold.body.data.holdToken,
      [tripSeatIds[0]],
      promotion.maKhuyenMai,
      customerPhone,
    );
    const guest = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(guestPayload);
    expect(guest.status, JSON.stringify(guest.body)).toBe(201);

    currentPrincipal = customerPrincipal;
    const registeredHold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[1]] });
    expect(registeredHold.status).toBe(201);
    const registeredPayload = await promotionBookingPayload(
      registeredHold.body.data.holdToken,
      [tripSeatIds[1]],
      promotion.maKhuyenMai,
      '0911111111',
    );
    const registered = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(registeredPayload);

    expect(registered.status).toBe(409);
    expect(registered.body.error).toBe('PROMOTION_ALREADY_USED');
    expect(await prisma.suDungKhuyenMai.count({ where: { khuyenMaiId: promotion.khuyenMaiId } })).toBe(1);
    expect(
      (await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotion.khuyenMaiId } })).soLuotDaSuDung,
    ).toBe(1);
  });

  it('uses the account customer ID after its verified phone changes', async () => {
    const promotion = await createPromotion({ quota: 3 });
    currentPrincipal = customerPrincipal;
    const firstHold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    const firstPayload = await promotionBookingPayload(
      firstHold.body.data.holdToken,
      [tripSeatIds[0]],
      promotion.maKhuyenMai,
      '0903333333',
    );
    const firstBooking = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(firstPayload);
    expect(firstBooking.status, JSON.stringify(firstBooking.body)).toBe(201);
    const ledger = await prisma.suDungKhuyenMai.findFirstOrThrow({
      where: { phieuDatVeId: firstBooking.body.data.bookingId },
    });
    expect(ledger.soDienThoaiChuanHoa).toBe(customerPhone);
    expect(ledger.khachHangId).toBe(customerId);

    const changedPhone = `097${customerPhone.slice(-7)}`;
    try {
      await prisma.taiKhoan.update({
        where: { taiKhoanId: customerPrincipal.taiKhoanId },
        data: { soDienThoai: changedPhone },
      });
      const secondHold = await request(app.getHttpServer())
        .post('/api/v1/seat-holds')
        .send({ tripId, seatIds: [tripSeatIds[1]] });
      expect(secondHold.status).toBe(201);
      const secondPayload = await promotionBookingPayload(
        secondHold.body.data.holdToken,
        [tripSeatIds[1]],
        promotion.maKhuyenMai,
        '0904444444',
      );
      const secondBooking = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(secondPayload);
      expect(secondBooking.status).toBe(409);
      expect(secondBooking.body.error).toBe('PROMOTION_ALREADY_USED');
    } finally {
      await prisma.taiKhoan.update({
        where: { taiKhoanId: customerPrincipal.taiKhoanId },
        data: { soDienThoai: customerPhone },
      });
    }
  });

  it('serializes two guests competing for the last free promotion use on MySQL', async () => {
    const promotion = await createPromotion({ quota: 1, amount: 150_000 });
    const firstHold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    const secondHold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[1]] });
    expect(firstHold.status).toBe(201);
    expect(secondHold.status).toBe(201);
    const [firstPayload, secondPayload] = await Promise.all([
      promotionBookingPayload(
        firstHold.body.data.holdToken,
        [tripSeatIds[0]],
        promotion.maKhuyenMai,
        '0901111111',
      ),
      promotionBookingPayload(
        secondHold.body.data.holdToken,
        [tripSeatIds[1]],
        promotion.maKhuyenMai,
        '0902222222',
      ),
    ]);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(firstPayload),
      request(competingApp.getHttpServer())
        .post('/api/v1/bookings')
        .send(secondPayload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409)?.body.error).toBe('PROMOTION_QUOTA_EXHAUSTED');
    expect(await prisma.suDungKhuyenMai.count({ where: { khuyenMaiId: promotion.khuyenMaiId } })).toBe(1);
    expect(
      (await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotion.khuyenMaiId } })).soLuotDaSuDung,
    ).toBe(1);
  });

  it('serializes a promotion edit against a quoted booking without losing usage or charging a stale quote', async () => {
    const promotion = await createPromotion({ quota: 2, amount: 30_000 });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status).toBe(201);
    const payload = await promotionBookingPayload(
      hold.body.data.holdToken,
      [tripSeatIds[0]],
      promotion.maKhuyenMai,
      '0901234567',
    );
    const editor: AuthPrincipal = {
      ...customerPrincipal,
      roles: ['NHA_XE_ADMIN'],
      permissions: ['promotion:update'],
      nhanVienId: 1,
      nhaXeId: busCompanyId,
    };
    const edit = app.get(PromotionsService).update(
      promotion.khuyenMaiId,
      {
        name: 'Concurrent promotion edit',
        code: promotion.maKhuyenMai,
        discountType: 'SO_TIEN',
        discountValue: '50000',
        startsOn: '2020-01-01',
        endsOn: '2099-12-31',
        usageLimit: 2,
      },
      editor,
    );
    const booking = request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(payload);
    const [updatedPromotion, bookingResponse] = await Promise.all([edit, booking]);

    expect(updatedPromotion).toMatchObject({
      discountValue: '50000.00',
      usageLimit: 2,
    });
    expect([201, 409]).toContain(bookingResponse.status);
    const current = await prisma.khuyenMai.findUniqueOrThrow({
      where: { khuyenMaiId: promotion.khuyenMaiId },
    });
    const uses = await prisma.suDungKhuyenMai.count({
      where: { khuyenMaiId: promotion.khuyenMaiId },
    });
    expect(current.soLuotDaSuDung).toBe(uses);
    expect(uses).toBeLessThanOrEqual(current.soLuotToiDa);

    if (bookingResponse.status === 201) {
      expect(bookingResponse.body.data).toMatchObject({
        originalTicketSubtotal: 150_000,
        discountAmount: 30_000,
        ticketSubtotal: 120_000,
      });
      const bookingRecord = await prisma.phieuDatVe.findUniqueOrThrow({
        where: { phieuDatVeId: bookingResponse.body.data.bookingId },
      });
      expect(Number(bookingRecord.soTienGiamKhuyenMai)).toBe(30_000);
      expect(uses).toBe(1);
    } else {
      expect(bookingResponse.body.error).toBe('PROMOTION_QUOTE_CHANGED');
      expect(uses).toBe(0);
      expect(await prisma.phieuDatVe.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } })).toBe(0);
      expect(await prisma.thanhToan.count({ where: { donGiaoDich: { nhaXeId: busCompanyId } } })).toBe(0);
      expect(await prisma.lichSuTrangThaiPhieuDatVe.count({ where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } } })).toBe(0);
      expect((await prisma.gheChuyenXe.findUniqueOrThrow({ where: { gheChuyenXeId: tripSeatIds[0] } })).trangThai).toBe('DANG_GIU');
    }
  });

  it('serializes two concurrent booking attempts for the same guest phone on MySQL', async () => {
    const promotion = await createPromotion({ quota: 3 });
    const firstHold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    const secondHold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[1]] });
    expect(firstHold.status).toBe(201);
    expect(secondHold.status).toBe(201);
    const phone = '+84901234567';
    const [firstPayload, secondPayload] = await Promise.all([
      promotionBookingPayload(
        firstHold.body.data.holdToken,
        [tripSeatIds[0]],
        promotion.maKhuyenMai,
        phone,
      ),
      promotionBookingPayload(
        secondHold.body.data.holdToken,
        [tripSeatIds[1]],
        promotion.maKhuyenMai,
        '0901234567',
      ),
    ]);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(firstPayload),
      request(competingApp.getHttpServer())
        .post('/api/v1/bookings')
        .send(secondPayload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409)?.body.error).toBe('PROMOTION_ALREADY_USED');
    expect(await prisma.suDungKhuyenMai.count({ where: { khuyenMaiId: promotion.khuyenMaiId } })).toBe(1);
    expect(
      (await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotion.khuyenMaiId } })).soLuotDaSuDung,
    ).toBe(1);
  });

  it('expires a pending promoted booking without restoring quota or deleting its ledger', async () => {
    const promotion = await createPromotion({ quota: 2 });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    const payload = await promotionBookingPayload(
      hold.body.data.holdToken,
      [tripSeatIds[0]],
      promotion.maKhuyenMai,
      '0901234567',
    );
    const bookingResponse = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(payload);
    expect(bookingResponse.status, JSON.stringify(bookingResponse.body)).toBe(201);
    const bookingId = bookingResponse.body.data.bookingId;

    const expired = await app
      .get(PaymentsService)
      .expireBookingIfExpired(bookingId, new Date(Date.now() + 11 * 60 * 1000));

    expect(expired).toBe(true);
    expect(
      (await prisma.phieuDatVe.findUniqueOrThrow({ where: { phieuDatVeId: bookingId } })).trangThai,
    ).toBe('DA_HUY');
    expect(await prisma.suDungKhuyenMai.count({ where: { phieuDatVeId: bookingId } })).toBe(1);
    expect(
      (await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotion.khuyenMaiId } })).soLuotDaSuDung,
    ).toBe(1);
    expect(
      (await prisma.gheChuyenXe.findUniqueOrThrow({ where: { gheChuyenXeId: tripSeatIds[0] } })).trangThai,
    ).toBe('TRONG');
  });

  it('applies a booking promotion only to tickets when cargo is attached', async () => {
    const promotion = await createPromotion({ amount: 30_000 });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    const expectedPromotionQuote = await fetchPromotionQuote(
      [tripSeatIds[0]],
      promotion.maKhuyenMai,
      customerPhone,
    );
    if (!expectedPromotionQuote) throw new Error('Cargo promotion quote was rejected.');
    expect(expectedPromotionQuote).toMatchObject({
      originalTotal: '150000.00',
      discountAmount: '30000.00',
      finalTotal: '120000.00',
    });
    const payload = {
      ...bookingWithCargoPayload(hold.body.data.holdToken, [
        { name: 'Hành lý coupon', loaiHangHoaId: cargoTypeId, quantity: 1, weight: 2 },
      ]),
      promotionCode: promotion.maKhuyenMai,
      expectedPromotionQuote,
    };
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(payload);

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data).toMatchObject({
      originalTicketSubtotal: 150_000,
      discountAmount: 30_000,
      ticketSubtotal: 120_000,
      shippingFee: 60_000,
      totalAmount: 180_000,
    });
    const shipment = await prisma.phieuGuiHang.findFirstOrThrow({
      where: { donGiaoDichId: response.body.data.orderId },
    });
    expect(shipment.khuyenMaiId).toBeNull();
    expect(Number(shipment.tongPhi)).toBe(60_000);
    expect(await prisma.suDungKhuyenMai.count({ where: { khuyenMaiId: promotion.khuyenMaiId } })).toBe(1);
  });

  it('rolls back the real MySQL quota and ledger if a later transaction step fails', async () => {
    const promotion = await createPromotion({ quota: 2 });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status).toBe(201);
    const promotionsService = app.get(PromotionsService);
    const recordUsage = promotionsService.recordUsageInTransaction.bind(promotionsService);
    const recordSpy = vi
      .spyOn(promotionsService, 'recordUsageInTransaction')
      .mockImplementation(async (...args) => {
        await recordUsage(...args);
        throw new Error('Injected failure after writing real promotion ledger');
      });
    let response;
    try {
      const payload = await promotionBookingPayload(
        hold.body.data.holdToken,
        [tripSeatIds[0]],
        promotion.maKhuyenMai,
        '0901234567',
      );
      response = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(payload);
    } finally {
      recordSpy.mockRestore();
    }

    expect(response?.status).toBe(500);
    expect(await prisma.suDungKhuyenMai.count({ where: { khuyenMaiId: promotion.khuyenMaiId } })).toBe(0);
    expect(
      (await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotion.khuyenMaiId } })).soLuotDaSuDung,
    ).toBe(0);
    expect(await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } })).toBe(0);
    const seat = await prisma.gheChuyenXe.findUniqueOrThrow({ where: { gheChuyenXeId: tripSeatIds[0] } });
    expect(seat.trangThai).toBe('DANG_GIU');
    expect(seat.giuChoId).not.toBeNull();
  });

  it('returns HTTP 410 for legacy validation regardless of client-supplied amount', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/promotions/validate')
      .send({ nhaXeId: busCompanyId, code: 'INJECTED', totalAmount: 999_999_999, seatCount: 99 });

    expect(response.status).toBe(410);
    expect(response.body.error).toBe('PROMOTION_VALIDATE_DEPRECATED');
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
    const body = JSON.stringify({
      id: eventId,
      transactionDate: new Date(Date.now() + 7 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' '),
      accountNumber: sepayAccountNumber,
      code: 'TRUNCATED',
      content: booking.orderCode,
      transferType: 'in',
      transferAmount: booking.totalAmount,
    });
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
    const settled = await prisma.phieuDatVe.findUniqueOrThrow({
      where: { phieuDatVeId: booking.bookingId },
      include: { donGiaoDich: { include: { thanhToans: true } }, ves: true },
    });
    expect(settled.trangThai).toBe('DA_THANH_TOAN');
    expect(settled.donGiaoDich.trangThai).toBe('DA_THANH_TOAN');
    expect(settled.ves).toHaveLength(1);
    expect(settled.ves[0].trangThai).toBe('DA_THANH_TOAN');
    expect(settled.donGiaoDich.thanhToans).toHaveLength(1);
    expect(settled.donGiaoDich.thanhToans[0]).toMatchObject({
      phuongThuc: 'SEPAY',
      trangThai: 'THANH_CONG',
      maGiaoDichSePay: String(eventId),
    });
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
    expect(standaloneShipment.donGiaoDich.thanhToans).toHaveLength(1);
    expect(standaloneShipment.donGiaoDich.thanhToans[0]).toMatchObject({
      phuongThuc: 'SEPAY',
      loaiGiaoDich: 'THANH_TOAN',
      trangThai: 'DANG_XU_LY',
    });
    expect(Number(standaloneShipment.donGiaoDich.thanhToans[0].soTien)).toBe(
      Number(standaloneShipment.donGiaoDich.tongTien),
    );
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

  it('accepts two 25kg packages, snapshots the 50kg rate, and consumes two capacity units', async () => {
    currentPrincipal = customerPrincipal;
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tripId },
      data: { sucChuaHangCongKenh: 2 },
    });
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status, JSON.stringify(hold.body)).toBe(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(
        bookingWithCargoPayload(hold.body.data.holdToken, [
          {
            name: 'Hai thùng hàng',
            type: 'Vali',
            loaiHangHoaId: bulkyCargoTypeId,
            quantity: 2,
            weight: 25,
          },
        ]),
      );

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data).toMatchObject({
      shippingFee: 90_000,
      totalAmount: 240_000,
    });
    const shipmentId = response.body.data.shipment.shipmentId as number;
    const shipment = await prisma.phieuGuiHang.findUniqueOrThrow({
      where: { phieuGuiHangId: shipmentId },
      include: { chiTietCuocGuiHangs: true, hangHoas: true },
    });
    expect(shipment.chiTietCuocGuiHangs).toHaveLength(1);
    expect(shipment.chiTietCuocGuiHangs[0].bangCuocGuiHangId).toBe(
      bulkyHeavyCargoRateId,
    );
    expect(Number(shipment.chiTietCuocGuiHangs[0].khoiLuongTinhCuoc)).toBe(50);
    expect(Number(shipment.chiTietCuocGuiHangs[0].soTienCuoc)).toBe(90_000);
    expect(shipment.hangHoas).toHaveLength(1);
    expect(shipment.hangHoas[0].soLuong).toBe(2);
    expect(Number(shipment.hangHoas[0].khoiLuong)).toBe(25);

    const capacity = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}/cargo-capacity`);
    expect(capacity.body.data.capacities.bulkyGoods).toEqual({
      total: 2,
      used: 2,
      remaining: 0,
    });
  });

  it('rejects a 41kg package without partial booking writes or consuming its seat hold', async () => {
    currentPrincipal = customerPrincipal;
    const hold = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeatIds[0]] });
    expect(hold.status, JSON.stringify(hold.body)).toBe(201);

    const countBookingAndCargoRecords = async () => ({
      orders: await prisma.donGiaoDich.count({ where: { nhaXeId: busCompanyId } }),
      bookings: await prisma.phieuDatVe.count({
        where: { donGiaoDich: { nhaXeId: busCompanyId } },
      }),
      tickets: await prisma.ve.count({
        where: { phieuDatVe: { donGiaoDich: { nhaXeId: busCompanyId } } },
      }),
      payments: await prisma.thanhToan.count({
        where: { donGiaoDich: { nhaXeId: busCompanyId } },
      }),
      shipments: await prisma.phieuGuiHang.count({ where: { chuyenXeId: tripId } }),
      items: await prisma.hangHoa.count({
        where: { phieuGuiHang: { chuyenXeId: tripId } },
      }),
      feeDetails: await prisma.chiTietCuocGuiHang.count({
        where: { phieuGuiHang: { chuyenXeId: tripId } },
      }),
    });
    const before = await countBookingAndCargoRecords();

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(
        bookingWithCargoPayload(hold.body.data.holdToken, [
          {
            name: 'Thùng quá cân',
            type: 'Vali',
            loaiHangHoaId: bulkyCargoTypeId,
            quantity: 2,
            weight: 41,
          },
        ]),
      );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'CARGO_WEIGHT_EXCEEDED',
      message: expect.stringContaining('mỗi kiện tối đa 40kg'),
    });
    expect(await countBookingAndCargoRecords()).toEqual(before);
    const seat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeatIds[0] },
    });
    expect(seat.trangThai).toBe('DANG_GIU');
    expect(seat.giuChoId).not.toBeNull();
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
