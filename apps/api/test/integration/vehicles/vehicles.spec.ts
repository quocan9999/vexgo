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

const vehicleListRecord = {
  xeId: 12,
  bienSoXe: '51B-123.45',
  trangThai: 'HOAT_DONG',
  nhaXe: { nhaXeId: 1, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
  loaiXe: { loaiXeId: 3, tenLoai: 'Limousine' },
  createdAt: new Date('2026-09-25T10:00:00.000Z'),
  updatedAt: new Date('2026-09-25T11:00:00.000Z'),
};

const vehicleDetailRecord = {
  ...vehicleListRecord,
  loaiXe: { ...vehicleListRecord.loaiXe, moTa: 'Xe giường phòng cao cấp' },
};

const prisma = {
  xe: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
};

describe('Vehicles API request-pipeline integration', () => {
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
    prisma.xe.findMany.mockResolvedValue([vehicleListRecord]);
    prisma.xe.count.mockResolvedValue(1);
    prisma.xe.findUnique.mockResolvedValue(vehicleDetailRecord);
  });

  it('returns the English vehicle and relation shape with default pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .expect(200);

    expect(response.body).toEqual({
      data: [
        {
          vehicleId: 12,
          licensePlate: '51B-123.45',
          status: 'HOAT_DONG',
          busCompany: {
            busCompanyId: 1,
            code: 'FUTA',
            name: 'Phương Trang',
          },
          vehicleType: { vehicleTypeId: 3, name: 'Limousine' },
          createdAt: '2026-09-25T10:00:00.000Z',
          updatedAt: '2026-09-25T11:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    expect(prisma.xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { bienSoXe: 'asc' },
        skip: 0,
        take: 10,
      }),
    );
    expect(prisma.xe.count).toHaveBeenCalledWith({ where: {} });
  });

  it('trims search and composes status, ID filters, sort, and pagination', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .query({
        page: '2',
        pageSize: '5',
        search: '  FUTA  ',
        status: 'BAO_TRI',
        busCompanyId: '4',
        vehicleTypeId: '7',
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      })
      .expect(200);

    expect(prisma.xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { bienSoXe: { contains: 'FUTA' } },
            {
              nhaXe: {
                is: {
                  OR: [
                    { maNhaXe: { contains: 'FUTA' } },
                    { tenNhaXe: { contains: 'FUTA' } },
                  ],
                },
              },
            },
            { loaiXe: { is: { tenLoai: { contains: 'FUTA' } } } },
          ],
          trangThai: 'BAO_TRI',
          nhaXeId: 4,
          loaiXeId: 7,
        },
        orderBy: { updatedAt: 'desc' },
        skip: 5,
        take: 5,
      }),
    );
    expect(prisma.xe.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ loaiXeId: 7 }),
      }),
    );
  });

  it('accepts an empty result without turning it into a not-found error', async () => {
    prisma.xe.findMany.mockResolvedValueOnce([]);
    prisma.xe.count.mockResolvedValueOnce(0);

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .query({ busCompanyId: '999999' })
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
  });

  it.each([
    ['status', 'UNKNOWN'],
    ['sortBy', 'busCompany.name'],
    ['sortDirection', 'ascending'],
    ['page', '0'],
    ['pageSize', '101'],
  ])('rejects invalid %s before querying Prisma', async (key, value) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .query({ [key]: value })
      .expect(400);

    expect(response.body).toMatchObject({ error: 'VALIDATION_ERROR' });
    expect(prisma.xe.findMany).not.toHaveBeenCalled();
    expect(prisma.xe.count).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10'])(
    'rejects non-positive or non-decimal busCompanyId %s before Prisma',
    async (value) => {
      await request(app.getHttpServer())
        .get('/api/v1/vehicles')
        .query({ busCompanyId: value })
        .expect(400);

      expect(prisma.xe.findMany).not.toHaveBeenCalled();
      expect(prisma.xe.count).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '-1', 'abc', '1e3', '0x10'])(
    'rejects non-positive or non-decimal vehicleTypeId %s before Prisma',
    async (value) => {
      await request(app.getHttpServer())
        .get('/api/v1/vehicles')
        .query({ vehicleTypeId: value })
        .expect(400);

      expect(prisma.xe.findMany).not.toHaveBeenCalled();
      expect(prisma.xe.count).not.toHaveBeenCalled();
    },
  );

  it('rejects unknown query fields through the global ValidationPipe', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .query({ unknownFilter: 'anything' })
      .expect(400);

    expect(response.body).toMatchObject({ error: 'VALIDATION_ERROR' });
    expect(prisma.xe.findMany).not.toHaveBeenCalled();
  });

  it('returns vehicle detail with relation description from the requested ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles/12')
      .expect(200);

    expect(response.body).toEqual({
      data: {
        vehicleId: 12,
        licensePlate: '51B-123.45',
        status: 'HOAT_DONG',
        busCompany: {
          busCompanyId: 1,
          code: 'FUTA',
          name: 'Phương Trang',
        },
        vehicleType: {
          vehicleTypeId: 3,
          name: 'Limousine',
          description: 'Xe giường phòng cao cấp',
        },
        createdAt: '2026-09-25T10:00:00.000Z',
        updatedAt: '2026-09-25T11:00:00.000Z',
      },
    });
    expect(prisma.xe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { xeId: 12 } }),
    );
  });

  it('returns the exact not-found API contract for missing detail', async () => {
    prisma.xe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles/999999')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10'])(
    'rejects non-decimal vehicle ID %s before Prisma',
    async (id) => {
      await request(app.getHttpServer())
        .get(`/api/v1/vehicles/${id}`)
        .expect(400);

      expect(prisma.xe.findUnique).not.toHaveBeenCalled();
    },
  );
});
