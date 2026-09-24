import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Prisma } from '../../../src/generated/prisma/client.js';
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
    create: vi.fn(),
    update: vi.fn(),
  };
  const nhaXe = { findUnique: vi.fn() };
  const loaiXe = { findUnique: vi.fn() };
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
      .useValue({ xe, nhaXe, loaiXe })
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
    xe.create.mockResolvedValue(vehicleRecord);
    xe.update.mockResolvedValue(vehicleRecord);
    nhaXe.findUnique.mockResolvedValue({ nhaXeId: 1 });
    loaiXe.findUnique.mockResolvedValue({ loaiXeId: 3 });
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

  it('creates a vehicle with trimmed plate and the complete API detail contract', async () => {
    const createdVehicle = { ...vehicleRecord, bienSoXe: '51B-456.78' };
    xe.create.mockResolvedValueOnce(createdVehicle);

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '  51B-456.78  ',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      })
      .expect(201);

    expect(response.body).toEqual({
      data: {
        ...mappedVehicle,
        licensePlate: '51B-456.78',
        vehicleType: {
          vehicleTypeId: 3,
          name: 'Limousine',
          description: 'Xe giường phòng cao cấp',
        },
      },
    });
    expect(nhaXe.findUnique).toHaveBeenCalledWith({
      where: { nhaXeId: 1 },
      select: { nhaXeId: true },
    });
    expect(loaiXe.findUnique).toHaveBeenCalledWith({
      where: { loaiXeId: 3 },
      select: { loaiXeId: true },
    });
    expect(xe.create).toHaveBeenCalledWith({
      data: {
        bienSoXe: '51B-456.78',
        nhaXeId: 1,
        loaiXeId: 3,
        trangThai: 'HOAT_DONG',
      },
      select: expect.any(Object),
    });
  });

  it('accepts the maximum signed 32-bit reference ID', async () => {
    const maxId = 2_147_483_647;
    nhaXe.findUnique.mockResolvedValueOnce({ nhaXeId: maxId });
    loaiXe.findUnique.mockResolvedValueOnce({ loaiXeId: maxId });
    xe.create.mockResolvedValueOnce({
      ...vehicleRecord,
      nhaXeId: maxId,
      loaiXeId: maxId,
      nhaXe: {
        nhaXeId: maxId,
        maNhaXe: 'MAX',
        tenNhaXe: 'Nhà xe biên giới',
      },
      loaiXe: {
        loaiXeId: maxId,
        tenLoai: 'Loại xe biên giới',
        moTa: null,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '51B-456.78',
        busCompanyId: maxId,
        vehicleTypeId: maxId,
        status: 'HOAT_DONG',
      })
      .expect(201);

    expect(response.body.data.busCompany.busCompanyId).toBe(maxId);
    expect(response.body.data.vehicleType.vehicleTypeId).toBe(maxId);
    expect(xe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bienSoXe: '51B-456.78',
          nhaXeId: maxId,
          loaiXeId: maxId,
          trangThai: 'HOAT_DONG',
        },
      }),
    );
  });

  it.each([
    ['missing', { busCompanyId: 1, vehicleTypeId: 3, status: 'HOAT_DONG' }],
    [
      'blank after trimming',
      {
        licensePlate: '  \t ',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      },
    ],
    [
      'over 15 characters',
      {
        licensePlate: '1234567890123456',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      },
    ],
    [
      'non-string',
      {
        licensePlate: 12345,
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      },
    ],
  ])(
    'rejects %s licensePlate before reference lookups',
    async (_name, body) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/vehicles')
        .send(body)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'licensePlate' }),
        ]),
      );
      expect(nhaXe.findUnique).not.toHaveBeenCalled();
      expect(loaiXe.findUnique).not.toHaveBeenCalled();
      expect(xe.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['busCompanyId', 0],
    ['busCompanyId', -1],
    ['busCompanyId', null],
    ['busCompanyId', 1.5],
    ['busCompanyId', 'abc'],
    ['busCompanyId', '1e3'],
    ['busCompanyId', '0x10'],
    ['busCompanyId', '+1'],
    ['busCompanyId', '1.0'],
    ['busCompanyId', '2147483648'],
    ['vehicleTypeId', 0],
    ['vehicleTypeId', -1],
    ['vehicleTypeId', null],
    ['vehicleTypeId', 1.5],
    ['vehicleTypeId', 'abc'],
    ['vehicleTypeId', '1e3'],
    ['vehicleTypeId', '0x10'],
    ['vehicleTypeId', '+1'],
    ['vehicleTypeId', '1.0'],
    ['vehicleTypeId', '2147483648'],
  ])(
    'rejects invalid create reference %s=%s before Prisma',
    async (field, value) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/vehicles')
        .send({
          licensePlate: '51B-456.78',
          busCompanyId: field === 'busCompanyId' ? value : 1,
          vehicleTypeId: field === 'vehicleTypeId' ? value : 3,
          status: 'HOAT_DONG',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
      expect(nhaXe.findUnique).not.toHaveBeenCalled();
      expect(loaiXe.findUnique).not.toHaveBeenCalled();
      expect(xe.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'missing status',
      { licensePlate: '51B-456.78', busCompanyId: 1, vehicleTypeId: 3 },
    ],
    [
      'invalid status',
      {
        licensePlate: '51B-456.78',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'DANG_HOAT_DONG',
      },
    ],
    [
      'unknown field',
      {
        licensePlate: '51B-456.78',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
        unexpected: true,
      },
    ],
  ])('rejects create with %s before Prisma', async (_name, body) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send(body)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(nhaXe.findUnique).not.toHaveBeenCalled();
    expect(loaiXe.findUnique).not.toHaveBeenCalled();
    expect(xe.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      'busCompanyId',
      { licensePlate: '51B-456.78', vehicleTypeId: 3, status: 'HOAT_DONG' },
    ],
    [
      'vehicleTypeId',
      { licensePlate: '51B-456.78', busCompanyId: 1, status: 'HOAT_DONG' },
    ],
  ])('requires %s when creating a vehicle', async (field, body) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send(body)
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    expect(nhaXe.findUnique).not.toHaveBeenCalled();
    expect(loaiXe.findUnique).not.toHaveBeenCalled();
    expect(xe.create).not.toHaveBeenCalled();
  });

  it('returns BUS_COMPANY_NOT_FOUND when the create reference is missing', async () => {
    nhaXe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '51B-456.78',
        busCompanyId: 9,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'BUS_COMPANY_NOT_FOUND',
      message: 'Không tìm thấy nhà xe.',
    });
    expect(xe.create).not.toHaveBeenCalled();
  });

  it('returns VEHICLE_TYPE_NOT_FOUND when the create reference is missing', async () => {
    loaiXe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '51B-456.78',
        busCompanyId: 1,
        vehicleTypeId: 9,
        status: 'HOAT_DONG',
      })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
    expect(xe.create).not.toHaveBeenCalled();
  });

  it('maps the actual MariaDB Xe.bienSoXe P2002 metadata to the duplicate-plate 409', async () => {
    xe.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate plate', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            name: 'DriverAdapterError',
            cause: {
              originalCode: '1062',
              originalMessage: "Duplicate entry for key 'Xe.Xe_bienSoXe_key'",
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'Xe_bienSoXe_key' },
              table: 'Xe',
            },
          },
          modelName: 'Xe',
        },
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'VEHICLE_LICENSE_PLATE_EXISTS',
      message: 'Biển số xe đã tồn tại.',
    });
    expect(response.text).not.toContain('Unique constraint failed');
    expect(response.text).not.toContain('Xe_bienSoXe_key');
  });

  it('does not map an unrelated P2002 from create to a duplicate-plate conflict', async () => {
    xe.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unrelated unique constraint', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: { modelName: 'Xe', target: ['otherField'] },
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '51B-456.78',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      })
      .expect(500);

    expect(response.body).toMatchObject({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
    });
    expect(response.text).not.toContain('unrelated unique constraint');
    expect(response.text).not.toContain('PrismaClientKnownRequestError');
  });

  it('edits a vehicle with full fields, trims its plate, and preserves the status', async () => {
    const updatedVehicle = {
      ...vehicleRecord,
      bienSoXe: '51B-999.99',
      nhaXe: { nhaXeId: 1, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
      loaiXe: {
        loaiXeId: 3,
        tenLoai: 'Limousine',
        moTa: 'Xe giường phòng cao cấp',
      },
    };
    xe.update.mockResolvedValueOnce(updatedVehicle);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: '  51B-999.99  ',
        busCompanyId: 1,
        vehicleTypeId: 3,
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      vehicleId: 12,
      licensePlate: '51B-999.99',
      status: 'HOAT_DONG',
      busCompany: { busCompanyId: 1, code: 'FUTA', name: 'Phương Trang' },
      vehicleType: {
        vehicleTypeId: 3,
        name: 'Limousine',
        description: 'Xe giường phòng cao cấp',
      },
    });
    expect(xe.update).toHaveBeenCalledWith({
      where: { xeId: 12 },
      data: {
        bienSoXe: '51B-999.99',
        nhaXeId: 1,
        loaiXeId: 3,
      },
      select: expect.any(Object),
    });
    expect(xe.update.mock.calls[0][0].data).not.toHaveProperty('trangThai');
  });

  it('allows editing with the existing license plate', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 1,
        vehicleTypeId: 3,
      })
      .expect(200);

    expect(response.body.data.licensePlate).toBe('51B-123.45');
    expect(xe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { xeId: 12 },
        data: {
          bienSoXe: '51B-123.45',
          nhaXeId: 1,
          loaiXeId: 3,
        },
      }),
    );
  });

  it('requires all editable fields and rejects status in the edit DTO', async () => {
    for (const [field, body] of [
      ['licensePlate', { busCompanyId: 1, vehicleTypeId: 3 }],
      ['busCompanyId', { licensePlate: '51B-999.99', vehicleTypeId: 3 }],
      ['vehicleTypeId', { licensePlate: '51B-999.99', busCompanyId: 1 }],
    ] as const) {
      const missingFieldResponse = await request(app.getHttpServer())
        .patch('/api/v1/vehicles/12')
        .send(body)
        .expect(400);
      expect(missingFieldResponse.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
    }

    const statusResponse = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: '51B-999.99',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'BAO_TRI',
      })
      .expect(400);
    expect(statusResponse.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'status' })]),
    );
    expect(xe.findUnique).not.toHaveBeenCalled();
    expect(xe.update).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10', '+1', '1.0', '2147483648'])(
    'rejects edit ID %s before Prisma',
    async (id) => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/vehicles/${id}`)
        .send({
          licensePlate: '51B-999.99',
          busCompanyId: 1,
          vehicleTypeId: 3,
        })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
      );
      expect(xe.findUnique).not.toHaveBeenCalled();
      expect(xe.update).not.toHaveBeenCalled();
    },
  );

  it('returns VEHICLE_NOT_FOUND before checking edit references', async () => {
    xe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/999999')
      .send({
        licensePlate: '51B-999.99',
        busCompanyId: 1,
        vehicleTypeId: 3,
      })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });
    expect(nhaXe.findUnique).not.toHaveBeenCalled();
    expect(loaiXe.findUnique).not.toHaveBeenCalled();
    expect(xe.update).not.toHaveBeenCalled();
  });

  it('returns 404 when edit references a missing bus company', async () => {
    nhaXe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: '51B-999.99',
        busCompanyId: 9,
        vehicleTypeId: 3,
      })
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'BUS_COMPANY_NOT_FOUND',
      message: 'Không tìm thấy nhà xe.',
    });
    expect(xe.update).not.toHaveBeenCalled();
  });

  it('returns 404 when edit references a missing vehicle type', async () => {
    loaiXe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: '51B-999.99',
        busCompanyId: 1,
        vehicleTypeId: 9,
      })
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
    expect(xe.update).not.toHaveBeenCalled();
  });

  it('maps duplicate plate during edit to the exact 409 contract', async () => {
    xe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate plate', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'Xe_bienSoXe_key' },
            },
          },
          modelName: 'Xe',
        },
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: '51B-999.99',
        busCompanyId: 1,
        vehicleTypeId: 3,
      })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'VEHICLE_LICENSE_PLATE_EXISTS',
      message: 'Biển số xe đã tồn tại.',
    });
  });

  it.each([
    ['HOAT_DONG', 'BAO_TRI'],
    ['BAO_TRI', 'HOAT_DONG'],
    ['HOAT_DONG', 'HOAT_DONG'],
  ] as const)(
    'updates target vehicle status from %s to %s and changes only status',
    async (_currentStatus, status) => {
      xe.update.mockResolvedValueOnce({ ...vehicleRecord, trangThai: status });

      const response = await request(app.getHttpServer())
        .patch('/api/v1/vehicles/12/status')
        .send({ status })
        .expect(200);

      expect(response.body.data.status).toBe(status);
      expect(xe.update).toHaveBeenCalledWith({
        where: { xeId: 12 },
        data: { trangThai: status },
        select: expect.any(Object),
      });
      expect(xe.update.mock.calls[0][0].data).toEqual({ trangThai: status });
    },
  );

  it.each([
    ['missing', {}],
    ['invalid', { status: 'DANG_HOAT_DONG' }],
    ['unknown field', { status: 'BAO_TRI', unexpected: true }],
  ])('rejects %s status update before Prisma', async (_name, body) => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/status')
      .send(body)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(xe.update).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10', '+1', '1.0', '2147483648'])(
    'rejects status update ID %s before Prisma',
    async (id) => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/vehicles/${id}/status`)
        .send({ status: 'BAO_TRI' })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
      );
      expect(xe.update).not.toHaveBeenCalled();
    },
  );

  it('maps a missing row during status update to VEHICLE_NOT_FOUND', async () => {
    xe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('record not found', {
        code: 'P2025',
        clientVersion: '7.10.0',
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/999999/status')
      .send({ status: 'BAO_TRI' })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });
  });
});
