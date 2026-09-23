import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
        cancellationPolicy: 'Đổi vé trước giờ khởi hành.',
        status: 'HOAT_DONG',
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-02-03T04:05:06.000Z',
      },
    ],
    meta: { page: 2, pageSize: 5, totalItems: 11, totalPages: 3 },
  };
  const service = { findAll: vi.fn() };

  beforeAll(async () => {
    service.findAll.mockResolvedValue(responseData);
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
