import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusCompaniesService } from '../../../src/bus-companies/bus-companies.service.js';
import { BusCompanyQueryDto } from '../../../src/bus-companies/dto/bus-company-query.dto.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('BusCompaniesService', () => {
  const nhaXe = {
    findMany: vi.fn(),
    count: vi.fn(),
  };
  const service = new BusCompaniesService({
    nhaXe,
  } as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    nhaXe.findMany.mockResolvedValue([
      {
        nhaXeId: 1,
        maNhaXe: 'NX001',
        tenNhaXe: 'Nhà xe ABC',
        thongTinLienHe: '0900000000',
        chinhSachDoiHuy: 'Đổi vé trước giờ khởi hành.',
        trangThai: 'HOAT_DONG',
        createdAt: new Date('2026-01-02T03:04:05.000Z'),
        updatedAt: new Date('2026-02-03T04:05:06.000Z'),
      },
    ]);
    nhaXe.count.mockResolvedValue(11);
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
          cancellationPolicy: 'Đổi vé trước giờ khởi hành.',
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

  it('filters by the inclusive creation timestamp range in both queries', async () => {
    const createdFrom = '2026-01-01T00:00:00.000Z';
    const createdTo = '2026-01-31T23:59:59.999Z';

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
        gte: new Date(createdFrom),
        lte: new Date(createdTo),
      },
    };
    expect(nhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(nhaXe.count).toHaveBeenCalledWith({ where });
  });

  it('matches both current and legacy codes for the active status filter', async () => {
    await service.findAll(
      Object.assign(new BusCompanyQueryDto(), {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortDirection: 'asc',
        status: 'ACTIVE',
      }),
    );

    const where = { trangThai: { in: ['ACTIVE', 'HOAT_DONG'] } };
    expect(nhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(nhaXe.count).toHaveBeenCalledWith({ where });
  });
});
