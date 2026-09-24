import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VehiclesService } from '../../../src/vehicles/vehicles.service.js';
import { VehicleQueryDto } from '../../../src/vehicles/dto/vehicle-query.dto.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('VehiclesService', () => {
  const xe = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  };
  const service = new VehiclesService({ xe } as unknown as PrismaService);
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
});
