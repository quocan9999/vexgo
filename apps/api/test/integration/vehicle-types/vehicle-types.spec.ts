import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { VehicleTypesModule } from '../../../src/vehicle-types/vehicle-types.module.js';

describe('Vehicle types API integration', () => {
  let app: INestApplication;
  const loaiXe = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  };
  const vehicleTypeRecord = {
    loaiXeId: 7,
    tenLoai: 'Limousine',
    moTa: 'Xe cao cấp',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-02-03T04:05:06.000Z'),
  };
  const mappedVehicleType = {
    vehicleTypeId: 7,
    name: 'Limousine',
    description: 'Xe cao cấp',
    createdAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-02-03T04:05:06.000Z',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [VehicleTypesModule],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: () => undefined },
        },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ loaiXe })
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
    loaiXe.findMany.mockResolvedValue([vehicleTypeRecord]);
    loaiXe.count.mockResolvedValue(1);
    loaiXe.findUnique.mockResolvedValue(vehicleTypeRecord);
  });

  it('serves the default paginated list contract using real request validation and mapping', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .expect(200);

    expect(response.body).toEqual({
      data: [mappedVehicleType],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    expect(loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { tenLoai: 'asc' },
        skip: 0,
        take: 10,
      }),
    );
  });

  it('trims search in the real API request pipeline and searches name and description', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .query({ search: '  Limousine  ' })
      .expect(200);

    expect(loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { tenLoai: { contains: 'Limousine' } },
            { moTa: { contains: 'Limousine' } },
          ],
        },
      }),
    );
  });

  it('uses backend pagination and maps an allowed sort in the HTTP flow', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .query({
        page: '2',
        pageSize: '5',
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
    expect(loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updatedAt: 'desc' },
        skip: 5,
        take: 5,
      }),
    );
  });

  it.each([
    ['sortBy', 'rawField'],
    ['sortDirection', 'sideways'],
  ])('rejects invalid %s before querying Prisma', async (field, value) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .query({ [field]: value })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    expect(loaiXe.findMany).not.toHaveBeenCalled();
    expect(loaiXe.count).not.toHaveBeenCalled();
  });

  it.each([
    ['page', '0'],
    ['page', '-1'],
    ['pageSize', '0'],
    ['pageSize', '101'],
  ])('rejects invalid %s=%s before querying Prisma', async (field, value) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .query({ [field]: value })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    expect(loaiXe.findMany).not.toHaveBeenCalled();
    expect(loaiXe.count).not.toHaveBeenCalled();
  });

  it('returns an empty list with zero pages instead of a not found error', async () => {
    loaiXe.findMany.mockResolvedValueOnce([]);
    loaiXe.count.mockResolvedValueOnce(0);

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
  });

  it('returns detail by id through Prisma and the English response mapper', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types/7')
      .expect(200);

    expect(response.body).toEqual({ data: mappedVehicleType });
    expect(loaiXe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { loaiXeId: 7 } }),
    );
  });

  it('returns the vehicle type not found contract for a missing record', async () => {
    loaiXe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types/999999')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10'])(
    'rejects strict-invalid detail id %s before querying Prisma',
    async (id) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/vehicle-types/${id}`)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
      );
      expect(loaiXe.findUnique).not.toHaveBeenCalled();
    },
  );
});
