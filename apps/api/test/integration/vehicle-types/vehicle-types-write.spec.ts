import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { AppModule } from '../../../src/app.module.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const vehicleTypeRecord = {
  loaiXeId: 8,
  tenLoai: 'Limousine 22 phòng',
  moTa: 'Loại xe giường phòng cao cấp',
  createdAt: new Date('2026-09-25T10:00:00.000Z'),
  updatedAt: new Date('2026-09-25T11:00:00.000Z'),
};

const prisma = {
  loaiXe: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  nhaXe: { findMany: vi.fn(), count: vi.fn() },
};

function mariaDbUniqueError(index: string) {
  return new Prisma.PrismaClientKnownRequestError('duplicate vehicle type name', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: {
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { index },
        },
      },
    },
  });
}

describe('Vehicle type write API request-pipeline integration', () => {
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
    prisma.loaiXe.create.mockResolvedValue(vehicleTypeRecord);
    prisma.loaiXe.update.mockResolvedValue(vehicleTypeRecord);
  });

  it('creates a vehicle type, trims fields, and returns the mapped envelope', async () => {
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
        createdAt: '2026-09-25T10:00:00.000Z',
        updatedAt: '2026-09-25T11:00:00.000Z',
      },
    });
    expect(prisma.loaiXe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenLoai: 'Limousine 22 phòng',
          moTa: 'Loại xe giường phòng cao cấp',
        },
      }),
    );
  });

  it.each([
    ['omitted', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace-only', '  \t '],
  ])('normalizes %s description to null during create', async (_label, description) => {
    prisma.loaiXe.create.mockResolvedValueOnce({
      ...vehicleTypeRecord,
      moTa: null,
    });
    const body = { name: 'Limousine 22 phòng', ...(description !== undefined ? { description } : {}) };

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .send(body)
      .expect(201);

    expect(response.body.data.description).toBeNull();
    expect(prisma.loaiXe.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ moTa: null }) }),
    );
  });

  it.each([
    ['missing name', {}, 'name'],
    ['blank name', { name: '  \t ' }, 'name'],
    ['non-string name', { name: 22 }, 'name'],
    ['name longer than 100 characters', { name: 'N'.repeat(101) }, 'name'],
    ['non-string description', { name: 'Xe', description: 22 }, 'description'],
    ['description longer than 500 characters', { name: 'Xe', description: 'D'.repeat(501) }, 'description'],
    ['unknown field', { name: 'Xe', status: 'ACTIVE' }, 'status'],
  ] as const)(
    'rejects create with %s before writing to Prisma',
    async (_label, body, field) => {
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
      expect(prisma.loaiXe.create).not.toHaveBeenCalled();
    },
  );

  it('maps the database unique constraint to the vehicle type name conflict', async () => {
    prisma.loaiXe.create.mockRejectedValueOnce(
      mariaDbUniqueError('LoaiXe_index_0'),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .send({ name: 'Limousine 22 phòng' })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'VEHICLE_TYPE_NAME_EXISTS',
      message: 'Tên loại xe đã tồn tại.',
    });
    expect(response.text).not.toContain('duplicate vehicle type name');
    expect(response.text).not.toContain('LoaiXe_index_0');
  });

  it('updates and trims editable fields while preserving the mapped API contract', async () => {
    prisma.loaiXe.update.mockResolvedValueOnce({
      ...vehicleTypeRecord,
      tenLoai: 'Limousine 24 phòng',
      moTa: 'Phiên bản 24 phòng',
    });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/8')
      .send({ name: '  Limousine 24 phòng ', description: ' Phiên bản 24 phòng ' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      vehicleTypeId: 8,
      name: 'Limousine 24 phòng',
      description: 'Phiên bản 24 phòng',
    });
    expect(prisma.loaiXe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { loaiXeId: 8 },
        data: {
          tenLoai: 'Limousine 24 phòng',
          moTa: 'Phiên bản 24 phòng',
        },
      }),
    );
  });

  it('normalizes omitted and whitespace-only descriptions to null during update', async () => {
    for (const body of [
      { name: 'Limousine 22 phòng' },
      { name: 'Limousine 22 phòng', description: '' },
      { name: 'Limousine 22 phòng', description: '   ' },
    ]) {
      prisma.loaiXe.update.mockResolvedValueOnce({ ...vehicleTypeRecord, moTa: null });
      const response = await request(app.getHttpServer())
        .patch('/api/v1/vehicle-types/8')
        .send(body)
        .expect(200);

      expect(response.body.data.description).toBeNull();
      expect(prisma.loaiXe.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { tenLoai: 'Limousine 22 phòng', moTa: null } }),
      );
    }
  });

  it.each([
    ['missing name', {}, 'name'],
    ['blank name', { name: '  ' }, 'name'],
    ['non-string name', { name: 22 }, 'name'],
    ['name longer than 100 characters', { name: 'N'.repeat(101) }, 'name'],
    ['non-string description', { name: 'Xe', description: [] }, 'description'],
    ['description longer than 500 characters', { name: 'Xe', description: 'D'.repeat(501) }, 'description'],
    ['unknown field', { name: 'Xe', status: 'ACTIVE' }, 'status'],
  ] as const)(
    'rejects update with %s before writing to Prisma',
    async (_label, body, field) => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/vehicle-types/8')
        .send(body)
        .expect(400);

      expect(response.body).toMatchObject({ error: 'VALIDATION_ERROR' });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
      expect(prisma.loaiXe.update).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '-1', 'abc', '1e3', '0x10'])(
    'rejects invalid update id %s before calling Prisma',
    async (id) => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/vehicle-types/${id}`)
        .send({ name: 'Limousine' })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'VALIDATION_ERROR' });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
      );
      expect(prisma.loaiXe.update).not.toHaveBeenCalled();
    },
  );

  it('maps Prisma P2025 to the vehicle type not-found response', async () => {
    prisma.loaiXe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('record not found', {
        code: 'P2025',
        clientVersion: '7.10.0',
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/999')
      .send({ name: 'Limousine' })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
  });

  it('maps a duplicate update name to the vehicle type name conflict', async () => {
    prisma.loaiXe.update.mockRejectedValueOnce(
      mariaDbUniqueError('LoaiXe_index_0'),
    );

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/8')
      .send({ name: 'Limousine khác' })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'VEHICLE_TYPE_NAME_EXISTS',
      message: 'Tên loại xe đã tồn tại.',
    });
  });

  it('allows an edit that keeps the current vehicle type name', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/8')
      .send({ name: 'Limousine 22 phòng', description: 'Mô tả mới' })
      .expect(200);

    expect(prisma.loaiXe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { loaiXeId: 8 },
        data: {
          tenLoai: 'Limousine 22 phòng',
          moTa: 'Mô tả mới',
        },
      }),
    );
  });
});
