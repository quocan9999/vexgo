import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('Reviews API Integration with MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let busCompanyId: number;
  let routeId: number;
  let vehicleTypeId: number;
  let vehicleId: number;
  let bangGiaId: number;
  let departedTripId: number;
  let futureTripId: number;
  let departedTripSeatId: number;
  let futureTripSeatId: number;

  let currentPrincipal: AuthPrincipal | null = null;
  let customerAId: number;
  let customerAPrincipal: AuthPrincipal;
  let customerBId: number;
  let customerBPrincipal: AuthPrincipal;

  beforeAll(async () => {
    const accessTokenGuard = {
      canActivate(context: ExecutionContext) {
        if (currentPrincipal) {
          context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
            currentPrincipal;
          return true;
        }
        return false;
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

    // 1. Bus Company, Route, Vehicle Type, Vehicle with seats
    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-REV-${suffix}`,
        tenNhaXe: `Review Test Co ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    busCompanyId = company.nhaXeId;

    const route = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: `TX-REV-${suffix}`,
        diemDi: 'Sài Gòn',
        diemDen: 'Vũng Tàu',
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
      },
      select: { tuyenXeId: true },
    });
    routeId = route.tuyenXeId;

    const vehicleType = await prisma.loaiXe.create({
      data: {
        nhaXeId: busCompanyId,
        tenLoai: `Ghế ngồi ${suffix}`,
      },
      select: { loaiXeId: true },
    });
    vehicleTypeId = vehicleType.loaiXeId;

    const vehicle = await prisma.xe.create({
      data: {
        bienSoXe: `72A-${suffix}`,
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
        loaiXeId: vehicleTypeId,
        ghes: {
          create: [
            { soGhe: 'R01', viTri: 'Tầng 1' },
            { soGhe: 'R02', viTri: 'Tầng 1' },
          ],
        },
      },
      include: { ghes: true },
    });
    vehicleId = vehicle.xeId;

    // 2. Bang Gia
    const fare = await prisma.bangGia.create({
      data: {
        nhaXeId: busCompanyId,
        tuyenXeId: routeId,
        loaiXeId: vehicleTypeId,
        giaNiemYet: 150000,
        tuNgay: new Date('2020-01-01'),
        trangThai: 'HOAT_DONG',
      },
      select: { bangGiaId: true },
    });
    bangGiaId = fare.bangGiaId;

    // 3. Customers
    const accountA = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8493${suffix.slice(0, 7)}`,
        matKhau: '$2b$10$hashedpasswordforexampletest',
        hoTen: `Reviewer A ${suffix}`,
        trangThai: 'HOAT_DONG',
        daXacThucSoDienThoai: true,
        khachHang: {
          create: {
            maKhachHang: `KH-RA-${suffix}`,
          },
        },
      },
      include: { khachHang: true },
    });
    customerAId = accountA.khachHang!.khachHangId;
    customerAPrincipal = {
      taiKhoanId: accountA.taiKhoanId,
      sessionId: `sess-ra-${suffix}`,
      roles: ['CUSTOMER'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };

    const accountB = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8494${suffix.slice(0, 7)}`,
        matKhau: '$2b$10$hashedpasswordforexampletest',
        hoTen: `Reviewer B ${suffix}`,
        trangThai: 'HOAT_DONG',
        daXacThucSoDienThoai: true,
        khachHang: {
          create: {
            maKhachHang: `KH-RB-${suffix}`,
          },
        },
      },
      include: { khachHang: true },
    });
    customerBId = accountB.khachHang!.khachHangId;
    customerBPrincipal = {
      taiKhoanId: accountB.taiKhoanId,
      sessionId: `sess-rb-${suffix}`,
      roles: ['CUSTOMER'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };

    // 4. Departed trip (in the past) and Future trip (in the future)
    const departedTrip = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: `CX-DEP-${suffix}`,
        ngayKhoiHanh: new Date('2020-01-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        trangThai: 'HOAN_THANH',
        nhaXeId: busCompanyId,
        tuyenXeId: routeId,
        xeId: vehicleId,
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        gheChuyenXes: {
          create: [{ gheId: vehicle.ghes[0].gheId, trangThai: 'DA_DAT' }],
        },
      },
      include: { gheChuyenXes: true },
    });
    departedTripId = departedTrip.chuyenXeId;
    departedTripSeatId = departedTrip.gheChuyenXes[0].gheChuyenXeId;

    const futureTrip = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: `CX-FUT-${suffix}`,
        ngayKhoiHanh: new Date('2099-01-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: busCompanyId,
        tuyenXeId: routeId,
        xeId: vehicleId,
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        gheChuyenXes: {
          create: [{ gheId: vehicle.ghes[1].gheId, trangThai: 'DA_DAT' }],
        },
      },
      include: { gheChuyenXes: true },
    });
    futureTripId = futureTrip.chuyenXeId;
    futureTripSeatId = futureTrip.gheChuyenXes[0].gheChuyenXeId;
  }, 30_000);

  afterAll(async () => {
    try {
      await prisma.phanHoi.deleteMany({
        where: { chuyenXeId: { in: [departedTripId, futureTripId] } },
      });
      await prisma.ve.deleteMany({
        where: { gheChuyenXeId: { in: [departedTripSeatId, futureTripSeatId] } },
      });
      await prisma.phieuDatVe.deleteMany({
        where: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } },
      });
      await prisma.donGiaoDich.deleteMany({
        where: { khachHangId: { in: [customerAId, customerBId] } },
      });
      await prisma.bangGia.deleteMany({ where: { bangGiaId } });
      await prisma.gheChuyenXe.deleteMany({
        where: { chuyenXeId: { in: [departedTripId, futureTripId] } },
      });
      await prisma.chuyenXe.deleteMany({
        where: { chuyenXeId: { in: [departedTripId, futureTripId] } },
      });
      await prisma.ghe.deleteMany({ where: { xeId: vehicleId } });
      await prisma.xe.deleteMany({ where: { xeId: vehicleId } });
      await prisma.loaiXe.deleteMany({ where: { loaiXeId: vehicleTypeId } });
      await prisma.tuyenXe.deleteMany({ where: { tuyenXeId: routeId } });
      await prisma.nhaXe.deleteMany({ where: { nhaXeId: busCompanyId } });

      await prisma.khachHang.deleteMany({ where: { khachHangId: { in: [customerAId, customerBId] } } });
      await prisma.taiKhoan.deleteMany({ where: { taiKhoanId: { in: [customerAPrincipal.taiKhoanId, customerBPrincipal.taiKhoanId] } } });
    } finally {
      await app?.close();
    }
  }, 30_000);

  beforeEach(async () => {
    currentPrincipal = null;
    await prisma.phanHoi.deleteMany({
      where: { chuyenXeId: { in: [departedTripId, futureTripId] } },
    });
    await prisma.ve.deleteMany({
      where: { gheChuyenXeId: { in: [departedTripSeatId, futureTripSeatId] } },
    });
    await prisma.phieuDatVe.deleteMany({
      where: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } },
    });
    await prisma.donGiaoDich.deleteMany({
      where: { khachHangId: { in: [customerAId, customerBId] } },
    });
  });

  async function createBookingWithTickets(params: {
    customerId: number;
    tripSeatId: number;
    transactionStatus: 'CHO_THANH_TOAN' | 'DA_THANH_TOAN';
    bookingStatus: 'CHO_THANH_TOAN' | 'DA_THANH_TOAN' | 'HOAN_TAT';
    ticketStatus: 'DA_DAT' | 'DA_THANH_TOAN' | 'HOAN_TAT';
  }) {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const don = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich: `DGD-${suffix}`,
        ngayTao: new Date(),
        tongTien: 150000,
        trangThai: params.transactionStatus,
        tenKhachHang: 'Test Buyer',
        soDienThoaiKhachHang: '+84930000001',
        khachHangId: params.customerId,
        nhaXeId: busCompanyId,
        phieuDatVe: {
          create: {
            maPhieuDatVe: `PDV-${suffix}`,
            ngayDat: new Date(),
            soLuongVeBanDau: 1,
            tongTienBanDau: 150000,
            trangThai: params.bookingStatus,
            ves: {
              create: [
                {
                  maVe: `VE-${suffix}`,
                  giaNiemYet: 150000,
                  giaThucTe: 150000,
                  trangThai: params.ticketStatus,
                  gheChuyenXeId: params.tripSeatId,
                  bangGiaApDungId: bangGiaId,
                },
              ],
            },
          },
        },
      },
      include: {
        phieuDatVe: {
          include: { ves: true },
        },
      },
    });
    return don;
  }

  it('rejects review when customer has unpaid booking (CHO_THANH_TOAN) with 403 Forbidden', async () => {
    await createBookingWithTickets({
      customerId: customerAId,
      tripSeatId: departedTripSeatId,
      transactionStatus: 'CHO_THANH_TOAN',
      bookingStatus: 'CHO_THANH_TOAN',
      ticketStatus: 'DA_DAT',
    });

    currentPrincipal = customerAPrincipal;
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({
        tripId: departedTripId,
        rating: 5,
        comment: 'Xe chạy rất đúng giờ và êm ái.',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('rejects review when customer has no booking or ticket for this trip with 403 Forbidden', async () => {
    currentPrincipal = customerBPrincipal; // Customer B has NO bookings at all
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({
        tripId: departedTripId,
        rating: 4,
        comment: 'Tôi chưa từng đi nhưng muốn đánh giá',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('allows review when customer has paid booking (DA_THANH_TOAN) and trip departed with 201 Created', async () => {
    await createBookingWithTickets({
      customerId: customerAId,
      tripSeatId: departedTripSeatId,
      transactionStatus: 'DA_THANH_TOAN',
      bookingStatus: 'DA_THANH_TOAN',
      ticketStatus: 'DA_THANH_TOAN',
    });

    currentPrincipal = customerAPrincipal;
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({
        tripId: departedTripId,
        rating: 5,
        comment: 'Chuyến xe rất sạch sẽ, tài xế lịch sự!',
      });

    expect(res.status).toBe(201);
    const body = res.body.data ?? res.body;
    expect(body.reviewId).toBeDefined();
    expect(body.tripId).toBe(departedTripId);
    expect(body.rating).toBe(5);
    expect(body.comment).toBe('Chuyến xe rất sạch sẽ, tài xế lịch sự!');

    // DB verification
    const dbReview = await prisma.phanHoi.findFirst({
      where: { khachHangId: customerAId, chuyenXeId: departedTripId },
    });
    expect(dbReview).toBeDefined();
    expect(dbReview?.mucDanhGia).toBe(5);
  });

  it('rejects duplicate review for the same trip with 409 Conflict', async () => {
    await createBookingWithTickets({
      customerId: customerAId,
      tripSeatId: departedTripSeatId,
      transactionStatus: 'DA_THANH_TOAN',
      bookingStatus: 'DA_THANH_TOAN',
      ticketStatus: 'DA_THANH_TOAN',
    });

    currentPrincipal = customerAPrincipal;
    // First review succeeds
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({
        tripId: departedTripId,
        rating: 5,
        comment: 'Đánh giá lần 1',
      });
    expect(res1.status).toBe(201);

    // Second review on the exact same trip fails with 409
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({
        tripId: departedTripId,
        rating: 4,
        comment: 'Đánh giá lần 2 trùng lặp',
      });
    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('CONFLICT');
  });

  it('rejects review on future trip that has not departed yet with 409 Conflict', async () => {
    await createBookingWithTickets({
      customerId: customerAId,
      tripSeatId: futureTripSeatId,
      transactionStatus: 'DA_THANH_TOAN',
      bookingStatus: 'DA_THANH_TOAN',
      ticketStatus: 'DA_THANH_TOAN',
    });

    currentPrincipal = customerAPrincipal;
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({
        tripId: futureTripId,
        rating: 5,
        comment: 'Chuyến xe tương lai chưa chạy',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
  });
});
