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

const seatRecord = {
  gheId: 101,
  soGhe: 'A01',
  viTri: 'Tầng dưới',
  xeId: 12,
  createdAt: new Date('2026-09-25T10:00:00.000Z'),
  updatedAt: new Date('2026-09-25T11:00:00.000Z'),
};

const prisma = {
  xe: { findUnique: vi.fn() },
  ghe: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  gheChuyenXe: { count: vi.fn() },
};

describe('Vehicles seat API request-pipeline integration', () => {
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
    prisma.xe.findUnique.mockResolvedValue({ xeId: 12 });
    prisma.ghe.findMany.mockResolvedValue([seatRecord]);
    prisma.ghe.create.mockResolvedValue(seatRecord);
    prisma.ghe.findFirst.mockResolvedValue({ gheId: 101 });
    prisma.ghe.update.mockResolvedValue({
      ...seatRecord,
      soGhe: 'A02',
      viTri: 'Tầng trên',
    });
    prisma.ghe.delete.mockResolvedValue(seatRecord);
    prisma.gheChuyenXe.count.mockResolvedValue(0);
  });

  function prismaKnownError(code: string, meta: Record<string, unknown> = {}) {
    return new Prisma.PrismaClientKnownRequestError('Prisma request failed', {
      code,
      clientVersion: 'test',
      meta,
    });
  }

  it('returns mapped seats in a stable list envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles/12/seats')
      .expect(200);

    expect(response.body).toEqual({
      data: [
        {
          seatId: 101,
          seatNumber: 'A01',
          position: 'Tầng dưới',
          vehicleId: 12,
          createdAt: '2026-09-25T10:00:00.000Z',
          updatedAt: '2026-09-25T11:00:00.000Z',
        },
      ],
      meta: { totalItems: 1 },
    });
    expect(prisma.ghe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { xeId: 12 }, orderBy: { soGhe: 'asc' } }),
    );
  });

  it('returns an empty list for a vehicle with no configured seats', async () => {
    prisma.ghe.findMany.mockResolvedValueOnce([]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles/12/seats')
      .expect(200);

    expect(response.body).toEqual({ data: [], meta: { totalItems: 0 } });
  });

  it('returns exact vehicle not-found for list and create', async () => {
    prisma.xe.findUnique.mockResolvedValue(null);
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/vehicles/999/seats')
      .expect(404);
    expect(listResponse.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/vehicles/999/seats')
      .send({ seatNumber: 'A01' })
      .expect(404);
    expect(createResponse.body.error).toBe('VEHICLE_NOT_FOUND');
    expect(prisma.ghe.create).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1e3', '0x10'])(
    'rejects a non-decimal vehicle ID %s before Prisma',
    async (vehicleId) => {
      await request(app.getHttpServer())
        .get(`/api/v1/vehicles/${vehicleId}/seats`)
        .expect(400);
      expect(prisma.xe.findUnique).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '-1', 'abc', '1e3', '0x10'])(
    'rejects malformed vehicle IDs on create/delete and seat IDs on update/delete: %s',
    async (id) => {
      await request(app.getHttpServer())
        .post(`/api/v1/vehicles/${id}/seats`)
        .send({ seatNumber: 'A01' })
        .expect(400);
      await request(app.getHttpServer())
        .delete(`/api/v1/vehicles/${id}/seats/101`)
        .expect(400);
      await request(app.getHttpServer())
        .patch(`/api/v1/vehicles/12/seats/${id}`)
        .send({ seatNumber: 'A02' })
        .expect(400);
      await request(app.getHttpServer())
        .delete(`/api/v1/vehicles/12/seats/${id}`)
        .expect(400);

      expect(prisma.xe.findUnique).not.toHaveBeenCalled();
      expect(prisma.ghe.findFirst).not.toHaveBeenCalled();
      expect(prisma.ghe.create).not.toHaveBeenCalled();
      expect(prisma.ghe.update).not.toHaveBeenCalled();
      expect(prisma.ghe.delete).not.toHaveBeenCalled();
    },
  );

  it('creates a trimmed root seat without generating trip seats', async () => {
    prisma.ghe.create.mockResolvedValueOnce({
      ...seatRecord,
      soGhe: 'A01',
      viTri: 'Tầng dưới',
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles/12/seats')
      .send({ seatNumber: ' A01 ', position: ' Tầng dưới ' })
      .expect(201);

    expect(response.body.data).toMatchObject({ seatNumber: 'A01', position: 'Tầng dưới' });
    expect(prisma.ghe.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { xeId: 12, soGhe: 'A01', viTri: 'Tầng dưới' } }),
    );
    expect(prisma.gheChuyenXe.count).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', '   '])(
    'normalizes omitted or blank position %s to null',
    async (position) => {
      await request(app.getHttpServer())
        .post('/api/v1/vehicles/12/seats')
        .send({ seatNumber: 'A01', ...(position === undefined ? {} : { position }) })
        .expect(201);

      expect(prisma.ghe.create.mock.calls[0][0].data.viTri).toBeNull();
    },
  );

  it('rejects invalid seat fields and unknown create properties before Prisma', async () => {
    const invalidInputs: Record<string, unknown>[] = [
      {},
      { seatNumber: '   ' },
      { seatNumber: '12345678901' },
      { seatNumber: 1 },
      { seatNumber: 'A01', position: 1 },
      { seatNumber: 'A01', position: 'x'.repeat(51) },
      { seatNumber: 'A01', other: true },
    ];

    for (const input of invalidInputs) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/vehicles/12/seats')
        .send(input)
        .expect(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    }
    expect(prisma.ghe.create).not.toHaveBeenCalled();
  });

  it('maps duplicate scoped seat numbers and allows the same number on a different vehicle', async () => {
    prisma.ghe.create.mockRejectedValueOnce(
      prismaKnownError('P2002', { target: ['xeId', 'soGhe'] }),
    );
    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/vehicles/12/seats')
      .send({ seatNumber: 'A01' })
      .expect(409);
    expect(duplicate.body).toEqual({
      statusCode: 409,
      error: 'VEHICLE_SEAT_NUMBER_EXISTS',
      message: 'Số ghế đã tồn tại trên xe này.',
    });

    prisma.xe.findUnique.mockResolvedValueOnce({ xeId: 13 });
    await request(app.getHttpServer())
      .post('/api/v1/vehicles/13/seats')
      .send({ seatNumber: 'A01' })
      .expect(201);
    expect(prisma.ghe.create.mock.calls[1][0].data.xeId).toBe(13);
  });

  it('updates editable fields and rejects invalid or unknown fields', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/seats/101')
      .send({ seatNumber: ' A02 ', position: ' Tầng trên ' })
      .expect(200);
    expect(response.body.data).toMatchObject({ seatNumber: 'A02', position: 'Tầng trên' });
    expect(prisma.ghe.update.mock.calls[0][0].data).toEqual({
      soGhe: 'A02',
      viTri: 'Tầng trên',
    });

    await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/seats/101')
      .send({ seatNumber: 'A02', xeId: 13 })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/seats/101')
      .send({ position: 'Tầng trên' })
      .expect(400);
    expect(prisma.ghe.update).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid seat IDs and reports missing or differently owned seats', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/seats/0')
      .send({ seatNumber: 'A02' })
      .expect(400);

    prisma.ghe.findFirst.mockResolvedValueOnce(null);
    const missing = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/seats/999')
      .send({ seatNumber: 'A02' })
      .expect(404);
    expect(missing.body.error).toBe('VEHICLE_SEAT_NOT_FOUND');
  });

  it('allows the current seat number, maps duplicate updates, and blocks used seats', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/seats/101')
      .send({ seatNumber: 'A01', position: null })
      .expect(200);
    expect(prisma.ghe.update.mock.calls[0][0].data).toEqual({ soGhe: 'A01', viTri: null });

    prisma.ghe.update.mockRejectedValueOnce(
      prismaKnownError('P2002', { target: ['xeId', 'soGhe'] }),
    );
    const duplicate = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/seats/101')
      .send({ seatNumber: 'A02' })
      .expect(409);
    expect(duplicate.body.error).toBe('VEHICLE_SEAT_NUMBER_EXISTS');

    prisma.gheChuyenXe.count.mockResolvedValueOnce(1);
    const used = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/12/seats/101')
      .send({ seatNumber: 'A03' })
      .expect(409);
    expect(used.body).toEqual({
      statusCode: 409,
      error: 'VEHICLE_SEAT_IN_USE',
      message: 'Ghế đã được sử dụng trong chuyến xe và không thể thay đổi.',
    });
  });

  it('deletes unused seats with 204 and blocks referenced seats', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/v1/vehicles/12/seats/101')
      .expect(204);
    expect(response.text).toBe('');

    prisma.gheChuyenXe.count.mockResolvedValueOnce(1);
    const used = await request(app.getHttpServer())
      .delete('/api/v1/vehicles/12/seats/101')
      .expect(409);
    expect(used.body.error).toBe('VEHICLE_SEAT_IN_USE');
  });

  it('returns VEHICLE_SEAT_NOT_FOUND when delete does not find a seat owned by the vehicle', async () => {
    prisma.ghe.findFirst.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .delete('/api/v1/vehicles/12/seats/999')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'VEHICLE_SEAT_NOT_FOUND',
      message: 'Không tìm thấy ghế của xe.',
    });
    expect(prisma.ghe.delete).not.toHaveBeenCalled();
  });

  it('maps a delete-time foreign key constraint to the seat-in-use conflict', async () => {
    prisma.ghe.delete.mockRejectedValueOnce(prismaKnownError('P2003'));

    const response = await request(app.getHttpServer())
      .delete('/api/v1/vehicles/12/seats/101')
      .expect(409);
    expect(response.body.error).toBe('VEHICLE_SEAT_IN_USE');
  });
});
