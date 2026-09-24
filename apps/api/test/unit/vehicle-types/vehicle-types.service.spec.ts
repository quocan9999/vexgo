import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VehicleTypesService } from '../../../src/vehicle-types/vehicle-types.service.js';
import { VehicleTypeQueryDto } from '../../../src/vehicle-types/dto/vehicle-type-query.dto.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('VehicleTypesService', () => {
  const loaiXe = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  };
  const service = new VehicleTypesService({ loaiXe } as unknown as PrismaService);
  const vehicleTypeRecord = {
    loaiXeId: 7,
    tenLoai: 'Limousine',
    moTa: null,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-02-03T04:05:06.000Z'),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    loaiXe.findMany.mockResolvedValue([vehicleTypeRecord]);
    loaiXe.count.mockResolvedValue(11);
    loaiXe.findUnique.mockResolvedValue(vehicleTypeRecord);
  });

  it('maps LoaiXe fields and ISO timestamps into the paginated API contract', async () => {
    await expect(service.findAll(new VehicleTypeQueryDto())).resolves.toEqual({
      data: [
        {
          vehicleTypeId: 7,
          name: 'Limousine',
          description: null,
          createdAt: '2026-01-02T03:04:05.000Z',
          updatedAt: '2026-02-03T04:05:06.000Z',
        },
      ],
      meta: { page: 1, pageSize: 10, totalItems: 11, totalPages: 2 },
    });

    expect(loaiXe.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { tenLoai: 'asc' },
      skip: 0,
      take: 10,
      select: {
        loaiXeId: true,
        tenLoai: true,
        moTa: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('trims search and searches both vehicle type name and description', async () => {
    await service.findAll(
      Object.assign(new VehicleTypeQueryDto(), { search: '  Limousine  ' }),
    );

    const where = {
      OR: [
        { tenLoai: { contains: 'Limousine' } },
        { moTa: { contains: 'Limousine' } },
      ],
    };
    expect(loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(loaiXe.count).toHaveBeenCalledWith({ where });
  });

  it('treats whitespace-only search as no search condition', async () => {
    await service.findAll(
      Object.assign(new VehicleTypeQueryDto(), { search: '   ' }),
    );

    expect(loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(loaiXe.count).toHaveBeenCalledWith({ where: {} });
  });

  it.each([
    ['name', 'tenLoai'],
    ['createdAt', 'createdAt'],
    ['updatedAt', 'updatedAt'],
  ] as const)('maps sort key %s to the approved Prisma field', async (sortBy, field) => {
    await service.findAll(
      Object.assign(new VehicleTypeQueryDto(), {
        sortBy,
        sortDirection: 'desc',
      }),
    );

    expect(loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { [field]: 'desc' } }),
    );
  });

  it('calculates backend pagination offsets and page metadata', async () => {
    const query = Object.assign(new VehicleTypeQueryDto(), {
      page: 3,
      pageSize: 4,
    });

    await expect(service.findAll(query)).resolves.toMatchObject({
      meta: { page: 3, pageSize: 4, totalItems: 11, totalPages: 3 },
    });
    expect(loaiXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 8, take: 4 }),
    );
  });

  it('loads detail by database id and maps all public fields', async () => {
    await expect(service.findOne(7)).resolves.toEqual({
      data: {
        vehicleTypeId: 7,
        name: 'Limousine',
        description: null,
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-02-03T04:05:06.000Z',
      },
    });
    expect(loaiXe.findUnique).toHaveBeenCalledWith({
      where: { loaiXeId: 7 },
      select: {
        loaiXeId: true,
        tenLoai: true,
        moTa: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('maps a missing detail record to the vehicle type not found contract', async () => {
    loaiXe.findUnique.mockResolvedValueOnce(null);

    let caught: unknown;
    try {
      await service.findOne(999999);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(NotFoundException);
    if (!(caught instanceof NotFoundException)) throw caught;
    expect(caught.getStatus()).toBe(404);
    expect(caught.getResponse()).toEqual({
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
  });
});
