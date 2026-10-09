import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

function readLocalEnvValue(name: string): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '.env'),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    const line = readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim();
  }
  return undefined;
}

function databaseTarget(value: string) {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
  };
}

const testDatabaseUrl =
  process.env.FEATURE07_TEST_DATABASE_URL ??
  readLocalEnvValue('FEATURE07_TEST_DATABASE_URL');
const runtimeDatabaseUrl =
  process.env.DATABASE_URL ?? readLocalEnvValue('DATABASE_URL');
const shadowDatabaseUrl =
  process.env.SHADOW_DATABASE_URL ?? readLocalEnvValue('SHADOW_DATABASE_URL');

if (testDatabaseUrl) {
  const target = databaseTarget(testDatabaseUrl);
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!localHosts.has(target.host)) {
    throw new Error('Feature 07 test database must target localhost.');
  }
  if (!/^vexgo_feature07.*test$/i.test(target.database)) {
    throw new Error(
      'Feature 07 read API tests only allow a dedicated test database (e.g. vexgo_feature07_test or vexgo_feature07_ci_test).',
    );
  }
  const isCi = process.env.CI === 'true';
  const allowedPort = isCi
    ? target.port === 3306 || target.port === 3307
    : target.port === 3307;
  if (!allowedPort) {
    throw new Error(
      isCi
        ? 'CI Feature 07 test database port must be 3306 or 3307.'
        : 'Local Feature 07 test database must use port 3307.',
    );
  }

  if (runtimeDatabaseUrl) {
    const runtimeTarget = databaseTarget(runtimeDatabaseUrl);
    if (
      target.host === runtimeTarget.host &&
      target.port === runtimeTarget.port &&
      target.database === runtimeTarget.database
    ) {
      throw new Error(
        'Feature 07 test database must not point to the runtime database.',
      );
    }
  }
  if (shadowDatabaseUrl) {
    const shadowTarget = databaseTarget(shadowDatabaseUrl);
    if (
      target.host === shadowTarget.host &&
      target.port === shadowTarget.port &&
      target.database === shadowTarget.database
    ) {
      throw new Error(
        'Feature 07 test database must not point to the shadow database.',
      );
    }
  }
}

const featureDescribe = testDatabaseUrl ? describe : describe.skip;
const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
const fixturePrefix = `F07-READ-${suffix}`;
const tenantAToken = 'Bearer f07-read-tenant-a';
const tenantBToken = 'Bearer f07-read-tenant-b';
const noPermissionToken = 'Bearer f07-read-no-permission';
const customerToken = 'Bearer f07-read-customer';
const superAdminToken = 'Bearer f07-read-super-admin';
const missingTenantToken = 'Bearer f07-read-missing-tenant';

type TenantFixture = {
  nhaXeId: number;
  tuyenXeId: number;
  xeId: number;
  loaiXeId: number;
  bangGiaId: number;
  seats: Map<string, number>;
  trips: Map<string, number>;
};

type BookingFixture = {
  phieuDatVeId: number;
  donGiaoDichId: number;
  ticketIds: number[];
  bookingCode: string;
  ticketCodes: string[];
};

featureDescribe(
  'Admin bookings and tickets read APIs with Feature 07 MySQL',
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let tenantA: TenantFixture;
    let tenantB: TenantFixture;
    let customerId: number | undefined;
    let customerAccountId: number | undefined;
    let bookingA: BookingFixture;
    let bookingA2: BookingFixture;
    let inconsistentBookingA: BookingFixture;
    let bookingB: BookingFixture;
    let ticketCodes: string[];
    let bookingCodes: string[];
    let customerName: string;
    let customerPhone: string;

    const principals: Record<string, AuthPrincipal> = {
      [tenantAToken]: {
        taiKhoanId: 1,
        sessionId: 'f07-read-tenant-a-session',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['booking:read'],
        nhanVienId: 1,
        nhaXeId: 0,
      },
      [tenantBToken]: {
        taiKhoanId: 2,
        sessionId: 'f07-read-tenant-b-session',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['booking:read'],
        nhanVienId: 2,
        nhaXeId: 0,
      },
      [noPermissionToken]: {
        taiKhoanId: 3,
        sessionId: 'f07-read-no-permission-session',
        roles: ['NHA_XE_ADMIN'],
        permissions: [],
        nhanVienId: 3,
        nhaXeId: 0,
      },
      [customerToken]: {
        taiKhoanId: 4,
        sessionId: 'f07-read-customer-session',
        roles: ['KHACH_HANG'],
        permissions: ['booking:read'],
        nhanVienId: null,
        nhaXeId: null,
      },
      [superAdminToken]: {
        taiKhoanId: 5,
        sessionId: 'f07-read-super-admin-session',
        roles: ['SUPER_ADMIN'],
        permissions: ['booking:read'],
        nhanVienId: null,
        nhaXeId: null,
      },
      [missingTenantToken]: {
        taiKhoanId: 6,
        sessionId: 'f07-read-missing-tenant-session',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['booking:read'],
        nhanVienId: 6,
        nhaXeId: null,
      },
    };

    const accessTokenGuard = {
      canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest<{
          headers: { authorization?: string };
          user?: AuthPrincipal;
        }>();
        const token = req.headers.authorization;
        if (!token || !principals[token]) {
          throw new UnauthorizedException({
            error: 'ACCESS_TOKEN_INVALID',
            message: 'Cần đăng nhập để thực hiện thao tác này.',
          });
        }
        req.user = principals[token];
        return true;
      },
    };

    async function createTenant(label: 'A' | 'B'): Promise<TenantFixture> {
      const company = await prisma.nhaXe.create({
        data: {
          maNhaXe: `${fixturePrefix}-${label}`,
          tenNhaXe: `Feature 07 Tenant ${label} ${suffix}`,
          trangThai: 'HOAT_DONG',
        },
        select: { nhaXeId: true },
      });
      const route = await prisma.tuyenXe.create({
        data: {
          maTuyenXe: `${fixturePrefix}-ROUTE-${label}`,
          diemDi: label === 'A' ? 'TP.HCM' : 'Hà Nội',
          diemDen: label === 'A' ? 'Đà Lạt' : 'Huế',
          trangThai: 'HOAT_DONG',
          nhaXeId: company.nhaXeId,
        },
        select: { tuyenXeId: true },
      });
      const vehicleType = await prisma.loaiXe.create({
        data: {
          nhaXeId: company.nhaXeId,
          tenLoai: `${fixturePrefix} type ${label}`,
        },
        select: { loaiXeId: true },
      });
      const vehicle = await prisma.xe.create({
        data: {
          bienSoXe: `F07-${suffix.slice(0, 5)}-${label}`,
          trangThai: 'HOAT_DONG',
          nhaXeId: company.nhaXeId,
          loaiXeId: vehicleType.loaiXeId,
          ghes: {
            create: Array.from({ length: 6 }, (_, index) => ({
              soGhe: `${label}${String(index + 1).padStart(2, '0')}`,
              viTri: 'Tầng 1',
            })),
          },
        },
        select: {
          xeId: true,
          ghes: { select: { gheId: true, soGhe: true } },
        },
      });
      const fares = await prisma.bangGia.create({
        data: {
          giaNiemYet: '100000',
          tuNgay: new Date('2026-01-01T00:00:00.000Z'),
          trangThai: 'HOAT_DONG',
          nhaXeId: company.nhaXeId,
          tuyenXeId: route.tuyenXeId,
          loaiXeId: vehicleType.loaiXeId,
        },
        select: { bangGiaId: true },
      });
      const seatMap = new Map(
        vehicle.ghes.map(({ gheId, soGhe }) => [soGhe, gheId]),
      );
      const trips = new Map<string, number>();
      const tripDates =
        label === 'A'
          ? [
              ['primary', '2026-10-09'],
              ['secondary', '2026-10-10'],
            ]
          : [['primary', '2026-10-09']];
      for (const [tripLabel, date] of tripDates) {
        const trip = await prisma.chuyenXe.create({
          data: {
            maChuyenXe: `${fixturePrefix}-TRIP-${label}-${tripLabel}`,
            ngayKhoiHanh: new Date(`${date}T00:00:00.000Z`),
            gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
            sucChuaXeMay: 1,
            sucChuaHangCongKenh: 2,
            sucChuaHangNhe: 2,
            trangThai: 'CHUA_KHOI_HANH',
            nhaXeId: company.nhaXeId,
            tuyenXeId: route.tuyenXeId,
            xeId: vehicle.xeId,
          },
          select: { chuyenXeId: true },
        });
        trips.set(tripLabel, trip.chuyenXeId);
        await prisma.gheChuyenXe.createMany({
          data: [...seatMap.values()].map((gheId) => ({
            trangThai: 'DA_DAT',
            chuyenXeId: trip.chuyenXeId,
            gheId,
          })),
        });
      }
      const tripSeats = await prisma.gheChuyenXe.findMany({
        where: { chuyenXeId: { in: [...trips.values()] } },
        select: {
          gheChuyenXeId: true,
          ghe: { select: { soGhe: true } },
          chuyenXeId: true,
        },
      });
      const tripSeatMap = new Map(
        tripSeats.map(({ gheChuyenXeId, ghe, chuyenXeId }) => [
          `${chuyenXeId}:${ghe.soGhe}`,
          gheChuyenXeId,
        ]),
      );
      for (const [key, gheChuyenXeId] of tripSeatMap) {
        seatMap.set(key, gheChuyenXeId);
      }
      return {
        nhaXeId: company.nhaXeId,
        tuyenXeId: route.tuyenXeId,
        xeId: vehicle.xeId,
        loaiXeId: vehicleType.loaiXeId,
        bangGiaId: fares.bangGiaId,
        seats: seatMap,
        trips,
      };
    }

    async function createBooking(options: {
      tenant: TenantFixture;
      label: string;
      transactionStatus: string;
      bookingStatus: string;
      ticketDefinitions: Array<{
        seat: string;
        trip: string;
        status: 'DA_DAT' | 'HUY';
      }>;
      bookedAt?: Date;
      initialAmount: string;
      orderAmount: string;
      searchSuffix?: string;
    }): Promise<BookingFixture> {
      if (customerId === undefined) {
        throw new Error('Test fixture customer was not initialized.');
      }
      const bookedAt = options.bookedAt ?? new Date('2026-10-08T17:00:00.000Z');
      const searchableSuffix = options.searchSuffix
        ? `-${options.searchSuffix}`
        : '';
      const bookingCode = `${fixturePrefix}-BOOKING-${options.label}${searchableSuffix}`;
      const transaction = await prisma.donGiaoDich.create({
        data: {
          maDonGiaoDich: `${fixturePrefix}-ORDER-${options.label}`,
          ngayTao: bookedAt,
          tongTien: options.orderAmount,
          trangThai: options.transactionStatus,
          tenKhachHang: customerName,
          soDienThoaiKhachHang: customerPhone,
          emailKhachHang: 'customer@example.test',
          khachHangId: customerId,
          nhaXeId: options.tenant.nhaXeId,
        },
        select: { donGiaoDichId: true },
      });
      const booking = await prisma.phieuDatVe.create({
        data: {
          maPhieuDatVe: bookingCode,
          ngayDat: bookedAt,
          soLuongVeBanDau: options.ticketDefinitions.length,
          tongTienBanDau: options.initialAmount,
          trangThai: options.bookingStatus,
          donGiaoDichId: transaction.donGiaoDichId,
        },
        select: { phieuDatVeId: true },
      });
      const ticketIds: number[] = [];
      const createdTicketCodes: string[] = [];
      for (const [index, definition] of options.ticketDefinitions.entries()) {
        const tripId = options.tenant.trips.get(definition.trip);
        const gheChuyenXeId = options.tenant.seats.get(
          `${tripId}:${definition.seat}`,
        );
        if (!tripId || !gheChuyenXeId) {
          throw new Error(
            `Test fixture is missing trip seat ${definition.trip}:${definition.seat}.`,
          );
        }
        const ticketCode = `${fixturePrefix}-TICKET-${options.label}-${index + 1}${searchableSuffix}`;
        const ticket = await prisma.ve.create({
          data: {
            maVe: ticketCode,
            diemDon: 'Bến xe thử',
            giaNiemYet: '100000',
            giaThucTe: '100000',
            trangThai: definition.status,
            phieuDatVeId: booking.phieuDatVeId,
            gheChuyenXeId,
            bangGiaApDungId: options.tenant.bangGiaId,
            createdAt: bookedAt,
          },
          select: { veId: true, maVe: true },
        });
        ticketIds.push(ticket.veId);
        ticketCodes.push(ticketCode);
        createdTicketCodes.push(ticketCode);
      }
      bookingCodes.push(bookingCode);
      return {
        phieuDatVeId: booking.phieuDatVeId,
        donGiaoDichId: transaction.donGiaoDichId,
        ticketIds,
        bookingCode,
        ticketCodes: createdTicketCodes,
      };
    }

    async function addShipment(
      booking: BookingFixture,
      tripId: number,
      shipmentSuffix = '',
    ) {
      const sendPoint = await prisma.diemGiaoNhanHang.create({
        data: {
          maDiem: `${fixturePrefix}-SEND${shipmentSuffix}`,
          tenDiem: 'Điểm gửi thử',
          diaChi: '1 Đường Thử',
          tinhThanh: 'TP.HCM',
          trangThai: 'HOAT_DONG',
          nhaXeId: tenantA.nhaXeId,
        },
        select: { diemGiaoNhanHangId: true },
      });
      const receivePoint = await prisma.diemGiaoNhanHang.create({
        data: {
          maDiem: `${fixturePrefix}-RECEIVE${shipmentSuffix}`,
          tenDiem: 'Điểm nhận thử',
          diaChi: '2 Đường Thử',
          tinhThanh: 'Lâm Đồng',
          trangThai: 'HOAT_DONG',
          nhaXeId: tenantA.nhaXeId,
        },
        select: { diemGiaoNhanHangId: true },
      });
      const cargoType = await prisma.loaiHangHoa.create({
        data: {
          tenLoai: `${fixturePrefix}${shipmentSuffix} xe máy`,
          trangThai: 'HOAT_DONG',
          nhomSucChua: 'XE_MAY',
        },
        select: { loaiHangHoaId: true, tenLoai: true },
      });
      const shipment = await prisma.phieuGuiHang.create({
        data: {
          maVanDon: `${fixturePrefix}-SHIPMENT${shipmentSuffix}`,
          tenNguoiNhan: 'Người nhận thử',
          soDienThoaiNguoiNhan: '+84905554444',
          ngayGui: new Date('2026-10-08T17:00:00.000Z'),
          cuocChinh: '150000',
          phiDichVu: '0',
          soTienGiam: '0',
          tongPhi: '150000',
          nguoiTraCuoc: 'NGUOI_GUI',
          trangThai: 'MOI_TAO',
          chuyenXeId: tripId,
          diemGuiId: sendPoint.diemGiaoNhanHangId,
          diemNhanId: receivePoint.diemGiaoNhanHangId,
          donGiaoDichId: booking.donGiaoDichId,
        },
        select: { phieuGuiHangId: true },
      });
      await prisma.hangHoa.create({
        data: {
          tenHang: 'Xe máy mẫu',
          soLuong: 1,
          khoiLuong: '100',
          giaTriKhaiBao: '12300000',
          phieuGuiHangId: shipment.phieuGuiHangId,
          loaiHangHoaId: cargoType.loaiHangHoaId,
        },
      });
      return {
        shipmentId: shipment.phieuGuiHangId,
        cargoTypeName: cargoType.tenLoai,
      };
    }

    async function addHistory(booking: BookingFixture) {
      if (customerAccountId === undefined) {
        throw new Error('Test fixture customer account was not initialized.');
      }
      const sameTime = new Date('2026-10-08T17:00:00.000Z');
      await prisma.lichSuTrangThaiPhieuDatVe.createMany({
        data: [
          {
            phieuDatVeId: booking.phieuDatVeId,
            trangThaiCu: null,
            trangThaiMoi: 'CHO_THANH_TOAN',
            thoiDiem: sameTime,
            nguonThayDoi: 'SYSTEM',
            taiKhoanId: null,
            lyDo: 'Khởi tạo lịch sử trạng thái từ dữ liệu hiện có',
            maThaoTac: randomUUID(),
          },
          {
            phieuDatVeId: booking.phieuDatVeId,
            trangThaiCu: 'CHO_THANH_TOAN',
            trangThaiMoi: 'DA_THANH_TOAN',
            thoiDiem: sameTime,
            nguonThayDoi: 'CUSTOMER',
            taiKhoanId: customerAccountId,
            lyDo: 'Thanh toán được xác nhận',
            maThaoTac: randomUUID(),
          },
        ],
      });
      const ticketId = booking.ticketIds[0];
      await prisma.lichSuTrangThaiVe.createMany({
        data: [
          {
            veId: ticketId,
            trangThaiCu: null,
            trangThaiMoi: 'DA_DAT',
            thoiDiem: sameTime,
            nguonThayDoi: 'SYSTEM',
            taiKhoanId: null,
            lyDo: 'Khởi tạo lịch sử trạng thái từ dữ liệu hiện có',
            maThaoTac: randomUUID(),
          },
          {
            veId: ticketId,
            trangThaiCu: 'DA_DAT',
            trangThaiMoi: 'HUY',
            thoiDiem: sameTime,
            nguonThayDoi: 'CUSTOMER',
            taiKhoanId: customerAccountId,
            lyDo: 'Khách hủy một vé',
            maThaoTac: randomUUID(),
          },
        ],
      });
    }

    beforeAll(async () => {
      if (!testDatabaseUrl)
        throw new Error('Feature 07 test database is required.');
      prisma = new PrismaService(
        new ConfigService({ DATABASE_URL: testDatabaseUrl }),
      );
      await prisma.$connect();

      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(AccessTokenGuard)
        .useValue(accessTokenGuard)
        .overrideProvider(PrismaService)
        .useValue(prisma)
        .compile();
      app = moduleRef.createNestApplication();
      configureApi(app);
      await app.init();

      customerName = `Feature 07 Customer ${suffix}`;
      customerPhone = `+8490${suffix.slice(0, 9)}`;
      const account = await prisma.taiKhoan.create({
        data: {
          hoTen: customerName,
          soDienThoai: customerPhone,
          matKhau: 'test-only-password-hash',
          daXacThucSoDienThoai: true,
          trangThai: 'HOAT_DONG',
        },
        select: { taiKhoanId: true },
      });
      customerAccountId = account.taiKhoanId;
      const customer = await prisma.khachHang.create({
        data: {
          maKhachHang: `${fixturePrefix}-CUSTOMER`,
          taiKhoanId: account.taiKhoanId,
        },
        select: { khachHangId: true },
      });
      customerId = customer.khachHangId;

      tenantA = await createTenant('A');
      tenantB = await createTenant('B');
      principals[tenantAToken] = {
        ...principals[tenantAToken],
        nhaXeId: tenantA.nhaXeId,
      };
      principals[tenantBToken] = {
        ...principals[tenantBToken],
        nhaXeId: tenantB.nhaXeId,
      };
      principals[noPermissionToken] = {
        ...principals[noPermissionToken],
        nhaXeId: tenantA.nhaXeId,
      };
      principals[missingTenantToken] = {
        ...principals[missingTenantToken],
        nhaXeId: null,
      };

      ticketCodes = [];
      bookingCodes = [];
      bookingA = await createBooking({
        tenant: tenantA,
        label: 'A1',
        transactionStatus: 'DA_HUY',
        bookingStatus: 'DA_THANH_TOAN',
        bookedAt: new Date('2026-10-08T17:00:00.000Z'),
        initialAmount: '300000',
        orderAmount: '450000',
        ticketDefinitions: [
          { seat: 'A01', trip: 'primary', status: 'HUY' },
          { seat: 'A02', trip: 'primary', status: 'DA_DAT' },
          { seat: 'A03', trip: 'primary', status: 'DA_DAT' },
        ],
      });
      bookingA2 = await createBooking({
        tenant: tenantA,
        label: 'A2',
        transactionStatus: 'DA_THANH_TOAN',
        bookingStatus: 'CHO_THANH_TOAN',
        bookedAt: new Date('2026-10-09T16:59:59.000Z'),
        initialAmount: '100000',
        orderAmount: '100000',
        ticketDefinitions: [{ seat: 'A04', trip: 'primary', status: 'DA_DAT' }],
      });
      inconsistentBookingA = await createBooking({
        tenant: tenantA,
        label: 'A3',
        transactionStatus: 'DA_THANH_TOAN',
        bookingStatus: 'DA_THANH_TOAN',
        bookedAt: new Date('2026-10-08T17:00:00.000Z'),
        initialAmount: '200000',
        orderAmount: '200000',
        ticketDefinitions: [
          { seat: 'A05', trip: 'primary', status: 'DA_DAT' },
          { seat: 'A06', trip: 'secondary', status: 'DA_DAT' },
        ],
      });
      bookingB = await createBooking({
        tenant: tenantB,
        label: 'B1',
        transactionStatus: 'DA_HUY',
        bookingStatus: 'DA_HUY',
        initialAmount: '100000',
        orderAmount: '100000',
        ticketDefinitions: [{ seat: 'B01', trip: 'primary', status: 'HUY' }],
      });

      const shipment = await addShipment(
        bookingA,
        tenantA.trips.get('primary')!,
      );
      await addShipment(
        bookingA2,
        tenantA.trips.get('secondary')!,
        '-MISMATCH',
      );
      await addHistory(bookingA);
      await prisma.thanhToan.createMany({
        data: [
          {
            soTien: '450000',
            phuongThuc: 'VNPAY',
            loaiGiaoDich: 'THANH_TOAN',
            thoiGian: new Date('2026-10-08T17:00:00.000Z'),
            trangThai: 'THANH_CONG',
            donGiaoDichId: bookingA.donGiaoDichId,
          },
          {
            soTien: '450000',
            phuongThuc: 'VNPAY',
            loaiGiaoDich: 'THANH_TOAN',
            thoiGian: new Date('2026-10-08T17:01:00.000Z'),
            trangThai: 'DANG_XU_LY',
            donGiaoDichId: bookingA.donGiaoDichId,
          },
          {
            soTien: '100000',
            phuongThuc: 'MOMO',
            loaiGiaoDich: 'HOAN_TIEN',
            thoiGian: new Date('2026-10-08T17:02:00.000Z'),
            trangThai: 'DANG_XU_LY',
            donGiaoDichId: bookingA.donGiaoDichId,
            veId: bookingA.ticketIds[0],
          },
          {
            soTien: '100000',
            phuongThuc: 'MOMO',
            loaiGiaoDich: 'HOAN_TIEN',
            thoiGian: new Date('2026-10-08T17:03:00.000Z'),
            trangThai: 'THANH_CONG',
            donGiaoDichId: bookingA.donGiaoDichId,
            veId: bookingA.ticketIds[0],
          },
          {
            soTien: '150000',
            phuongThuc: 'VNPAY',
            loaiGiaoDich: 'HOAN_TIEN',
            thoiGian: new Date('2026-10-08T17:04:00.000Z'),
            trangThai: 'DANG_GUI',
            donGiaoDichId: bookingA.donGiaoDichId,
            veId: null,
          },
        ],
      });
      expect(shipment.shipmentId).toBeGreaterThan(0);
    }, 60_000);

    afterAll(async () => {
      try {
        if (prisma) {
          const fixtureCompanies = await prisma.nhaXe.findMany({
            where: { maNhaXe: { startsWith: fixturePrefix } },
            select: { nhaXeId: true },
          });
          const companyIds = fixtureCompanies.map(({ nhaXeId }) => nhaXeId);
          const fixtureTransactions = await prisma.donGiaoDich.findMany({
            where: { maDonGiaoDich: { startsWith: fixturePrefix } },
            select: { donGiaoDichId: true },
          });
          const transactionIds = fixtureTransactions.map(
            ({ donGiaoDichId }) => donGiaoDichId,
          );
          const fixtureBookings = await prisma.phieuDatVe.findMany({
            where: { donGiaoDichId: { in: transactionIds } },
            select: { phieuDatVeId: true },
          });
          const bookingIds = fixtureBookings.map(
            ({ phieuDatVeId }) => phieuDatVeId,
          );
          const fixtureTickets = await prisma.ve.findMany({
            where: { phieuDatVeId: { in: bookingIds } },
            select: { veId: true },
          });
          const ticketIds = fixtureTickets.map(({ veId }) => veId);
          const fixtureShipments = await prisma.phieuGuiHang.findMany({
            where: { donGiaoDichId: { in: transactionIds } },
            select: { phieuGuiHangId: true },
          });
          const shipmentIds = fixtureShipments.map(
            ({ phieuGuiHangId }) => phieuGuiHangId,
          );
          const fixtureTrips = await prisma.chuyenXe.findMany({
            where: { nhaXeId: { in: companyIds } },
            select: { chuyenXeId: true },
          });
          const tripIds = fixtureTrips.map(({ chuyenXeId }) => chuyenXeId);
          const fixtureVehicles = await prisma.xe.findMany({
            where: { nhaXeId: { in: companyIds } },
            select: { xeId: true },
          });
          const vehicleIds = fixtureVehicles.map(({ xeId }) => xeId);
          await prisma.$transaction(async (tx) => {
            await tx.lichSuTrangThaiPhieuDatVe.deleteMany({
              where: { phieuDatVeId: { in: bookingIds } },
            });
            await tx.lichSuTrangThaiVe.deleteMany({
              where: { veId: { in: ticketIds } },
            });
            await tx.thanhToan.deleteMany({
              where: {
                OR: [
                  { donGiaoDichId: { in: transactionIds } },
                  { veId: { in: ticketIds } },
                ],
              },
            });
            await tx.hangHoa.deleteMany({
              where: { phieuGuiHangId: { in: shipmentIds } },
            });
            await tx.phieuGuiHang.deleteMany({
              where: { phieuGuiHangId: { in: shipmentIds } },
            });
            await tx.ve.deleteMany({ where: { veId: { in: ticketIds } } });
            await tx.phieuDatVe.deleteMany({
              where: { phieuDatVeId: { in: bookingIds } },
            });
            await tx.donGiaoDich.deleteMany({
              where: { donGiaoDichId: { in: transactionIds } },
            });
            await tx.gheChuyenXe.deleteMany({
              where: { chuyenXeId: { in: tripIds } },
            });
            await tx.chuyenXe.deleteMany({
              where: { chuyenXeId: { in: tripIds } },
            });
            await tx.ghe.deleteMany({ where: { xeId: { in: vehicleIds } } });
            await tx.xe.deleteMany({ where: { xeId: { in: vehicleIds } } });
            await tx.bangGia.deleteMany({
              where: { nhaXeId: { in: companyIds } },
            });
            await tx.loaiXe.deleteMany({
              where: { nhaXeId: { in: companyIds } },
            });
            await tx.tuyenXe.deleteMany({
              where: { nhaXeId: { in: companyIds } },
            });
            await tx.loaiHangHoa.deleteMany({
              where: { tenLoai: { startsWith: fixturePrefix } },
            });
            await tx.diemGiaoNhanHang.deleteMany({
              where: { nhaXeId: { in: companyIds } },
            });
            await tx.nhaXe.deleteMany({
              where: { nhaXeId: { in: companyIds } },
            });
            if (customerId !== undefined) {
              await tx.khachHang.deleteMany({
                where: { khachHangId: customerId },
              });
            }
            if (customerAccountId !== undefined) {
              await tx.taiKhoan.deleteMany({
                where: { taiKhoanId: customerAccountId },
              });
            }
          });
          expect(
            await prisma.donGiaoDich.count({
              where: { maDonGiaoDich: { startsWith: fixturePrefix } },
            }),
          ).toBe(0);
          expect(
            await prisma.nhaXe.count({
              where: { maNhaXe: { startsWith: fixturePrefix } },
            }),
          ).toBe(0);
        }
      } finally {
        await app?.close();
      }
    }, 60_000);

    it('lists bookings with tenant-scoped counts, unique rows, and stable ID tie-breaks', async () => {
      const response = await request(app.getHttpServer())
        .get(
          '/api/v1/admin/bookings?page=1&pageSize=10&sortBy=bookedAt&sortDirection=asc',
        )
        .set('Authorization', tenantAToken)
        .expect(200);

      expect(response.body.meta).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 3,
        totalPages: 1,
      });
      expect(response.body.data).toHaveLength(3);
      expect(
        response.body.data.map((item: { bookingId: number }) => item.bookingId),
      ).toEqual([
        bookingA.phieuDatVeId,
        inconsistentBookingA.phieuDatVeId,
        bookingA2.phieuDatVeId,
      ]);
      expect(response.body.data[0]).toMatchObject({
        bookingCode: `${fixturePrefix}-BOOKING-A1`,
        initialTicketCount: 3,
        ticketCount: 3,
        cancelledTicketCount: 1,
        activeTicketCount: 2,
        initialTicketAmount: '300000',
        status: 'DA_THANH_TOAN',
        isPartiallyCancelled: true,
        tripIntegrity: 'CONSISTENT',
        trip: {
          tripCode: `${fixturePrefix}-TRIP-A-primary`,
          origin: 'TP.HCM',
          destination: 'Đà Lạt',
        },
      });
      expect(response.body.data[1]).toMatchObject({
        trip: null,
        tripIntegrity: 'MULTIPLE_TRIPS',
      });

      for (const sortBy of ['departureTime', 'totalTicketAmount']) {
        const sorted = await request(app.getHttpServer())
          .get(`/api/v1/admin/bookings?sortBy=${sortBy}&sortDirection=asc`)
          .set('Authorization', tenantAToken)
          .expect(200);
        expect(sorted.body.data).toHaveLength(3);
        expect(sorted.body.meta.totalItems).toBe(3);
      }

      const whitespaceSearch = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings?search=%20%20')
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(whitespaceSearch.body.meta.totalItems).toBe(3);

      const tenantBResponse = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .set('Authorization', tenantBToken)
        .expect(200);
      expect(tenantBResponse.body.meta.totalItems).toBe(1);
      expect(
        tenantBResponse.body.data.map(
          (item: { bookingCode: string }) => item.bookingCode,
        ),
      ).toEqual([`${fixturePrefix}-BOOKING-B1`]);
    });

    it('searches booking code, ticket code, customer name and phone without leaking another tenant', async () => {
      const tenantABookingIds = [
        bookingA.phieuDatVeId,
        bookingA2.phieuDatVeId,
        inconsistentBookingA.phieuDatVeId,
      ];
      const tenantABookingCodes = bookingCodes.slice(0, 3);
      const bookingSearches = [
        {
          search: bookingCodes[0],
          bookingIds: [bookingA.phieuDatVeId],
          codes: [bookingCodes[0]],
        },
        {
          search: ticketCodes[0],
          bookingIds: [bookingA.phieuDatVeId],
          codes: [bookingCodes[0]],
        },
        {
          search: customerName,
          bookingIds: tenantABookingIds,
          codes: tenantABookingCodes,
        },
        {
          search: customerPhone,
          bookingIds: tenantABookingIds,
          codes: tenantABookingCodes,
        },
      ];
      for (const { search, bookingIds, codes } of bookingSearches) {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/admin/bookings?search=${encodeURIComponent(search)}`)
          .set('Authorization', tenantAToken)
          .expect(200);
        expect(response.body.meta.totalItems).toBe(bookingIds.length);
        expect(
          response.body.data
            .map((item: { bookingId: number }) => item.bookingId)
            .sort((left: number, right: number) => left - right),
        ).toEqual([...bookingIds].sort((left, right) => left - right));
        expect(
          response.body.data
            .map((item: { bookingCode: string }) => item.bookingCode)
            .sort(),
        ).toEqual([...codes].sort());
      }

      const foreignSearch = await request(app.getHttpServer())
        .get(
          `/api/v1/admin/bookings?search=${encodeURIComponent(bookingCodes[3])}`,
        )
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(foreignSearch.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      });

      const tenantATicketIds = [
        ...bookingA.ticketIds,
        ...bookingA2.ticketIds,
        ...inconsistentBookingA.ticketIds,
      ];
      const tenantATicketCodes = ticketCodes.slice(0, 6);
      const ticketSearches = [
        {
          search: ticketCodes[0],
          ticketIds: [bookingA.ticketIds[0]],
          codes: [ticketCodes[0]],
        },
        {
          search: bookingCodes[0],
          ticketIds: bookingA.ticketIds,
          codes: ticketCodes.slice(0, 3),
        },
        {
          search: customerName,
          ticketIds: tenantATicketIds,
          codes: tenantATicketCodes,
        },
        {
          search: customerPhone,
          ticketIds: tenantATicketIds,
          codes: tenantATicketCodes,
        },
      ];
      for (const { search, ticketIds, codes } of ticketSearches) {
        const ticketSearch = await request(app.getHttpServer())
          .get(`/api/v1/admin/tickets?search=${encodeURIComponent(search)}`)
          .set('Authorization', tenantAToken)
          .expect(200);
        expect(ticketSearch.body.meta.totalItems).toBe(ticketIds.length);
        expect(
          ticketSearch.body.data
            .map((item: { ticketId: number }) => item.ticketId)
            .sort((left: number, right: number) => left - right),
        ).toEqual([...ticketIds].sort((left, right) => left - right));
        expect(
          ticketSearch.body.data
            .map((item: { ticketCode: string }) => item.ticketCode)
            .sort(),
        ).toEqual([...codes].sort());
      }
    });

    it('filters booking and ticket statuses independently and includes date-only boundaries', async () => {
      const bookingStatus = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings?status=DA_HUY')
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(bookingStatus.body.meta.totalItems).toBe(0);

      const ticketStatus = await request(app.getHttpServer())
        .get('/api/v1/admin/tickets?status=HUY')
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(ticketStatus.body.meta.totalItems).toBe(1);
      expect(ticketStatus.body.data[0].ticketCode).toBe(ticketCodes[0]);
      const allCancelledTenantB = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .set('Authorization', tenantBToken)
        .expect(200);
      expect(allCancelledTenantB.body.data[0]).toMatchObject({
        cancelledTicketCount: 1,
        activeTicketCount: 0,
        isPartiallyCancelled: false,
      });

      const bookedBusinessDay = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings?bookedFrom=2026-10-09&bookedTo=2026-10-09')
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(bookedBusinessDay.body.meta.totalItems).toBe(3);

      const departureDay = await request(app.getHttpServer())
        .get(
          '/api/v1/admin/bookings?departureFrom=2026-10-09&departureTo=2026-10-09',
        )
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(departureDay.body.meta.totalItems).toBe(3);
      expect(
        departureDay.body.data.map(
          (item: { bookingCode: string }) => item.bookingCode,
        ),
      ).toContain(`${fixturePrefix}-BOOKING-A3`);
    });

    it('returns a detailed booking with independent ticket/order/shipment and safe payment/refund summaries', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${bookingA.phieuDatVeId}`)
        .set('Authorization', tenantAToken)
        .expect(200);

      expect(response.body.data).toMatchObject({
        bookingCode: `${fixturePrefix}-BOOKING-A1`,
        status: 'DA_THANH_TOAN',
        transactionStatus: 'DA_HUY',
        initialTicketAmount: '300000',
        transactionTotalAmount: '450000',
        isPartiallyCancelled: true,
        shipment: {
          trackingCode: `${fixturePrefix}-SHIPMENT`,
          status: 'MOI_TAO',
          tripId: tenantA.trips.get('primary'),
          tripIntegrity: 'CONSISTENT',
          items: [{ name: 'Xe máy mẫu', quantity: 1 }],
        },
      });
      expect(response.body.data.tickets).toHaveLength(3);
      expect(response.body.data.paymentSummary.originalPayments).toHaveLength(
        2,
      );
      expect(
        response.body.data.paymentSummary.originalPayments[0].allocation,
      ).toBe('UNALLOCATED');
      expect(response.body.data.paymentSummary.refunds.pending).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'DANG_XU_LY',
            ticketId: bookingA.ticketIds[0],
          }),
          expect.objectContaining({ status: 'DANG_GUI', ticketId: null }),
        ]),
      );
      expect(response.body.data.paymentSummary.refunds.succeeded).toEqual([
        expect.objectContaining({
          status: 'THANH_CONG',
          ticketId: bookingA.ticketIds[0],
        }),
      ]);
      expect(JSON.stringify(response.body)).not.toContain('12300000');
      expect(JSON.stringify(response.body)).not.toContain('matKhau');

      const mismatchedShipment = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${bookingA2.phieuDatVeId}`)
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(mismatchedShipment.body.data).toMatchObject({
        tripIntegrity: 'CONSISTENT',
        shipment: {
          tripId: null,
          tripIntegrity: 'TRIP_MISMATCH',
        },
      });

      const noOptionalRelations = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${bookingB.phieuDatVeId}`)
        .set('Authorization', tenantBToken)
        .expect(200);
      expect(noOptionalRelations.body.data.shipment).toBeNull();
      expect(
        noOptionalRelations.body.data.paymentSummary.originalPayments,
      ).toEqual([]);
      expect(noOptionalRelations.body.data.paymentSummary.refunds).toEqual({
        pending: [],
        succeeded: [],
        other: [],
      });
    });

    it('lists and details tickets only through their tenant-owned booking', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/tickets?sortBy=departureTime&sortDirection=asc')
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(response.body.meta.totalItems).toBe(6);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ticketCode: ticketCodes[0],
            bookingCode: `${fixturePrefix}-BOOKING-A1`,
            actualPrice: '100000',
            status: 'HUY',
          }),
        ]),
      );
      expect(
        response.body.data.map(
          (item: { bookingCode: string }) => item.bookingCode,
        ),
      ).not.toContain(`${fixturePrefix}-BOOKING-B1`);

      const firstPage = await request(app.getHttpServer())
        .get(
          '/api/v1/admin/tickets?page=1&pageSize=2&sortBy=bookedAt&sortDirection=asc',
        )
        .set('Authorization', tenantAToken)
        .expect(200);
      const secondPage = await request(app.getHttpServer())
        .get(
          '/api/v1/admin/tickets?page=2&pageSize=2&sortBy=bookedAt&sortDirection=asc',
        )
        .set('Authorization', tenantAToken)
        .expect(200);
      const firstPageAgain = await request(app.getHttpServer())
        .get(
          '/api/v1/admin/tickets?page=1&pageSize=2&sortBy=bookedAt&sortDirection=asc',
        )
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(
        firstPage.body.data.map((item: { ticketId: number }) => item.ticketId),
      ).toEqual(
        firstPageAgain.body.data.map(
          (item: { ticketId: number }) => item.ticketId,
        ),
      );
      expect(
        new Set([
          ...firstPage.body.data.map(
            (item: { ticketId: number }) => item.ticketId,
          ),
          ...secondPage.body.data.map(
            (item: { ticketId: number }) => item.ticketId,
          ),
        ]).size,
      ).toBe(4);
      const ticketDepartureDay = await request(app.getHttpServer())
        .get(
          '/api/v1/admin/tickets?departureFrom=2026-10-09&departureTo=2026-10-09',
        )
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(ticketDepartureDay.body.meta.totalItems).toBe(5);
      const ticketBookedBusinessDay = await request(app.getHttpServer())
        .get('/api/v1/admin/tickets?bookedFrom=2026-10-09&bookedTo=2026-10-09')
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(ticketBookedBusinessDay.body.meta.totalItems).toBe(6);

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/admin/tickets/${bookingA.ticketIds[0]}`)
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(detail.body.data).toMatchObject({
        ticketCode: ticketCodes[0],
        status: 'HUY',
        actualPrice: '100000',
        booking: {
          bookingId: bookingA.phieuDatVeId,
          bookingCode: `${fixturePrefix}-BOOKING-A1`,
        },
        customer: { name: customerName, phoneNumber: customerPhone },
      });
      expect(detail.body.data.refunds).toHaveLength(2);

      const foreignSearch = await request(app.getHttpServer())
        .get(
          `/api/v1/admin/tickets?search=${encodeURIComponent(ticketCodes[6])}`,
        )
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(foreignSearch.body.meta.totalItems).toBe(0);
    });

    it('returns tenant-obscuring 404 for foreign and nonexistent details and histories', async () => {
      const foreignBooking = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${bookingB.phieuDatVeId}`)
        .set('Authorization', tenantAToken)
        .expect(404);
      const missingBooking = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings/2147483647')
        .set('Authorization', tenantAToken)
        .expect(404);
      expect(foreignBooking.body).toEqual(missingBooking.body);

      const foreignBookingHistory = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${bookingB.phieuDatVeId}/history`)
        .set('Authorization', tenantAToken)
        .expect(404);
      const missingBookingHistory = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings/2147483647/history')
        .set('Authorization', tenantAToken)
        .expect(404);
      expect(foreignBookingHistory.body).toEqual(missingBookingHistory.body);

      const foreignTicketHistory = await request(app.getHttpServer())
        .get(`/api/v1/admin/tickets/${bookingB.ticketIds[0]}/history`)
        .set('Authorization', tenantAToken)
        .expect(404);
      const missingTicketHistory = await request(app.getHttpServer())
        .get('/api/v1/admin/tickets/2147483647/history')
        .set('Authorization', tenantAToken)
        .expect(404);
      expect(foreignTicketHistory.body).toEqual(missingTicketHistory.body);

      const foreignTicket = await request(app.getHttpServer())
        .get(`/api/v1/admin/tickets/${bookingB.ticketIds[0]}`)
        .set('Authorization', tenantAToken)
        .expect(404);
      const missingTicket = await request(app.getHttpServer())
        .get('/api/v1/admin/tickets/2147483647')
        .set('Authorization', tenantAToken)
        .expect(404);
      expect(foreignTicket.body).toEqual(missingTicket.body);
    });

    it('returns independent histories in stable order and does not write during GET', async () => {
      const [bookingHistoryBefore, ticketHistoryBefore] = await Promise.all([
        prisma.lichSuTrangThaiPhieuDatVe.count({
          where: { phieuDatVeId: bookingA.phieuDatVeId },
        }),
        prisma.lichSuTrangThaiVe.count({
          where: { veId: bookingA.ticketIds[0] },
        }),
      ]);
      const bookingStatusBefore = await prisma.phieuDatVe.findUniqueOrThrow({
        where: { phieuDatVeId: bookingA.phieuDatVeId },
        select: { trangThai: true },
      });
      const bookingHistory = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${bookingA.phieuDatVeId}/history`)
        .set('Authorization', tenantAToken)
        .expect(200);
      const ticketHistory = await request(app.getHttpServer())
        .get(`/api/v1/admin/tickets/${bookingA.ticketIds[0]}/history`)
        .set('Authorization', tenantAToken)
        .expect(200);

      expect(
        bookingHistory.body.data.map(
          (entry: { newStatus: string }) => entry.newStatus,
        ),
      ).toEqual(['CHO_THANH_TOAN', 'DA_THANH_TOAN']);
      expect(
        ticketHistory.body.data.map(
          (entry: { newStatus: string }) => entry.newStatus,
        ),
      ).toEqual(['DA_DAT', 'HUY']);
      expect(bookingHistory.body.data[0].actorName).toBeNull();
      expect(bookingHistory.body.data[1].actorName).toBe(customerName);
      const [bookingHistoryAfter, ticketHistoryAfter] = await Promise.all([
        prisma.lichSuTrangThaiPhieuDatVe.count({
          where: { phieuDatVeId: bookingA.phieuDatVeId },
        }),
        prisma.lichSuTrangThaiVe.count({
          where: { veId: bookingA.ticketIds[0] },
        }),
      ]);
      expect(bookingHistoryAfter).toBe(bookingHistoryBefore);
      expect(ticketHistoryAfter).toBe(ticketHistoryBefore);
      const bookingStatusAfter = await prisma.phieuDatVe.findUniqueOrThrow({
        where: { phieuDatVeId: bookingA.phieuDatVeId },
        select: { trangThai: true },
      });
      expect(bookingStatusAfter).toEqual(bookingStatusBefore);

      const emptyHistory = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${bookingA2.phieuDatVeId}/history`)
        .set('Authorization', tenantAToken)
        .expect(200);
      expect(emptyHistory.body.data).toEqual([]);
    });

    it('validates status, date ranges, sorting and pagination before querying', async () => {
      for (const query of [
        '?status=DA_HUY&status=HUY',
        '?status=NOT_A_STATUS',
        '?sortBy=internalColumn',
        '?page=0',
        '?pageSize=101',
        '?bookedFrom=2026-10-10&bookedTo=2026-10-09',
        '?departureFrom=2026-02-30',
        '?search=' + 'x'.repeat(101),
      ]) {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/admin/bookings${query}`)
          .set('Authorization', tenantAToken)
          .expect(400);
        expect(response.body.error).toBe('VALIDATION_ERROR');
      }
      for (const query of ['?status=DA_HUY', '?sortBy=totalTicketAmount']) {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/admin/tickets${query}`)
          .set('Authorization', tenantAToken)
          .expect(400);
        expect(response.body.error).toBe('VALIDATION_ERROR');
      }
    });

    const paginationEndpoints: Array<{
      name: string;
      path: () => string;
      defaultPageSize: number;
    }> = [
      {
        name: 'bookings list',
        path: () => '/api/v1/admin/bookings',
        defaultPageSize: 10,
      },
      {
        name: 'tickets list',
        path: () => '/api/v1/admin/tickets',
        defaultPageSize: 10,
      },
      {
        name: 'booking history',
        path: () =>
          `/api/v1/admin/bookings/${bookingA.phieuDatVeId}/history`,
        defaultPageSize: 100,
      },
      {
        name: 'ticket history',
        path: () =>
          `/api/v1/admin/tickets/${bookingA.ticketIds[0]}/history`,
        defaultPageSize: 100,
      },
    ];

    for (const endpoint of paginationEndpoints) {
      it(`validates page boundaries through MySQL for ${endpoint.name}`, async () => {
        const endpointPath = endpoint.path();

        async function expectValidPage(
          query: string,
          expectedPage: number,
          expectedPageSize: number,
        ) {
          const response = await request(app.getHttpServer())
            .get(`${endpointPath}?${query}`)
            .set('Authorization', tenantAToken)
            .expect(200);
          const { meta, data } = response.body;

          expect(Array.isArray(data)).toBe(true);
          expect(meta).toEqual(
            expect.objectContaining({
              page: expectedPage,
              pageSize: expectedPageSize,
              totalItems: expect.any(Number),
              totalPages: expect.any(Number),
            }),
          );
          expect(meta.totalItems).toBeGreaterThan(0);
          expect(meta.totalPages).toBe(
            Math.ceil(meta.totalItems / meta.pageSize),
          );
          expect(data.length).toBeLessThanOrEqual(meta.pageSize);
          if (expectedPage === 1) expect(data.length).toBeGreaterThan(0);
        }

        async function expectInvalidQuery(query: string, field: string) {
          const response = await request(app.getHttpServer())
            .get(`${endpointPath}?${query}`)
            .set('Authorization', tenantAToken)
            .expect(400);

          expect(response.body).toMatchObject({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
          });
          expect(response.body.details).toEqual(
            expect.arrayContaining([expect.objectContaining({ field })]),
          );
        }

        for (const page of [1, 10_000]) {
          await expectValidPage(
            `page=${page}`,
            page,
            endpoint.defaultPageSize,
          );
        }
        for (const pageSize of [1, 100]) {
          await expectValidPage(`pageSize=${pageSize}`, 1, pageSize);
        }
        for (const page of [
          '0',
          '-1',
          '10001',
          '999999999999999999999999999999999999',
          'not-a-number',
          '1.5',
        ]) {
          await expectInvalidQuery(
            `page=${encodeURIComponent(page)}`,
            'page',
          );
        }
        for (const pageSize of ['0', '101', 'not-a-number', '1.5']) {
          await expectInvalidQuery(
            `pageSize=${encodeURIComponent(pageSize)}`,
            'pageSize',
          );
        }
      }, 60_000);
    }

    it('checks authentication, role, permission and tenant scope before endpoint access', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .set('Authorization', customerToken)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .set('Authorization', noPermissionToken)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .set('Authorization', superAdminToken)
        .expect(403);
      const missingTenant = await request(app.getHttpServer())
        .get('/api/v1/admin/bookings')
        .set('Authorization', missingTenantToken)
        .expect(403);
      expect(missingTenant.body.error).toBe('TENANT_SCOPE_REQUIRED');
    });

    it('matches literal LIKE wildcards through both tenant-scoped MySQL search APIs', async () => {
      const marker = `F3${suffix.slice(0, 6)}`;
      const cases = [
        {
          label: 'PCT',
          search: `${marker}P%`,
          lookalike: `${marker}PX`,
        },
        {
          label: 'UND',
          search: `${marker}U_`,
          lookalike: `${marker}UX`,
        },
        {
          label: 'BSL',
          search: `${marker}B\\`,
          lookalike: `${marker}B%`,
        },
      ];
      const tenantASeats = [
        { seat: 'A06', trip: 'primary' },
        { seat: 'A01', trip: 'secondary' },
        { seat: 'A02', trip: 'secondary' },
        { seat: 'A03', trip: 'secondary' },
        { seat: 'A04', trip: 'secondary' },
        { seat: 'A05', trip: 'secondary' },
      ];
      const tenantBSeats = ['B02', 'B03', 'B04'];
      let tenantASeatIndex = 0;
      let tenantBSeatIndex = 0;

      async function createSearchBooking(
        tenant: TenantFixture,
        label: string,
        searchSuffix: string,
        seat: { seat: string; trip: string },
      ) {
        return createBooking({
          tenant,
          label,
          searchSuffix,
          transactionStatus: 'DA_THANH_TOAN',
          bookingStatus: 'DA_THANH_TOAN',
          initialAmount: '100000',
          orderAmount: '100000',
          ticketDefinitions: [{ ...seat, status: 'DA_DAT' }],
        });
      }

      for (const testCase of cases) {
        const caseLabel = `F3${testCase.label}`;
        const targetA = await createSearchBooking(
          tenantA,
          `${caseLabel}A`,
          testCase.search,
          tenantASeats[tenantASeatIndex++],
        );
        const lookalikeA = await createSearchBooking(
          tenantA,
          `${caseLabel}D`,
          testCase.lookalike,
          tenantASeats[tenantASeatIndex++],
        );
        const targetB = await createSearchBooking(
          tenantB,
          `${caseLabel}B`,
          testCase.search,
          { seat: tenantBSeats[tenantBSeatIndex++], trip: 'primary' },
        );

        const persistedBookings = await prisma.phieuDatVe.findMany({
          where: {
            phieuDatVeId: {
              in: [
                targetA.phieuDatVeId,
                lookalikeA.phieuDatVeId,
                targetB.phieuDatVeId,
              ],
            },
          },
          select: { phieuDatVeId: true, maPhieuDatVe: true },
        });
        expect(
          persistedBookings
            .map(({ phieuDatVeId, maPhieuDatVe }) => ({
              phieuDatVeId,
              maPhieuDatVe,
            }))
            .sort((left, right) => left.phieuDatVeId - right.phieuDatVeId),
        ).toEqual(
          [targetA, lookalikeA, targetB]
            .map(({ phieuDatVeId, bookingCode }) => ({
              phieuDatVeId,
              maPhieuDatVe: bookingCode,
            }))
            .sort((left, right) => left.phieuDatVeId - right.phieuDatVeId),
        );

        for (const [token, expected] of [
          [tenantAToken, targetA],
          [tenantBToken, targetB],
        ] as const) {
          const bookingSearch = await request(app.getHttpServer())
            .get(
              `/api/v1/admin/bookings?search=${encodeURIComponent(testCase.search)}`,
            )
            .set('Authorization', token)
            .expect(200);
          expect(bookingSearch.body.meta.totalItems).toBe(1);
          expect(
            bookingSearch.body.data.map(
              (item: { bookingId: number; bookingCode: string }) => ({
                bookingId: item.bookingId,
                bookingCode: item.bookingCode,
              }),
            ),
          ).toEqual([
            {
              bookingId: expected.phieuDatVeId,
              bookingCode: expected.bookingCode,
            },
          ]);

          const ticketSearch = await request(app.getHttpServer())
            .get(
              `/api/v1/admin/tickets?search=${encodeURIComponent(testCase.search)}`,
            )
            .set('Authorization', token)
            .expect(200);
          expect(ticketSearch.body.meta.totalItems).toBe(1);
          expect(
            ticketSearch.body.data.map(
              (item: { ticketId: number; ticketCode: string }) => ({
                ticketId: item.ticketId,
                ticketCode: item.ticketCode,
              }),
            ),
          ).toEqual([
            {
              ticketId: expected.ticketIds[0],
              ticketCode: expected.ticketCodes[0],
            },
          ]);
        }
      }
    });
  },
);
