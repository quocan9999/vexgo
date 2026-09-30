import { INestApplication, NotFoundException } from '@nestjs/common';
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
import { RoutesModule } from '../../../src/routes/routes.module.js';
import { RoutesService } from '../../../src/routes/routes.service.js';

describe('Routes HTTP request pipeline (mocked service)', () => {
  let app: INestApplication;
  const service = { findAll: vi.fn(), findOne: vi.fn() };
  const route = {
    routeId: 17,
    code: 'FUTA-TX-0001',
    origin: 'TP.HCM',
    destination: 'Đà Lạt',
    status: 'HOAT_DONG',
    busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
    createdAt: '2026-09-22T07:34:00.000Z',
    updatedAt: '2026-09-23T07:34:00.000Z',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RoutesModule],
      providers: [
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    })
      .overrideProvider(RoutesService)
      .useValue(service)
      .overrideProvider(PrismaService)
      .useValue({})
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
    service.findAll.mockResolvedValue({
      data: [route],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    service.findOne.mockResolvedValue({ data: route });
  });

  it('returns the list envelope with parsed default query', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/routes')
      .expect(200);
    expect(response.body).toEqual({
      data: [route],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10, sortBy: 'code' }),
      undefined,
    );
  });

  it('passes pagination, search, filters, and sorting to the service', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/routes')
      .query({
        page: '2',
        pageSize: '5',
        search: 'Đà Lạt',
        status: 'TAM_NGUNG',
        busCompanyId: '3',
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      })
      .expect(200);
    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 5,
        search: 'Đà Lạt',
        status: 'TAM_NGUNG',
        busCompanyId: 3,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      }),
      undefined,
    );
  });

  it.each([
    ['status', 'ACTIVE'],
    ['busCompanyId', '0'],
    ['busCompanyId', '-1'],
    ['busCompanyId', 'abc'],
    ['busCompanyId', '1e3'],
    ['busCompanyId', '0x10'],
    ['busCompanyId', '2147483648'],
    ['sortBy', 'nhaXeId'],
    ['sortDirection', 'up'],
    ['unknown', 'value'],
  ])('rejects invalid %s=%s before service execution', async (field, value) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/routes')
      .query({ [field]: value })
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('returns the detail envelope and numeric ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/routes/17')
      .expect(200);
    expect(response.body).toEqual({ data: route });
    expect(service.findOne).toHaveBeenCalledWith(17, undefined);
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10', '2147483648'])(
    'rejects malformed route ID %s before service execution',
    async (id) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/routes/${id}`)
        .expect(400);
      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(service.findOne).not.toHaveBeenCalled();
    },
  );

  it('returns the route not found contract', async () => {
    service.findOne.mockRejectedValueOnce(
      new NotFoundException({
        error: 'ROUTE_NOT_FOUND',
        message: 'Không tìm thấy tuyến xe.',
      }),
    );
    const response = await request(app.getHttpServer())
      .get('/api/v1/routes/999')
      .expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      error: 'ROUTE_NOT_FOUND',
      message: 'Không tìm thấy tuyến xe.',
    });
  });
});
