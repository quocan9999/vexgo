import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { VehicleTypeQueryDto } from '../../../src/vehicle-types/dto/vehicle-type-query.dto.js';
import {
  mapVehicleType,
  VehicleTypesService,
} from '../../../src/vehicle-types/vehicle-types.service.js';

const vehicleTypeRecord = {
  loaiXeId: 1,
  tenLoai: 'Limousine',
  moTa: 'Dòng xe limousine',
  createdAt: new Date('2026-09-25T10:00:00.000Z'),
  updatedAt: new Date('2026-09-25T11:00:00.000Z'),
};

const prisma = {
  loaiXe: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
} as unknown as PrismaService;

const service = new VehicleTypesService(prisma);

function createQuery(overrides: Partial<VehicleTypeQueryDto> = {}) {
  return Object.assign(new VehicleTypeQueryDto(), overrides);
}

describe('VehicleTypesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.loaiXe.findMany).mockResolvedValue([vehicleTypeRecord]);
    vi.mocked(prisma.loaiXe.count).mockResolvedValue(1);
    vi.mocked(prisma.loaiXe.findUnique).mockResolvedValue(vehicleTypeRecord);
  });

  it('maps Prisma field names and dates to the English API shape', () => {
    expect(
      mapVehicleType({ ...vehicleTypeRecord, moTa: null }),
    ).toEqual({
      vehicleTypeId: 1,
      name: 'Limousine',
      description: null,
      createdAt: '2026-09-25T10:00:00.000Z',
      updatedAt: '2026-09-25T11:00:00.000Z',
    });
  });

  it('trims search and searches both vehicle type name and description', async () => {
    await service.findAll(createQuery({ search: '  Limousine  ' }));

    expect(prisma.loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { tenLoai: { contains: 'Limousine' } },
            { moTa: { contains: 'Limousine' } },
          ],
        },
      }),
    );
  });

  it('does not add a search condition for whitespace-only input', async () => {
    await service.findAll(createQuery({ search: '  \t ' }));

    expect(prisma.loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(prisma.loaiXe.count).toHaveBeenCalledWith({ where: {} });
  });

  it.each([
    ['name', 'tenLoai'],
    ['createdAt', 'createdAt'],
    ['updatedAt', 'updatedAt'],
  ] as const)('maps %s sorting to Prisma %s', async (sortBy, prismaField) => {
    await service.findAll(createQuery({ sortBy, sortDirection: 'desc' }));

    expect(prisma.loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { [prismaField]: 'desc' } }),
    );
  });

  it('uses the shared page and page size to calculate Prisma offset and limit', async () => {
    const result = await service.findAll(
      createQuery({ page: 3, pageSize: 7 }),
    );

    expect(prisma.loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 14, take: 7 }),
    );
    expect(result.meta).toEqual({
      page: 3,
      pageSize: 7,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('returns mapped detail data for the requested id', async () => {
    await expect(service.findOne(1)).resolves.toEqual({
      data: {
        vehicleTypeId: 1,
        name: 'Limousine',
        description: 'Dòng xe limousine',
        createdAt: '2026-09-25T10:00:00.000Z',
        updatedAt: '2026-09-25T11:00:00.000Z',
      },
    });
    expect(prisma.loaiXe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { loaiXeId: 1 } }),
    );
  });

  it('returns a domain not found error when the detail record is missing', async () => {
    vi.mocked(prisma.loaiXe.findUnique).mockResolvedValueOnce(null);

    const error = await service.findOne(999999).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    if (!(error instanceof NotFoundException)) {
      throw new Error('Expected a NotFoundException');
    }

    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual({
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
  });
});
