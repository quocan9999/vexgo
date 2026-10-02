import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { ADMIN_ROLE_DEFAULT_PERMISSION_KEYS } from '../../../src/auth/permissions/permission-catalog.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('Trips concurrent schedule conflict integrity with MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let busCompanyId: number;
  let routeId: number;
  let vehicleId1: number;
  let vehicleId2: number;
  let vehicleTypeId: number;
  let principal: AuthPrincipal;

  beforeAll(async () => {
    principal = {
      taiKhoanId: 8888,
      sessionId: 'trip-concurrency-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 9999,
      nhaXeId: null,
    };

    const accessTokenGuard = {
      canActivate(context: ExecutionContext) {
        context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
          principal;
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

    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-${suffix}`,
        tenNhaXe: `Test Concurrency Company ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    busCompanyId = company.nhaXeId;
    principal.nhaXeId = busCompanyId;

    const route = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: `TX-${suffix}`,
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
        tenLoai: `Loại Xe ${suffix}`,
      },
      select: { loaiXeId: true },
    });
    vehicleTypeId = vehicleType.loaiXeId;

    const v1 = await prisma.xe.create({
      data: {
        bienSoXe: `51B-${suffix}1`,
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
        loaiXeId: vehicleTypeId,
        ghes: {
          create: [
            { soGhe: 'A01', viTri: 'Tầng 1' },
            { soGhe: 'A02', viTri: 'Tầng 1' },
          ],
        },
      },
      select: { xeId: true },
    });
    vehicleId1 = v1.xeId;

    const v2 = await prisma.xe.create({
      data: {
        bienSoXe: `51B-${suffix}2`,
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
        loaiXeId: vehicleTypeId,
        ghes: {
          create: [
            { soGhe: 'B01', viTri: 'Tầng 1' },
            { soGhe: 'B02', viTri: 'Tầng 1' },
          ],
        },
      },
      select: { xeId: true },
    });
    vehicleId2 = v2.xeId;
  }, 30_000);

  afterAll(async () => {
    try {
      await prisma.gheChuyenXe.deleteMany({
        where: { chuyenXe: { is: { nhaXeId: busCompanyId } } },
      });
      await prisma.chuyenXe.deleteMany({
        where: { nhaXeId: busCompanyId },
      });
      await prisma.ghe.deleteMany({
        where: { xeId: { in: [vehicleId1, vehicleId2] } },
      });
      await prisma.xe.deleteMany({
        where: { nhaXeId: busCompanyId },
      });
      await prisma.loaiXe.deleteMany({
        where: { nhaXeId: busCompanyId },
      });
      await prisma.tuyenXe.deleteMany({
        where: { nhaXeId: busCompanyId },
      });
      await prisma.nhaXe.deleteMany({
        where: { nhaXeId: busCompanyId },
      });
    } finally {
      await app?.close();
    }
  }, 30_000);

  beforeEach(async () => {
    await prisma.gheChuyenXe.deleteMany({
      where: { chuyenXe: { is: { nhaXeId: busCompanyId } } },
    });
    await prisma.chuyenXe.deleteMany({
      where: { nhaXeId: busCompanyId },
    });
  });

  function createTripPayload(code: string, vehicleId: number, date: string, time: string) {
    return {
      code,
      routeId,
      vehicleId,
      departureDate: date,
      departureTime: time,
    };
  }

  it('allows only one of two concurrent creates for the exact same vehicle and schedule', async () => {
    const code1 = `CX-${randomUUID().slice(0, 8).toUpperCase()}`;
    const code2 = `CX-${randomUUID().slice(0, 8).toUpperCase()}`;

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(createTripPayload(code1, vehicleId1, '2099-05-15', '08:30:00')),
      request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(createTripPayload(code2, vehicleId1, '2099-05-15', '08:30:00')),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const conflictRes = [res1, res2].find((r) => r.status === 409);
    expect(conflictRes?.body.error).toBe('TRIP_VEHICLE_SCHEDULE_CONFLICT');

    const createdTrips = await prisma.chuyenXe.findMany({
      where: {
        xeId: vehicleId1,
        ngayKhoiHanh: new Date('2099-05-15T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:30:00.000Z'),
      },
    });
    expect(createdTrips).toHaveLength(1);
  }, 30_000);

  it('allows both concurrent creates when vehicles are different at the exact same schedule', async () => {
    const code1 = `CX-${randomUUID().slice(0, 8).toUpperCase()}`;
    const code2 = `CX-${randomUUID().slice(0, 8).toUpperCase()}`;

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(createTripPayload(code1, vehicleId1, '2099-05-16', '09:00:00')),
      request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(createTripPayload(code2, vehicleId2, '2099-05-16', '09:00:00')),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const createdTrips = await prisma.chuyenXe.findMany({
      where: {
        chuyenXeId: { in: [res1.body.data.tripId, res2.body.data.tripId] },
      },
    });
    expect(createdTrips).toHaveLength(2);
  }, 30_000);

  it('allows both concurrent creates for the same vehicle at different times', async () => {
    const code1 = `CX-${randomUUID().slice(0, 8).toUpperCase()}`;
    const code2 = `CX-${randomUUID().slice(0, 8).toUpperCase()}`;

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(createTripPayload(code1, vehicleId1, '2099-05-17', '07:00:00')),
      request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(createTripPayload(code2, vehicleId1, '2099-05-17', '15:00:00')),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const createdTrips = await prisma.chuyenXe.findMany({
      where: {
        chuyenXeId: { in: [res1.body.data.tripId, res2.body.data.tripId] },
      },
    });
    expect(createdTrips).toHaveLength(2);
  }, 30_000);

  it('allows only one of two concurrent updates attempting to move two trips of the same vehicle to the same slot', async () => {
    const code1 = `CX-${randomUUID().slice(0, 8).toUpperCase()}`;
    const code2 = `CX-${randomUUID().slice(0, 8).toUpperCase()}`;

    const trip1Res = await request(app.getHttpServer())
      .post('/api/v1/trips')
      .send(createTripPayload(code1, vehicleId1, '2099-05-18', '07:00:00'));
    const trip2Res = await request(app.getHttpServer())
      .post('/api/v1/trips')
      .send(createTripPayload(code2, vehicleId1, '2099-05-18', '19:00:00'));

    expect(trip1Res.status).toBe(201);
    expect(trip2Res.status).toBe(201);

    const trip1Id = trip1Res.body.data.tripId;
    const trip2Id = trip2Res.body.data.tripId;

    // Both attempt to reschedule to 12:00:00 on the same date concurrently
    const [update1, update2] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/trips/${trip1Id}`)
        .send({ departureDate: '2099-05-18', departureTime: '12:00:00' }),
      request(app.getHttpServer())
        .patch(`/api/v1/trips/${trip2Id}`)
        .send({ departureDate: '2099-05-18', departureTime: '12:00:00' }),
    ]);

    const statuses = [update1.status, update2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const conflictRes = [update1, update2].find((r) => r.status === 409);
    expect(conflictRes?.body.error).toBe('TRIP_VEHICLE_SCHEDULE_CONFLICT');

    const targetTrips = await prisma.chuyenXe.findMany({
      where: {
        xeId: vehicleId1,
        ngayKhoiHanh: new Date('2099-05-18T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T12:00:00.000Z'),
        trangThai: { not: 'DA_HUY' },
      },
    });
    expect(targetTrips).toHaveLength(1);
  }, 30_000);

  it('deterministically blocks and rejects concurrent create when vehicle row lock is held and slot is occupied before release', async () => {
    const targetDate = '2099-06-01';
    const targetTime = '10:00:00';
    const blockerCode = `CX-BLK-${randomUUID().slice(0, 6).toUpperCase()}`;
    const requestCode = `CX-REQ-${randomUUID().slice(0, 6).toUpperCase()}`;

    let notifyLockAcquired!: () => void;
    const lockAcquiredPromise = new Promise<void>((resolve) => {
      notifyLockAcquired = resolve;
    });

    let continueTransaction!: () => void;
    const releaseLockPromise = new Promise<void>((resolve) => {
      continueTransaction = resolve;
    });

    const txPromise = prisma.$transaction(
      async (tx) => {
        // Step 2: Actively lock the vehicle row with SELECT ... FOR UPDATE
        await tx.$queryRaw`
          SELECT xeId
          FROM Xe
          WHERE xeId = ${vehicleId1}
          FOR UPDATE
        `;

        // Signal that the vehicle lock is actively held
        notifyLockAcquired();

        // Hold the lock until test instructs us to proceed
        await releaseLockPromise;

        // Step 5: Within the lock-holding transaction, occupy the target slot
        await tx.chuyenXe.create({
          data: {
            maChuyenXe: blockerCode,
            ngayKhoiHanh: new Date(`${targetDate}T00:00:00.000Z`),
            gioKhoiHanh: new Date(`1970-01-01T${targetTime}.000Z`),
            trangThai: 'CHUA_KHOI_HANH',
            nhaXeId: busCompanyId,
            tuyenXeId: routeId,
            xeId: vehicleId1,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 30_000,
      },
    );

    try {
      // Wait until the test transaction has confirmed holding the row lock
      await lockAcquiredPromise;

      // Step 3: Start the HTTP create request targeting the exact same vehicle & slot
      let requestSettled = false;
      const requestPromise = request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(createTripPayload(requestCode, vehicleId1, targetDate, targetTime))
        .then((res) => {
          requestSettled = true;
          return res;
        });

      // Step 4: Prove request cannot complete while the vehicle row lock is held
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(requestSettled).toBe(false);

      // Step 6: Occupy the slot and commit the transaction to release the lock
      continueTransaction();
      await txPromise;

      // Step 7 & 8: Request resumes, sees the committed slot occupancy under ReadCommitted, and returns 409
      const response = await requestPromise;
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('TRIP_VEHICLE_SCHEDULE_CONFLICT');

      // Step 9: Query DB: exactly 1 non-cancelled trip exists at target slot
      const existingTrips = await prisma.chuyenXe.findMany({
        where: {
          xeId: vehicleId1,
          ngayKhoiHanh: new Date(`${targetDate}T00:00:00.000Z`),
          gioKhoiHanh: new Date(`1970-01-01T${targetTime}.000Z`),
          trangThai: { not: 'DA_HUY' },
        },
      });
      expect(existingTrips).toHaveLength(1);
      expect(existingTrips[0].maChuyenXe).toBe(blockerCode);
    } finally {
      continueTransaction?.();
      await txPromise.catch(() => {});
    }
  }, 30_000);
});
