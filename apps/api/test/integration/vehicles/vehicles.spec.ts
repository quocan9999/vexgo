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
import { Prisma } from '../../../src/generated/prisma/client.js';
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
    create: vi.fn(),
    update: vi.fn(),
  },
  nhaXe: { findUnique: vi.fn() },
  loaiXe: { findUnique: vi.fn() },
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
    vi.resetAllMocks();
    prisma.xe.findMany.mockResolvedValue([vehicleListRecord]);
    prisma.xe.count.mockResolvedValue(1);
    prisma.xe.findUnique.mockResolvedValue(vehicleDetailRecord);
    prisma.xe.create.mockResolvedValue(vehicleDetailRecord);
    prisma.xe.update.mockResolvedValue(vehicleDetailRecord);
    prisma.nhaXe.findUnique.mockResolvedValue({ nhaXeId: 1 });
    prisma.loaiXe.findUnique.mockResolvedValue({ loaiXeId: 3 });
  });

  function prismaKnownError(code: string, meta: Record<string, unknown> = {}) {
    return new Prisma.PrismaClientKnownRequestError('Prisma request failed', {
      code,
      clientVersion: 'test',
      meta,
    });
  }

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

  it('creates a vehicle, trims the plate, and returns its mapped relations', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: ' 51B-123.45 ',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      data: {
        vehicleId: 12,
        licensePlate: '51B-123.45',
        status: 'HOAT_DONG',
        busCompany: { busCompanyId: 1, code: 'FUTA', name: 'Phương Trang' },
        vehicleType: {
          vehicleTypeId: 3,
          name: 'Limousine',
          description: 'Xe giường phòng cao cấp',
        },
      },
    });
    expect(prisma.xe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bienSoXe: '51B-123.45',
          nhaXeId: 1,
          loaiXeId: 3,
          trangThai: 'HOAT_DONG',
        },
        select: expect.objectContaining({
          nhaXe: expect.any(Object),
          loaiXe: expect.any(Object),
        }),
      }),
    );
  });

  it.each([
    {
      name: 'missing',
      input: { busCompanyId: 1, vehicleTypeId: 3, status: 'HOAT_DONG' },
    },
    {
      name: 'blank',
      input: {
        licensePlate: '   ',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      },
    },
    {
      name: 'too long',
      input: {
        licensePlate: '1234567890123456',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      },
    },
    {
      name: 'non-string',
      input: {
        licensePlate: 123,
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      },
    },
  ])('rejects a $name licensePlate before Prisma', async ({ input }) => {
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send(input)
      .expect(400);

    expect(prisma.xe.create).not.toHaveBeenCalled();
  });

  it.each([
    ['busCompanyId', '0'],
    ['busCompanyId', '-1'],
    ['busCompanyId', 'abc'],
    ['busCompanyId', '1e3'],
    ['busCompanyId', '0x10'],
    ['vehicleTypeId', '0'],
    ['vehicleTypeId', '-1'],
    ['vehicleTypeId', 'abc'],
    ['vehicleTypeId', '1e3'],
    ['vehicleTypeId', '0x10'],
  ])('rejects invalid create %s value %s', async (field, value) => {
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: field === 'busCompanyId' ? value : 1,
        vehicleTypeId: field === 'vehicleTypeId' ? value : 3,
        status: 'HOAT_DONG',
      })
      .expect(400);

    expect(prisma.xe.create).not.toHaveBeenCalled();
  });

  it('rejects invalid create status and unknown fields before Prisma', async () => {
    const invalidStatus = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'UNKNOWN',
      })
      .expect(400);

    expect(invalidStatus.body.error).toBe('VALIDATION_ERROR');

    const unknownField = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
        unknown: true,
      })
      .expect(400);

    expect(unknownField.body.error).toBe('VALIDATION_ERROR');
    expect(prisma.xe.create).not.toHaveBeenCalled();
  });

  it('returns the exact missing bus company contract during create', async () => {
    prisma.nhaXe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 99,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'BUS_COMPANY_NOT_FOUND',
      message: 'Không tìm thấy nhà xe.',
    });
    expect(prisma.xe.create).not.toHaveBeenCalled();
  });

  it('returns the exact missing vehicle type contract during create', async () => {
    prisma.loaiXe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 1,
        vehicleTypeId: 99,
        status: 'HOAT_DONG',
      })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
    expect(prisma.xe.create).not.toHaveBeenCalled();
  });

  it('returns the exact 409 contract for a duplicate plate during create', async () => {
    prisma.xe.create.mockRejectedValueOnce(
      prismaKnownError('P2002', { target: ['bienSoXe'] }),
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
  });

  it('updates the full editable field set and excludes status', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: ' 51B-999.99 ',
        busCompanyId: 4,
        vehicleTypeId: 7,
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      vehicleId: 12,
      licensePlate: '51B-123.45',
      busCompany: { busCompanyId: 1 },
      vehicleType: { vehicleTypeId: 3, description: 'Xe giường phòng cao cấp' },
    });
    expect(prisma.xe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { xeId: 12 },
        data: {
          bienSoXe: '51B-999.99',
          nhaXeId: 4,
          loaiXeId: 7,
        },
      }),
    );
    expect(prisma.xe.update.mock.calls[0][0].data).not.toHaveProperty(
      'trangThai',
    );
  });

  it.each([
    ['licensePlate', { busCompanyId: 1, vehicleTypeId: 3 }],
    ['busCompanyId', { licensePlate: '51B-123.45', vehicleTypeId: 3 }],
    ['vehicleTypeId', { licensePlate: '51B-123.45', busCompanyId: 1 }],
  ])('requires %s for full-field edit', async (_field, fields) => {
    await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send(fields)
      .expect(400);

    expect(prisma.xe.update).not.toHaveBeenCalled();
  });

  it('rejects status and other unknown properties on the edit endpoint', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'BAO_TRI',
      })
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(prisma.xe.update).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10'])(
    'rejects non-decimal edit vehicle ID %s before Prisma',
    async (id) => {
      await request(app.getHttpServer())
        .patch(`/api/v1/vehicles/${id}`)
        .send({
          licensePlate: '51B-123.45',
          busCompanyId: 1,
          vehicleTypeId: 3,
        })
        .expect(400);

      expect(prisma.xe.findUnique).not.toHaveBeenCalled();
      expect(prisma.xe.update).not.toHaveBeenCalled();
    },
  );

  it('returns the exact missing vehicle contract during edit', async () => {
    prisma.xe.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/999')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 1,
        vehicleTypeId: 3,
      })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });
    expect(prisma.nhaXe.findUnique).not.toHaveBeenCalled();
    expect(prisma.xe.update).not.toHaveBeenCalled();
  });

  it('returns the exact missing reference contracts during edit', async () => {
    prisma.nhaXe.findUnique.mockResolvedValueOnce(null);
    const missingCompany = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 99,
        vehicleTypeId: 3,
      })
      .expect(404);

    expect(missingCompany.body.error).toBe('BUS_COMPANY_NOT_FOUND');

    prisma.nhaXe.findUnique.mockResolvedValueOnce({ nhaXeId: 1 });
    prisma.loaiXe.findUnique.mockResolvedValueOnce(null);
    const missingType = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 1,
        vehicleTypeId: 99,
      })
      .expect(404);

    expect(missingType.body.error).toBe('VEHICLE_TYPE_NOT_FOUND');
    expect(prisma.xe.update).not.toHaveBeenCalled();
  });

  it('allows keeping the current plate on edit', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12')
      .send({
        licensePlate: '51B-123.45',
        busCompanyId: 1,
        vehicleTypeId: 3,
      })
      .expect(200);

    expect(prisma.xe.update.mock.calls[0][0].data).toEqual({
      bienSoXe: '51B-123.45',
      nhaXeId: 1,
      loaiXeId: 3,
    });
  });

  it('returns the exact 409 contract for a duplicate plate during edit', async () => {
    prisma.xe.update.mockRejectedValueOnce(
      prismaKnownError('P2002', { target: 'Xe_bienSoXe_key' }),
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

  it.each(['BAO_TRI', 'HOAT_DONG', 'HOAT_DONG'] as const)(
    'accepts explicit target status %s and updates only trangThai',
    async (status) => {
      prisma.xe.update.mockResolvedValueOnce({
        ...vehicleDetailRecord,
        trangThai: status,
      });

      const response = await request(app.getHttpServer())
        .patch('/api/v1/vehicles/12/status')
        .send({ status })
        .expect(200);

      expect(response.body.data.status).toBe(status);
      expect(prisma.xe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { xeId: 12 },
          data: { trangThai: status },
        }),
      );
      expect(prisma.xe.update.mock.calls[0][0].data).toEqual({
        trangThai: status,
      });
    },
  );

  it('rejects invalid status, missing status, and unknown status fields', async () => {
    const invalid = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/status')
      .send({ status: 'UNKNOWN' })
      .expect(400);
    expect(invalid.body.error).toBe('VALIDATION_ERROR');

    const missing = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/status')
      .send({})
      .expect(400);
    expect(missing.body.error).toBe('VALIDATION_ERROR');

    const unknown = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/status')
      .send({ status: 'BAO_TRI', toggle: true })
      .expect(400);
    expect(unknown.body.error).toBe('VALIDATION_ERROR');
    expect(prisma.xe.update).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10'])(
    'rejects non-decimal status vehicle ID %s before Prisma',
    async (id) => {
      await request(app.getHttpServer())
        .patch(`/api/v1/vehicles/${id}/status`)
        .send({ status: 'BAO_TRI' })
        .expect(400);

      expect(prisma.xe.update).not.toHaveBeenCalled();
    },
  );

  it('returns the exact missing vehicle contract when status update matches no row', async () => {
    prisma.xe.update.mockRejectedValueOnce(prismaKnownError('P2025'));

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/999/status')
      .send({ status: 'BAO_TRI' })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });
  });
});
