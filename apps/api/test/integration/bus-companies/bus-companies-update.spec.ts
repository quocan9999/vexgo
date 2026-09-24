import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { BusCompaniesModule } from '../../../src/bus-companies/bus-companies.module.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('PATCH /api/v1/bus-companies/:id', () => {
  let app: INestApplication;
  const existingCompany = {
    nhaXeId: 7,
    maNhaXe: 'FUTA',
    tenNhaXe: 'Công ty Phương Trang',
    thongTinLienHe: '19006067',
    trangThai: 'HOAT_DONG',
    createdAt: new Date('2026-03-04T05:06:07.000Z'),
    updatedAt: new Date('2026-03-05T06:07:08.000Z'),
  };
  const nhaXe = { update: vi.fn() };

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
    nhaXe.update.mockResolvedValue(existingCompany);
  });

  it('updates and trims editable fields while returning the shared response mapping', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7')
      .send({
        code: ' FUTA ',
        name: ' Công ty Phương Trang ',
        contactInfo: ' 19006067 ',
      })
      .expect(200);

    expect(response.body).toEqual({
      data: {
        busCompanyId: 7,
        code: 'FUTA',
        name: 'Công ty Phương Trang',
        contactInfo: '19006067',
        status: 'HOAT_DONG',
        createdAt: '2026-03-04T05:06:07.000Z',
        updatedAt: '2026-03-05T06:07:08.000Z',
      },
    });
    expect(nhaXe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nhaXeId: 7 },
        data: {
          maNhaXe: 'FUTA',
          tenNhaXe: 'Công ty Phương Trang',
          thongTinLienHe: '19006067',
        },
      }),
    );
  });

  it('normalizes omitted contact info to null', async () => {
    nhaXe.update.mockResolvedValueOnce({
      ...existingCompany,
      thongTinLienHe: null,
    });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7')
      .send({ code: 'FUTA', name: 'Công ty Phương Trang' })
      .expect(200);

    expect(nhaXe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ thongTinLienHe: null }),
      }),
    );
    expect(response.body.data.contactInfo).toBeNull();
  });

  it('normalizes whitespace-only contact info to null', async () => {
    nhaXe.update.mockResolvedValueOnce({
      ...existingCompany,
      thongTinLienHe: null,
    });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7')
      .send({ code: 'FUTA', name: 'Công ty Phương Trang', contactInfo: ' \t ' })
      .expect(200);

    expect(nhaXe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ thongTinLienHe: null }),
      }),
    );
    expect(response.body.data.contactInfo).toBeNull();
  });

  it.each([
    ['missing code', { name: 'Nhà xe' }, 'code'],
    ['blank code', { code: ' \t ', name: 'Nhà xe' }, 'code'],
    ['missing name', { code: 'NX001' }, 'name'],
    ['blank name', { code: 'NX001', name: '   ' }, 'name'],
    ['code longer than 50 characters', { code: 'C'.repeat(51), name: 'Nhà xe' }, 'code'],
    ['name longer than 150 characters', { code: 'NX001', name: 'N'.repeat(151) }, 'name'],
    ['non-string contact info', { code: 'NX001', name: 'Nhà xe', contactInfo: 123 }, 'contactInfo'],
  ] as const)(
    'rejects %s before writing to Prisma',
    async (_caseName, body, field) => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/bus-companies/7')
        .send(body)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
      expect(nhaXe.update).not.toHaveBeenCalled();
    },
  );

  it('rejects status because it is outside the update contract', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7')
      .send({ code: 'FUTA', name: 'Nhà xe', status: 'TAM_NGUNG' })
      .expect(400);

    expect(response.body).toMatchObject({ error: 'VALIDATION_ERROR' });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'status' })]),
    );
    expect(nhaXe.update).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1e3'])(
    'rejects invalid route id %s before writing to Prisma',
    async (id) => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/bus-companies/${id}`)
        .send({ code: 'FUTA', name: 'Nhà xe' })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'VALIDATION_ERROR' });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
      );
      expect(nhaXe.update).not.toHaveBeenCalled();
    },
  );

  it('maps Prisma record-not-found to the bus-company 404 contract', async () => {
    nhaXe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('record not found', {
        code: 'P2025',
        clientVersion: '7.10.0',
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/999')
      .send({ code: 'NX999', name: 'Không tồn tại' })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'BUS_COMPANY_NOT_FOUND',
      message: 'Không tìm thấy nhà xe.',
    });
  });

  it('maps the MariaDB maNhaXe unique violation to the duplicate-code 409 contract', async () => {
    nhaXe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate code', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'NhaXe_maNhaXe_key' },
            },
          },
        },
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7')
      .send({ code: 'OTHER', name: 'Công ty Phương Trang' })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'BUS_COMPANY_CODE_EXISTS',
      message: 'Mã nhà xe đã tồn tại.',
    });
  });

  it('allows keeping the current code while updating other fields', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/7')
      .send({ code: 'FUTA', name: 'Công ty Phương Trang Mới' })
      .expect(200);

    expect(response.body.data.code).toBe('FUTA');
    expect(nhaXe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nhaXeId: 7 },
        data: expect.objectContaining({ maNhaXe: 'FUTA' }),
      }),
    );
  });
});
