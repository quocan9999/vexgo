import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { ADMIN_ROLE_DEFAULT_PERMISSION_KEYS } from '../../../src/auth/permissions/permission-catalog.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { Prisma } from '../../../src/generated/prisma/client.js';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fare = {
  bangGiaId: 15,
  giaNiemYet: new Prisma.Decimal(250000),
  tuNgay: new Date('2099-09-01T00:00:00.000Z'),
  denNgay: null,
  trangThai: 'HOAT_DONG',
  tuyenXeId: 3,
  loaiXeId: 2,
  createdAt: new Date('2026-09-01T08:30:00.000Z'),
  updatedAt: new Date('2026-09-02T08:30:00.000Z'),
  tuyenXe: {
    tuyenXeId: 3,
    maTuyenXe: 'SG-DL-01',
    diemDi: 'TP.HCM',
    diemDen: 'Đà Lạt',
  },
  loaiXe: { loaiXeId: 2, tenLoai: 'Limousine' },
};

const prisma = {
  bangGia: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  tuyenXe: { findFirst: vi.fn() },
  loaiXe: { findFirst: vi.fn() },
};

let testPrincipal: AuthPrincipal = {
  taiKhoanId: 7,
  sessionId: 'fare-price-read-session',
  roles: ['NHA_XE_ADMIN'],
  permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
  nhanVienId: 9,
  nhaXeId: 41,
};

const testAccessTokenGuard = {
  canActivate(context: import('@nestjs/common').ExecutionContext) {
    context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user = testPrincipal;
    return true;
  },
};

describe('Fare Price read HTTP contract', () => {
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
    testPrincipal = {
      taiKhoanId: 7,
      sessionId: 'fare-price-read-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 9,
      nhaXeId: 41,
    };
    prisma.bangGia.findMany.mockResolvedValue([fare]);
    prisma.bangGia.count.mockResolvedValue(1);
    prisma.bangGia.findFirst.mockResolvedValue(fare);
    prisma.tuyenXe.findFirst.mockResolvedValue({ tuyenXeId: 3, nhaXeId: 41 });
    prisma.loaiXe.findFirst.mockResolvedValue({ loaiXeId: 2, nhaXeId: 41 });
  });

  it('returns the paginated English resource contract and derived future state', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/fare-prices')
      .expect(200);

    expect(response.body).toEqual({
      data: [
        {
          farePriceId: 15,
          listedPrice: 250000,
          currency: 'VND',
          validFrom: '2099-09-01',
          validTo: null,
          status: 'HOAT_DONG',
          effectiveState: 'CHUA_HIEU_LUC',
          route: {
            routeId: 3,
            code: 'SG-DL-01',
            origin: 'TP.HCM',
            destination: 'Đà Lạt',
          },
          vehicleType: { vehicleTypeId: 2, name: 'Limousine' },
          createdAt: '2026-09-01T08:30:00.000Z',
          updatedAt: '2026-09-02T08:30:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    expect(prisma.bangGia.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { nhaXeId: 41 },
    });
    expect(prisma.bangGia.count.mock.calls[0]?.[0]).toMatchObject({
      where: { nhaXeId: 41 },
    });
  });

  it('returns the same detail resource contract for a positive integer ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/fare-prices/15')
      .expect(200);

    expect(response.body.data).toEqual({
      farePriceId: 15,
      listedPrice: 250000,
      currency: 'VND',
      validFrom: '2099-09-01',
      validTo: null,
      status: 'HOAT_DONG',
      effectiveState: 'CHUA_HIEU_LUC',
      route: {
        routeId: 3,
        code: 'SG-DL-01',
        origin: 'TP.HCM',
        destination: 'Đà Lạt',
      },
      vehicleType: { vehicleTypeId: 2, name: 'Limousine' },
      createdAt: '2026-09-01T08:30:00.000Z',
      updatedAt: '2026-09-02T08:30:00.000Z',
    });
  });

  it('applies route/type/status/search filters, stable sorting, and pagination in Prisma', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/fare-prices')
      .query({
        page: '2',
        pageSize: '5',
        search: 'Đà Lạt',
        routeId: '3',
        vehicleTypeId: '2',
        status: 'HOAT_DONG',
        sortBy: 'listedPrice',
        sortDirection: 'asc',
      })
      .expect(200);

    expect(response.body.meta).toEqual({
      page: 2,
      pageSize: 5,
      totalItems: 1,
      totalPages: 1,
    });
    const query = prisma.bangGia.findMany.mock.calls[0]?.[0] as {
      skip: number;
      take: number;
      where: {
        tuyenXeId: number;
        loaiXeId: number;
        trangThai: string;
        OR: unknown[];
      };
      orderBy: unknown[];
    };
    expect(query.skip).toBe(5);
    expect(query.take).toBe(5);
    expect(query.where).toMatchObject({
      nhaXeId: 41,
      tuyenXeId: 3,
      loaiXeId: 2,
      trangThai: 'HOAT_DONG',
    });
    expect(query.where.OR).toEqual(
      expect.arrayContaining([
        { tuyenXe: { is: { maTuyenXe: { contains: 'Đà Lạt' } } } },
        { tuyenXe: { is: { diemDi: { contains: 'Đà Lạt' } } } },
        { tuyenXe: { is: { diemDen: { contains: 'Đà Lạt' } } } },
        { loaiXe: { is: { tenLoai: { contains: 'Đà Lạt' } } } },
      ]),
    );
    expect(query.orderBy).toEqual([
      { giaNiemYet: 'asc' },
      { bangGiaId: 'desc' },
    ]);
  });

  it('uses the business date at UTC midnight for effective-state DATE filters', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-31T17:00:00.000Z'));
    let query: { where: { AND: Array<Record<string, unknown>> } } | undefined;
    try {
      await request(app.getHttpServer())
        .get('/api/v1/fare-prices')
        .query({ effectiveState: 'CHUA_HIEU_LUC' })
        .expect(200);

      query = prisma.bangGia.findMany.mock.calls[0]?.[0] as {
        where: { AND: Array<Record<string, unknown>> };
      };
    } finally {
      vi.useRealTimers();
    }

    expect(query?.where.AND).toEqual(
      expect.arrayContaining([
        { trangThai: 'HOAT_DONG' },
        { tuNgay: { gt: new Date('2026-09-01T00:00:00.000Z') } },
      ]),
    );
  });

  it('returns an empty page with zero total pages when filters have no matches', async () => {
    prisma.bangGia.findMany.mockResolvedValueOnce([]);
    prisma.bangGia.count.mockResolvedValueOnce(0);

    const response = await request(app.getHttpServer())
      .get('/api/v1/fare-prices')
      .query({ search: 'no-match' })
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
  });

  it('does not apply a search predicate to whitespace-only input', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/fare-prices')
      .query({ search: '   ' })
      .expect(200);

    const query = prisma.bangGia.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(query.where.OR).toBeUndefined();
  });

  it.each([
    { page: '0' },
    { pageSize: '101' },
    { routeId: '1e3' },
    { vehicleTypeId: '0' },
    { status: 'DELETED' },
    { effectiveState: 'UNKNOWN' },
    { sortBy: 'sql' },
    { sortDirection: 'up' },
    { unexpected: 'value' },
  ])('rejects invalid list query %j before Prisma', async (query) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/fare-prices')
      .query(query)
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(prisma.bangGia.findMany).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1.5', '1e3', '0x10', '2147483648'])(
    'rejects invalid detail ID %s before Prisma',
    async (id) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/fare-prices/${id}`)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(prisma.bangGia.findFirst).not.toHaveBeenCalled();
    },
  );

  it('returns FARE_PRICE_NOT_FOUND for a missing fare', async () => {
    prisma.bangGia.findFirst.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .get('/api/v1/fare-prices/999')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'FARE_PRICE_NOT_FOUND',
      message: 'Không tìm thấy bảng giá.',
    });
    expect(prisma.bangGia.findFirst).toHaveBeenCalledWith({
      where: { bangGiaId: 999, nhaXeId: 41 },
      select: expect.any(Object),
    });
  });

  it('does not access fare data for a Super Admin principal', async () => {
    testPrincipal = {
      ...testPrincipal,
      roles: ['SUPER_ADMIN'],
      nhanVienId: null,
      nhaXeId: null,
    };

    const response = await request(app.getHttpServer())
      .get('/api/v1/fare-prices')
      .expect(403);

    expect(response.body.error).toBe('ROLE_FORBIDDEN');
    expect(prisma.bangGia.findMany).not.toHaveBeenCalled();
    expect(prisma.bangGia.count).not.toHaveBeenCalled();
  });

  it('fails closed when the authenticated tenant has no valid bus-company scope', async () => {
    testPrincipal = { ...testPrincipal, nhaXeId: null };

    const response = await request(app.getHttpServer())
      .get('/api/v1/fare-prices')
      .expect(403);

    expect(response.body.error).toBe('TENANT_SCOPE_REQUIRED');
    expect(prisma.bangGia.findMany).not.toHaveBeenCalled();
    expect(prisma.bangGia.count).not.toHaveBeenCalled();
  });

  it('scopes applicable-fare relation and price queries to the authenticated tenant', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/fare-prices/applicable')
      .query({ routeId: 3, vehicleTypeId: 2, date: '2099-09-10' })
      .expect(200);

    expect(response.body.data.farePriceId).toBe(15);
    expect(prisma.tuyenXe.findFirst).toHaveBeenCalledWith({
      where: { tuyenXeId: 3, nhaXeId: 41 },
      select: { tuyenXeId: true, nhaXeId: true },
    });
    expect(prisma.loaiXe.findFirst).toHaveBeenCalledWith({
      where: { loaiXeId: 2, nhaXeId: 41 },
      select: { loaiXeId: true, nhaXeId: true },
    });
    expect(prisma.bangGia.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        nhaXeId: 41,
        tuyenXeId: 3,
        loaiXeId: 2,
      }),
      take: 2,
    }));
  });
});
