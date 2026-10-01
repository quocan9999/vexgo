import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { RouteQueryDto } from '../../../src/routes/dto/route-query.dto.js';
import { RoutesService } from '../../../src/routes/routes.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

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
  tuyenXe: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
} as unknown as PrismaService;
const service = new RoutesService(prisma);

function tenantAdmin(nhaXeId: number | null): AuthPrincipal {
  return {
    taiKhoanId: 42,
    sessionId: 'test-session',
    roles: ['NHA_XE_ADMIN'],
    permissions: [],
    nhanVienId: 77,
    nhaXeId,
  };
}

function tenantEmployee(
  nhaXeId: number | null,
  roles = ['NHAN_VIEN_CSKH'],
  nhanVienId: number | null = 88,
): AuthPrincipal {
  return {
    taiKhoanId: 43,
    sessionId: 'employee-test-session',
    roles,
    permissions: [],
    nhanVienId,
    nhaXeId,
  };
}

function publicPrincipal(role: 'KHACH_HANG' | 'SUPER_ADMIN'): AuthPrincipal {
  return {
    taiKhoanId: role === 'SUPER_ADMIN' ? 1 : 50,
    sessionId: `${role.toLowerCase()}-test-session`,
    roles: [role],
    permissions: [],
    nhanVienId: null,
    nhaXeId: null,
  };
}

function query(overrides: Partial<RouteQueryDto> = {}) {
  return Object.assign(new RouteQueryDto(), overrides);
}

describe('RoutesService read operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.tuyenXe.findMany).mockResolvedValue([routeRecord]);
    vi.mocked(prisma.tuyenXe.count).mockResolvedValue(1);
    vi.mocked(prisma.tuyenXe.findUnique).mockResolvedValue(routeRecord);
    vi.mocked(prisma.tuyenXe.findFirst).mockResolvedValue(routeRecord);
  });

  it('maps route, company relation, and timestamps without loading trips or prices', async () => {
    const result = await service.findAll(query());
    expect(result.data).toEqual([
      {
        routeId: 17,
        code: 'FUTA-TX-0001',
        origin: 'TP.HCM',
        destination: 'Đà Lạt',
        status: 'HOAT_DONG',
        busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
        createdAt: '2026-09-22T07:34:00.000Z',
        updatedAt: '2026-09-23T07:34:00.000Z',
      },
    ]);
    const select = vi.mocked(prisma.tuyenXe.findMany).mock.calls[0][0]?.select;
    expect(select).toMatchObject({
      nhaXe: { select: { nhaXeId: true, maNhaXe: true, tenNhaXe: true } },
    });
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
    await service.findAll(
      query({ search: '  ', status: 'TAM_NGUNG', busCompanyId: 3 }),
    );
    expect(prisma.tuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trangThai: 'TAM_NGUNG', nhaXeId: 3 },
      }),
    );
  });

  it('adds the trusted tenant ID to both list and count queries for a tenant admin', async () => {
    await service.findAll(query(), tenantAdmin(3));

    expect(prisma.tuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nhaXeId: 3 },
      }),
    );
    expect(prisma.tuyenXe.count).toHaveBeenCalledWith({
      where: { nhaXeId: 3 },
    });
  });

  it('adds the trusted tenant ID to list and count queries for an employee', async () => {
    await service.findAll(query(), tenantEmployee(9));

    expect(prisma.tuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nhaXeId: 9 } }),
    );
    expect(prisma.tuyenXe.count).toHaveBeenCalledWith({
      where: { nhaXeId: 9 },
    });
  });

  it('rejects a tenant admin filter that attempts to select another company', async () => {
    const error = await service
      .findAll(query({ busCompanyId: 4 }), tenantAdmin(3))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      error: 'TENANT_SCOPE_VIOLATION',
    });
    expect(prisma.tuyenXe.findMany).not.toHaveBeenCalled();
    expect(prisma.tuyenXe.count).not.toHaveBeenCalled();
  });

  it('rejects an employee filter for another company before querying', async () => {
    const error = await service
      .findAll(query({ busCompanyId: 4 }), tenantEmployee(3))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      error: 'TENANT_SCOPE_VIOLATION',
    });
    expect(prisma.tuyenXe.findMany).not.toHaveBeenCalled();
    expect(prisma.tuyenXe.count).not.toHaveBeenCalled();
  });

  it('hides a route from another tenant when loading detail', async () => {
    vi.mocked(prisma.tuyenXe.findFirst).mockResolvedValueOnce(null);

    const error = await service
      .findOne(17, tenantAdmin(4))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({
      error: 'ROUTE_NOT_FOUND',
    });
    expect(prisma.tuyenXe.findFirst).toHaveBeenCalledWith({
      where: { tuyenXeId: 17, nhaXeId: 4 },
      select: expect.any(Object),
    });
  });

  it('scopes route detail to an employee tenant', async () => {
    await service.findOne(17, tenantEmployee(9));

    expect(prisma.tuyenXe.findFirst).toHaveBeenCalledWith({
      where: { tuyenXeId: 17, nhaXeId: 9 },
      select: expect.any(Object),
    });
    expect(prisma.tuyenXe.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed when a tenant admin principal has no tenant identity', async () => {
    const error = await service
      .findAll(query(), tenantAdmin(null))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      error: 'TENANT_SCOPE_REQUIRED',
    });
    expect(prisma.tuyenXe.findMany).not.toHaveBeenCalled();
  });

  it('fails closed for a malformed tenant employee before querying', async () => {
    const error = await service
      .findAll(query(), tenantEmployee(3, ['NHAN_VIEN_CSKH', 'KHACH_HANG']))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      error: 'ROLE_SCOPE_CONFLICT',
    });
    expect(prisma.tuyenXe.findMany).not.toHaveBeenCalled();
    expect(prisma.tuyenXe.count).not.toHaveBeenCalled();
  });

  it.each(['KHACH_HANG', 'SUPER_ADMIN'] as const)(
    'preserves global public route listing for %s',
    async (role) => {
      await service.findAll(query(), publicPrincipal(role));

      expect(prisma.tuyenXe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(prisma.tuyenXe.count).toHaveBeenCalledWith({ where: {} });
    },
  );

  it.each([
    ['code', 'maTuyenXe'],
    ['origin', 'diemDi'],
    ['destination', 'diemDen'],
    ['status', 'trangThai'],
    ['createdAt', 'createdAt'],
    ['updatedAt', 'updatedAt'],
  ] as const)('maps %s sorting to %s', async (sortBy, field) => {
    await service.findAll(query({ sortBy, sortDirection: 'desc' }));
    expect(prisma.tuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ [field]: 'desc' }, { tuyenXeId: 'asc' }],
      }),
    );
  });

  it('uses backend pagination and returns empty-list metadata', async () => {
    vi.mocked(prisma.tuyenXe.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.tuyenXe.count).mockResolvedValueOnce(0);
    const result = await service.findAll(query({ page: 3, pageSize: 7 }));
    expect(prisma.tuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 14, take: 7 }),
    );
    expect(result).toEqual({
      data: [],
      meta: { page: 3, pageSize: 7, totalItems: 0, totalPages: 0 },
    });
  });

  it('loads detail by ID with the same English contract', async () => {
    const result = await service.findOne(17);
    expect(result.data.busCompany).toEqual({
      busCompanyId: 3,
      code: 'FUTA',
      name: 'Phương Trang',
    });
    expect(prisma.tuyenXe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tuyenXeId: 17 } }),
    );
  });

  it('returns the domain 404 when a detail is missing', async () => {
    vi.mocked(prisma.tuyenXe.findUnique).mockResolvedValueOnce(null);
    const error = await service.findOne(999).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'ROUTE_NOT_FOUND',
      message: 'Không tìm thấy tuyến xe.',
    });
  });
});
