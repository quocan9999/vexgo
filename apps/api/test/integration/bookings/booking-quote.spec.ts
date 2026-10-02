import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
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

describe('Booking quote HTTP contract with MySQL', () => {
  let context: SeatHoldTestContext;

  beforeAll(async () => {
    context = await createSeatHoldTestContext();
  }, 30_000);

  afterAll(async () => {
    await context?.close();
  }, 30_000);

  it('uses the trip fare and server-resolved promotion over the exact seat set', async () => {
    const ordersBefore = await context.prisma.donGiaoDich.count();
    const ticketsBefore = await context.prisma.ve.count();

    const response = await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({
        tripId: context.tripId,
        seatIds: context.tripSeatIds,
        promotionCode: context.promotionCode.toLowerCase(),
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      tripId: context.tripId,
      farePriceId: context.farePriceId,
      seatIds: context.tripSeatIds,
      seatCount: 2,
      unitPrice: '100000.00',
      currency: 'VND',
      subtotal: '200000.00',
      discountAmount: '20000.00',
      totalAmount: '180000.00',
      promotion: {
        code: context.promotionCode,
      },
    });
    expect(response.body.data.customerId).toBeUndefined();
    expect(await context.prisma.donGiaoDich.count()).toBe(ordersBefore);
    expect(await context.prisma.ve.count()).toBe(ticketsBefore);
  });

  it('rejects repeated, nonexistent, and other-trip seats without substituting seats', async () => {
    const duplicate = await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({
        tripId: context.tripId,
        seatIds: [context.tripSeatIds[0], context.tripSeatIds[0]],
      })
      .expect(400);
    expect(duplicate.body.error).toBe('VALIDATION_ERROR');

    for (const seatId of [2_147_483_647, context.otherTripSeatId]) {
      const response = await request(context.app.getHttpServer())
        .post('/api/v1/bookings/quote')
        .send({ tripId: context.tripId, seatIds: [seatId] })
        .expect(400);
      expect(response.body.error).toBe('SEAT_SELECTION_INVALID');
    }

    const seats = await request(context.app.getHttpServer())
      .get(`/api/v1/trips/${context.tripId}/seats`)
      .expect(200);
    expect(
      seats.body.data.map((seat: { status: string }) => seat.status),
    ).toEqual(['TRONG', 'TRONG']);
  });

  it('requires a matching owned hold when any selected seat is already held', async () => {
    const hold = await request(context.app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({
        tripId: context.tripId,
        tripSeatIds: [context.tripSeatIds[0]],
      })
      .expect(201);
    const holdToken = hold.body.data.token as string;

    const unavailable = await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({ tripId: context.tripId, seatIds: [context.tripSeatIds[0]] })
      .expect(409);
    expect(unavailable.body.error).toBe('SEAT_UNAVAILABLE');

    const mismatched = await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({
        tripId: context.tripId,
        seatIds: [context.tripSeatIds[1]],
        holdToken,
      })
      .expect(409);
    expect(mismatched.body.error).toBe('SEAT_HOLD_MISMATCH');

    await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({
        tripId: context.tripId,
        seatIds: [context.tripSeatIds[0]],
        holdToken,
      })
      .expect(200);

    await request(context.app.getHttpServer())
      .delete(`/api/v1/seat-holds/${holdToken}`)
      .expect(200);
  });

  it('validates promotion scope, status, threshold, and client-supplied totals', async () => {
    const belowMinimum = await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({
        tripId: context.tripId,
        seatIds: [context.tripSeatIds[0]],
        promotionCode: context.promotionCode,
      })
      .expect(422);
    expect(belowMinimum.body.error).toBe('PROMOTION_MINIMUM_NOT_MET');

    const unsupportedCode = await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({
        tripId: context.tripId,
        seatIds: context.tripSeatIds,
        promotionCode: 'NOTREAL10',
      })
      .expect(422);
    expect(unsupportedCode.body.error).toBe('PROMOTION_NOT_APPLICABLE');

    const forgedTotal = await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({
        tripId: context.tripId,
        seatIds: context.tripSeatIds,
        totalAmount: 1,
      })
      .expect(400);
    expect(forgedTotal.body.error).toBe('VALIDATION_ERROR');
  });

  it('requires a customer principal', async () => {
    context.setPrincipal(null);
    await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({ tripId: context.tripId, seatIds: context.tripSeatIds })
      .expect(401);

    context.setPrincipal(
      principal(context.accountId, context.sessionId, ['NHA_XE_ADMIN']),
    );
    await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({ tripId: context.tripId, seatIds: context.tripSeatIds })
      .expect(403);

    context.setPrincipal(principal(context.accountId, context.sessionId));
  });

  it('rechecks the canonical trip status while calculating a quote', async () => {
    await context.prisma.chuyenXe.update({
      where: { chuyenXeId: context.tripId },
      data: { trangThai: 'DA_HUY' },
    });
    try {
      const response = await request(context.app.getHttpServer())
        .post('/api/v1/bookings/quote')
        .send({ tripId: context.tripId, seatIds: context.tripSeatIds })
        .expect(409);
      expect(response.body.error).toBe('TRIP_NOT_AVAILABLE');
    } finally {
      await context.prisma.chuyenXe.update({
        where: { chuyenXeId: context.tripId },
        data: { trangThai: 'CHUA_KHOI_HANH' },
      });
    }
  });

  it('returns APPLICABLE_FARE_NOT_FOUND instead of a default when fare is missing', async () => {
    await context.prisma.bangGia.delete({
      where: { bangGiaId: context.farePriceId },
    });

    const response = await request(context.app.getHttpServer())
      .post('/api/v1/bookings/quote')
      .send({ tripId: context.tripId, seatIds: context.tripSeatIds })
      .expect(404);
    expect(response.body.error).toBe('APPLICABLE_FARE_NOT_FOUND');
  });
});
