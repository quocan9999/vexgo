import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { BusCompaniesService } from '../../../src/bus-companies/bus-companies.service.js';
import { BusCompanyQueryDto } from '../../../src/bus-companies/dto/bus-company-query.dto.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('BusCompaniesService', () => {
  const nhaXe = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  };
  const getConfig = vi.fn().mockReturnValue('Asia/Ho_Chi_Minh');
  const config = { get: getConfig } as unknown as ConfigService;
  const service = new BusCompaniesService({
    nhaXe,
  } as unknown as PrismaService, config);

  beforeEach(() => {
    vi.clearAllMocks();
    getConfig.mockReturnValue('Asia/Ho_Chi_Minh');
    nhaXe.findMany.mockResolvedValue([
      {
        nhaXeId: 1,
        maNhaXe: 'NX001',
        tenNhaXe: 'Nhà xe ABC',
        thongTinLienHe: '0900000000',
        trangThai: 'HOAT_DONG',
        createdAt: new Date('2026-01-02T03:04:05.000Z'),
        updatedAt: new Date('2026-02-03T04:05:06.000Z'),
      },
    ]);
    nhaXe.count.mockResolvedValue(11);
    nhaXe.findUnique.mockResolvedValue(null);
    nhaXe.create.mockResolvedValue({
      nhaXeId: 7,
      maNhaXe: 'NX007',
      tenNhaXe: 'Nhà xe Mới',
      thongTinLienHe: '0900000007',
      trangThai: 'HOAT_DONG',
      createdAt: new Date('2026-03-04T05:06:07.000Z'),
      updatedAt: new Date('2026-03-04T05:06:07.000Z'),
    });
  });

  it('creates a bus company with Prisma field mapping and returns the GET response contract', async () => {
    await expect(
      service.create({
        code: 'NX007',
        name: 'Nhà xe Mới',
        contactInfo: '0900000007',
        status: 'HOAT_DONG',
      }),
    ).resolves.toEqual({
      data: {
        busCompanyId: 7,
        code: 'NX007',
        name: 'Nhà xe Mới',
        contactInfo: '0900000007',
        status: 'HOAT_DONG',
        createdAt: '2026-03-04T05:06:07.000Z',
        updatedAt: '2026-03-04T05:06:07.000Z',
      },
    });

    expect(nhaXe.create).toHaveBeenCalledWith({
      data: {
        maNhaXe: 'NX007',
        tenNhaXe: 'Nhà xe Mới',
        thongTinLienHe: '0900000007',
        trangThai: 'HOAT_DONG',
      },
      select: expect.objectContaining({
        nhaXeId: true,
        maNhaXe: true,
        tenNhaXe: true,
        thongTinLienHe: true,
        trangThai: true,
        createdAt: true,
        updatedAt: true,
      }),
    });
  });

  it('maps the MariaDB adapter maNhaXe P2002 shape to the duplicate-code conflict contract', async () => {
    nhaXe.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate code', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'NhaXe_maNhaXe_key' },
            },
          },
        },
      }),
    );

    let caught: unknown;
    try {
      await service.create({
        code: 'NX007',
        name: 'Nhà xe Mới',
        status: 'HOAT_DONG',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConflictException);
    if (!(caught instanceof ConflictException)) throw caught;
    expect(caught.getStatus()).toBe(409);
    expect(caught.getResponse()).toEqual({
      error: 'BUS_COMPANY_CODE_EXISTS',
      message: 'Mã nhà xe đã tồn tại.',
    });
  });

  it('does not map unrelated P2002 constraints to the bus-company code conflict', async () => {
    const unrelatedUniqueError = new Prisma.PrismaClientKnownRequestError(
      'unrelated unique constraint',
      {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'NhaXe_unrelated_key' },
            },
          },
        },
      },
    );
    nhaXe.create.mockRejectedValueOnce(unrelatedUniqueError);

    await expect(
      service.create({
        code: 'NX007',
        name: 'Nhà xe Mới',
        status: 'HOAT_DONG',
      }),
    ).rejects.toBe(unrelatedUniqueError);
  });

  it('maps the English response and applies search, status, pagination, and safe sorting', async () => {
    const query = Object.assign(new BusCompanyQueryDto(), {
      page: 2,
      pageSize: 5,
      search: '  NX001  ',
      sortBy: 'createdAt',
      sortDirection: 'desc',
      status: 'HOAT_DONG',
    });

    await expect(service.findAll(query)).resolves.toEqual({
      data: [
        {
          busCompanyId: 1,
          code: 'NX001',
          name: 'Nhà xe ABC',
          contactInfo: '0900000000',
          status: 'HOAT_DONG',
          createdAt: '2026-01-02T03:04:05.000Z',
          updatedAt: '2026-02-03T04:05:06.000Z',
        },
      ],
      meta: { page: 2, pageSize: 5, totalItems: 11, totalPages: 3 },
    });

    expect(nhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { maNhaXe: { contains: 'NX001' } },
            { tenNhaXe: { contains: 'NX001' } },
            { thongTinLienHe: { contains: 'NX001' } },
          ],
          trangThai: 'HOAT_DONG',
        },
        skip: 5,
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(nhaXe.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { maNhaXe: { contains: 'NX001' } },
          { tenNhaXe: { contains: 'NX001' } },
          { thongTinLienHe: { contains: 'NX001' } },
        ],
        trangThai: 'HOAT_DONG',
      },
    });
  });

  it('loads and maps a detail record using its database id', async () => {
    nhaXe.findUnique.mockResolvedValue({
      nhaXeId: 42,
      maNhaXe: 'NX042',
      tenNhaXe: 'Nhà xe Chi tiết',
      thongTinLienHe: '0900000042',
      trangThai: 'HOAT_DONG',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      updatedAt: new Date('2026-02-03T04:05:06.000Z'),
    });

    await expect(service.findOne(42)).resolves.toEqual({
      data: {
        busCompanyId: 42,
        code: 'NX042',
        name: 'Nhà xe Chi tiết',
        contactInfo: '0900000042',
        status: 'HOAT_DONG',
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-02-03T04:05:06.000Z',
      },
    });
    expect(nhaXe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nhaXeId: 42 } }),
    );
  });

  it('returns the bus company not found contract when the id has no record', async () => {
    let caught: unknown;
    try {
      await service.findOne(999);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(NotFoundException);
    if (!(caught instanceof NotFoundException)) throw caught;
    expect(caught.getStatus()).toBe(404);
    expect(caught.getResponse()).toEqual({
      error: 'BUS_COMPANY_NOT_FOUND',
      message: 'Không tìm thấy nhà xe.',
    });
    expect(nhaXe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nhaXeId: 999 } }),
    );
  });

  it.each([
    ['name', 'tenNhaXe'],
    ['code', 'maNhaXe'],
    ['status', 'trangThai'],
    ['createdAt', 'createdAt'],
  ] as const)(
    'maps the %s sort key to a fixed Prisma field',
    async (sortBy, field) => {
      await service.findAll(
        Object.assign(new BusCompanyQueryDto(), {
          page: 1,
          pageSize: 10,
          sortBy,
          sortDirection: 'asc',
        }),
      );

      expect(nhaXe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { [field]: 'asc' } }),
      );
    },
  );

  it('filters by business-local dates using a half-open UTC range in both queries', async () => {
    const createdFrom = '2026-01-01';
    const createdTo = '2026-01-31';

    await service.findAll(
      Object.assign(new BusCompanyQueryDto(), {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortDirection: 'asc',
        createdFrom,
        createdTo,
      }),
    );

    const where = {
      createdAt: {
        gte: new Date('2025-12-31T17:00:00.000Z'),
        lt: new Date('2026-01-31T17:00:00.000Z'),
      },
    };
    expect(nhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(nhaXe.count).toHaveBeenCalledWith({ where });
  });

  it('uses the configured business time zone instead of the server time zone', async () => {
    getConfig.mockReturnValue('America/Los_Angeles');

    await service.findAll(
      Object.assign(new BusCompanyQueryDto(), {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortDirection: 'asc',
        createdFrom: '2026-01-01',
      }),
    );

    expect(nhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { gte: new Date('2026-01-01T08:00:00.000Z') } },
      }),
    );
  });

  it('falls back to Asia/Ho_Chi_Minh when the business time zone is not configured', async () => {
    getConfig.mockReturnValue(undefined);

    await service.findAll(
      Object.assign(new BusCompanyQueryDto(), {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortDirection: 'asc',
        createdFrom: '2026-01-01',
      }),
    );

    expect(nhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: { gte: new Date('2025-12-31T17:00:00.000Z') },
        },
      }),
    );
  });

  it('falls back to Asia/Ho_Chi_Minh when the business time zone is empty', async () => {
    getConfig.mockReturnValue('');

    await service.findAll(
      Object.assign(new BusCompanyQueryDto(), {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortDirection: 'asc',
        createdFrom: '2026-01-01',
      }),
    );

    expect(nhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: { gte: new Date('2025-12-31T17:00:00.000Z') },
        },
      }),
    );
  });

  it('uses the canonical paused status as an exact database value', async () => {
    await service.findAll(
      Object.assign(new BusCompanyQueryDto(), {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortDirection: 'asc',
        status: 'TAM_NGUNG',
      }),
    );

    expect(nhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { trangThai: 'TAM_NGUNG' } }),
    );
  });

});
