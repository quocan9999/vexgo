import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { RouteQueryDto } from '../../../src/routes/dto/route-query.dto.js';
import { RoutesService } from '../../../src/routes/routes.service.js';

const routeRecord = {
  tuyenXeId: 17,
  nhaXeId: 3,
  maTuyenXe: 'FUTA-TX-0001',
  diemDi: 'TP.HCM',
  diemDen: 'Đà Lạt',
  trangThai: 'HOAT_DONG',
  createdAt: new Date('2026-09-22T07:34:00.000Z'),
  updatedAt: new Date('2026-09-23T07:34:00.000Z'),
  nhaXe: { nhaXeId: 3, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
};

const prisma = {
  tuyenXe: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
} as unknown as PrismaService;
const service = new RoutesService(prisma);

function query(overrides: Partial<RouteQueryDto> = {}) {
  return Object.assign(new RouteQueryDto(), overrides);
}

describe('RoutesService read operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.tuyenXe.findMany).mockResolvedValue([routeRecord]);
    vi.mocked(prisma.tuyenXe.count).mockResolvedValue(1);
    vi.mocked(prisma.tuyenXe.findUnique).mockResolvedValue(routeRecord);
  });

  it('maps route, company relation, and timestamps without loading trips or prices', async () => {
    const result = await service.findAll(query());
    expect(result.data).toEqual([{
      routeId: 17,
      code: 'FUTA-TX-0001',
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      status: 'HOAT_DONG',
      busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
      createdAt: '2026-09-22T07:34:00.000Z',
      updatedAt: '2026-09-23T07:34:00.000Z',
    }]);
    const select = vi.mocked(prisma.tuyenXe.findMany).mock.calls[0][0]?.select;
    expect(select).toMatchObject({ nhaXe: { select: { nhaXeId: true, maNhaXe: true, tenNhaXe: true } } });
    expect(select).not.toHaveProperty('chuyenXes');
    expect(select).not.toHaveProperty('bangGias');
    expect(prisma.tuyenXe.findMany).toHaveBeenCalledTimes(1);
  });

  it('trims search and matches route fields and both company fields', async () => {
    await service.findAll(query({ search: '  FUTA  ' }));
    const where = vi.mocked(prisma.tuyenXe.findMany).mock.calls[0][0]?.where;
    expect(where?.OR).toEqual([
      { maTuyenXe: { contains: 'FUTA' } },
      { diemDi: { contains: 'FUTA' } },
      { diemDen: { contains: 'FUTA' } },
      { nhaXe: { is: { maNhaXe: { contains: 'FUTA' } } } },
      { nhaXe: { is: { tenNhaXe: { contains: 'FUTA' } } } },
    ]);
    expect(prisma.tuyenXe.count).toHaveBeenCalledWith({ where });
  });

  it('treats whitespace search as absent and combines exact filters', async () => {
    await service.findAll(query({ search: '  ', status: 'TAM_NGUNG', busCompanyId: 3 }));
    expect(prisma.tuyenXe.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { trangThai: 'TAM_NGUNG', nhaXeId: 3 },
    }));
  });

  it.each([
    ['code', 'maTuyenXe'], ['origin', 'diemDi'], ['destination', 'diemDen'],
    ['status', 'trangThai'], ['createdAt', 'createdAt'], ['updatedAt', 'updatedAt'],
  ] as const)('maps %s sorting to %s', async (sortBy, field) => {
    await service.findAll(query({ sortBy, sortDirection: 'desc' }));
    expect(prisma.tuyenXe.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { [field]: 'desc' },
    }));
  });

  it('uses backend pagination and returns empty-list metadata', async () => {
    vi.mocked(prisma.tuyenXe.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.tuyenXe.count).mockResolvedValueOnce(0);
    const result = await service.findAll(query({ page: 3, pageSize: 7 }));
    expect(prisma.tuyenXe.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 14, take: 7 }));
    expect(result).toEqual({ data: [], meta: { page: 3, pageSize: 7, totalItems: 0, totalPages: 0 } });
  });

  it('loads detail by ID with the same English contract', async () => {
    const result = await service.findOne(17);
    expect(result.data.busCompany).toEqual({ busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' });
    expect(prisma.tuyenXe.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tuyenXeId: 17 } }));
  });

  it('returns the domain 404 when a detail is missing', async () => {
    vi.mocked(prisma.tuyenXe.findUnique).mockResolvedValueOnce(null);
    const error = await service.findOne(999).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'ROUTE_NOT_FOUND', message: 'Không tìm thấy tuyến xe.',
    });
  });
});
