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
import { BusCompaniesModule } from '../../../src/bus-companies/bus-companies.module.js';
import { BusCompaniesService } from '../../../src/bus-companies/bus-companies.service.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('GET /api/v1/bus-companies', () => {
  let app: INestApplication;
  const responseData = {
    data: [
      {
        busCompanyId: 1,
        code: 'NX001',
        name: 'Nhà xe ABC',
        contactInfo: '0900000000',
        status: 'HOAT_DONG',
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-02-03T04:05:06.000Z',
      },
    ],
    meta: { page: 2, pageSize: 5, totalItems: 11, totalPages: 3 },
  };
  const detailResponse = {
    data: {
      busCompanyId: 1,
      code: 'NX001',
      name: 'Nhà xe ABC',
      contactInfo: '0900000000',
      status: 'HOAT_DONG',
      createdAt: '2026-01-02T03:04:05.000Z',
      updatedAt: '2026-02-03T04:05:06.000Z',
    },
  };
  const service = { findAll: vi.fn(), findOne: vi.fn() };

  beforeAll(async () => {
    service.findAll.mockResolvedValue(responseData);
    service.findOne.mockResolvedValue(detailResponse);
    const moduleRef = await Test.createTestingModule({
      imports: [BusCompaniesModule],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: () => undefined },
        },
      ],
    })
      .overrideProvider(BusCompaniesService)
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
    service.findAll.mockResolvedValue(responseData);
    service.findOne.mockResolvedValue(detailResponse);
  });

  it('returns a detail data envelope for the requested bus company id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/bus-companies/1')
      .expect(200);

    expect(response.body).toEqual(detailResponse);
    expect(service.findOne).toHaveBeenCalledWith(1);
  });

  it.each(['abc', '0', '-1', '2147483648', '1e3', '0x10'])(
    'rejects invalid detail id %s before calling the service',
    async (id) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/bus-companies/${id}`)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
      );
      expect(service.findOne).not.toHaveBeenCalled();
    },
  );

  it('returns the not found error contract when detail service has no record', async () => {
    service.findOne.mockRejectedValueOnce(
      new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe.',
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/bus-companies/999')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'BUS_COMPANY_NOT_FOUND',
      message: 'Không tìm thấy nhà xe.',
    });
    expect(service.findOne).toHaveBeenCalledWith(999);
  });

  it('returns an English data envelope with pagination metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/bus-companies')
      .query({
        page: '2',
        pageSize: '5',
        search: 'NX001',
        sortBy: 'createdAt',
        sortDirection: 'desc',
        status: 'HOAT_DONG',
        createdFrom: '2026-01-01',
        createdTo: '2026-01-31',
      })
      .expect(200);

    expect(response.body).toEqual(responseData);
    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 5,
        search: 'NX001',
        sortBy: 'createdAt',
        sortDirection: 'desc',
        status: 'HOAT_DONG',
        createdFrom: '2026-01-01',
        createdTo: '2026-01-31',
      }),
    );
  });

  it('rejects sort keys outside the supported whitelist', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/bus-companies')
      .query({ sortBy: 'tenNhaXe' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'sortBy' })]),
    );
  });

  it.each(['ACTIVE', 'INACTIVE'])(
    'rejects the non-canonical status %s',
    async (status) => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/bus-companies')
        .query({ status })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'status' })]),
      );
    },
  );

  it('accepts TAM_NGUNG as a canonical raw status value', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/bus-companies')
      .query({ status: 'TAM_NGUNG' })
      .expect(200);

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'TAM_NGUNG' }),
    );
  });

  it('rejects a creation date range whose start is after its end', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/bus-companies')
      .query({
        createdFrom: '2026-02-01',
        createdTo: '2026-01-31',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'createdTo',
          message: 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
        }),
      ]),
    );
  });

  it('rejects timestamp boundaries because the API accepts business dates only', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/bus-companies')
      .query({ createdFrom: '2026-01-01T00:00:00.000Z' })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'createdFrom' }),
      ]),
    );
  });
});
