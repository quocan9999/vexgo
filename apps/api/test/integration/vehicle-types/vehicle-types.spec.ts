import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { VehicleTypesModule } from '../../../src/vehicle-types/vehicle-types.module.js';

describe('Vehicle types API request-pipeline integration (Prisma mocked)', () => {
  let app: INestApplication;
  const loaiXe = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
  const createdVehicleTypeRecord = {
    ...vehicleTypeRecord,
    loaiXeId: 8,
    tenLoai: 'Limousine 22 phòng',
    moTa: 'Loại xe giường phòng cao cấp',
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
    loaiXe.create.mockResolvedValue(createdVehicleTypeRecord);
    loaiXe.update.mockResolvedValue(vehicleTypeRecord);
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

  it('creates a vehicle type through the validated HTTP pipeline and returns the mapped record', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .send({
        name: '  Limousine 22 phòng  ',
        description: '  Loại xe giường phòng cao cấp  ',
      })
      .expect(201);

    expect(response.body).toEqual({
      data: {
        vehicleTypeId: 8,
        name: 'Limousine 22 phòng',
        description: 'Loại xe giường phòng cao cấp',
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-02-03T04:05:06.000Z',
      },
    });
    expect(loaiXe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenLoai: 'Limousine 22 phòng',
          moTa: 'Loại xe giường phòng cao cấp',
        },
      }),
    );
  });

  it.each([
    ['omitted description', { name: 'Loại xe mới' }],
    ['null description', { name: 'Loại xe mới', description: null }],
    ['whitespace-only description', { name: 'Loại xe mới', description: '  \t ' }],
  ])('normalizes %s to null during create', async (_caseName, body) => {
    loaiXe.create.mockResolvedValueOnce({
      ...createdVehicleTypeRecord,
      tenLoai: 'Loại xe mới',
      moTa: null,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .send(body)
      .expect(201);

    expect(response.body.data).toMatchObject({
      name: 'Loại xe mới',
      description: null,
    });
    expect(loaiXe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { tenLoai: 'Loại xe mới', moTa: null },
      }),
    );
  });

  it('accepts name and description at their database length limits', async () => {
    const name = 'N'.repeat(100);
    const description = 'D'.repeat(500);
    loaiXe.create.mockResolvedValueOnce({
      ...createdVehicleTypeRecord,
      tenLoai: name,
      moTa: description,
    });

    await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .send({ name, description })
      .expect(201);

    expect(loaiXe.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tenLoai: name, moTa: description } }),
    );
  });

  it('accepts trimmed name and description at their length limits', async () => {
    const name = 'N'.repeat(100);
    const description = 'D'.repeat(500);
    loaiXe.create.mockResolvedValueOnce({
      ...createdVehicleTypeRecord,
      tenLoai: name,
      moTa: description,
    });

    await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .send({ name: ` ${name} `, description: ` ${description} ` })
      .expect(201);

    expect(loaiXe.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tenLoai: name, moTa: description } }),
    );
  });

  it.each([
    ['missing name', {}, 'name'],
    ['blank name', { name: '  \t ' }, 'name'],
    ['non-string name', { name: 42 }, 'name'],
    ['name over 100 characters', { name: 'N'.repeat(101) }, 'name'],
    ['non-string description', { name: 'Valid', description: 42 }, 'description'],
    [
      'description over 500 characters',
      { name: 'Valid', description: 'D'.repeat(501) },
      'description',
    ],
  ])('rejects create with %s before Prisma write', async (_caseName, body, field) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .send(body)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    expect(loaiXe.create).not.toHaveBeenCalled();
  });

  it('rejects unknown create fields before Prisma write', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .send({ name: 'Limousine', status: 'ACTIVE' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'status' })]),
    );
    expect(loaiXe.create).not.toHaveBeenCalled();
  });

  it('returns only the duplicate-name conflict contract when the same name is created twice', async () => {
    loaiXe.create
      .mockResolvedValueOnce({ ...createdVehicleTypeRecord, tenLoai: 'TEST' })
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the index: `LoaiXe_index_0`',
          {
            code: 'P2002',
            clientVersion: '7.10.0',
            meta: {
              driverAdapterError: {
                cause: {
                  kind: 'UniqueConstraintViolation',
                  constraint: { index: 'LoaiXe_index_0' },
                },
              },
            },
          },
        ),
      );

    const body = { name: 'TEST' };
    await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .send(body)
      .expect(201);
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .send(body)
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'VEHICLE_TYPE_NAME_EXISTS',
      message: 'Tên loại xe đã tồn tại.',
    });
    expect(response.text).not.toContain('Unique constraint failed');
    expect(response.text).not.toContain('LoaiXe_index_0');
    expect(loaiXe.create).toHaveBeenCalledTimes(2);
  });

  it('updates editable fields through the validated HTTP pipeline and returns the backend record', async () => {
    loaiXe.update.mockResolvedValueOnce({
      ...vehicleTypeRecord,
      tenLoai: 'Limousine 24 phòng',
      moTa: null,
    });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/7')
      .send({ name: '  Limousine 24 phòng  ', description: '  ' })
      .expect(200);

    expect(response.body).toEqual({
      data: {
        vehicleTypeId: 7,
        name: 'Limousine 24 phòng',
        description: null,
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-02-03T04:05:06.000Z',
      },
    });
    expect(loaiXe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { loaiXeId: 7 },
        data: { tenLoai: 'Limousine 24 phòng', moTa: null },
      }),
    );
  });

  it('allows an edit that keeps the current name unchanged', async () => {
    loaiXe.update.mockResolvedValueOnce({ ...vehicleTypeRecord, moTa: null });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/7')
      .send({ name: 'Limousine' })
      .expect(200);

    expect(response.body.data.name).toBe('Limousine');
    expect(response.body.data.description).toBeNull();
    expect(loaiXe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { loaiXeId: 7 },
        data: { tenLoai: 'Limousine', moTa: null },
      }),
    );
  });

  it.each([
    ['missing name', {}, 'name'],
    ['blank name', { name: '  ' }, 'name'],
    ['non-string name', { name: 42 }, 'name'],
    ['name over 100 characters', { name: 'N'.repeat(101) }, 'name'],
    ['non-string description', { name: 'Valid', description: 42 }, 'description'],
    [
      'description over 500 characters',
      { name: 'Valid', description: 'D'.repeat(501) },
      'description',
    ],
  ])('rejects edit with %s before Prisma write', async (_caseName, body, field) => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/7')
      .send(body)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    expect(loaiXe.update).not.toHaveBeenCalled();
  });

  it('rejects unknown edit fields before Prisma write', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/7')
      .send({ name: 'Limousine', status: 'ACTIVE' })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'status' })]),
    );
    expect(loaiXe.update).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10'])(
    'rejects strict-invalid edit id %s before Prisma write',
    async (id) => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/vehicle-types/${id}`)
        .send({ name: 'Limousine' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
      );
      expect(loaiXe.update).not.toHaveBeenCalled();
    },
  );

  it('returns the vehicle type not found contract when update target is missing', async () => {
    loaiXe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record to update not found', {
        code: 'P2025',
        clientVersion: '7.10.0',
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/999999')
      .send({ name: 'Limousine' })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
    expect(response.text).not.toContain('Record to update not found');
  });

  it('returns the duplicate-name contract when edit conflicts with another type', async () => {
    loaiXe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the index: `LoaiXe_index_0`',
        {
          code: 'P2002',
          clientVersion: '7.10.0',
          meta: {
            driverAdapterError: {
              cause: {
                kind: 'UniqueConstraintViolation',
                constraint: { index: 'LoaiXe_index_0' },
              },
            },
          },
        },
      ),
    );

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/7')
      .send({ name: 'Giường nằm' })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'VEHICLE_TYPE_NAME_EXISTS',
      message: 'Tên loại xe đã tồn tại.',
    });
    expect(response.text).not.toContain('Unique constraint failed');
  });
});
