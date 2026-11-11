import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { BusCompaniesModule } from '../../../src/bus-companies/bus-companies.module.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('POST /api/v1/bus-companies', () => {
  let app: INestApplication;
  const createdCompany = {
    nhaXeId: 7,
    maNhaXe: 'NX007',
    tenNhaXe: 'Nhà xe Mới',
    thongTinLienHe: '0900000007',
    trangThai: 'HOAT_DONG',
    createdAt: new Date('2026-03-04T05:06:07.000Z'),
    updatedAt: new Date('2026-03-04T05:06:07.000Z'),
  };
  const nhaXe = { create: vi.fn() };

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
    nhaXe.create.mockResolvedValue(createdCompany);
  });

  it('creates a company through the API and returns the mapped data envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/bus-companies')
      .send({
        code: ' NX007 ',
        name: ' Nhà xe Mới ',
        contactInfo: ' 0900000007 ',
        status: 'HOAT_DONG',
      })
      .expect(201);

    expect(response.body).toEqual({
      data: {
        busCompanyId: 7,
        code: 'NX007',
        name: 'Nhà xe Mới',
        contactInfo: '0900000007',
        status: 'HOAT_DONG',
        createdAt: '2026-03-04T05:06:07.000Z',
        updatedAt: '2026-03-04T05:06:07.000Z',
      },
    });
    expect(nhaXe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          maNhaXe: 'NX007',
          tenNhaXe: 'Nhà xe Mới',
          thongTinLienHe: '0900000007',
          trangThai: 'HOAT_DONG',
        },
      }),
    );
  });

  it('normalizes omitted contact info to null', async () => {
    nhaXe.create.mockResolvedValueOnce({
      ...createdCompany,
      thongTinLienHe: null,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/bus-companies')
      .send({ code: 'NX008', name: 'Nhà xe Khác', status: 'TAM_NGUNG' })
      .expect(201);

    expect(nhaXe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ thongTinLienHe: null }),
      }),
    );
    expect(response.body.data.contactInfo).toBeNull();
  });

  it('normalizes whitespace-only contact info to null', async () => {
    nhaXe.create.mockResolvedValueOnce({
      ...createdCompany,
      thongTinLienHe: null,
    });

    await request(app.getHttpServer())
      .post('/api/v1/bus-companies')
      .send({
        code: 'NX009',
        name: 'Nhà xe Có liên hệ rỗng',
        contactInfo: '   \t ',
        status: 'HOAT_DONG',
      })
      .expect(201);

    expect(nhaXe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ thongTinLienHe: null }),
      }),
    );
  });

  it.each([
    ['missing code', { name: 'Nhà xe Mới', status: 'HOAT_DONG' }, 'code'],
    ['missing name', { code: 'NX007', status: 'HOAT_DONG' }, 'name'],
    ['blank code', { code: ' \t ', name: 'Nhà xe Mới', status: 'HOAT_DONG' }, 'code'],
    ['blank name', { code: 'NX007', name: '   ', status: 'HOAT_DONG' }, 'name'],
    ['invalid status', { code: 'NX007', name: 'Nhà xe Mới', status: 'ACTIVE' }, 'status'],
    [
      'code longer than the Prisma column limit',
      { code: 'N'.repeat(51), name: 'Nhà xe Mới', status: 'HOAT_DONG' },
      'code',
    ],
    [
      'name longer than the Prisma column limit',
      { code: 'NX007', name: 'N'.repeat(151), status: 'HOAT_DONG' },
      'name',
    ],
  ] as const)(
    'rejects %s before writing to Prisma',
    async (_caseName, body, field) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/bus-companies')
        .send(body)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
      expect(nhaXe.create).not.toHaveBeenCalled();
    },
  );

  it('rejects unknown fields through the global ValidationPipe', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/bus-companies')
      .send({
        code: 'NX007',
        name: 'Nhà xe Mới',
        status: 'HOAT_DONG',
        cancellationPolicy: 'not part of the create contract',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      error: 'VALIDATION_ERROR',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'cancellationPolicy' }),
      ]),
    );
    expect(nhaXe.create).not.toHaveBeenCalled();
  });

  it('returns a duplicate-code conflict when the same code is posted twice', async () => {
    nhaXe.create
      .mockResolvedValueOnce({
        ...createdCompany,
        maNhaXe: 'TEST02',
        tenNhaXe: 'Nhà xe API Test',
        thongTinLienHe: '0909000002',
        trangThai: 'TAM_NGUNG',
      })
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the index: `NhaXe_maNhaXe_key`',
          {
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
          },
        ),
      );

    const body = {
      code: 'TEST02',
      name: 'Nhà xe API Test',
      contactInfo: '0909000002',
      status: 'TAM_NGUNG',
    };
    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/bus-companies')
      .send(body)
      .expect(201);
    expect(firstResponse.body.data).toMatchObject({
      code: 'TEST02',
      status: 'TAM_NGUNG',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/bus-companies')
      .send(body)
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'BUS_COMPANY_CODE_EXISTS',
      message: 'Mã nhà xe đã tồn tại.',
    });
    expect(response.text).not.toContain('Unique constraint failed');
    expect(response.text).not.toContain('NhaXe_maNhaXe_key');
    expect(nhaXe.create).toHaveBeenCalledTimes(2);
  });
});
