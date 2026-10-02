import { Test } from '@nestjs/testing';
import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { ADMIN_ROLE_DEFAULT_PERMISSION_KEYS } from '../../../src/auth/permissions/permission-catalog.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { Prisma } from '../../../src/generated/prisma/client.js';

const mockRoute = {
  tuyenXeId: 1,
  maTuyenXe: 'FUTA-TX-0001',
  diemDi: 'TP.HCM',
  diemDen: 'Đà Lạt',
  trangThai: 'HOAT_DONG',
  nhaXeId: 5,
};

const mockVehicle = {
  xeId: 8,
  bienSoXe: '30F-123.45',
  trangThai: 'HOAT_DONG',
  nhaXeId: 5,
  loaiXe: {
    loaiXeId: 2,
    tenLoai: 'GIƯỜNG NẰM',
  },
  ghes: [
    { gheId: 101, soGhe: 'A01' },
    { gheId: 102, soGhe: 'A02' },
  ],
};

const mockTripCreated = {
  chuyenXeId: 101,
  maChuyenXe: 'FUTA-CX-001',
  ngayKhoiHanh: new Date('2026-10-10T00:00:00.000Z'),
  gioKhoiHanh: new Date('1970-01-01T07:30:00.000Z'),
  trangThai: 'CHUA_KHOI_HANH',
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-01T10:00:00.000Z'),
  tuyenXe: mockRoute,
  xe: mockVehicle,
  gheChuyenXes: [{ trangThai: 'TRONG' }, { trangThai: 'TRONG' }],
};

const prisma = {
  chuyenXe: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
  },
  gheChuyenXe: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  tuyenXe: { findFirst: vi.fn() },
  xe: { findFirst: vi.fn() },
  phienDangNhap: { findUnique: vi.fn() },
  vaiTroQuyen: { findMany: vi.fn().mockResolvedValue([]) },
  cauHinhQuyenVaiTroNhaXe: { findMany: vi.fn().mockResolvedValue([]) },
  $transaction: vi.fn(),
};

let currentPrincipal: AuthPrincipal | null = null;

const testAccessTokenGuard = {
  canActivate(context: ExecutionContext) {
    if (!currentPrincipal) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Yêu cầu đăng nhập.',
      });
    }
    context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
      currentPrincipal;
    return true;
  },
};

describe('Trips write HTTP contract (05.2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AccessTokenGuard)
      .useValue(testAccessTokenGuard)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    currentPrincipal = {
      taiKhoanId: 10,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 100,
      nhaXeId: 5,
    };
    prisma.tuyenXe.findFirst.mockResolvedValue(mockRoute);
    prisma.xe.findFirst.mockResolvedValue(mockVehicle);
    prisma.chuyenXe.findFirst.mockResolvedValue(null);
    prisma.chuyenXe.create.mockResolvedValue(mockTripCreated);
    prisma.chuyenXe.update.mockResolvedValue(mockTripCreated);
    prisma.chuyenXe.updateMany.mockResolvedValue({ count: 1 });
    prisma.chuyenXe.findFirstOrThrow.mockResolvedValue(mockTripCreated);
    prisma.gheChuyenXe.findFirst.mockResolvedValue(null);
  });

  describe('POST /api/v1/trips', () => {
    const validBody = {
      code: 'FUTA-CX-001',
      routeId: 1,
      vehicleId: 8,
      departureDate: '2026-10-10',
      departureTime: '07:30:00',
    };

    it('rejects unauthenticated request with 401', async () => {
      currentPrincipal = null;
      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(401);

      expect(res.body.statusCode).toBe(401);
    });

    it('rejects request without trip:create permission with 403', async () => {
      currentPrincipal = {
        ...currentPrincipal!,
        permissions: ['trip:read'],
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });

    it('allows NHAN_VIEN_DIEU_HANH with trip:create to create trip', async () => {
      currentPrincipal = {
        taiKhoanId: 12,
        sessionId: 'test-dieu-hanh',
        roles: ['NHAN_VIEN_DIEU_HANH'],
        permissions: [
          ...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_DIEU_HANH,
        ],
        nhanVienId: 102,
        nhaXeId: 5,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(201);

      expect(res.body.data.code).toBe('FUTA-CX-001');
      expect(res.body.data.seatSummary).toEqual({
        total: 2,
        available: 2,
        held: 0,
        booked: 0,
      });
    });

    it('creates trip and GheChuyenXe snapshot initialized to TRONG atomically', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(201);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.chuyenXe.create).toHaveBeenCalledWith({
        data: {
          maChuyenXe: 'FUTA-CX-001',
          ngayKhoiHanh: new Date('2026-10-10T00:00:00.000Z'),
          gioKhoiHanh: new Date('1970-01-01T07:30:00.000Z'),
          trangThai: 'CHUA_KHOI_HANH',
          nhaXeId: 5,
          tuyenXeId: 1,
          xeId: 8,
          gheChuyenXes: {
            create: [
              { gheId: 101, trangThai: 'TRONG' },
              { gheId: 102, trangThai: 'TRONG' },
            ],
          },
        },
        include: {
          tuyenXe: true,
          xe: { include: { loaiXe: true } },
          gheChuyenXes: { select: { trangThai: true } },
        },
      });

      expect(res.body).toEqual({
        data: {
          tripId: 101,
          code: 'FUTA-CX-001',
          departureDate: '2026-10-10',
          departureTime: '07:30:00',
          status: 'CHUA_KHOI_HANH',
          route: {
            routeId: 1,
            code: 'FUTA-TX-0001',
            origin: 'TP.HCM',
            destination: 'Đà Lạt',
          },
          vehicle: {
            vehicleId: 8,
            licensePlate: '30F-123.45',
            status: 'HOAT_DONG',
            vehicleType: {
              vehicleTypeId: 2,
              name: 'GIƯỜNG NẰM',
            },
          },
          seatSummary: {
            total: 2,
            available: 2,
            held: 0,
            booked: 0,
          },
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
      });
    });

    it('rejects with 404 ROUTE_NOT_FOUND when route does not belong to tenant', async () => {
      prisma.tuyenXe.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        error: 'ROUTE_NOT_FOUND',
        message: 'Không tìm thấy tuyến xe trong nhà xe.',
      });
    });

    it('rejects with 409 ROUTE_NOT_ACTIVE when route is not HOAT_DONG', async () => {
      prisma.tuyenXe.findFirst.mockResolvedValue({
        ...mockRoute,
        trangThai: 'TAM_NGUNG',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'ROUTE_NOT_ACTIVE',
        message: 'Tuyến xe đang tạm ngưng hoạt động, không thể lập chuyến.',
      });
    });

    it('rejects with 404 VEHICLE_NOT_FOUND when vehicle does not belong to tenant', async () => {
      prisma.xe.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        error: 'VEHICLE_NOT_FOUND',
        message: 'Không tìm thấy xe trong nhà xe.',
      });
    });

    it('rejects with 409 VEHICLE_NOT_ACTIVE when vehicle is not HOAT_DONG', async () => {
      prisma.xe.findFirst.mockResolvedValue({
        ...mockVehicle,
        trangThai: 'TAM_NGUNG',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'VEHICLE_NOT_ACTIVE',
        message: 'Xe đang không hoạt động, không thể phân công vào chuyến.',
      });
    });

    it('rejects with 409 VEHICLE_HAS_NO_SEATS when vehicle has 0 seats', async () => {
      prisma.xe.findFirst.mockResolvedValue({
        ...mockVehicle,
        ghes: [],
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'VEHICLE_HAS_NO_SEATS',
        message: 'Xe chưa được cấu hình ghế nên chưa thể lập chuyến.',
      });
    });

    it('rejects with 409 TRIP_CODE_EXISTS when trip code already exists', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({ chuyenXeId: 99 });

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'TRIP_CODE_EXISTS',
        message: 'Mã chuyến xe đã tồn tại.',
      });
    });

    it('handles unique constraint race condition P2002 with 409 TRIP_CODE_EXISTS', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '7.10.0' },
      );
      prisma.chuyenXe.create.mockRejectedValue(p2002);

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send(validBody)
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'TRIP_CODE_EXISTS',
        message: 'Mã chuyến xe đã tồn tại.',
      });
    });

    it('rejects client attempt to inject busCompanyId or status with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send({
          ...validBody,
          busCompanyId: 999,
          status: 'DANG_CHAY',
        })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it.each([
      ['code', ''],
      ['routeId', 0],
      ['vehicleId', -1],
      ['departureDate', 'invalid-date'],
      ['departureTime', '25:00:00'],
    ])('rejects invalid %s with 400 VALIDATION_ERROR', async (field, val) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/trips')
        .send({ ...validBody, [field]: val })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/v1/trips/:id', () => {
    const validPatchBody = {
      departureDate: '2026-10-15',
      departureTime: '09:00:00',
    };

    it('rejects unauthenticated request with 401', async () => {
      currentPrincipal = null;
      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101')
        .send(validPatchBody)
        .expect(401);

      expect(res.body.statusCode).toBe(401);
    });

    it('rejects request without trip:update permission with 403', async () => {
      currentPrincipal = {
        ...currentPrincipal!,
        permissions: ['trip:read'],
      };

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101')
        .send(validPatchBody)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });

    it('updates departureDate and departureTime', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue(mockTripCreated);
      const updatedTrip = {
        ...mockTripCreated,
        ngayKhoiHanh: new Date('2026-10-15T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T09:00:00.000Z'),
      };
      prisma.chuyenXe.updateMany.mockResolvedValue({ count: 1 });
      prisma.chuyenXe.findFirstOrThrow.mockResolvedValue(updatedTrip);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101')
        .send(validPatchBody)
        .expect(200);

      expect(prisma.chuyenXe.updateMany).toHaveBeenCalledWith({
        where: { chuyenXeId: 101, nhaXeId: 5, trangThai: 'CHUA_KHOI_HANH' },
        data: {
          ngayKhoiHanh: new Date('2026-10-15T00:00:00.000Z'),
          gioKhoiHanh: new Date('1970-01-01T09:00:00.000Z'),
        },
      });

      expect(res.body.data.departureDate).toBe('2026-10-15');
      expect(res.body.data.departureTime).toBe('09:00:00');
    });

    it('rejects with 404 TRIP_NOT_FOUND when trip does not belong to tenant', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/999')
        .send(validPatchBody)
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    });

    it('rejects attempt to mutate immutable fields (code, routeId, vehicleId, status) with 400', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101')
        .send({
          ...validPatchBody,
          code: 'NEW-CODE',
          routeId: 2,
          vehicleId: 9,
          status: 'DANG_CHAY',
        })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects with 409 TRIP_STATUS_TRANSITION_NOT_ALLOWED when editing DANG_CHAY trip', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'DANG_CHAY',
      });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101')
        .send(validPatchBody)
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Chỉ có thể cập nhật chuyến xe khi chưa khởi hành.',
      });
    });

    it('rejects with 409 TRIP_STATUS_TRANSITION_NOT_ALLOWED when editing terminal trip', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'HOAN_THANH',
      });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101')
        .send(validPatchBody)
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Chỉ có thể cập nhật chuyến xe khi chưa khởi hành.',
      });
    });
  });

  describe('PATCH /api/v1/trips/:id/status (05.3)', () => {
    it('rejects unauthenticated request with 401', async () => {
      currentPrincipal = null;
      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101/status')
        .send({ status: 'DANG_CHAY' })
        .expect(401);

      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('rejects with 403 when principal lacks trip:update permission', async () => {
      currentPrincipal = {
        ...currentPrincipal!,
        permissions: ['trip:read'],
      };

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101/status')
        .send({ status: 'DANG_CHAY' })
        .expect(403);

      expect(res.body.error).toBe('PERMISSION_FORBIDDEN');
    });

    it('rejects invalid or prohibited status in body with 400', async () => {
      const res1 = await request(app.getHttpServer())
        .patch('/api/v1/trips/101/status')
        .send({ status: 'DA_HUY' })
        .expect(400);

      expect(res1.body.error).toBe('VALIDATION_ERROR');

      const res2 = await request(app.getHttpServer())
        .patch('/api/v1/trips/101/status')
        .send({ status: 'MO_BAN' })
        .expect(400);

      expect(res2.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects with 404 when trip is not found in tenant scope', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/999/status')
        .send({ status: 'DANG_CHAY' })
        .expect(404);

      expect(res.body.error).toBe('TRIP_NOT_FOUND');
    });

    it('successfully transitions from CHUA_KHOI_HANH to DANG_CHAY', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'CHUA_KHOI_HANH',
      });
      prisma.chuyenXe.updateMany.mockResolvedValue({ count: 1 });
      prisma.chuyenXe.findFirstOrThrow.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'DANG_CHAY',
      });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101/status')
        .send({ status: 'DANG_CHAY' })
        .expect(200);

      expect(prisma.chuyenXe.updateMany).toHaveBeenCalledWith({
        where: { chuyenXeId: 101, nhaXeId: 5, trangThai: 'CHUA_KHOI_HANH' },
        data: { trangThai: 'DANG_CHAY' },
      });
      expect(res.body.data.status).toBe('DANG_CHAY');
    });

    it('successfully transitions from DANG_CHAY to HOAN_THANH', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'DANG_CHAY',
      });
      prisma.chuyenXe.updateMany.mockResolvedValue({ count: 1 });
      prisma.chuyenXe.findFirstOrThrow.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'HOAN_THANH',
      });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101/status')
        .send({ status: 'HOAN_THANH' })
        .expect(200);

      expect(res.body.data.status).toBe('HOAN_THANH');
    });

    it('handles idempotent same-state update without database write', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'DANG_CHAY',
      });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101/status')
        .send({ status: 'DANG_CHAY' })
        .expect(200);

      expect(prisma.chuyenXe.updateMany).not.toHaveBeenCalled();
      expect(res.body.data.status).toBe('DANG_CHAY');
    });

    it('rejects invalid state transition with 409', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'CHUA_KHOI_HANH',
      });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101/status')
        .send({ status: 'HOAN_THANH' })
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể chuyển chuyến xe sang trạng thái yêu cầu.',
      });
    });

    it('handles race condition when state changes concurrently during updateStatus', async () => {
      prisma.chuyenXe.findFirst
        .mockResolvedValueOnce({
          ...mockTripCreated,
          trangThai: 'CHUA_KHOI_HANH',
        })
        .mockResolvedValueOnce({
          ...mockTripCreated,
          trangThai: 'DA_HUY',
        });
      prisma.chuyenXe.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/trips/101/status')
        .send({ status: 'DANG_CHAY' })
        .expect(409);

      expect(res.body.error).toBe('TRIP_STATUS_TRANSITION_NOT_ALLOWED');
    });
  });

  describe('POST /api/v1/trips/:id/cancel (05.3)', () => {
    it('rejects unauthenticated request with 401', async () => {
      currentPrincipal = null;
      const res = await request(app.getHttpServer())
        .post('/api/v1/trips/101/cancel')
        .expect(401);

      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('rejects with 403 when principal lacks trip:cancel permission', async () => {
      currentPrincipal = {
        ...currentPrincipal!,
        permissions: ['trip:read', 'trip:update'],
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips/101/cancel')
        .expect(403);

      expect(res.body.error).toBe('PERMISSION_FORBIDDEN');
    });

    it('rejects with 404 when trip is not found in tenant scope', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips/999/cancel')
        .expect(404);

      expect(res.body.error).toBe('TRIP_NOT_FOUND');
    });

    it('successfully cancels trip in CHUA_KHOI_HANH state', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'CHUA_KHOI_HANH',
      });
      prisma.chuyenXe.updateMany.mockResolvedValue({ count: 1 });
      prisma.chuyenXe.findFirstOrThrow.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'DA_HUY',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips/101/cancel')
        .expect(201);

      expect(prisma.chuyenXe.updateMany).toHaveBeenCalledWith({
        where: { chuyenXeId: 101, nhaXeId: 5, trangThai: 'CHUA_KHOI_HANH' },
        data: { trangThai: 'DA_HUY' },
      });
      expect(res.body.data.status).toBe('DA_HUY');
    });

    it('handles idempotent same-state cancellation when already DA_HUY', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'DA_HUY',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips/101/cancel')
        .expect(201);

      expect(prisma.chuyenXe.updateMany).not.toHaveBeenCalled();
      expect(res.body.data.status).toBe('DA_HUY');
    });

    it('rejects cancellation with 409 TRIP_HAS_ACTIVE_BOOKINGS when trip has active booked/held seats or tickets', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'CHUA_KHOI_HANH',
      });
      prisma.gheChuyenXe.findFirst.mockResolvedValue({ gheChuyenXeId: 101 });

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips/101/cancel')
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'TRIP_HAS_ACTIVE_BOOKINGS',
        message: 'Không thể hủy chuyến xe đã có vé hoặc đang có khách giữ chỗ.',
      });
      expect(prisma.chuyenXe.updateMany).not.toHaveBeenCalled();
    });

    it('rejects cancellation of running or completed trips with 409', async () => {
      prisma.chuyenXe.findFirst.mockResolvedValue({
        ...mockTripCreated,
        trangThai: 'DANG_CHAY',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips/101/cancel')
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể hủy chuyến xe đang chạy hoặc đã hoàn thành.',
      });
    });

    it('handles race condition when state changes concurrently during cancel', async () => {
      prisma.chuyenXe.findFirst
        .mockResolvedValueOnce({
          ...mockTripCreated,
          trangThai: 'CHUA_KHOI_HANH',
        })
        .mockResolvedValueOnce({
          ...mockTripCreated,
          trangThai: 'DANG_CHAY',
        });
      prisma.chuyenXe.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app.getHttpServer())
        .post('/api/v1/trips/101/cancel')
        .expect(409);

      expect(res.body.error).toBe('TRIP_STATUS_TRANSITION_NOT_ALLOWED');
    });
  });
});
