import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { BusCompaniesModule } from '../../../src/bus-companies/bus-companies.module.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('PATCH /api/v1/bus-companies/:id/status', () => {
  let app: INestApplication;
  const initialCompany = {
    nhaXeId: 7,
    maNhaXe: 'FUTA',
    tenNhaXe: 'Công ty Phương Trang',
    thongTinLienHe: '19006067',
    trangThai: 'HOAT_DONG',
    createdAt: new Date('2026-03-04T05:06:07.000Z'),
    updatedAt: new Date('2026-03-05T06:07:08.000Z'),
  };
  let storedCompany = { ...initialCompany };
  const nhaXe = {
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        BusCompaniesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ nhaXe })
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
    storedCompany = { ...initialCompany };
    nhaXe.update.mockImplementation(
      async (args: {
        where: { nhaXeId: number };
        data: { trangThai: string };
      }) => {
        if (args.where.nhaXeId !== storedCompany.nhaXeId) {
          throw new Prisma.PrismaClientKnownRequestError('record not found', {
            code: 'P2025',
            clientVersion: '7.10.0',
          });
        }
        storedCompany = {
          ...storedCompany,
          trangThai: args.data.trangThai,
          updatedAt: new Date('2026-03-06T07:08:09.000Z'),
        };
        return storedCompany;
      },
    );
    nhaXe.findUnique.mockImplementation(
      async (args: { where: { nhaXeId: number } }) =>
        args.where.nhaXeId === storedCompany.nhaXeId ? storedCompany : null,
    );
    nhaXe.findMany.mockImplementation(
      async (args: { where?: { trangThai?: string } }) =>
        args.where?.trangThai && args.where.trangThai !== storedCompany.trangThai
          ? []
          : [storedCompany],
    );
    nhaXe.count.mockImplementation(
      async (args: { where?: { trangThai?: string } }) =>
        args.where?.trangThai && args.where.trangThai !== storedCompany.trangThai
          ? 0
          : 1,
    );
  });

  it.each([
    ['HOAT_DONG', 'TAM_NGUNG'],
    ['TAM_NGUNG', 'HOAT_DONG'],
  ] as const)(
    'updates status from %s to %s with the shared response contract',
    async (_currentStatus, status) => {
      storedCompany = { ...storedCompany, trangThai: _currentStatus };

      const response = await request(app.getHttpServer())
        .patch('/api/v1/bus-companies/7/status')
        .send({ status })
        .expect(200);

      expect(response.body).toEqual({
        data: {
          busCompanyId: 7,
          code: 'FUTA',
          name: 'Công ty Phương Trang',
          contactInfo: '19006067',
          status,
          createdAt: '2026-03-04T05:06:07.000Z',
          updatedAt: '2026-03-06T07:08:09.000Z',
        },
      });
      expect(nhaXe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { nhaXeId: 7 },
          data: { trangThai: status },
        }),
      );
      expect(Object.keys(nhaXe.update.mock.calls[0][0].data)).toEqual([
        'trangThai',
      ]);
    },
  );

  it('keeps same-status requests successful and updates detail and status-filtered list', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7/status')
      .send({ status: 'HOAT_DONG' })
      .expect(200);

    const detailResponse = await request(app.getHttpServer())
      .get('/api/v1/bus-companies/7')
      .expect(200);
    expect(detailResponse.body.data.status).toBe('HOAT_DONG');

    await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7/status')
      .send({ status: 'TAM_NGUNG' })
      .expect(200);

    const updatedDetail = await request(app.getHttpServer())
      .get('/api/v1/bus-companies/7')
      .expect(200);
    expect(updatedDetail.body.data.status).toBe('TAM_NGUNG');

    const filteredList = await request(app.getHttpServer())
      .get('/api/v1/bus-companies')
      .query({ status: 'TAM_NGUNG' })
      .expect(200);
    expect(filteredList.body.data).toEqual([
      expect.objectContaining({ busCompanyId: 7, status: 'TAM_NGUNG' }),
    ]);
    expect(nhaXe.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { trangThai: 'TAM_NGUNG' } }),
    );
  });

  it('rejects a missing status before updating Prisma', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7/status')
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'status' })]),
    );
    expect(nhaXe.update).not.toHaveBeenCalled();
  });

  it.each(['ACTIVE', 'INACTIVE', ''])('rejects invalid status %j before updating Prisma', async (status) => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7/status')
      .send({ status })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'status' })]),
    );
    expect(nhaXe.update).not.toHaveBeenCalled();
  });

  it('rejects unknown fields before updating Prisma', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7/status')
      .send({ status: 'TAM_NGUNG', reason: 'manual' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'reason' })]),
    );
    expect(nhaXe.update).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1e3'])(
    'rejects invalid route id %s before updating Prisma',
    async (id) => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/bus-companies/${id}/status`)
        .send({ status: 'TAM_NGUNG' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
      );
      expect(nhaXe.update).not.toHaveBeenCalled();
    },
  );

  it('maps a missing bus company to the status-specific not-found contract', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/999/status')
      .send({ status: 'TAM_NGUNG' })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'BUS_COMPANY_NOT_FOUND',
      message: 'Không tìm thấy nhà xe.',
    });
  });
});
