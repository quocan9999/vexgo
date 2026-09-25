import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { CreateVehicleSeatDto } from '../../../src/vehicles/dto/create-vehicle-seat.dto.js';
import { UpdateVehicleSeatDto } from '../../../src/vehicles/dto/update-vehicle-seat.dto.js';
import { VehiclesService } from '../../../src/vehicles/vehicles.service.js';

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
} as unknown as PrismaService;

const service = new VehiclesService(prisma);

function prismaKnownError(code: string, meta: Record<string, unknown> = {}) {
  return new Prisma.PrismaClientKnownRequestError('Prisma request failed', {
    code,
    clientVersion: 'test',
    meta,
  });
}

function createInput(overrides: Partial<CreateVehicleSeatDto> = {}) {
  return Object.assign(new CreateVehicleSeatDto(), {
    seatNumber: 'A01',
    position: 'Tầng dưới',
    ...overrides,
  });
}

function updateInput(overrides: Partial<UpdateVehicleSeatDto> = {}) {
  return Object.assign(new UpdateVehicleSeatDto(), {
    seatNumber: 'A02',
    position: 'Tầng trên',
    ...overrides,
  });
}

describe('VehiclesService vehicle seats', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.xe.findUnique).mockResolvedValue({ xeId: 12 } as never);
    vi.mocked(prisma.ghe.findMany).mockResolvedValue([seatRecord] as never);
    vi.mocked(prisma.ghe.create).mockResolvedValue(seatRecord as never);
    vi.mocked(prisma.ghe.findFirst).mockResolvedValue({ gheId: 101 } as never);
    vi.mocked(prisma.ghe.update).mockResolvedValue({
      ...seatRecord,
      soGhe: 'A02',
      viTri: 'Tầng trên',
    } as never);
    vi.mocked(prisma.ghe.delete).mockResolvedValue(seatRecord as never);
    vi.mocked(prisma.gheChuyenXe.count).mockResolvedValue(0);
  });

  it('checks vehicle existence before listing and returns stable seat order with mapped fields', async () => {
    const result = await service.findSeats(12);

    expect(prisma.xe.findUnique).toHaveBeenCalledWith({
      where: { xeId: 12 },
      select: { xeId: true },
    });
    expect(prisma.ghe.findMany).toHaveBeenCalledWith({
      where: { xeId: 12 },
      orderBy: { soGhe: 'asc' },
      select: expect.any(Object),
    });
    expect(result).toEqual({
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
  });

  it('returns an empty list for an existing vehicle without querying a count', async () => {
    vi.mocked(prisma.ghe.findMany).mockResolvedValueOnce([] as never);

    await expect(service.findSeats(12)).resolves.toEqual({
      data: [],
      meta: { totalItems: 0 },
    });
  });

  it('returns VEHICLE_NOT_FOUND before listing seats for a missing vehicle', async () => {
    vi.mocked(prisma.xe.findUnique).mockResolvedValueOnce(null);

    const error = await service.findSeats(999).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });
    expect(prisma.ghe.findMany).not.toHaveBeenCalled();
  });

  it('creates a root seat with the vehicle ID and maps the response', async () => {
    const result = await service.createSeat(12, createInput());

    expect(prisma.ghe.create).toHaveBeenCalledWith({
      data: { xeId: 12, soGhe: 'A01', viTri: 'Tầng dưới' },
      select: expect.any(Object),
    });
    expect(result.data).toMatchObject({ seatId: 101, vehicleId: 12 });
  });

  it('stores blank position as null', async () => {
    await service.createSeat(12, createInput({ position: '  ' }));

    expect(prisma.ghe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { xeId: 12, soGhe: 'A01', viTri: null },
      }),
    );
  });

  it('returns VEHICLE_NOT_FOUND before creating a seat', async () => {
    vi.mocked(prisma.xe.findUnique).mockResolvedValueOnce(null);

    await expect(service.createSeat(999, createInput())).rejects.toMatchObject({
      response: { error: 'VEHICLE_NOT_FOUND' },
    });
    expect(prisma.ghe.create).not.toHaveBeenCalled();
  });

  it.each([
    { target: ['xeId', 'soGhe'] },
    { target: 'Ghe_index_1' },
    {
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { index: 'Ghe_index_1' },
        },
      },
    },
  ])('maps the vehicle-scoped duplicate index to a seat number conflict', async (meta) => {
    vi.mocked(prisma.ghe.create).mockRejectedValueOnce(
      prismaKnownError('P2002', meta),
    );

    const error = await service
      .createSeat(12, createInput())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      error: 'VEHICLE_SEAT_NUMBER_EXISTS',
      message: 'Số ghế đã tồn tại trên xe này.',
    });
  });

  it('does not convert an unrelated P2002 into a seat conflict', async () => {
    const prismaError = prismaKnownError('P2002', { target: ['otherField'] });
    vi.mocked(prisma.ghe.create).mockRejectedValueOnce(prismaError);

    await expect(service.createSeat(12, createInput())).rejects.toBe(prismaError);
  });

  it('updates a seat only after confirming it belongs to the requested vehicle', async () => {
    await service.updateSeat(12, 101, updateInput());

    expect(prisma.ghe.findFirst).toHaveBeenCalledWith({
      where: { gheId: 101, xeId: 12 },
      select: { gheId: true },
    });
    expect(prisma.ghe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          gheId: 101,
          xeId: 12,
          gheChuyenXes: { none: {} },
        },
        data: { soGhe: 'A02', viTri: 'Tầng trên' },
      }),
    );
    expect(vi.mocked(prisma.ghe.update).mock.calls[0][0].data).not.toHaveProperty(
      'xeId',
    );
  });

  it('returns VEHICLE_NOT_FOUND first when updating under a missing vehicle', async () => {
    vi.mocked(prisma.xe.findUnique).mockResolvedValueOnce(null);

    await expect(service.updateSeat(999, 101, updateInput())).rejects.toMatchObject({
      response: { error: 'VEHICLE_NOT_FOUND' },
    });
    expect(prisma.ghe.findFirst).not.toHaveBeenCalled();
  });

  it('returns VEHICLE_SEAT_NOT_FOUND for a missing or differently owned seat', async () => {
    vi.mocked(prisma.ghe.findFirst).mockResolvedValueOnce(null);

    await expect(service.updateSeat(12, 999, updateInput())).rejects.toMatchObject({
      response: { error: 'VEHICLE_SEAT_NOT_FOUND' },
    });
    expect(prisma.ghe.update).not.toHaveBeenCalled();
  });

  it('allows keeping the current seat number', async () => {
    await service.updateSeat(12, 101, updateInput({ seatNumber: 'A01' }));

    expect(prisma.ghe.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { soGhe: 'A01', viTri: 'Tầng trên' } }),
    );
  });

  it('maps duplicate seat numbers during update to VEHICLE_SEAT_NUMBER_EXISTS', async () => {
    vi.mocked(prisma.ghe.update).mockRejectedValueOnce(
      prismaKnownError('P2002', { target: ['xeId', 'soGhe'] }),
    );

    await expect(service.updateSeat(12, 101, updateInput())).rejects.toMatchObject({
      response: { error: 'VEHICLE_SEAT_NUMBER_EXISTS' },
    });
  });

  it('rejects updating a seat already referenced by a trip', async () => {
    vi.mocked(prisma.gheChuyenXe.count).mockResolvedValueOnce(1);

    await expect(service.updateSeat(12, 101, updateInput())).rejects.toMatchObject({
      response: { error: 'VEHICLE_SEAT_IN_USE' },
    });
    expect(prisma.ghe.update).not.toHaveBeenCalled();
  });

  it('rechecks ownership when the atomic unused-seat update no longer matches', async () => {
    vi.mocked(prisma.ghe.update).mockRejectedValueOnce(prismaKnownError('P2025'));

    await expect(service.updateSeat(12, 101, updateInput())).rejects.toMatchObject({
      response: { error: 'VEHICLE_SEAT_IN_USE' },
    });
    expect(prisma.ghe.findFirst).toHaveBeenCalledTimes(2);
  });

  it('deletes an unused seat for the requested vehicle', async () => {
    await expect(service.deleteSeat(12, 101)).resolves.toBeUndefined();

    expect(prisma.ghe.delete).toHaveBeenCalledWith({
      where: { gheId: 101, xeId: 12 },
      select: { gheId: true },
    });
  });

  it('rejects deleting a seat already referenced by a trip', async () => {
    vi.mocked(prisma.gheChuyenXe.count).mockResolvedValueOnce(1);

    await expect(service.deleteSeat(12, 101)).rejects.toMatchObject({
      response: { error: 'VEHICLE_SEAT_IN_USE' },
    });
    expect(prisma.ghe.delete).not.toHaveBeenCalled();
  });

  it('maps a delete-time foreign key race to VEHICLE_SEAT_IN_USE', async () => {
    vi.mocked(prisma.ghe.delete).mockRejectedValueOnce(prismaKnownError('P2003'));

    await expect(service.deleteSeat(12, 101)).rejects.toMatchObject({
      response: { error: 'VEHICLE_SEAT_IN_USE' },
    });
  });

  it('returns VEHICLE_SEAT_NOT_FOUND when delete no longer finds the owned seat', async () => {
    vi.mocked(prisma.ghe.findFirst).mockResolvedValueOnce(null);

    await expect(service.deleteSeat(12, 101)).rejects.toMatchObject({
      response: { error: 'VEHICLE_SEAT_NOT_FOUND' },
    });
    expect(prisma.ghe.delete).not.toHaveBeenCalled();
  });
});
