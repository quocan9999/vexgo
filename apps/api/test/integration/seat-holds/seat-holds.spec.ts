import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import {
  createSeatHoldTestContext,
  type SeatHoldTestContext,
} from './seat-hold-test-context.js';

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

describe('Seat holds HTTP and persistence contract with MySQL', () => {
  let context: SeatHoldTestContext;

  beforeAll(async () => {
    context = await createSeatHoldTestContext();
  }, 30_000);

  afterAll(async () => {
    await context?.close();
  }, 30_000);

  it('holds the exact trip-seat set, exposes the held state, and releases the owned hold', async () => {
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId: context.tripId, tripSeatIds: context.tripSeatIds })
      .expect(201);

    const hold = response.body.data as {
      token: string;
      tripId: number;
      tripSeatIds: number[];
      expiresAt: string;
    };
    expect(hold.tripId).toBe(context.tripId);
    expect(hold.tripSeatIds).toEqual(context.tripSeatIds);
    expect(hold.token).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(hold.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const persisted = await context.prisma.giuCho.findUnique({
      where: {
        tokenHash: createHash('sha256').update(hold.token).digest('hex'),
      },
      include: { gheChuyenXes: true },
    });
    expect(persisted?.tokenHash).not.toBe(hold.token);
    expect(
      persisted?.gheChuyenXes
        .map(({ gheChuyenXeId }) => gheChuyenXeId)
        .sort((a, b) => a - b),
    ).toEqual([...context.tripSeatIds].sort((a, b) => a - b));

    const seatsResponse = await request(context.app.getHttpServer())
      .get(`/api/v1/trips/${context.tripId}/seats`)
      .expect(200);
    expect(seatsResponse.body.data).toEqual(
      expect.arrayContaining(
        context.tripSeatIds.map((tripSeatId) =>
          expect.objectContaining({ tripSeatId, status: 'DANG_GIU' }),
        ),
      ),
    );
    const searchWhileHeld = await request(context.app.getHttpServer())
      .get('/api/v1/trips/search')
      .query({ from: 'Điểm thử giữ ghế', to: 'Điểm thử đích' })
      .expect(200);
    expect(
      searchWhileHeld.body.data.find(
        (trip: { id: number }) => trip.id === context.tripId,
      )?.availableSeats,
    ).toBe(0);

    await request(context.app.getHttpServer())
      .delete(`/api/v1/seat-holds/${hold.token}`)
      .expect(200);

    const releasedSeats = await request(context.app.getHttpServer())
      .get(`/api/v1/trips/${context.tripId}/seats`)
      .expect(200);
    expect(
      releasedSeats.body.data.map((seat: { status: string }) => seat.status),
    ).toEqual(['TRONG', 'TRONG']);
    const searchAfterRelease = await request(context.app.getHttpServer())
      .get('/api/v1/trips/search')
      .query({ from: 'Điểm thử giữ ghế', to: 'Điểm thử đích' })
      .expect(200);
    expect(
      searchAfterRelease.body.data.find(
        (trip: { id: number }) => trip.id === context.tripId,
      )?.availableSeats,
    ).toBe(2);
  });

  it('rejects duplicate seat ids through the request DTO', async () => {
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({
        tripId: context.tripId,
        tripSeatIds: [context.tripSeatIds[0], context.tripSeatIds[0]],
      })
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'tripSeatIds' }),
      ]),
    );
  });

  it.each([
    ['a seat that does not exist', 2_147_483_647],
    ['a seat from another trip', 'other-trip-seat'],
  ])('rejects %s without selecting a replacement seat', async (_label, id) => {
    const tripSeatId = id === 'other-trip-seat' ? context.otherTripSeatId : id;
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId: context.tripId, tripSeatIds: [tripSeatId] })
      .expect(400);

    expect(response.body.error).toBe('SEAT_SELECTION_INVALID');
    const seats = await request(context.app.getHttpServer())
      .get(`/api/v1/trips/${context.tripId}/seats`)
      .expect(200);
    expect(
      seats.body.data.map((seat: { status: string }) => seat.status),
    ).toEqual(['TRONG', 'TRONG']);
  });

  it('allows only one of two competing requests to hold a seat', async () => {
    const attempts = await Promise.all(
      [0, 1].map(() =>
        request(context.app.getHttpServer())
          .post('/api/v1/seat-holds')
          .send({
            tripId: context.tripId,
            tripSeatIds: [context.tripSeatIds[0]],
          }),
      ),
    );

    expect(attempts.map(({ status }) => status).sort()).toEqual([201, 409]);
    const winner = attempts.find(({ status }) => status === 201)!;
    const conflict = attempts.find(({ status }) => status === 409)!;
    expect(conflict.body.error).toBe('SEAT_UNAVAILABLE');
    await request(context.app.getHttpServer())
      .delete(`/api/v1/seat-holds/${winner.body.data.token}`)
      .expect(200);
  });

  it('expires old holds and prevents an old token from releasing a newer hold', async () => {
    const first = await request(context.app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({
        tripId: context.tripId,
        tripSeatIds: [context.tripSeatIds[0]],
      })
      .expect(201);
    const oldToken = first.body.data.token as string;
    const tokenHash = createHash('sha256').update(oldToken).digest('hex');
    await context.prisma.giuCho.update({
      where: { tokenHash },
      data: { hetHanLuc: new Date(Date.now() - 1_000) },
    });

    const second = await request(context.app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({
        tripId: context.tripId,
        tripSeatIds: [context.tripSeatIds[0]],
      })
      .expect(201);

    await request(context.app.getHttpServer())
      .delete(`/api/v1/seat-holds/${oldToken}`)
      .expect(404);
    const seats = await request(context.app.getHttpServer())
      .get(`/api/v1/trips/${context.tripId}/seats`)
      .expect(200);
    expect(seats.body.data[0].status).toBe('DANG_GIU');
    await request(context.app.getHttpServer())
      .delete(`/api/v1/seat-holds/${second.body.data.token}`)
      .expect(200);
  });

  it('scopes hold release to the authenticated account and login session', async () => {
    const response = await request(context.app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({
        tripId: context.tripId,
        tripSeatIds: [context.tripSeatIds[1]],
      })
      .expect(201);
    const token = response.body.data.token as string;

    context.setPrincipal(
      principal(context.otherAccountId, context.otherSessionId),
    );
    await request(context.app.getHttpServer())
      .delete(`/api/v1/seat-holds/${token}`)
      .expect(404);

    context.setPrincipal(principal(context.accountId, context.otherSessionId));
    await request(context.app.getHttpServer())
      .delete(`/api/v1/seat-holds/${token}`)
      .expect(404);
    const stillHeld = await request(context.app.getHttpServer())
      .get(`/api/v1/trips/${context.tripId}/seats`)
      .expect(200);
    expect(stillHeld.body.data[1].status).toBe('DANG_GIU');

    context.setPrincipal(principal(context.accountId, context.sessionId));
    await request(context.app.getHttpServer())
      .delete(`/api/v1/seat-holds/${token}`)
      .expect(200);
  });

  it('requires a customer role and an authenticated principal', async () => {
    context.setPrincipal(null);
    await request(context.app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId: context.tripId, tripSeatIds: [context.tripSeatIds[0]] })
      .expect(401);

    context.setPrincipal(
      principal(context.accountId, context.sessionId, ['NHA_XE_ADMIN']),
    );
    await request(context.app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId: context.tripId, tripSeatIds: [context.tripSeatIds[0]] })
      .expect(403);

    context.setPrincipal(principal(context.accountId, context.sessionId));
  });
});
