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
  let departedSecondTripSeatId: number;
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
            { maGhe: `seat-r01-${suffix}`.padEnd(32, '0').slice(0, 32), tenGhe: 'R01', viTri: 'Tầng 1' },
            { maGhe: `seat-r02-${suffix}`.padEnd(32, '0').slice(0, 32), tenGhe: 'R02', viTri: 'Tầng 1' },
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
          create: vehicle.ghes.map((seat) => ({
            gheId: seat.gheId,
            trangThai: 'DA_DAT',
          })),
        },
      },
      include: { gheChuyenXes: true },
    });
    departedTripId = departedTrip.chuyenXeId;
    departedTripSeatId = departedTrip.gheChuyenXes[0].gheChuyenXeId;
    departedSecondTripSeatId = departedTrip.gheChuyenXes[1].gheChuyenXeId;

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
        where: { gheChuyenXeId: { in: [departedTripSeatId, departedSecondTripSeatId, futureTripSeatId] } },
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
      where: { gheChuyenXeId: { in: [departedTripSeatId, departedSecondTripSeatId, futureTripSeatId] } },
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

  it('submits a review using the authoritative tripId returned by ticket and booking APIs', async () => {
    const order = await createBookingWithTickets({
      customerId: customerAId,
      tripSeatId: departedTripSeatId,
      transactionStatus: 'DA_THANH_TOAN',
      bookingStatus: 'DA_THANH_TOAN',
      ticketStatus: 'DA_THANH_TOAN',
    });

    const booking = order.phieuDatVe!;
    const ticket = booking.ves[0];
    currentPrincipal = customerAPrincipal;
    const ticketList = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .expect(200);
    const ticketDetail = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticket.veId}`)
      .expect(200);
    const bookingList = await request(app.getHttpServer())
      .get('/api/v1/bookings')
      .expect(200);
    const bookingDetail = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${booking.phieuDatVeId}`)
      .expect(200);
    const publicDetail = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${booking.phieuDatVeId}/detail`)
      .expect(200);
    const lookup = await request(app.getHttpServer())
      .post('/api/v1/tickets/lookup')
      .send({ ticketCode: ticket.maVe, phoneNumber: '+84930000001' })
      .expect(200);
    for (const mapped of [
      ticketList.body.data[0],
      ticketDetail.body.data,
      bookingList.body.data[0],
      bookingDetail.body.data,
      publicDetail.body.data,
      lookup.body.data,
    ]) {
      expect(mapped.tripId).toBe(departedTripId);
    }
    expect(ticketDetail.body.data.bookingId).toBe(booking.phieuDatVeId);

    // Knowing a trip ID does not grant access to another customer's records or reviews.
    currentPrincipal = customerBPrincipal;
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticket.veId}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/bookings/${booking.phieuDatVeId}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({ tripId: ticketDetail.body.data.tripId, rating: 5 })
      .expect(403);

    currentPrincipal = customerAPrincipal;
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({
        tripId: ticketDetail.body.data.tripId,
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
    expect(dbReview?.chuyenXeId).toBe(ticketDetail.body.data.tripId);
  });

  it('persists review readback across list/detail for all customer seats without leaking another customer review', async () => {
    const orders = [];
    for (const tripSeatId of [departedTripSeatId, departedSecondTripSeatId]) {
      orders.push(
        await createBookingWithTickets({
          customerId: customerAId,
          tripSeatId,
          transactionStatus: 'DA_THANH_TOAN',
          bookingStatus: 'HOAN_TAT',
          ticketStatus: 'HOAN_TAT',
        }),
      );
    }
    currentPrincipal = customerAPrincipal;
    const before = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .expect(200);
    expect(before.body.data).toHaveLength(2);
    expect(
      before.body.data.every(
        (ticket: { review: unknown }) => ticket.review === null,
      ),
    ).toBe(true);
    const response = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({
        tripId: before.body.data[0].tripId,
        rating: 4,
        comment: 'Persisted review',
      })
      .expect(201);
    const receipt = response.body.data;
    // Adversarial pre-existing data must never be selected as this owner's review.
    await prisma.phanHoi.create({
      data: {
        khachHangId: customerBId,
        chuyenXeId: departedTripId,
        mucDanhGia: 1,
        noiDung: 'Other customer private comment',
        trangThai: 'HIEN_THI',
        thoiGian: new Date(Date.now() + 60_000),
      },
    });
    // Moderation does not undo review submission or permit another submission.
    await prisma.phanHoi.update({
      where: { phanHoiId: receipt.reviewId },
      data: { trangThai: 'AN' },
    });
    const expected = { ...receipt, status: 'AN' };
    for (let refresh = 0; refresh < 2; refresh++) {
      const list = await request(app.getHttpServer())
        .get('/api/v1/tickets')
        .expect(200);
      expect(list.body.data).toHaveLength(2);
      for (const ticket of list.body.data) {
        expect(ticket.status).toBe('HOAN_TAT');
        expect(ticket.review).toEqual(expected);
        const detail = await request(app.getHttpServer())
          .get(`/api/v1/tickets/${ticket.ticketId}`)
          .expect(200);
        expect(detail.body.data.review).toEqual(expected);
      }
    }
    await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({
        tripId: departedTripId,
        rating: 5,
        comment: 'Duplicate from second seat',
      })
      .expect(409);
    expect(
      await prisma.phanHoi.count({
        where: { khachHangId: customerAId, chuyenXeId: departedTripId },
      }),
    ).toBe(1);
    const ticket = orders[0].phieuDatVe!.ves[0];
    const lookup = await request(app.getHttpServer())
      .post('/api/v1/tickets/lookup')
      .send({ ticketCode: ticket.maVe, phoneNumber: '+84930000001' })
      .expect(200);
    expect(lookup.body.data.review).toBeNull();
    currentPrincipal = customerBPrincipal;
    const otherList = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .expect(200);
    expect(otherList.body.data).toEqual([]);
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticket.veId}`)
      .expect(403);
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

  it('prevents concurrent duplicate review creation for the same customer/trip (race condition - discussion_r4222294117)', async () => {
    await createBookingWithTickets({
      customerId: customerAId,
      tripSeatId: departedTripSeatId,
      transactionStatus: 'DA_THANH_TOAN',
      bookingStatus: 'DA_THANH_TOAN',
      ticketStatus: 'DA_THANH_TOAN',
    });

    currentPrincipal = customerAPrincipal;

    // Send two concurrent POST requests for the same trip
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/reviews').send({
        tripId: departedTripId,
        rating: 5,
        comment: 'Concurrent review 1',
      }),
      request(app.getHttpServer()).post('/api/v1/reviews').send({
        tripId: departedTripId,
        rating: 4,
        comment: 'Concurrent review 2',
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Exactly one review exists in MySQL
    const reviewsInDb = await prisma.phanHoi.findMany({
      where: { khachHangId: customerAId, chuyenXeId: departedTripId },
    });
    expect(reviewsInDb).toHaveLength(1);
  });
});
