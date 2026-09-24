import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { VehiclesModule } from '../../../src/vehicles/vehicles.module.js';

describe('Vehicles API request-pipeline integration (Prisma mocked)', () => {
  let app: INestApplication;
  const xe = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  };
  const vehicleRecord = {
    xeId: 12,
    bienSoXe: '51B-123.45',
    trangThai: 'HOAT_DONG',
    nhaXeId: 1,
    loaiXeId: 3,
    createdAt: new Date('2026-09-25T10:00:00.000Z'),
    updatedAt: new Date('2026-09-25T11:00:00.000Z'),
    nhaXe: { nhaXeId: 1, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
    loaiXe: {
      loaiXeId: 3,
      tenLoai: 'Limousine',
      moTa: 'Xe giường phòng cao cấp',
    },
  };
  const mappedVehicle = {
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
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [VehiclesModule],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: () => undefined },
        },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ xe })
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
    xe.findMany.mockResolvedValue([vehicleRecord]);
    xe.count.mockResolvedValue(1);
    xe.findUnique.mockResolvedValue(vehicleRecord);
  });

  it('serves the default paginated list contract with the required relations', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .expect(200);

    expect(response.body).toEqual({
      data: [mappedVehicle],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    expect(xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { bienSoXe: 'asc' },
        skip: 0,
        take: 10,
      }),
    );
    expect(xe.findMany).toHaveBeenCalledTimes(1);
    expect(xe.count).toHaveBeenCalledTimes(1);
  });

  it('trims search and sends OR conditions across plate and related names/codes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .query({ search: '  51B  ' })
      .expect(200);

    const where = {
      OR: [
        { bienSoXe: { contains: '51B' } },
        { nhaXe: { maNhaXe: { contains: '51B' } } },
        { nhaXe: { tenNhaXe: { contains: '51B' } } },
        { loaiXe: { tenLoai: { contains: '51B' } } },
      ],
    };
    expect(xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(xe.count).toHaveBeenCalledWith({ where });
  });

  it('omits search conditions for whitespace-only search', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .query({ search: '  \t ' })
      .expect(200);

    expect(xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(xe.count).toHaveBeenCalledWith({ where: {} });
  });

  it('combines status, foreign-key filters, sort and pagination in the API flow', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .query({
        status: 'BAO_TRI',
        busCompanyId: '1',
        vehicleTypeId: '3',
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        page: '2',
        pageSize: '5',
      })
      .expect(200);

    expect(response.body.meta).toEqual({
      page: 2,
      pageSize: 5,
      totalItems: 1,
      totalPages: 1,
    });
    expect(xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trangThai: 'BAO_TRI', nhaXeId: 1, loaiXeId: 3 },
        orderBy: { updatedAt: 'desc' },
        skip: 5,
        take: 5,
      }),
    );
  });

  it('returns an empty page when a valid foreign-key filter has no matches', async () => {
    xe.findMany.mockResolvedValueOnce([]);
    xe.count.mockResolvedValueOnce(0);

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .query({ busCompanyId: '2147483647' })
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
    expect(xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nhaXeId: 2_147_483_647 } }),
    );
    expect(xe.count).toHaveBeenCalledWith({
      where: { nhaXeId: 2_147_483_647 },
    });
    expect(xe.findUnique).not.toHaveBeenCalled();
  });

  it('accepts maximum supported page size and validated sort fields', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .query({ pageSize: '100', sortBy: 'licensePlate', sortDirection: 'asc' })
      .expect(200);

    expect(xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { bienSoXe: 'asc' }, take: 100 }),
    );
  });

  it.each([
    ['sortBy', 'name'],
    ['sortDirection', 'sideways'],
    ['page', '0'],
    ['pageSize', '101'],
    ['status', 'DANG_HOAT_DONG'],
    ['status', 'UNKNOWN'],
    ['unexpected', 'value'],
  ])(
    'rejects invalid list query %s=%s before querying Prisma',
    async (field, value) => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/vehicles')
        .query({ [field]: value })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
      expect(xe.findMany).not.toHaveBeenCalled();
      expect(xe.count).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['busCompanyId', '0'],
    ['busCompanyId', '-1'],
    ['busCompanyId', 'abc'],
    ['busCompanyId', '1e3'],
    ['busCompanyId', '0x10'],
    ['busCompanyId', '+1'],
    ['busCompanyId', '1.0'],
    ['busCompanyId', '2147483648'],
    ['vehicleTypeId', '0'],
    ['vehicleTypeId', '-1'],
    ['vehicleTypeId', 'abc'],
    ['vehicleTypeId', '1e3'],
    ['vehicleTypeId', '0x10'],
    ['vehicleTypeId', '+1'],
    ['vehicleTypeId', '1.0'],
    ['vehicleTypeId', '2147483648'],
  ])(
    'rejects strict-invalid %s=%s before querying Prisma',
    async (field, value) => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/vehicles')
        .query({ [field]: value })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
      expect(xe.findMany).not.toHaveBeenCalled();
      expect(xe.count).not.toHaveBeenCalled();
    },
  );

  it('serves vehicle detail from the API and maps its type description', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles/12')
      .expect(200);

    expect(response.body).toEqual({
      data: {
        ...mappedVehicle,
        vehicleType: {
          vehicleTypeId: 3,
          name: 'Limousine',
          description: 'Xe giường phòng cao cấp',
        },
      },
    });
    expect(xe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { xeId: 12 } }),
    );
    expect(xe.findMany).not.toHaveBeenCalled();
  });

  it('returns the exact vehicle not found response without exposing Prisma details', async () => {
    xe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles/999999')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });
    expect(JSON.stringify(response.body)).not.toContain('Prisma');
    expect(xe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { xeId: 999999 } }),
    );
  });

  it('accepts the maximum supported route id and passes it to Prisma', async () => {
    xe.findUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .get('/api/v1/vehicles/2147483647')
      .expect(404);

    expect(xe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { xeId: 2_147_483_647 } }),
    );
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10', '+1', '1.0', '2147483648'])(
    'rejects strict-invalid detail id %s before querying Prisma',
    async (id) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/vehicles/${id}`)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
      );
      expect(xe.findUnique).not.toHaveBeenCalled();
    },
  );
});
