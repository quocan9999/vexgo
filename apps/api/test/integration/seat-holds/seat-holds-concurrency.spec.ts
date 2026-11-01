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
import { SeatHoldsService } from '../../../src/seat-holds/seat-holds.service.js';

describe('SeatHolds Concurrency & Isolation with MySQL (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seatHoldsService: SeatHoldsService;
  let busCompanyId: number;
  let routeId: number;
  let vehicleTypeId: number;
  let vehicleId: number;
  let tripId: number;
  let tripSeat1: number;
  let tripSeat2: number;
  let currentPrincipal: AuthPrincipal | null = null;

  let customerAId: number;
  let customerBId: number;
  let customerAAccountId: number;
  let customerBAccountId: number;
  let customerAPrincipal: AuthPrincipal;
  let customerBPrincipal: AuthPrincipal;

  beforeAll(async () => {
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
    seatHoldsService = app.get(SeatHoldsService);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();

    // 1. Create company, route, vehicle type, vehicle with seats
    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-${suffix}`,
        tenNhaXe: `SeatHold Test Co ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    busCompanyId = company.nhaXeId;

    const route = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: `TX-${suffix}`,
        diemDi: 'Sài Gòn',
        diemDen: 'Nha Trang',
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
      },
      select: { tuyenXeId: true },
    });
    routeId = route.tuyenXeId;

    const vehicleType = await prisma.loaiXe.create({
      data: {
        nhaXeId: busCompanyId,
        tenLoai: `Limousine ${suffix}`,
      },
      select: { loaiXeId: true },
    });
    vehicleTypeId = vehicleType.loaiXeId;

    const vehicle = await prisma.xe.create({
      data: {
        bienSoXe: `59X-${suffix}`,
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
        loaiXeId: vehicleTypeId,
        ghes: {
          create: [
            { maGhe: `seat-s01-${suffix}`.padEnd(32, '0').slice(0, 32), tenGhe: 'S01', viTri: 'Tầng 1' },
            { maGhe: `seat-s02-${suffix}`.padEnd(32, '0').slice(0, 32), tenGhe: 'S02', viTri: 'Tầng 1' },
          ],
        },
      },
      include: { ghes: true },
    });
    vehicleId = vehicle.xeId;

    // 2. Create customer accounts
    const accountA = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8491${suffix.slice(0, 7)}`,
        matKhau: '$2b$10$hashedpasswordforexampletest',
        hoTen: `User A ${suffix}`,
        trangThai: 'HOAT_DONG',
        daXacThucSoDienThoai: true,
        khachHang: {
          create: {
            maKhachHang: `KH-A-${suffix}`,
          },
        },
      },
      include: { khachHang: true },
    });
    customerAAccountId = accountA.taiKhoanId;
    customerAId = accountA.khachHang!.khachHangId;
    customerAPrincipal = {
      taiKhoanId: accountA.taiKhoanId,
      sessionId: `sess-a-${suffix}`,
      roles: ['CUSTOMER'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };

    const accountB = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8492${suffix.slice(0, 7)}`,
        matKhau: '$2b$10$hashedpasswordforexampletest',
        hoTen: `User B ${suffix}`,
        trangThai: 'HOAT_DONG',
        daXacThucSoDienThoai: true,
        khachHang: {
          create: {
            maKhachHang: `KH-B-${suffix}`,
          },
        },
      },
      include: { khachHang: true },
    });
    customerBAccountId = accountB.taiKhoanId;
    customerBId = accountB.khachHang!.khachHangId;
    customerBPrincipal = {
      taiKhoanId: accountB.taiKhoanId,
      sessionId: `sess-b-${suffix}`,
      roles: ['CUSTOMER'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };
  }, 30_000);

  afterAll(async () => {
    try {
      if (tripId) {
        await prisma.gheChuyenXe.deleteMany({ where: { chuyenXeId: tripId } });
        await prisma.giuCho.deleteMany({ where: { chuyenXeId: tripId } });
        await prisma.chuyenXe.deleteMany({ where: { chuyenXeId: tripId } });
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

      if (customerAId) {
        await prisma.khachHang.deleteMany({ where: { khachHangId: customerAId } });
      }
      if (customerAAccountId) {
        await prisma.taiKhoan.deleteMany({ where: { taiKhoanId: customerAAccountId } });
      }
      if (customerBId) {
        await prisma.khachHang.deleteMany({ where: { khachHangId: customerBId } });
      }
      if (customerBAccountId) {
        await prisma.taiKhoan.deleteMany({ where: { taiKhoanId: customerBAccountId } });
      }
    } finally {
      await app?.close();
    }
  }, 30_000);

  beforeEach(async () => {
    currentPrincipal = null;

    // Reset trip & seats
    if (tripId) {
      await prisma.gheChuyenXe.deleteMany({ where: { chuyenXeId: tripId } });
      await prisma.giuCho.deleteMany({ where: { chuyenXeId: tripId } });
      await prisma.chuyenXe.deleteMany({ where: { chuyenXeId: tripId } });
    }

    const seats = await prisma.ghe.findMany({ where: { xeId: vehicleId } });
    const trip = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: `CX-HOLD-${randomUUID().slice(0, 6).toUpperCase()}`,
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
      include: { gheChuyenXes: true },
    });
    tripId = trip.chuyenXeId;
    tripSeat1 = trip.gheChuyenXes[0].gheChuyenXeId;
    tripSeat2 = trip.gheChuyenXes[1].gheChuyenXeId;
  });

  it('rejects the removed trip-scoped create endpoint without changing seat state', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/seat-holds`)
      .send({ seatNumbers: ['S01'] });

    expect(response.status).toBe(404);

    const seat = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    const holds = await prisma.giuCho.findMany({
      where: { chuyenXeId: tripId },
    });

    expect(seat?.trangThai).toBe('TRONG');
    expect(seat?.giuChoId).toBeNull();
    expect(holds).toHaveLength(0);
  }, 30_000);

  it('rejects the removed trip-scoped release endpoint without releasing a canonical hold', async () => {
    const holdResponse = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] })
      .expect(201);
    const holdToken = (holdResponse.body.data ?? holdResponse.body).holdToken;
    expect(holdToken).toBeDefined();

    const seatWhileHeld = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(seatWhileHeld?.trangThai).toBe('DANG_GIU');
    expect(seatWhileHeld?.giuChoId).toBeDefined();

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/trips/${tripId}/seat-holds`)
      .send({ seatNumbers: ['S01'] });

    expect(response.status).toBe(404);

    const seatAfterLegacyRequest = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    const holdAfterLegacyRequest = await prisma.giuCho.findUnique({
      where: { giuChoId: seatWhileHeld!.giuChoId! },
    });

    expect(seatAfterLegacyRequest?.trangThai).toBe('DANG_GIU');
    expect(seatAfterLegacyRequest?.giuChoId).toBe(seatWhileHeld?.giuChoId);
    expect(holdAfterLegacyRequest?.trangThai).toBe('DANG_GIU');

    await request(app.getHttpServer())
      .delete('/api/v1/seat-holds')
      .set('X-Hold-Token', holdToken)
      .expect(200);

    await request(app.getHttpServer()).delete('/api/v1/seat-holds').expect(400);
  }, 30_000);

  it('rejects the legacy token-path release alias and keeps the DB-backed hold active', async () => {
    const holdResponse = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] })
      .expect(201);
    const holdToken = (holdResponse.body.data ?? holdResponse.body).holdToken;
    const heldSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeat1 },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/seat-holds/${holdToken}`)
      .expect(404);

    const seatAfterAlias = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeat1 },
    });
    const holdAfterAlias = await prisma.giuCho.findUniqueOrThrow({
      where: { giuChoId: heldSeat.giuChoId! },
    });
    expect(seatAfterAlias.trangThai).toBe('DANG_GIU');
    expect(seatAfterAlias.giuChoId).toBe(heldSeat.giuChoId);
    expect(holdAfterAlias.trangThai).toBe('DANG_GIU');

    await request(app.getHttpServer())
      .delete('/api/v1/seat-holds')
      .set('X-Hold-Token', holdToken)
      .expect(200);
  }, 30_000);

  it('does not release an orphaned DANG_GIU seat when the signed token has no DB hold', async () => {
    const holdResponse = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] })
      .expect(201);
    const holdToken = (holdResponse.body.data ?? holdResponse.body).holdToken;
    const heldSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeat1 },
    });
    const holdId = heldSeat.giuChoId!;

    // Deleting only this test-owned GiuCho exercises the legacy orphan state;
    // the FK sets giuChoId to null while leaving the seat status unchanged.
    await prisma.giuCho.delete({ where: { giuChoId: holdId } });
    const orphanSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(orphanSeat.trangThai).toBe('DANG_GIU');
    expect(orphanSeat.giuChoId).toBeNull();

    await request(app.getHttpServer())
      .delete('/api/v1/seat-holds')
      .set('X-Hold-Token', holdToken)
      .expect(200);

    const seatAfterRelease = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(seatAfterRelease.trangThai).toBe('DANG_GIU');
    expect(seatAfterRelease.giuChoId).toBeNull();
  }, 30_000);

  it('allows only one of two concurrent requests to hold the exact same seat on real MySQL (CAS Race Condition)', async () => {
    // Both requests attempt to hold tripSeat1 simultaneously
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/seat-holds')
        .send({ tripId, seatIds: [tripSeat1] }),
      request(app.getHttpServer())
        .post('/api/v1/seat-holds')
        .send({ tripId, seatIds: [tripSeat1] }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const winner = res1.status === 201 ? res1 : res2;
    const loser = res1.status === 409 ? res1 : res2;

    const winnerBody = winner.body.data ?? winner.body;
    const loserBody = loser.body;

    expect(winnerBody.holdToken).toBeDefined();
    expect(winnerBody.seatIds).toEqual([tripSeat1]);
    expect(loserBody.error).toBe('SEAT_UNAVAILABLE');

    // Verify DB integrity in MySQL:
    // Exactly 1 GiuCho record exists for this trip
    const dbHolds = await prisma.giuCho.findMany({
      where: { chuyenXeId: tripId, trangThai: 'DANG_GIU' },
    });
    expect(dbHolds).toHaveLength(1);

    // GheChuyenXe is marked DANG_GIU and bound to that GiuCho ID
    const dbSeat = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(dbSeat?.trangThai).toBe('DANG_GIU');
    expect(dbSeat?.giuChoId).toBe(dbHolds[0].giuChoId);
  }, 30_000);

  it('prevents stale hold token from releasing seats acquired by subsequent holders (Generation-Safe Release Isolation)', async () => {
    // Step 1: User A holds seat 1
    const holdARes = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] });
    expect(holdARes.status).toBe(201);
    const holdTokenA = (holdARes.body.data ?? holdARes.body).holdToken;
    expect(holdTokenA).toBeDefined();

    const seatAfterHoldA = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(seatAfterHoldA?.trangThai).toBe('DANG_GIU');
    const holdAId = seatAfterHoldA?.giuChoId;
    expect(holdAId).toBeDefined();

    // Step 2: Simulate expiry of User A's hold
    await prisma.giuCho.update({
      where: { giuChoId: holdAId! },
      data: { hetHanLuc: new Date(Date.now() - 60_000) },
    });

    // Run stale holds cleanup to return seat to TRONG
    const releasedCount = await seatHoldsService.releaseStaleHolds();
    expect(releasedCount).toBeGreaterThanOrEqual(1);

    const seatAfterCleanup = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(seatAfterCleanup?.trangThai).toBe('TRONG');
    expect(seatAfterCleanup?.giuChoId).toBeNull();

    // Step 3: User B holds the same seat 1
    const holdBRes = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] });
    expect(holdBRes.status).toBe(201);
    const holdTokenB = (holdBRes.body.data ?? holdBRes.body).holdToken;
    expect(holdTokenB).toBeDefined();

    const seatAfterHoldB = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(seatAfterHoldB?.trangThai).toBe('DANG_GIU');
    const holdBId = seatAfterHoldB?.giuChoId;
    expect(holdBId).toBeDefined();
    expect(holdBId).not.toBe(holdAId);

    // Step 4: User A attempts to release using old stale holdTokenA
    await request(app.getHttpServer())
      .delete('/api/v1/seat-holds')
      .set('X-Hold-Token', holdTokenA)
      .expect(200);

    // CRUCIAL ASSERTION: User B's seat MUST REMAIN 'DANG_GIU' and still linked to holdBId!
    const seatAfterAttemptedTheft = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(seatAfterAttemptedTheft?.trangThai).toBe('DANG_GIU');
    expect(seatAfterAttemptedTheft?.giuChoId).toBe(holdBId);

    // Step 5: User B releases using legitimate holdTokenB -> seat should successfully revert to TRONG
    await request(app.getHttpServer())
      .delete('/api/v1/seat-holds')
      .set('X-Hold-Token', holdTokenB)
      .expect(200);

    const seatFinal = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(seatFinal?.trangThai).toBe('TRONG');
    expect(seatFinal?.giuChoId).toBeNull();
  }, 30_000);

  it('binds hold to authenticated customer and rejects consumption by a different customer', async () => {
    // Customer A creates hold
    currentPrincipal = customerAPrincipal;
    const holdRes = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat2] });
    expect(holdRes.status).toBe(201);
    const holdToken = (holdRes.body.data ?? holdRes.body).holdToken;
    expect(holdToken).toBeDefined();

    // Verify DB recorded customerId
    const dbHold = await prisma.giuCho.findFirst({
      where: { chuyenXeId: tripId, trangThai: 'DANG_GIU' },
    });
    expect(dbHold?.khachHangId).toBe(customerAId);

    // Customer B attempts to verify/consume Customer A's hold
    expect(() => {
      seatHoldsService.verifyHold(holdToken, tripId, [tripSeat2], customerBId);
    }).toThrowError();

    // Customer A verifies/consumes successfully
    expect(() => {
      seatHoldsService.verifyHold(holdToken, tripId, [tripSeat2], customerAId);
    }).not.toThrow();

    const consumed = await seatHoldsService.consumeHold(
      holdToken,
      tripId,
      [tripSeat2],
      customerAId,
    );
    expect(consumed).toBe(true);

    const updatedHold = await prisma.giuCho.findUnique({
      where: { giuChoId: dbHold!.giuChoId },
    });
    expect(updatedHold?.trangThai).toBe('DA_DAT');

    await prisma.gheChuyenXe.updateMany({
      where: {
        gheChuyenXeId: tripSeat2,
        trangThai: 'DANG_GIU',
        giuChoId: dbHold!.giuChoId,
      },
      data: { trangThai: 'DA_DAT', giuChoId: null },
    });
    await request(app.getHttpServer())
      .delete('/api/v1/seat-holds')
      .set('X-Hold-Token', holdToken)
      .expect(200);
    const bookedSeat = await prisma.gheChuyenXe.findUniqueOrThrow({
      where: { gheChuyenXeId: tripSeat2 },
    });
    expect(bookedSeat.trangThai).toBe('DA_DAT');
    expect(bookedSeat.giuChoId).toBeNull();
  }, 30_000);

  it('releases held seats back to TRONG when hold expires and allows other customers to hold them (discussion_r4220529046)', async () => {
    // Customer A creates hold on seat 1
    currentPrincipal = customerAPrincipal;
    const holdRes = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] });
    expect(holdRes.status).toBe(201);
    const holdToken = (holdRes.body.data ?? holdRes.body).holdToken;

    const seatWhileHeld = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(seatWhileHeld?.trangThai).toBe('DANG_GIU');
    const holdId = seatWhileHeld?.giuChoId;
    expect(holdId).toBeDefined();

    // Simulate hold TTL expiration in DB (hetHanLuc in the past)
    await prisma.giuCho.update({
      where: { giuChoId: holdId! },
      data: { hetHanLuc: new Date(Date.now() - 60_000) },
    });

    // Customer or system triggers release on expired hold
    const releaseRes = await request(app.getHttpServer())
      .delete('/api/v1/seat-holds')
      .set('X-Hold-Token', holdToken)
      .expect(200);
    expect(releaseRes.body.data?.success ?? releaseRes.body.success).toBe(true);

    // Assert: GiuCho must transition to HET_HAN
    const dbHoldAfter = await prisma.giuCho.findUnique({
      where: { giuChoId: holdId! },
    });
    expect(dbHoldAfter?.trangThai).toBe('HET_HAN');

    // Assert: Seat MUST be freed to TRONG and giuChoId cleared to null (no stranding!)
    const seatAfterRelease = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(seatAfterRelease?.trangThai).toBe('TRONG');
    expect(seatAfterRelease?.giuChoId).toBeNull();

    // Customer B can now immediately hold seat 1
    currentPrincipal = customerBPrincipal;
    const customerBHoldRes = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] });
    expect(customerBHoldRes.status).toBe(201);

    // Clean up Customer B hold
    const holdTokenB = (customerBHoldRes.body.data ?? customerBHoldRes.body).holdToken;
    await request(app.getHttpServer())
      .delete('/api/v1/seat-holds')
      .set('X-Hold-Token', holdTokenB)
      .expect(200);
  }, 30_000);

  it('releaseStaleHolds sweeps orphaned seats associated with HET_HAN holds (discussion_r4220529046)', async () => {
    // Customer A creates hold on seat 1
    currentPrincipal = customerAPrincipal;
    const holdRes = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] });
    expect(holdRes.status).toBe(201);
    const holdToken = (holdRes.body.data ?? holdRes.body).holdToken;

    const seatHeld = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    const holdId = seatHeld!.giuChoId!;

    // Manually simulate a stranded state: hold is HET_HAN but seat was never released (e.g. legacy bug/crash)
    await prisma.giuCho.update({
      where: { giuChoId: holdId },
      data: { trangThai: 'HET_HAN', hetHanLuc: new Date(Date.now() - 120_000) },
    });
    // Seat is still DANG_GIU with giuChoId = holdId
    const strandedSeat = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(strandedSeat?.trangThai).toBe('DANG_GIU');
    expect(strandedSeat?.giuChoId).toBe(holdId);

    // Run releaseStaleHolds
    const released = await seatHoldsService.releaseStaleHolds();
    expect(released).toBeGreaterThanOrEqual(1);

    // Seat must be cleaned to TRONG and giuChoId null
    const cleanedSeat = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(cleanedSeat?.trangThai).toBe('TRONG');
    expect(cleanedSeat?.giuChoId).toBeNull();
  }, 30_000);

  it('prevents released hold from consuming or stealing seat acquired by subsequent holder in tx (discussion_r4164957997 & r4220529053)', async () => {
    // 1. Customer A holds seat 1
    currentPrincipal = customerAPrincipal;
    const holdResA = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] });
    expect(holdResA.status).toBe(201);
    const holdTokenA = (holdResA.body.data ?? holdResA.body).holdToken;

    const seatHeldA = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    const holdIdA = seatHeldA!.giuChoId!;

    // 2. Customer A releases hold
    await request(app.getHttpServer())
      .delete('/api/v1/seat-holds')
      .set('X-Hold-Token', holdTokenA)
      .expect(200);

    // 3. Customer B holds the exact same seat
    currentPrincipal = customerBPrincipal;
    const holdResB = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] });
    expect(holdResB.status).toBe(201);
    const holdTokenB = (holdResB.body.data ?? holdResB.body).holdToken;

    const seatHeldB = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    const holdIdB = seatHeldB!.giuChoId!;
    expect(holdIdB).not.toBe(holdIdA);

    // 4. Customer A attempts to consume using old holdTokenA inside tx
    await expect(
      seatHoldsService.consumeHoldInTx(
        prisma,
        holdTokenA,
        tripId,
        [tripSeat1],
        customerAId,
      ),
    ).rejects.toThrowError();

    // 5. Customer A attempting CAS update with holdIdA MUST match 0 rows (prevent theft!)
    const stolenAttemptCount = await prisma.gheChuyenXe.updateMany({
      where: {
        chuyenXeId: tripId,
        gheChuyenXeId: { in: [tripSeat1] },
        trangThai: 'DANG_GIU',
        giuChoId: holdIdA,
      },
      data: {
        trangThai: 'DA_DAT',
        giuChoId: null,
      },
    });
    expect(stolenAttemptCount.count).toBe(0);

    // Verify Customer B's seat is 100% untampered
    const seatAfterAttempt = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(seatAfterAttempt?.trangThai).toBe('DANG_GIU');
    expect(seatAfterAttempt?.giuChoId).toBe(holdIdB);

    // 6. Customer B can consume legitimately inside tx
    const consumedB = await seatHoldsService.consumeHoldInTx(
      prisma,
      holdTokenB,
      tripId,
      [tripSeat1],
      customerBId,
    );
    expect(consumedB.giuChoId).toBe(holdIdB);

    // CAS update with holdIdB succeeds for Customer B
    const legitimateBookingUpdate = await prisma.gheChuyenXe.updateMany({
      where: {
        chuyenXeId: tripId,
        gheChuyenXeId: { in: [tripSeat1] },
        trangThai: 'DANG_GIU',
        giuChoId: holdIdB,
      },
      data: {
        trangThai: 'DA_DAT',
        giuChoId: null,
      },
    });
    expect(legitimateBookingUpdate.count).toBe(1);
  }, 30_000);

  it('handles race condition between concurrent releaseSeatHold and booking consumeHoldInTx (discussion_r4226248016)', async () => {
    // Reset seat 1 to TRONG
    await prisma.gheChuyenXe.update({
      where: { gheChuyenXeId: tripSeat1 },
      data: { trangThai: 'TRONG', giuChoId: null },
    });

    // Customer A creates hold on seat 1
    currentPrincipal = customerAPrincipal;
    const holdRes = await request(app.getHttpServer())
      .post('/api/v1/seat-holds')
      .send({ tripId, seatIds: [tripSeat1] });
    expect(holdRes.status).toBe(201);
    const holdToken = (holdRes.body.data ?? holdRes.body).holdToken;
    expect(holdToken).toBeDefined();

    const initialSeat = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });
    expect(initialSeat?.trangThai).toBe('DANG_GIU');
    const holdId = initialSeat?.giuChoId;
    expect(holdId).toBeDefined();

    // Concurrently trigger releaseSeatHold and booking consumption using Promise.allSettled
    const [releaseResult, bookingAttempt] = await Promise.allSettled([
      seatHoldsService.releaseSeatHold(holdToken),
      prisma.$transaction(async (tx) => {
        const consumed = await seatHoldsService.consumeHoldInTx(
          tx,
          holdToken,
          tripId,
          [tripSeat1],
          customerAId,
        );
        const updateSeats = await tx.gheChuyenXe.updateMany({
          where: {
            chuyenXeId: tripId,
            gheChuyenXeId: { in: [tripSeat1] },
            trangThai: 'DANG_GIU',
            giuChoId: consumed.giuChoId,
          },
          data: {
            trangThai: 'DA_DAT',
            giuChoId: null,
          },
        });
        if (updateSeats.count !== 1) {
          throw new Error('SEAT_UNAVAILABLE');
        }
        return { booked: true };
      }),
    ]);

    // Inspect DB final state: MUST be strictly ONE valid outcome, NEVER inconsistent/hybrid
    const finalHold = await prisma.giuCho.findUnique({
      where: { giuChoId: holdId! },
    });
    const finalSeat = await prisma.gheChuyenXe.findUnique({
      where: { gheChuyenXeId: tripSeat1 },
    });

    if (bookingAttempt.status === 'fulfilled') {
      // Outcome 1: Booking won the race! Hold MUST be DA_DAT, seat MUST be DA_DAT
      expect(finalHold?.trangThai).toBe('DA_DAT');
      expect(finalSeat?.trangThai).toBe('DA_DAT');
      expect(finalSeat?.giuChoId).toBeNull();
    } else {
      // Outcome 2: Release won the race! Booking got rejected, hold MUST be DA_GIAI_PHONG, seat MUST be TRONG
      expect(finalHold?.trangThai).toBe('DA_GIAI_PHONG');
      expect(finalSeat?.trangThai).toBe('TRONG');
      expect(finalSeat?.giuChoId).toBeNull();
    }
  }, 30_000);
});


