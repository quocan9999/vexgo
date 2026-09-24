import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { VehiclesService } from '../../../src/vehicles/vehicles.service.js';
import { VehicleQueryDto } from '../../../src/vehicles/dto/vehicle-query.dto.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('VehiclesService', () => {
  const xe = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const nhaXe = { findUnique: vi.fn() };
  const loaiXe = { findUnique: vi.fn() };
  const service = new VehiclesService({
    xe,
    nhaXe,
    loaiXe,
  } as unknown as PrismaService);
  const vehicleRecord = {
    xeId: 12,
    bienSoXe: '51B-123.45',
    trangThai: 'HOAT_DONG',
    nhaXeId: 1,
    loaiXeId: 3,
    createdAt: new Date('2026-09-25T10:00:00.000Z'),
    updatedAt: new Date('2026-09-25T11:00:00.000Z'),
    nhaXe: { nhaXeId: 1, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
    loaiXe: {
      loaiXeId: 3,
      tenLoai: 'Limousine',
      moTa: 'Xe giường phòng cao cấp',
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    xe.findMany.mockResolvedValue([vehicleRecord]);
    xe.count.mockResolvedValue(1);
    xe.findUnique.mockResolvedValue(vehicleRecord);
    xe.create.mockResolvedValue(vehicleRecord);
    xe.update.mockResolvedValue(vehicleRecord);
    nhaXe.findUnique.mockResolvedValue({ nhaXeId: 1 });
    loaiXe.findUnique.mockResolvedValue({ loaiXeId: 3 });
  });

  it('maps Xe and its selected relations to the paginated API contract without N+1 reads', async () => {
    await expect(service.findAll(new VehicleQueryDto())).resolves.toEqual({
      data: [
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
      ],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    expect(xe.findMany).toHaveBeenCalledTimes(1);
    expect(xe.count).toHaveBeenCalledTimes(1);
    expect(xe.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { bienSoXe: 'asc' },
      skip: 0,
      take: 10,
      select: {
        xeId: true,
        bienSoXe: true,
        trangThai: true,
        createdAt: true,
        updatedAt: true,
        nhaXe: {
          select: { nhaXeId: true, maNhaXe: true, tenNhaXe: true },
        },
        loaiXe: { select: { loaiXeId: true, tenLoai: true } },
      },
    });
  });

  it('trims search and searches plate, bus company code/name, and vehicle type name', async () => {
    await service.findAll(
      Object.assign(new VehicleQueryDto(), { search: '  FUTA  ' }),
    );

    const where = {
      OR: [
        { bienSoXe: { contains: 'FUTA' } },
        { nhaXe: { maNhaXe: { contains: 'FUTA' } } },
        { nhaXe: { tenNhaXe: { contains: 'FUTA' } } },
        { loaiXe: { tenLoai: { contains: 'FUTA' } } },
      ],
    };
    expect(xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(xe.count).toHaveBeenCalledWith({ where });
  });

  it('treats whitespace-only search as no search condition', async () => {
    await service.findAll(
      Object.assign(new VehicleQueryDto(), { search: '  \t ' }),
    );

    expect(xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(xe.count).toHaveBeenCalledWith({ where: {} });
  });

  it.each([
    ['busCompanyId', { busCompanyId: 7 }, { nhaXeId: 7 }],
    ['vehicleTypeId', { vehicleTypeId: 9 }, { loaiXeId: 9 }],
    ['status', { status: 'BAO_TRI' }, { trangThai: 'BAO_TRI' }],
  ] as const)(
    'maps the %s filter to its Xe field',
    async (_name, input, where) => {
      await service.findAll(Object.assign(new VehicleQueryDto(), input));

      expect(xe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      expect(xe.count).toHaveBeenCalledWith({ where });
    },
  );

  it('combines search and all filters in one backend where clause', async () => {
    await service.findAll(
      Object.assign(new VehicleQueryDto(), {
        search: ' Bus ',
        status: 'HOAT_DONG',
        busCompanyId: 4,
        vehicleTypeId: 8,
      }),
    );

    const where = {
      OR: [
        { bienSoXe: { contains: 'Bus' } },
        { nhaXe: { maNhaXe: { contains: 'Bus' } } },
        { nhaXe: { tenNhaXe: { contains: 'Bus' } } },
        { loaiXe: { tenLoai: { contains: 'Bus' } } },
      ],
      trangThai: 'HOAT_DONG',
      nhaXeId: 4,
      loaiXeId: 8,
    };
    expect(xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(xe.count).toHaveBeenCalledWith({ where });
  });

  it.each([
    ['licensePlate', 'bienSoXe'],
    ['status', 'trangThai'],
    ['createdAt', 'createdAt'],
    ['updatedAt', 'updatedAt'],
  ] as const)(
    'maps sort key %s to the whitelisted Prisma field',
    async (sortBy, field) => {
      await service.findAll(
        Object.assign(new VehicleQueryDto(), {
          sortBy,
          sortDirection: 'desc',
        }),
      );

      expect(xe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { [field]: 'desc' } }),
      );
    },
  );

  it('uses backend pagination offsets and count metadata', async () => {
    xe.count.mockResolvedValueOnce(23);
    const query = Object.assign(new VehicleQueryDto(), {
      page: 3,
      pageSize: 5,
    });

    await expect(service.findAll(query)).resolves.toMatchObject({
      meta: { page: 3, pageSize: 5, totalItems: 23, totalPages: 5 },
    });
    expect(xe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });

  it('maps detail relations including vehicle type description in one query', async () => {
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
    expect(xe.findUnique).toHaveBeenCalledTimes(1);
    expect(xe.findUnique).toHaveBeenCalledWith({
      where: { xeId: 12 },
      select: {
        xeId: true,
        bienSoXe: true,
        trangThai: true,
        createdAt: true,
        updatedAt: true,
        nhaXe: {
          select: { nhaXeId: true, maNhaXe: true, tenNhaXe: true },
        },
        loaiXe: { select: { loaiXeId: true, tenLoai: true, moTa: true } },
      },
    });
  });

  it('maps missing detail to the VEHICLE_NOT_FOUND contract', async () => {
    xe.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne(999999)).rejects.toMatchObject({
      status: 404,
      response: {
        error: 'VEHICLE_NOT_FOUND',
        message: 'Không tìm thấy xe.',
      },
    });
  });

  it('creates a vehicle with only the four editable database fields and returns full relations', async () => {
    const input = {
      licensePlate: '51B-456.78',
      busCompanyId: 1,
      vehicleTypeId: 3,
      status: 'HOAT_DONG' as const,
    };

    await expect(service.create(input)).resolves.toEqual({
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

    expect(nhaXe.findUnique).toHaveBeenCalledWith({
      where: { nhaXeId: 1 },
      select: { nhaXeId: true },
    });
    expect(loaiXe.findUnique).toHaveBeenCalledWith({
      where: { loaiXeId: 3 },
      select: { loaiXeId: true },
    });
    expect(xe.create).toHaveBeenCalledWith({
      data: {
        bienSoXe: '51B-456.78',
        nhaXeId: 1,
        loaiXeId: 3,
        trangThai: 'HOAT_DONG',
      },
      select: expect.any(Object),
    });
  });

  it.each([
    [
      'bus company',
      { nhaXeId: 9 },
      { loaiXeId: 3 },
      'BUS_COMPANY_NOT_FOUND',
      'Không tìm thấy nhà xe.',
    ],
    [
      'vehicle type',
      { nhaXeId: 1 },
      { loaiXeId: 9 },
      'VEHICLE_TYPE_NOT_FOUND',
      'Không tìm thấy loại xe.',
    ],
  ])(
    'rejects vehicle creation when the %s reference does not exist',
    async (_name, companyResult, typeResult, error, message) => {
      nhaXe.findUnique.mockResolvedValueOnce(
        companyResult.nhaXeId === 9 ? null : companyResult,
      );
      loaiXe.findUnique.mockResolvedValueOnce(
        typeResult.loaiXeId === 9 ? null : typeResult,
      );

      await expect(
        service.create({
          licensePlate: '51B-456.78',
          busCompanyId: companyResult.nhaXeId,
          vehicleTypeId: typeResult.loaiXeId,
          status: 'HOAT_DONG',
        }),
      ).rejects.toMatchObject({
        status: 404,
        response: { error, message },
      });
      expect(xe.create).not.toHaveBeenCalled();
    },
  );

  it('maps the MariaDB adapter Xe.bienSoXe P2002 shape to the duplicate-plate conflict', async () => {
    xe.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate plate', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            name: 'DriverAdapterError',
            cause: {
              originalCode: '1062',
              originalMessage: "Duplicate entry for key 'Xe.Xe_bienSoXe_key'",
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'Xe_bienSoXe_key' },
              table: 'Xe',
            },
          },
          modelName: 'Xe',
        },
      }),
    );

    await expect(
      service.create({
        licensePlate: '51B-456.78',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'VEHICLE_LICENSE_PLATE_EXISTS',
        message: 'Biển số xe đã tồn tại.',
      },
    });
  });

  it('does not map unrelated P2002 errors to duplicate vehicle plates', async () => {
    const unrelatedError = new Prisma.PrismaClientKnownRequestError(
      'unrelated unique constraint',
      {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: { modelName: 'Xe', target: ['otherField'] },
      },
    );
    xe.create.mockRejectedValueOnce(unrelatedError);

    await expect(
      service.create({
        licensePlate: '51B-456.78',
        busCompanyId: 1,
        vehicleTypeId: 3,
        status: 'HOAT_DONG',
      }),
    ).rejects.toBe(unrelatedError);
  });

  it('updates only plate and foreign keys, leaving status unchanged', async () => {
    const updatedVehicle = {
      ...vehicleRecord,
      bienSoXe: '51B-999.99',
      nhaXeId: 4,
      loaiXeId: 8,
      nhaXe: { nhaXeId: 4, maNhaXe: 'TB', tenNhaXe: 'Thành Bưởi' },
      loaiXe: {
        loaiXeId: 8,
        tenLoai: 'Giường nằm',
        moTa: 'Xe giường nằm',
      },
    };
    xe.update.mockResolvedValueOnce(updatedVehicle);

    await expect(
      service.update(12, {
        licensePlate: '51B-999.99',
        busCompanyId: 4,
        vehicleTypeId: 8,
      }),
    ).resolves.toMatchObject({
      data: {
        licensePlate: '51B-999.99',
        status: 'HOAT_DONG',
        busCompany: { busCompanyId: 4, code: 'TB', name: 'Thành Bưởi' },
        vehicleType: {
          vehicleTypeId: 8,
          name: 'Giường nằm',
          description: 'Xe giường nằm',
        },
      },
    });

    expect(xe.update).toHaveBeenCalledWith({
      where: { xeId: 12 },
      data: {
        bienSoXe: '51B-999.99',
        nhaXeId: 4,
        loaiXeId: 8,
      },
      select: expect.any(Object),
    });
    expect(xe.update.mock.calls[0][0].data).not.toHaveProperty('trangThai');
  });

  it('allows editing while keeping the current plate', async () => {
    await expect(
      service.update(12, {
        licensePlate: vehicleRecord.bienSoXe,
        busCompanyId: 1,
        vehicleTypeId: 3,
      }),
    ).resolves.toMatchObject({ data: { licensePlate: '51B-123.45' } });
    expect(xe.update).toHaveBeenCalledTimes(1);
  });

  it('maps an edit duplicate-plate P2002 to the duplicate-plate conflict', async () => {
    xe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate plate', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'Xe_bienSoXe_key' },
            },
          },
          modelName: 'Xe',
        },
      }),
    );

    await expect(
      service.update(12, {
        licensePlate: '51B-999.99',
        busCompanyId: 1,
        vehicleTypeId: 3,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { error: 'VEHICLE_LICENSE_PLATE_EXISTS' },
    });
  });

  it('returns the vehicle not found contract before checking edit references', async () => {
    xe.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.update(999999, {
        licensePlate: '51B-999.99',
        busCompanyId: 1,
        vehicleTypeId: 3,
      }),
    ).rejects.toMatchObject({
      status: 404,
      response: { error: 'VEHICLE_NOT_FOUND', message: 'Không tìm thấy xe.' },
    });
    expect(nhaXe.findUnique).not.toHaveBeenCalled();
    expect(loaiXe.findUnique).not.toHaveBeenCalled();
    expect(xe.update).not.toHaveBeenCalled();
  });

  it.each([
    ['HOAT_DONG', 'BAO_TRI'],
    ['BAO_TRI', 'HOAT_DONG'],
    ['HOAT_DONG', 'HOAT_DONG'],
  ] as const)(
    'updates vehicle status from %s to target %s using only trangThai',
    async (_currentStatus, status) => {
      xe.update.mockResolvedValueOnce({ ...vehicleRecord, trangThai: status });

      await expect(service.updateStatus(12, { status })).resolves.toMatchObject(
        {
          data: { status },
        },
      );
      expect(xe.update).toHaveBeenCalledWith({
        where: { xeId: 12 },
        data: { trangThai: status },
        select: expect.any(Object),
      });
      expect(xe.update.mock.calls[0][0].data).toEqual({ trangThai: status });
    },
  );

  it('maps P2025 from status update to VEHICLE_NOT_FOUND', async () => {
    xe.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('record not found', {
        code: 'P2025',
        clientVersion: '7.10.0',
      }),
    );

    await expect(
      service.updateStatus(999999, { status: 'BAO_TRI' }),
    ).rejects.toMatchObject({
      status: 404,
      response: { error: 'VEHICLE_NOT_FOUND', message: 'Không tìm thấy xe.' },
    });
  });
});
