import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { VehicleTypesService } from '../../../src/vehicle-types/vehicle-types.service.js';
import { VehicleTypeQueryDto } from '../../../src/vehicle-types/dto/vehicle-type-query.dto.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('VehicleTypesService', () => {
  const loaiXe = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
    loaiXe.create.mockResolvedValue(vehicleTypeRecord);
    loaiXe.update.mockResolvedValue(vehicleTypeRecord);
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

  it('creates a vehicle type using only LoaiXe editable fields and maps the response', async () => {
    const createdRecord = {
      ...vehicleTypeRecord,
      tenLoai: 'Limousine 22 phòng',
      moTa: 'Loại xe giường phòng cao cấp',
    };
    loaiXe.create.mockResolvedValueOnce(createdRecord);

    await expect(
      service.create({
        name: 'Limousine 22 phòng',
        description: 'Loại xe giường phòng cao cấp',
      }),
    ).resolves.toEqual({
      data: {
        vehicleTypeId: 7,
        name: 'Limousine 22 phòng',
        description: 'Loại xe giường phòng cao cấp',
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-02-03T04:05:06.000Z',
      },
    });
    expect(loaiXe.create).toHaveBeenCalledWith({
      data: {
        tenLoai: 'Limousine 22 phòng',
        moTa: 'Loại xe giường phòng cao cấp',
      },
      select: {
        loaiXeId: true,
        tenLoai: true,
        moTa: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('stores an omitted description as null', async () => {
    loaiXe.create.mockResolvedValueOnce({ ...vehicleTypeRecord, moTa: null });

    await service.create({ name: 'Limousine 22 phòng' });

    expect(loaiXe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { tenLoai: 'Limousine 22 phòng', moTa: null },
      }),
    );
  });

  it('maps the MariaDB adapter LoaiXe_index_0 P2002 shape to a duplicate-name conflict', async () => {
    loaiXe.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the index: `LoaiXe_index_0`',
        {
          code: 'P2002',
          clientVersion: '7.10.0',
          meta: {
            driverAdapterError: {
              cause: {
                kind: 'UniqueConstraintViolation',
                constraint: { index: 'LoaiXe_index_0' },
              },
            },
          },
        },
      ),
    );

    let caught: unknown;
    try {
      await service.create({ name: 'Limousine' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConflictException);
    if (!(caught instanceof ConflictException)) throw caught;
    expect(caught.getStatus()).toBe(409);
    expect(caught.getResponse()).toEqual({
      error: 'VEHICLE_TYPE_NAME_EXISTS',
      message: 'Tên loại xe đã tồn tại.',
    });
  });

  it('propagates unrelated P2002 errors instead of reporting a duplicate vehicle type name', async () => {
    const unrelatedError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on another index',
      {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'AnotherLoaiXeIndex' },
            },
          },
        },
      },
    );
    loaiXe.create.mockRejectedValueOnce(unrelatedError);

    await expect(service.create({ name: 'Limousine' })).rejects.toBe(
      unrelatedError,
    );
  });

  it('updates only name and description and permits keeping the current name', async () => {
    await expect(
      service.update(7, { name: 'Limousine', description: null }),
    ).resolves.toEqual({
      data: {
        vehicleTypeId: 7,
        name: 'Limousine',
        description: null,
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-02-03T04:05:06.000Z',
      },
    });
    expect(loaiXe.update).toHaveBeenCalledWith({
      where: { loaiXeId: 7 },
      data: { tenLoai: 'Limousine', moTa: null },
      select: {
        loaiXeId: true,
        tenLoai: true,
        moTa: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('maps duplicate names from update to the same conflict contract', async () => {
    loaiXe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate name', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'LoaiXe_index_0' },
            },
          },
        },
      }),
    );

    await expect(
      service.update(7, { name: 'Giường nằm', description: null }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'VEHICLE_TYPE_NAME_EXISTS',
        message: 'Tên loại xe đã tồn tại.',
      },
    });
  });

  it('maps a missing update target to the vehicle type not found contract', async () => {
    loaiXe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record to update not found', {
        code: 'P2025',
        clientVersion: '7.10.0',
      }),
    );

    let caught: unknown;
    try {
      await service.update(999999, { name: 'Limousine', description: null });
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
