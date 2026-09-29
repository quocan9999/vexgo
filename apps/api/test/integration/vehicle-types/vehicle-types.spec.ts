import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
let testPrincipal: AuthPrincipal = {
  taiKhoanId: 7,
  sessionId: 'tenant-session',
  roles: ['NHA_XE_ADMIN'],
  permissions: [],
  nhanVienId: 9,
  nhaXeId: 1,
};
const testAccessTokenGuard = {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user = testPrincipal;
    return true;
  },
};

const vehicleTypeRecord = {
  loaiXeId: 1,
  tenLoai: 'Limousine',
  moTa: 'Dòng xe limousine',
  createdAt: new Date('2026-09-25T10:00:00.000Z'),
  updatedAt: new Date('2026-09-25T11:00:00.000Z'),
};

const busCompanyRecord = {
  nhaXeId: 1,
  maNhaXe: 'NX001',
  tenNhaXe: 'Nhà xe ABC',
  thongTinLienHe: '0900000000',
  trangThai: 'HOAT_DONG',
  createdAt: new Date('2026-09-25T10:00:00.000Z'),
  updatedAt: new Date('2026-09-25T11:00:00.000Z'),
};

const prisma = {
  loaiXe: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  nhaXe: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

describe('Vehicle types API integration', () => {
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
    testPrincipal = {
      taiKhoanId: 7,
      sessionId: 'tenant-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 9,
      nhaXeId: 1,
    };
    vi.clearAllMocks();
    prisma.loaiXe.findMany.mockResolvedValue([vehicleTypeRecord]);
    prisma.loaiXe.count.mockResolvedValue(1);
    prisma.loaiXe.findFirst.mockResolvedValue(vehicleTypeRecord);
    prisma.nhaXe.findMany.mockResolvedValue([busCompanyRecord]);
    prisma.nhaXe.count.mockResolvedValue(1);
  });

  it('denies tenant vehicle-type reads to a platform-only account', async () => {
    testPrincipal = { ...testPrincipal, roles: ['SUPER_ADMIN'], nhaXeId: null };

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .expect(403);

    expect(response.body.error).toBe('ROLE_FORBIDDEN');
    expect(prisma.loaiXe.findMany).not.toHaveBeenCalled();
  });

  it('returns mapped types and default pagination from the shared API module', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .expect(200);

    expect(response.body).toEqual({
      data: [
        {
          vehicleTypeId: 1,
          name: 'Limousine',
          description: 'Dòng xe limousine',
          createdAt: '2026-09-25T10:00:00.000Z',
          updatedAt: '2026-09-25T11:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    expect(prisma.loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nhaXeId: 1 },
        orderBy: { tenLoai: 'asc' },
        skip: 0,
        take: 10,
      }),
    );
    expect(prisma.loaiXe.count).toHaveBeenCalledWith({ where: { nhaXeId: 1 } });
  });

  it('trims search and maps supported sort and pagination parameters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .query({
        page: '2',
        pageSize: '5',
        search: '  Limousine  ',
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      })
      .expect(200);

    expect(response.body.meta).toEqual({
      page: 2,
      pageSize: 5,
      totalItems: 1,
      totalPages: 1,
    });
    expect(prisma.loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          nhaXeId: 1,
          OR: [
            { tenLoai: { contains: 'Limousine' } },
            { moTa: { contains: 'Limousine' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        skip: 5,
        take: 5,
      }),
    );
  });

  it('treats whitespace search as an unfiltered list and supports createdAt sorting', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .query({ search: '   ', sortBy: 'createdAt' })
      .expect(200);

    expect(prisma.loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nhaXeId: 1 },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 10,
      }),
    );
  });

  it.each([
    ['sortBy', 'tenLoai'],
    ['sortDirection', 'ascending'],
    ['page', '0'],
    ['pageSize', '101'],
  ])('rejects invalid %s before querying Prisma', async (key, value) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .query({ [key]: value })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(prisma.loaiXe.findMany).not.toHaveBeenCalled();
    expect(prisma.loaiXe.count).not.toHaveBeenCalled();
  });

  it('returns an empty page without converting it to not found', async () => {
    prisma.loaiXe.findMany.mockResolvedValueOnce([]);
    prisma.loaiXe.count.mockResolvedValueOnce(0);

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
  });

  it('returns detail data from the record loaded by id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types/1')
      .expect(200);

    expect(response.body.data).toEqual({
      vehicleTypeId: 1,
      name: 'Limousine',
      description: 'Dòng xe limousine',
      createdAt: '2026-09-25T10:00:00.000Z',
      updatedAt: '2026-09-25T11:00:00.000Z',
    });
    expect(prisma.loaiXe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { loaiXeId: 1, nhaXeId: 1 } }),
    );
  });

  it('returns the vehicle type not found contract for a missing record', async () => {
    prisma.loaiXe.findFirst.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types/999999')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10', '2147483648'])(
    'rejects invalid detail id %s before querying Prisma',
    async (id) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/vehicle-types/${id}`)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(prisma.loaiXe.findFirst).not.toHaveBeenCalled();
    },
  );

  it('keeps the Feature 01 bus companies list contract available', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/bus-companies')
      .expect(200);

    expect(response.body).toMatchObject({
      data: [
        {
          busCompanyId: 1,
          code: 'NX001',
          name: 'Nhà xe ABC',
          status: 'HOAT_DONG',
        },
      ],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
  });
});
