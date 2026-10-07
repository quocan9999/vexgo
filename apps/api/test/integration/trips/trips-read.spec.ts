import { Test } from '@nestjs/testing';
import { type ExecutionContext, type INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { ADMIN_ROLE_DEFAULT_PERMISSION_KEYS } from '../../../src/auth/permissions/permission-catalog.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { AUTH_MODE_KEY } from '../../../src/auth/decorators/public.decorator.js';

const mockTrip = {
  chuyenXeId: 101,
  maChuyenXe: 'FUTA-CX-001',
  ngayKhoiHanh: new Date('2026-10-10T00:00:00.000Z'),
  gioKhoiHanh: new Date('1970-01-01T07:30:00.000Z'),
  trangThai: 'CHUA_KHOI_HANH',
  nhanGuiHang: true,
  sucChuaXeMay: 1,
  sucChuaHangCongKenh: 2,
  sucChuaHangNhe: 3,
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-01T10:00:00.000Z'),
  tuyenXe: {
    tuyenXeId: 1,
    maTuyenXe: 'FUTA-TX-0001',
    diemDi: 'TP.HCM',
    diemDen: 'Đà Lạt',
  },
  xe: {
    xeId: 8,
    bienSoXe: '30F-123.45',
    trangThai: 'HOAT_DONG',
    loaiXe: {
      loaiXeId: 2,
      tenLoai: 'GIƯỜNG NẰM',
      sucChuaXeMayMacDinh: 9,
      sucChuaHangCongKenhMacDinh: 9,
      sucChuaHangNheMacDinh: 9,
    },
  },
  gheChuyenXes: [
    { trangThai: 'TRONG' },
    { trangThai: 'TRONG' },
    { trangThai: 'DANG_GIU' },
    { trangThai: 'DA_DAT' },
  ],
};

const prisma = {
  chuyenXe: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  gheChuyenXe: {
    findMany: vi.fn(),
  },
  bangGia: {
    findFirst: vi.fn(),
  },
  phienDangNhap: { findUnique: vi.fn() },
  vaiTroQuyen: { findMany: vi.fn().mockResolvedValue([]) },
  cauHinhQuyenVaiTroNhaXe: { findMany: vi.fn().mockResolvedValue([]) },
};

let currentPrincipal: AuthPrincipal | null = null;

const testAccessTokenGuard = {
  canActivate(context: ExecutionContext) {
    const handler = context.getHandler();
    const authMode = Reflect.getMetadata(AUTH_MODE_KEY, handler);
    if (authMode === 'public' || authMode === 'optional') {
      return true;
    }
    if (!currentPrincipal) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Yêu cầu đăng nhập.',
      });
    }
    context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user = currentPrincipal;
    return true;
  },
};

describe('Trips read HTTP contract and authorization', () => {
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
    currentPrincipal = {
      taiKhoanId: 10,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 100,
      nhaXeId: 5,
    };
    prisma.chuyenXe.findMany.mockResolvedValue([mockTrip]);
    prisma.chuyenXe.count.mockResolvedValue(1);
    prisma.chuyenXe.findFirst.mockResolvedValue(mockTrip);
  });

  it('rejects unauthenticated list request with 401', async () => {
    currentPrincipal = null;
    const res = await request(app.getHttpServer())
      .get('/api/v1/trips')
      .expect(401);
    expect(res.body.statusCode).toBe(401);
  });

  it('rejects unauthenticated operational detail request with 401', async () => {
    currentPrincipal = null;
    const res = await request(app.getHttpServer())
      .get('/api/v1/trips/101/operational-detail')
      .expect(401);
    expect(res.body.statusCode).toBe(401);
  });

  it('rejects tenant employee missing trip:read permission with 403', async () => {
    currentPrincipal = {
      taiKhoanId: 11,
      sessionId: 'test-session-2',
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['seat:read'],
      nhanVienId: 101,
      nhaXeId: 5,
    };
    const res = await request(app.getHttpServer())
      .get('/api/v1/trips')
      .expect(403);
    expect(res.body.statusCode).toBe(403);
  });

  it('rejects user without tenant principal (no nhaXeId) with 403', async () => {
    currentPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-super-admin',
      roles: ['SUPER_ADMIN'],
      permissions: ['trip:read'],
      nhanVienId: null,
      nhaXeId: null,
    };
    const res = await request(app.getHttpServer())
      .get('/api/v1/trips')
      .expect(403);
    expect(res.body.statusCode).toBe(403);
  });

  it('allows NHAN_VIEN_DIEU_HANH with trip:read to list trips', async () => {
    currentPrincipal = {
      taiKhoanId: 12,
      sessionId: 'test-session-dieu-hanh',
      roles: ['NHAN_VIEN_DIEU_HANH'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_DIEU_HANH],
      nhanVienId: 102,
      nhaXeId: 5,
    };
    const res = await request(app.getHttpServer())
      .get('/api/v1/trips')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('returns paginated trip list in camelCase envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/trips')
      .expect(200);

    expect(res.body).toEqual({
      data: [
        {
          tripId: 101,
          code: 'FUTA-CX-001',
          departureDate: '2026-10-10',
          departureTime: '07:30:00',
          status: 'CHUA_KHOI_HANH',
          acceptsShipments: true,
          cargoCapacity: { motorbikes: 1, bulkyCargo: 2, lightCargo: 3 },
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
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
      ],
      meta: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    });

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ nhaXeId: 5 }),
        skip: 0,
        take: 10,
      }),
    );
  });

  it('passes search, status, routeId, vehicleId, departureDate, and sort query', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/trips')
      .query({
        page: '2',
        pageSize: '5',
        search: 'Đà Lạt',
        status: 'CHUA_KHOI_HANH',
        routeId: '1',
        vehicleId: '8',
        departureDate: '2026-10-10',
        sortBy: 'code',
        sortDirection: 'desc',
      })
      .expect(200);

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nhaXeId: 5,
          trangThai: 'CHUA_KHOI_HANH',
          tuyenXeId: 1,
          xeId: 8,
          ngayKhoiHanh: new Date('2026-10-10T00:00:00.000Z'),
          OR: [
            { maChuyenXe: { contains: 'Đà Lạt' } },
            { tuyenXe: { is: { maTuyenXe: { contains: 'Đà Lạt' } } } },
            { tuyenXe: { is: { diemDi: { contains: 'Đà Lạt' } } } },
            { tuyenXe: { is: { diemDen: { contains: 'Đà Lạt' } } } },
            { xe: { is: { bienSoXe: { contains: 'Đà Lạt' } } } },
          ],
        }),
        skip: 5,
        take: 5,
        orderBy: [{ maChuyenXe: 'desc' }, { chuyenXeId: 'asc' }],
      }),
    );
  });

  it('returns trip detail with seatSummary', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/trips/101/operational-detail')
      .expect(200);

    expect(res.body).toEqual({
      data: {
        tripId: 101,
        code: 'FUTA-CX-001',
        departureDate: '2026-10-10',
        departureTime: '07:30:00',
        status: 'CHUA_KHOI_HANH',
        acceptsShipments: true,
        cargoCapacity: { motorbikes: 1, bulkyCargo: 2, lightCargo: 3 },
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
          total: 4,
          available: 2,
          held: 1,
          booked: 1,
        },
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      },
    });

    expect(prisma.chuyenXe.findFirst).toHaveBeenCalledWith({
      where: { chuyenXeId: 101, nhaXeId: 5 },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });
  });

  it('enforces tenant isolation and returns 404 TRIP_NOT_FOUND when trip does not belong to tenant', async () => {
    prisma.chuyenXe.findFirst.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .get('/api/v1/trips/999/operational-detail')
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      error: 'TRIP_NOT_FOUND',
      message: 'Không tìm thấy chuyến xe.',
    });
  });

  it.each([
    ['page', '0'],
    ['pageSize', '101'],
    ['departureDate', 'invalid-date'],
    ['status', 'MO_BAN'],
    ['sortBy', 'unknownField'],
    ['sortDirection', 'diagonal'],
  ])('rejects invalid query %s=%s with 400 VALIDATION_ERROR', async (field, val) => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/trips')
      .query({ [field]: val })
      .expect(400);

    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(prisma.chuyenXe.findMany).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc'])(
    'rejects invalid trip id %s with 400 VALIDATION_ERROR',
    async (id) => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/trips/${id}/operational-detail`)
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(prisma.chuyenXe.findFirst).not.toHaveBeenCalled();
    },
  );

  describe('GET /api/v1/trips/:id/seat-inventory', () => {
    const mockSeats = [
      {
        gheChuyenXeId: 1002,
        chuyenXeId: 101,
        gheId: 502,
        trangThai: 'DANG_GIU',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        updatedAt: new Date('2026-10-01T10:00:00.000Z'),
        ghe: {
          gheId: 502,
          soGhe: 'A02',
          viTri: 'Tầng dưới',
        },
      },
      {
        gheChuyenXeId: 1001,
        chuyenXeId: 101,
        gheId: 501,
        trangThai: 'TRONG',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        updatedAt: new Date('2026-10-01T10:00:00.000Z'),
        ghe: {
          gheId: 501,
          soGhe: 'A01',
          viTri: 'Tầng dưới',
        },
      },
      {
        gheChuyenXeId: 1003,
        chuyenXeId: 101,
        gheId: 503,
        trangThai: 'DA_DAT',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        updatedAt: new Date('2026-10-01T10:00:00.000Z'),
        ghe: {
          gheId: 503,
          soGhe: 'B01',
          viTri: 'Tầng trên',
        },
      },
    ];

    it('rejects unauthenticated requests with 401', async () => {
      currentPrincipal = null;

      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/101/seat-inventory')
        .expect(401);

      expect(res.body.statusCode).toBe(401);
    });

    it('rejects principal without trip:read with 403 PERMISSION_FORBIDDEN', async () => {
      currentPrincipal = {
        taiKhoanId: 11,
        sessionId: 'test-session-no-read',
        roles: ['NHAN_VIEN_CSKH'],
        permissions: ['seat:read'],
        nhanVienId: 101,
        nhaXeId: 5,
      };

      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/101/seat-inventory')
        .expect(403);

      expect(res.body.error).toBe('PERMISSION_FORBIDDEN');
    });

    it('returns 404 TRIP_NOT_FOUND when trip is outside tenant scope', async () => {
      currentPrincipal = {
        taiKhoanId: 10,
        sessionId: 'test-session',
        roles: ['NHA_XE_ADMIN'],
        permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
        nhanVienId: 100,
        nhaXeId: 5,
      };
      prisma.chuyenXe.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/999/seat-inventory')
        .expect(404);

      expect(res.body.error).toBe('TRIP_NOT_FOUND');
    });

    it('returns seat inventory with stable order and accurate meta summary counts', async () => {
      currentPrincipal = {
        taiKhoanId: 12,
        sessionId: 'test-session-dieu-hanh',
        roles: ['NHAN_VIEN_DIEU_HANH'],
        permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_DIEU_HANH],
        nhanVienId: 102,
        nhaXeId: 5,
      };
      prisma.chuyenXe.findFirst.mockResolvedValue({ chuyenXeId: 101 });
      prisma.gheChuyenXe.findMany.mockResolvedValue([...mockSeats]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/101/seat-inventory')
        .expect(200);

      expect(res.body.meta).toEqual({
        tripId: 101,
        total: 3,
        available: 1,
        held: 1,
        booked: 1,
      });
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0].seat.code).toBe('A01');
      expect(res.body.data[0].status).toBe('TRONG');
      expect(res.body.data[0].seat.position).toBe('Tầng dưới');
      expect(res.body.data[1].seat.code).toBe('A02');
      expect(res.body.data[2].seat.code).toBe('B01');
    });

    it('filters data by status while keeping accurate total meta counts', async () => {
      currentPrincipal = {
        taiKhoanId: 10,
        sessionId: 'test-session',
        roles: ['NHA_XE_ADMIN'],
        permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
        nhanVienId: 100,
        nhaXeId: 5,
      };
      prisma.chuyenXe.findFirst.mockResolvedValue({ chuyenXeId: 101 });
      prisma.gheChuyenXe.findMany.mockResolvedValue([...mockSeats]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/101/seat-inventory')
        .query({ status: 'TRONG' })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].seat.code).toBe('A01');
      expect(res.body.meta).toEqual({
        tripId: 101,
        total: 3,
        available: 1,
        held: 1,
        booked: 1,
      });
    });

    it('rejects invalid status filter with 400 VALIDATION_ERROR', async () => {
      currentPrincipal = {
        taiKhoanId: 10,
        sessionId: 'test-session',
        roles: ['NHA_XE_ADMIN'],
        permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
        nhanVienId: 100,
        nhaXeId: 5,
      };

      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/101/seat-inventory')
        .query({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Customer public endpoints (GET /api/v1/trips/:id and :id/seats)', () => {
    it('allows guest to access public trip detail without authentication', async () => {
      currentPrincipal = null;
      prisma.chuyenXe.findUnique.mockResolvedValueOnce({
        ...mockTrip,
        nhaXeId: 5,
        tuyenXeId: 1,
        xeId: 8,
        tuyenXe: {
          ...mockTrip.tuyenXe,
          nhaXe: { nhaXeId: 5, tenNhaXe: 'Phương Trang' },
        },
        xe: {
          ...mockTrip.xe,
          loaiXe: { loaiXeId: 2, tenLoai: 'GIƯỜNG NẰM' },
        },
        ngayKhoiHanh: new Date('2026-10-10T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T23:59:00.000Z'),
        gheChuyenXes: [{ trangThai: 'TRONG' }],
      });
      prisma.bangGia.findFirst.mockResolvedValueOnce(null);

      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/101')
        .expect(200);

      expect(res.body.data.id).toBe(101);
      expect(res.body.data.code).toBe('FUTA-CX-001');
    });

    it('allows guest to access public trip seats without authentication', async () => {
      currentPrincipal = null;
      prisma.chuyenXe.findUnique.mockResolvedValueOnce({
        chuyenXeId: 101,
        trangThai: 'CHUA_KHOI_HANH',
      });
      prisma.gheChuyenXe.findMany.mockResolvedValueOnce([
        {
          gheChuyenXeId: 1001,
          trangThai: 'TRONG',
          ghe: { soGhe: 'A01', viTri: 'Tầng 1' },
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/101/seats')
        .expect(200);

      expect(res.body.data).toEqual([
        {
          tripSeatId: 1001,
          seatNumber: 'A01',
          position: 'Tầng 1',
          status: 'TRONG',
        },
      ]);
    });
  });
});
