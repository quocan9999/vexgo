import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { SeatHoldsService } from '../../../src/seat-holds/seat-holds.service.js';
import {
  createSeatHoldTestContext,
  type SeatHoldTestContext,
} from '../seat-holds/seat-hold-test-context.js';

function principal(
  taiKhoanId: number,
  sessionId: string,
  roles = ['KHACH_HANG'],
): AuthPrincipal {
  return {
    taiKhoanId,
    sessionId,
    roles,
    permissions: [],
    nhanVienId: null,
    nhaXeId: null,
  };
}

async function createHold(
  context: SeatHoldTestContext,
  tripSeatIds = context.tripSeatIds,
) {
  const response = await request(context.app.getHttpServer())
    .post('/api/v1/seat-holds')
    .send({ tripId: context.tripId, tripSeatIds })
    .expect(201);
  return response.body.data.token as string;
}

describe('Booking create HTTP contract with MySQL', () => {
  let context: SeatHoldTestContext;

  beforeAll(async () => {
    context = await createSeatHoldTestContext();
  }, 30_000);

  afterAll(async () => {
    await context?.close();
  }, 30_000);

  beforeEach(async () => {
    await context.prisma.giuCho.deleteMany({
      where: { chuyenXeId: { in: [context.tripId, context.otherTripId] } },
    });
    const orders = await context.prisma.donGiaoDich.findMany({
      where: { khachHangId: context.customerId },
      select: { donGiaoDichId: true },
    });
    const orderIds = orders.map(({ donGiaoDichId }) => donGiaoDichId);
    if (orderIds.length > 0) {
      await context.prisma.ve.deleteMany({
        where: { phieuDatVe: { donGiaoDichId: { in: orderIds } } },
      });
      await context.prisma.phieuDatVe.deleteMany({
        where: { donGiaoDichId: { in: orderIds } },
      });
      await context.prisma.donGiaoDich.deleteMany({
        where: { donGiaoDichId: { in: orderIds } },
      });
    }
    await context.prisma.gheChuyenXe.updateMany({
      where: { chuyenXeId: context.tripId },
      data: { trangThai: 'TRONG' },
    });
    context.setPrincipal(principal(context.accountId, context.sessionId));
  });

  it('creates one order, booking, and ticket per held seat with order-level discount', async () => {
    const holdToken = await createHold(context);
    const paymentsBefore = await context.prisma.thanhToan.count();

    const response = await request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId: context.tripId,
        seatIds: context.tripSeatIds,
        holdToken,
        promotionCode: context.promotionCode,
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      tripId: context.tripId,
      seatIds: context.tripSeatIds,
      seatCount: 2,
      farePriceId: context.farePriceId,
      unitPrice: '100000.00',
      subtotal: '200000.00',
      discountAmount: '20000.00',
      totalAmount: '180000.00',
      status: 'CHO_THANH_TOAN',
      paymentStatus: 'CHO_THANH_TOAN',
      promotion: { code: context.promotionCode },
    });
    expect(response.body.data.tickets).toHaveLength(2);
    expect(response.body.data.tickets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seatId: context.tripSeatIds[0],
          price: '100000.00',
        }),
        expect.objectContaining({
          seatId: context.tripSeatIds[1],
          price: '100000.00',
        }),
      ]),
    );

    const order = await context.prisma.donGiaoDich.findUniqueOrThrow({
      where: { donGiaoDichId: response.body.data.orderId as number },
      include: { phieuDatVe: { include: { ves: true } } },
    });
    expect(order.tongTien.toFixed(2)).toBe('180000.00');
    expect(order.khachHangId).toBe(context.customerId);
    expect(order.phieuDatVe?.tongTienBanDau.toFixed(2)).toBe('200000.00');
    expect(order.phieuDatVe?.khuyenMaiId).not.toBeNull();
    expect(
      order.phieuDatVe?.ves.map(({ giaThucTe }) => giaThucTe.toFixed(2)),
    ).toEqual(['100000.00', '100000.00']);
    expect(order.phieuDatVe?.ves.map(({ trangThai }) => trangThai)).toEqual([
      'DA_DAT',
      'DA_DAT',
    ]);
    expect(await context.prisma.thanhToan.count()).toBe(paymentsBefore);
    expect(
      await context.prisma.giuCho.count({
        where: { tokenHash: { not: '' }, chuyenXeId: context.tripId },
      }),
    ).toBe(0);
    expect(
      await context.prisma.gheChuyenXe.count({
        where: {
          gheChuyenXeId: { in: context.tripSeatIds },
          trangThai: 'DA_DAT',
        },
      }),
    ).toBe(2);

    const history = await request(context.app.getHttpServer())
      .get('/api/v1/bookings')
      .expect(200);
    expect(history.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingId: response.body.data.bookingId,
          totalAmount: 180000,
          ticketCount: 2,
        }),
      ]),
    );
    const detail = await request(context.app.getHttpServer())
      .get(`/api/v1/bookings/${response.body.data.bookingId as number}`)
      .expect(200);
    expect(detail.body.data.totalAmount).toBe(180000);
  });

  it('requires the exact active hold owned by the current customer session', async () => {
    const holdToken = await createHold(context);
    const wrongTrip = await request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId: 2_147_483_647,
        seatIds: context.tripSeatIds,
        holdToken,
      })
      .expect(404);
    expect(wrongTrip.body.error).toBe('TRIP_NOT_FOUND');

    const mismatchedSeats = await request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId: context.tripId,
        seatIds: [context.tripSeatIds[0]],
        holdToken,
      })
      .expect(409);
    expect(mismatchedSeats.body.error).toBe('SEAT_HOLD_MISMATCH');

    const noHold = await request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({ tripId: context.tripId, seatIds: context.tripSeatIds })
      .expect(400);
    expect(noHold.body.error).toBe('VALIDATION_ERROR');

    context.setPrincipal(principal(context.otherAccountId, context.sessionId));
    const wrongCustomer = await request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({ tripId: context.tripId, seatIds: context.tripSeatIds, holdToken })
      .expect(404);
    expect(wrongCustomer.body.error).toBe('SEAT_HOLD_NOT_FOUND');

    context.setPrincipal(principal(context.accountId, context.otherSessionId));
    const wrongSession = await request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({ tripId: context.tripId, seatIds: context.tripSeatIds, holdToken })
      .expect(404);
    expect(wrongSession.body.error).toBe('SEAT_HOLD_NOT_FOUND');
    context.setPrincipal(principal(context.accountId, context.sessionId));
  });

  it('consumes a hold only once when the same create request is submitted concurrently', async () => {
    const holdToken = await createHold(context);
    const payload = {
      tripId: context.tripId,
      seatIds: context.tripSeatIds,
      holdToken,
    };
    const before = await context.prisma.donGiaoDich.count();

    const results = await Promise.all([
      request(context.app.getHttpServer())
        .post('/api/v1/bookings')
        .send(payload),
      request(context.app.getHttpServer())
        .post('/api/v1/bookings')
        .send(payload),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([201, 404]);
    const created = results.find(({ status }) => status === 201);
    const rejected = results.find(({ status }) => status === 404);
    expect(created?.body.data.totalAmount).toBe('200000.00');
    expect(rejected?.body.error).toBe('SEAT_HOLD_NOT_FOUND');
    expect(await context.prisma.donGiaoDich.count()).toBe(before + 1);
    expect(
      await context.prisma.ve.count({
        where: {
          phieuDatVe: { donGiaoDich: { khachHangId: context.customerId } },
        },
      }),
    ).toBe(2);
  });

  it('rejects expired holds without creating a booking or changing seat state', async () => {
    const holdToken = await createHold(context);
    await context.prisma.giuCho.updateMany({
      where: { chuyenXeId: context.tripId },
      data: { hetHanLuc: new Date(Date.now() - 1_000) },
    });
    const before = await context.prisma.donGiaoDich.count();

    const response = await request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId: context.tripId,
        seatIds: context.tripSeatIds,
        holdToken,
      })
      .expect(404);

    expect(response.body.error).toBe('SEAT_HOLD_NOT_FOUND');
    expect(await context.prisma.donGiaoDich.count()).toBe(before);
    expect(
      await context.prisma.gheChuyenXe.count({
        where: {
          gheChuyenXeId: { in: context.tripSeatIds },
          trangThai: 'TRONG',
        },
      }),
    ).toBe(2);
  });

  it('rolls back seat and booking writes if the hold is released during commit', async () => {
    const holdToken = await createHold(context);
    const ordersBefore = await context.prisma.donGiaoDich.count();
    const seatHolds = context.app.get(SeatHoldsService);
    const originalAssertValidHold = seatHolds.assertValidHold.bind(seatHolds);
    let holdValidated!: () => void;
    let resumeCreate!: () => void;
    const validated = new Promise<void>((resolve) => {
      holdValidated = resolve;
    });
    const createGate = new Promise<void>((resolve) => {
      resumeCreate = resolve;
    });
    const assertSpy = vi
      .spyOn(seatHolds, 'assertValidHold')
      .mockImplementation(async (...args) => {
        const hold = await originalAssertValidHold(...args);
        holdValidated();
        await createGate;
        return hold;
      });

    const createRequest = request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId: context.tripId,
        seatIds: context.tripSeatIds,
        holdToken,
      });
    const createResponse = createRequest.then((response) => response);

    try {
      await validated;
      await request(context.app.getHttpServer())
        .delete(`/api/v1/seat-holds/${holdToken}`)
        .expect(200);
      resumeCreate();

      const response = await createResponse;
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('SEAT_HOLD_NOT_FOUND');
    } finally {
      resumeCreate();
      assertSpy.mockRestore();
    }

    expect(await context.prisma.donGiaoDich.count()).toBe(ordersBefore);
    expect(
      await context.prisma.gheChuyenXe.count({
        where: {
          gheChuyenXeId: { in: context.tripSeatIds },
          trangThai: 'TRONG',
        },
      }),
    ).toBe(2);
    expect(
      await context.prisma.ve.count({
        where: {
          phieuDatVe: { donGiaoDich: { khachHangId: context.customerId } },
        },
      }),
    ).toBe(0);
  });

  it('rolls back booking and seat updates when promotion validation fails', async () => {
    const holdToken = await createHold(context, [context.tripSeatIds[0]!]);
    const before = await context.prisma.donGiaoDich.count();

    const response = await request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId: context.tripId,
        seatIds: [context.tripSeatIds[0]],
        holdToken,
        promotionCode: context.promotionCode,
      })
      .expect(422);
    expect(response.body.error).toBe('PROMOTION_MINIMUM_NOT_MET');
    expect(await context.prisma.donGiaoDich.count()).toBe(before);
    expect(
      await context.prisma.gheChuyenXe.count({
        where: {
          gheChuyenXeId: { in: context.tripSeatIds },
          trangThai: 'TRONG',
        },
      }),
    ).toBe(2);
  });

  it('validates customer role and rejects client-supplied totals or customer IDs', async () => {
    const holdToken = await createHold(context);
    const forged = await request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        tripId: context.tripId,
        seatIds: context.tripSeatIds,
        holdToken,
        totalAmount: 1,
        customerId: context.otherAccountId,
      })
      .expect(400);
    expect(forged.body.error).toBe('VALIDATION_ERROR');

    context.setPrincipal(
      principal(context.accountId, context.sessionId, ['NHA_XE_ADMIN']),
    );
    await request(context.app.getHttpServer())
      .post('/api/v1/bookings')
      .send({ tripId: context.tripId, seatIds: context.tripSeatIds, holdToken })
      .expect(403);
    context.setPrincipal(principal(context.accountId, context.sessionId));
  });

  it('re-resolves the fare during create and leaves seats available when fare is missing', async () => {
    const holdToken = await createHold(context);
    const trip = await context.prisma.chuyenXe.findUniqueOrThrow({
      where: { chuyenXeId: context.tripId },
      select: {
        nhaXeId: true,
        tuyenXeId: true,
        ngayKhoiHanh: true,
        xe: { select: { loaiXeId: true } },
      },
    });
    await context.prisma.bangGia.delete({
      where: { bangGiaId: context.farePriceId },
    });

    try {
      const before = await context.prisma.donGiaoDich.count();
      const response = await request(context.app.getHttpServer())
        .post('/api/v1/bookings')
        .send({
          tripId: context.tripId,
          seatIds: context.tripSeatIds,
          holdToken,
        })
        .expect(404);

      expect(response.body.error).toBe('APPLICABLE_FARE_NOT_FOUND');
      expect(await context.prisma.donGiaoDich.count()).toBe(before);
      expect(
        await context.prisma.gheChuyenXe.count({
          where: {
            gheChuyenXeId: { in: context.tripSeatIds },
            trangThai: 'TRONG',
          },
        }),
      ).toBe(2);
    } finally {
      await context.prisma.bangGia.create({
        data: {
          bangGiaId: context.farePriceId,
          giaNiemYet: '100000.00',
          tuNgay: trip.ngayKhoiHanh,
          denNgay: null,
          trangThai: 'HOAT_DONG',
          nhaXeId: trip.nhaXeId,
          tuyenXeId: trip.tuyenXeId,
          loaiXeId: trip.xe.loaiXeId,
        },
      });
    }
  });
});
