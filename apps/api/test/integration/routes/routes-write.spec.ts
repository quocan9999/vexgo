import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApi } from '../../../src/common/configure-api.js';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { RoutesModule } from '../../../src/routes/routes.module.js';

const record = {
  tuyenXeId: 17, nhaXeId: 3, maTuyenXe: 'FUTA-TX-0100',
  diemDi: 'TP.HCM', diemDen: 'Đà Lạt', trangThai: 'HOAT_DONG',
  createdAt: new Date('2026-09-22T07:34:00.000Z'),
  updatedAt: new Date('2026-09-23T07:34:00.000Z'),
  nhaXe: { nhaXeId: 3, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
};
const prisma = {
  nhaXe: { findUnique: vi.fn() },
  tuyenXe: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
};
const createInput = {
  code: 'FUTA-TX-0100', origin: 'TP.HCM', destination: 'Đà Lạt',
  busCompanyId: 3, status: 'HOAT_DONG',
};

function knownError(code: string, meta: Record<string, unknown> = {}) {
  return new Prisma.PrismaClientKnownRequestError('database failure', {
    code, clientVersion: 'test', meta,
  });
}

describe('Route write HTTP pipeline with real service and mocked Prisma', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RoutesModule],
      providers: [{ provide: ConfigService, useValue: { get: () => undefined } }],
    })
      .overrideProvider(PrismaService).useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  afterAll(async () => { await app?.close(); });
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.nhaXe.findUnique.mockResolvedValue({ nhaXeId: 3 });
    prisma.tuyenXe.create.mockResolvedValue(record);
    prisma.tuyenXe.update.mockResolvedValue(record);
    prisma.tuyenXe.findUnique.mockResolvedValue(record);
    prisma.tuyenXe.findMany.mockResolvedValue([record]);
    prisma.tuyenXe.count.mockResolvedValue(1);
  });

  it('trims create fields, returns 201 with English relation mapping, and reads created detail', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/routes').send({
      ...createInput, code: '  FUTA-TX-0100  ', origin: '  TP.HCM ', destination: ' Đà Lạt  ',
    }).expect(201);
    expect(prisma.tuyenXe.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { maTuyenXe: 'FUTA-TX-0100', diemDi: 'TP.HCM', diemDen: 'Đà Lạt', nhaXeId: 3, trangThai: 'HOAT_DONG' },
    }));
    expect(response.body).toEqual({ data: {
      routeId: 17, code: 'FUTA-TX-0100', origin: 'TP.HCM', destination: 'Đà Lạt',
      status: 'HOAT_DONG', busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
      createdAt: '2026-09-22T07:34:00.000Z', updatedAt: '2026-09-23T07:34:00.000Z',
    } });
    const detail = await request(app.getHttpServer()).get('/api/v1/routes/17').expect(200);
    expect(detail.body.data).toEqual(response.body.data);
  });

  it.each([
    ['missing code', { origin: 'A', destination: 'B', busCompanyId: 3, status: 'HOAT_DONG' }],
    ['blank code', { ...createInput, code: '   ' }],
    ['long code', { ...createInput, code: 'X'.repeat(51) }],
    ['nonstring code', { ...createInput, code: 1 }],
    ['blank origin', { ...createInput, origin: '   ' }],
    ['blank destination', { ...createInput, destination: '   ' }],
    ['long origin', { ...createInput, origin: 'X'.repeat(101) }],
    ['long destination', { ...createInput, destination: 'X'.repeat(101) }],
    ['nonstring origin', { ...createInput, origin: 42 }],
    ['missing status', { code: 'A', origin: 'A', destination: 'B', busCompanyId: 3 }],
    ['invalid status', { ...createInput, status: 'ACTIVE' }],
    ['unknown field', { ...createInput, extra: true }],
  ])('rejects %s before Prisma', async (_name, body) => {
    const response = await request(app.getHttpServer()).post('/api/v1/routes').send(body).expect(400);
    expect(response.body).toMatchObject({ statusCode: 400, error: 'VALIDATION_ERROR' });
    expect(prisma.tuyenXe.create).not.toHaveBeenCalled();
  });

  it.each([undefined, 0, -1, 'abc', '1e3', '0x10', 1.5, 2_147_483_648])(
    'rejects invalid busCompanyId %s before Prisma', async (busCompanyId) => {
      const response = await request(app.getHttpServer()).post('/api/v1/routes')
        .send({ ...createInput, busCompanyId }).expect(400);
      expect(response.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'busCompanyId' })]));
      expect(prisma.nhaXe.findUnique).not.toHaveBeenCalled();
    },
  );

  it('returns BUS_COMPANY_NOT_FOUND when create references a missing company', async () => {
    prisma.nhaXe.findUnique.mockResolvedValueOnce(null);
    const response = await request(app.getHttpServer()).post('/api/v1/routes').send(createInput).expect(404);
    expect(response.body).toEqual({ statusCode: 404, error: 'BUS_COMPANY_NOT_FOUND', message: 'Không tìm thấy nhà xe.' });
    expect(prisma.tuyenXe.create).not.toHaveBeenCalled();
  });

  it('maps same-company duplicate to 409 but permits another company', async () => {
    prisma.tuyenXe.create.mockRejectedValueOnce(knownError('P2002', { target: ['nhaXeId', 'maTuyenXe'] }));
    const duplicate = await request(app.getHttpServer()).post('/api/v1/routes').send(createInput).expect(409);
    expect(duplicate.body).toEqual({ statusCode: 409, error: 'ROUTE_CODE_EXISTS', message: 'Mã tuyến đã tồn tại trong nhà xe này.' });
    const other = await request(app.getHttpServer()).post('/api/v1/routes').send({ ...createInput, busCompanyId: 4 }).expect(201);
    expect(prisma.tuyenXe.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nhaXeId: 4, maTuyenXe: createInput.code }),
    }));
    expect(other.body.data.code).toBe(createInput.code);
  });

  it('updates only endpoints and reflects the update in detail and list', async () => {
    const updated = { ...record, diemDi: 'Đà Lạt', diemDen: 'Nha Trang' };
    prisma.tuyenXe.update.mockResolvedValueOnce(updated);
    prisma.tuyenXe.findUnique.mockResolvedValueOnce(updated);
    prisma.tuyenXe.findMany.mockResolvedValueOnce([updated]);
    const response = await request(app.getHttpServer()).patch('/api/v1/routes/17').send({
      origin: ' Đà Lạt ', destination: ' Nha Trang ',
    }).expect(200);
    expect(prisma.tuyenXe.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { tuyenXeId: 17 }, data: { diemDi: 'Đà Lạt', diemDen: 'Nha Trang' },
    }));
    expect(response.body.data).toMatchObject({ code: createInput.code, origin: 'Đà Lạt', destination: 'Nha Trang', status: 'HOAT_DONG' });
    const detail = await request(app.getHttpServer()).get('/api/v1/routes/17').expect(200);
    expect(detail.body.data).toMatchObject({ origin: 'Đà Lạt', destination: 'Nha Trang' });
    const list = await request(app.getHttpServer()).get('/api/v1/routes').query({ search: 'Nha Trang' }).expect(200);
    expect(list.body.data[0]).toMatchObject({ origin: 'Đà Lạt', destination: 'Nha Trang' });
  });

  it.each([
    ['missing origin', { destination: 'B' }], ['missing destination', { origin: 'A' }],
    ['blank origin', { origin: '  ', destination: 'B' }],
    ['blank destination', { origin: 'A', destination: '  ' }],
    ['long origin', { origin: 'X'.repeat(101), destination: 'B' }],
    ['long destination', { origin: 'A', destination: 'X'.repeat(101) }],
    ['nonstring origin', { origin: 42, destination: 'B' }],
    ['immutable code', { origin: 'A', destination: 'B', code: 'NEW' }],
    ['immutable company', { origin: 'A', destination: 'B', busCompanyId: 4 }],
    ['immutable status', { origin: 'A', destination: 'B', status: 'TAM_NGUNG' }],
  ])('rejects PATCH with %s', async (_name, body) => {
    const response = await request(app.getHttpServer()).patch('/api/v1/routes/17').send(body).expect(400);
    expect(response.body).toMatchObject({ statusCode: 400, error: 'VALIDATION_ERROR' });
    expect(prisma.tuyenXe.update).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10', '2147483648'])(
    'rejects invalid PATCH ID %s before Prisma', async (id) => {
      await request(app.getHttpServer()).patch(`/api/v1/routes/${id}`)
        .send({ origin: 'A', destination: 'B' }).expect(400);
      expect(prisma.tuyenXe.update).not.toHaveBeenCalled();
    },
  );

  it('returns ROUTE_NOT_FOUND for a missing update record', async () => {
    prisma.tuyenXe.update.mockRejectedValueOnce(knownError('P2025'));
    const response = await request(app.getHttpServer()).patch('/api/v1/routes/999')
      .send({ origin: 'A', destination: 'B' }).expect(404);
    expect(response.body).toEqual({ statusCode: 404, error: 'ROUTE_NOT_FOUND', message: 'Không tìm thấy tuyến xe.' });
  });
});
