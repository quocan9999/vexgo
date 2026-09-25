import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { VehicleQueryDto } from '../../../src/vehicles/dto/vehicle-query.dto.js';
import { VehiclesService } from '../../../src/vehicles/vehicles.service.js';

const vehicleListRecord = {
  xeId: 12,
  bienSoXe: '51B-123.45',
  trangThai: 'HOAT_DONG',
  nhaXeId: 1,
  loaiXeId: 3,
  nhaXe: { nhaXeId: 1, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
  loaiXe: { loaiXeId: 3, tenLoai: 'Limousine' },
  createdAt: new Date('2026-09-25T10:00:00.000Z'),
  updatedAt: new Date('2026-09-25T11:00:00.000Z'),
};

const vehicleDetailRecord = {
  ...vehicleListRecord,
  loaiXe: { ...vehicleListRecord.loaiXe, moTa: 'Xe giường phòng cao cấp' },
};

const prisma = {
  xe: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
} as unknown as PrismaService;

const service = new VehiclesService(prisma);

function createQuery(overrides: Partial<VehicleQueryDto> = {}) {
  return Object.assign(new VehicleQueryDto(), overrides);
}

describe('VehiclesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.xe.findMany).mockResolvedValue([vehicleListRecord]);
    vi.mocked(prisma.xe.count).mockResolvedValue(1);
    vi.mocked(prisma.xe.findUnique).mockResolvedValue(vehicleDetailRecord);
  });

  it('maps vehicle, bus company, and vehicle type fields to the English API shape', async () => {
    const result = await service.findAll(createQuery());

    expect(result.data).toEqual([
      {
        vehicleId: 12,
        licensePlate: '51B-123.45',
        status: 'HOAT_DONG',
        busCompany: {
          busCompanyId: 1,
          code: 'FUTA',
          name: 'Phương Trang',
        },
        vehicleType: { vehicleTypeId: 3, name: 'Limousine' },
        createdAt: '2026-09-25T10:00:00.000Z',
        updatedAt: '2026-09-25T11:00:00.000Z',
      },
    ]);
  });

  it('trims search and filters plate, bus company code/name, and vehicle type name', async () => {
    await service.findAll(createQuery({ search: '  Limousine  ' }));

    expect(prisma.xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { bienSoXe: { contains: 'Limousine' } },
            {
              nhaXe: {
                is: {
                  OR: [
                    { maNhaXe: { contains: 'Limousine' } },
                    { tenNhaXe: { contains: 'Limousine' } },
                  ],
                },
              },
            },
            { loaiXe: { is: { tenLoai: { contains: 'Limousine' } } } },
          ],
        },
      }),
    );
  });

  it('does not add a search condition for whitespace-only input', async () => {
    await service.findAll(createQuery({ search: '  \t ' }));

    expect(prisma.xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(prisma.xe.count).toHaveBeenCalledWith({ where: {} });
  });

  it('maps status and relation ID filters to the Xe foreign key fields', async () => {
    await service.findAll(
      createQuery({
        status: 'BAO_TRI',
        busCompanyId: 4,
        vehicleTypeId: 7,
      }),
    );

    expect(prisma.xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trangThai: 'BAO_TRI', nhaXeId: 4, loaiXeId: 7 },
      }),
    );
  });

  it.each([
    ['licensePlate', 'bienSoXe'],
    ['status', 'trangThai'],
    ['createdAt', 'createdAt'],
    ['updatedAt', 'updatedAt'],
  ] as const)('maps %s sorting to Prisma %s', async (sortBy, prismaField) => {
    await service.findAll(createQuery({ sortBy, sortDirection: 'desc' }));

    expect(prisma.xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { [prismaField]: 'desc' } }),
    );
  });

  it('uses shared pagination metadata and performs one relation-selecting list query', async () => {
    const result = await service.findAll(createQuery({ page: 3, pageSize: 7 }));

    expect(prisma.xe.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 14,
        take: 7,
        select: expect.objectContaining({
          nhaXe: { select: { nhaXeId: true, maNhaXe: true, tenNhaXe: true } },
          loaiXe: { select: { loaiXeId: true, tenLoai: true } },
        }),
      }),
    );
    expect(result.meta).toEqual({
      page: 3,
      pageSize: 7,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('maps detail relations and includes the vehicle type description', async () => {
    await expect(service.findOne(12)).resolves.toEqual({
      data: {
        vehicleId: 12,
        licensePlate: '51B-123.45',
        status: 'HOAT_DONG',
        busCompany: {
          busCompanyId: 1,
          code: 'FUTA',
          name: 'Phương Trang',
        },
        vehicleType: {
          vehicleTypeId: 3,
          name: 'Limousine',
          description: 'Xe giường phòng cao cấp',
        },
        createdAt: '2026-09-25T10:00:00.000Z',
        updatedAt: '2026-09-25T11:00:00.000Z',
      },
    });
    expect(prisma.xe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { xeId: 12 },
        select: expect.objectContaining({
          nhaXe: { select: { nhaXeId: true, maNhaXe: true, tenNhaXe: true } },
          loaiXe: {
            select: { loaiXeId: true, tenLoai: true, moTa: true },
          },
        }),
      }),
    );
  });

  it('returns VEHICLE_NOT_FOUND when detail does not exist', async () => {
    vi.mocked(prisma.xe.findUnique).mockResolvedValueOnce(null);

    const error = await service
      .findOne(999999)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    if (!(error instanceof NotFoundException)) {
      throw new Error('Expected a NotFoundException');
    }
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual({
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });
  });
});
