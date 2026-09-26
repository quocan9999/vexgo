import type { INestApplication } from '@nestjs/common';
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
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

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
    prisma.loaiXe.findMany.mockResolvedValue([vehicleTypeRecord]);
    prisma.loaiXe.count.mockResolvedValue(1);
    prisma.loaiXe.findUnique.mockResolvedValue(vehicleTypeRecord);
    prisma.nhaXe.findMany.mockResolvedValue([busCompanyRecord]);
    prisma.nhaXe.count.mockResolvedValue(1);
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
        where: {},
        orderBy: { tenLoai: 'asc' },
        skip: 0,
        take: 10,
      }),
    );
    expect(prisma.loaiXe.count).toHaveBeenCalledWith({ where: {} });
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
        where: {},
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
    expect(prisma.loaiXe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { loaiXeId: 1 } }),
    );
  });

  it('returns the vehicle type not found contract for a missing record', async () => {
    prisma.loaiXe.findUnique.mockResolvedValueOnce(null);

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
      expect(prisma.loaiXe.findUnique).not.toHaveBeenCalled();
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
