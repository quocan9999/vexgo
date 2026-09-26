import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
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
    create: vi.fn(),
    update: vi.fn(),
  },
  nhaXe: { findUnique: vi.fn() },
  loaiXe: { findUnique: vi.fn() },
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
    vi.mocked(prisma.xe.create).mockResolvedValue(vehicleDetailRecord);
    vi.mocked(prisma.xe.update).mockResolvedValue(vehicleDetailRecord);
    vi.mocked(prisma.nhaXe.findUnique).mockResolvedValue({
      nhaXeId: 1,
    } as never);
    vi.mocked(prisma.loaiXe.findUnique).mockResolvedValue({
      loaiXeId: 3,
    } as never);
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

const createVehicleInput = {
  licensePlate: '51B-123.45',
  busCompanyId: 1,
  vehicleTypeId: 3,
  status: 'HOAT_DONG' as const,
};

const updateVehicleInput = {
  licensePlate: '51B-999.99',
  busCompanyId: 4,
  vehicleTypeId: 7,
};

function prismaKnownError(code: string, meta: Record<string, unknown> = {}) {
  return new Prisma.PrismaClientKnownRequestError('Prisma request failed', {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('VehiclesService writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.xe.findUnique).mockResolvedValue(vehicleDetailRecord);
    vi.mocked(prisma.xe.create).mockResolvedValue(vehicleDetailRecord);
    vi.mocked(prisma.xe.update).mockResolvedValue(vehicleDetailRecord);
    vi.mocked(prisma.nhaXe.findUnique).mockResolvedValue({
      nhaXeId: 1,
    } as never);
    vi.mocked(prisma.loaiXe.findUnique).mockResolvedValue({
      loaiXeId: 3,
    } as never);
  });

  it('creates a vehicle with only its four editable fields and maps the shared response', async () => {
    const result = await service.create(createVehicleInput);

    expect(prisma.xe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bienSoXe: '51B-123.45',
          nhaXeId: 1,
          loaiXeId: 3,
          trangThai: 'HOAT_DONG',
        },
        select: expect.objectContaining({
          nhaXe: expect.any(Object),
          loaiXe: expect.any(Object),
        }),
      }),
    );
    expect(result.data).toMatchObject({
      vehicleId: 12,
      licensePlate: '51B-123.45',
      status: 'HOAT_DONG',
      busCompany: { busCompanyId: 1, code: 'FUTA', name: 'Phương Trang' },
      vehicleType: {
        vehicleTypeId: 3,
        name: 'Limousine',
        description: 'Xe giường phòng cao cấp',
      },
    });
  });

  it('returns BUS_COMPANY_NOT_FOUND before creating when the company is missing', async () => {
    vi.mocked(prisma.nhaXe.findUnique).mockResolvedValueOnce(null);

    const error = await service
      .create(createVehicleInput)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'BUS_COMPANY_NOT_FOUND',
      message: 'Không tìm thấy nhà xe.',
    });
    expect(prisma.xe.create).not.toHaveBeenCalled();
  });

  it('returns VEHICLE_TYPE_NOT_FOUND before creating when the type is missing', async () => {
    vi.mocked(prisma.loaiXe.findUnique).mockResolvedValueOnce(null);

    const error = await service
      .create(createVehicleInput)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
    expect(prisma.xe.create).not.toHaveBeenCalled();
  });

  it('maps a licensePlate P2002 target to VEHICLE_LICENSE_PLATE_EXISTS', async () => {
    vi.mocked(prisma.xe.create).mockRejectedValueOnce(
      prismaKnownError('P2002', { target: ['bienSoXe'] }),
    );

    const error = await service
      .create(createVehicleInput)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      error: 'VEHICLE_LICENSE_PLATE_EXISTS',
      message: 'Biển số xe đã tồn tại.',
    });
  });

  it('maps MariaDB adapter unique-index metadata for the vehicle plate', async () => {
    vi.mocked(prisma.xe.create).mockRejectedValueOnce(
      prismaKnownError('P2002', {
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            constraint: { index: 'Xe_bienSoXe_key' },
          },
        },
      }),
    );

    const error = await service
      .create(createVehicleInput)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
  });

  it('does not map an unrelated P2002 unique constraint to a plate conflict', async () => {
    const prismaError = prismaKnownError('P2002', { target: ['otherField'] });
    vi.mocked(prisma.xe.create).mockRejectedValueOnce(prismaError);

    await expect(service.create(createVehicleInput)).rejects.toBe(prismaError);
  });

  it('returns VEHICLE_NOT_FOUND before checking edit references for a missing vehicle', async () => {
    vi.mocked(prisma.xe.findUnique).mockResolvedValueOnce(null);

    const error = await service
      .update(999, updateVehicleInput)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });
    expect(prisma.nhaXe.findUnique).not.toHaveBeenCalled();
    expect(prisma.xe.update).not.toHaveBeenCalled();
  });

  it('returns BUS_COMPANY_NOT_FOUND when the edit company reference is missing', async () => {
    vi.mocked(prisma.nhaXe.findUnique).mockResolvedValueOnce(null);

    const error = await service
      .update(12, updateVehicleInput)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({
      error: 'BUS_COMPANY_NOT_FOUND',
    });
    expect(prisma.xe.update).not.toHaveBeenCalled();
  });

  it('returns VEHICLE_TYPE_NOT_FOUND when the edit vehicle type is missing', async () => {
    vi.mocked(prisma.loaiXe.findUnique).mockResolvedValueOnce(null);

    const error = await service
      .update(12, updateVehicleInput)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({
      error: 'VEHICLE_TYPE_NOT_FOUND',
    });
    expect(prisma.xe.update).not.toHaveBeenCalled();
  });

  it('updates only plate and relation IDs and accepts an unchanged current plate', async () => {
    const input = { ...updateVehicleInput, licensePlate: '51B-123.45' };
    await service.update(12, input);

    expect(prisma.xe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { xeId: 12 },
        data: {
          bienSoXe: '51B-123.45',
          nhaXeId: 4,
          loaiXeId: 7,
        },
        select: expect.objectContaining({ loaiXe: expect.any(Object) }),
      }),
    );
    expect(
      vi.mocked(prisma.xe.update).mock.calls[0][0].data,
    ).not.toHaveProperty('trangThai');
  });

  it('maps a duplicate plate during edit to VEHICLE_LICENSE_PLATE_EXISTS', async () => {
    vi.mocked(prisma.xe.update).mockRejectedValueOnce(
      prismaKnownError('P2002', { target: 'Xe_bienSoXe_key' }),
    );

    const error = await service
      .update(12, updateVehicleInput)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
  });

  it.each([
    ['HOAT_DONG', 'BAO_TRI'],
    ['BAO_TRI', 'HOAT_DONG'],
    ['HOAT_DONG', 'HOAT_DONG'],
  ] as const)(
    'sets an explicit status target %s → %s',
    async (_current, status) => {
      await service.updateStatus(12, { status });

      expect(prisma.xe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { xeId: 12 },
          data: { trangThai: status },
          select: expect.objectContaining({
            nhaXe: expect.any(Object),
            loaiXe: expect.any(Object),
          }),
        }),
      );
      expect(vi.mocked(prisma.xe.update).mock.calls[0][0].data).toEqual({
        trangThai: status,
      });
    },
  );

  it('maps status update P2025 to VEHICLE_NOT_FOUND', async () => {
    vi.mocked(prisma.xe.update).mockRejectedValueOnce(
      prismaKnownError('P2025'),
    );

    const error = await service
      .updateStatus(999, { status: 'BAO_TRI' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'VEHICLE_NOT_FOUND',
      message: 'Không tìm thấy xe.',
    });
  });
});
