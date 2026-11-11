import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { FarePricesService } from '../../../src/fare-prices/fare-prices.service.js';

const principal: AuthPrincipal = {
  taiKhoanId: 7,
  sessionId: 'fare-price-service-session',
  roles: ['NHA_XE_ADMIN'],
  permissions: [],
  nhanVienId: 9,
  nhaXeId: 41,
};

const employeePrincipal: AuthPrincipal = {
  ...principal,
  roles: ['NHAN_VIEN_CSKH'],
};

const currentFare = {
  bangGiaId: 15,
  giaNiemYet: new Prisma.Decimal(250000),
  tuNgay: new Date('2099-09-01T00:00:00.000Z'),
  denNgay: new Date('2099-09-30T00:00:00.000Z'),
  trangThai: 'TAM_NGUNG',
  tuyenXeId: 3,
  loaiXeId: 2,
  createdAt: new Date('2026-09-01T08:30:00.000Z'),
  updatedAt: new Date('2026-09-02T08:30:00.000Z'),
  tuyenXe: {
    tuyenXeId: 3,
    maTuyenXe: 'SG-DL-01',
    diemDi: 'TP.HCM',
    diemDen: 'Đà Lạt',
  },
  loaiXe: { loaiXeId: 2, tenLoai: 'Limousine' },
};

function createService(transaction: Record<string, unknown>) {
  const prisma = {
    ...transaction,
    $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
      operation(transaction),
    ),
  } as unknown as PrismaService;
  const config = { get: vi.fn().mockReturnValue(undefined) } as unknown as ConfigService;
  return { service: new FarePricesService(prisma, config), prisma };
}

describe('FarePricesService tenant-safe writes', () => {
  it('filters fare-price lists by the employee principal tenant', async () => {
    const transaction = {
      bangGia: {
        findMany: vi.fn().mockResolvedValue([currentFare]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const { service } = createService(transaction);

    const result = await service.findAll({
      page: 1,
      pageSize: 10,
      sortBy: 'validFrom',
      sortDirection: 'desc',
    }, employeePrincipal);

    expect(result.meta.totalItems).toBe(1);
    expect(transaction.bangGia.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { nhaXeId: 41 },
    }));
    expect(transaction.bangGia.count).toHaveBeenCalledWith({ where: { nhaXeId: 41 } });
  });

  it('scopes employee fare-price detail reads to the trusted tenant', async () => {
    const transaction = {
      bangGia: { findFirst: vi.fn().mockResolvedValue(currentFare) },
    };
    const { service } = createService(transaction);

    const result = await service.findOne(15, employeePrincipal);

    expect(result.data.farePriceId).toBe(15);
    expect(transaction.bangGia.findFirst).toHaveBeenCalledWith({
      where: { bangGiaId: 15, nhaXeId: 41 },
      select: expect.any(Object),
    });
  });

  it('creates employee fare prices with the trusted tenant and same-tenant relations', async () => {
    const transaction = {
      tuyenXe: {
        findFirst: vi.fn().mockResolvedValue({ tuyenXeId: 3, nhaXeId: 41 }),
      },
      loaiXe: {
        findFirst: vi.fn().mockResolvedValue({ loaiXeId: 2, nhaXeId: 41 }),
      },
      bangGia: { create: vi.fn().mockResolvedValue(currentFare) },
    };
    const { service } = createService(transaction);

    const result = await service.create({
      listedPrice: 250000,
      validFrom: '2099-09-01',
      validTo: '2099-09-30',
      status: 'TAM_NGUNG',
      routeId: 3,
      vehicleTypeId: 2,
    }, employeePrincipal);

    expect(result.data.farePriceId).toBe(15);
    expect(transaction.tuyenXe.findFirst).toHaveBeenCalledWith({
      where: { tuyenXeId: 3, nhaXeId: 41 },
      select: { tuyenXeId: true, nhaXeId: true },
    });
    expect(transaction.loaiXe.findFirst).toHaveBeenCalledWith({
      where: { loaiXeId: 2, nhaXeId: 41 },
      select: { loaiXeId: true, nhaXeId: true },
    });
    expect(transaction.bangGia.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nhaXeId: 41,
        tuyenXeId: 3,
        loaiXeId: 2,
      }),
      select: expect.any(Object),
    }));
  });

  it('keeps both fare ID and trusted tenant in the final update predicate', async () => {
    const updatedFare = {
      ...currentFare,
      giaNiemYet: new Prisma.Decimal(275000),
    };
    const transaction = {
      bangGia: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(currentFare)
          .mockResolvedValueOnce(updatedFare),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { service } = createService(transaction);

    const result = await service.update(15, { listedPrice: 275000 }, principal);

    expect(result.data.listedPrice).toBe(275000);
    expect(transaction.bangGia.updateMany).toHaveBeenCalledWith({
      where: { bangGiaId: 15, nhaXeId: 41 },
      data: { giaNiemYet: new Prisma.Decimal(275000) },
    });
    expect(transaction.bangGia.findFirst).toHaveBeenNthCalledWith(1, {
      where: { bangGiaId: 15, nhaXeId: 41 },
      select: expect.any(Object),
    });
  });

  it('keeps both fare ID and trusted tenant in the final status predicate', async () => {
    const activeFare = { ...currentFare, trangThai: 'HOAT_DONG' };
    const updatedFare = { ...currentFare, trangThai: 'TAM_NGUNG' };
    const transaction = {
      bangGia: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(activeFare)
          .mockResolvedValueOnce(updatedFare),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { service } = createService(transaction);

    const result = await service.updateStatus(15, 'TAM_NGUNG', principal);

    expect(result.data.status).toBe('TAM_NGUNG');
    expect(transaction.bangGia.updateMany).toHaveBeenCalledWith({
      where: { bangGiaId: 15, nhaXeId: 41 },
      data: { trangThai: 'TAM_NGUNG' },
    });
  });

  it('updates an employee fare only through the trusted tenant predicate', async () => {
    const updatedFare = {
      ...currentFare,
      giaNiemYet: new Prisma.Decimal(275000),
    };
    const transaction = {
      bangGia: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(currentFare)
          .mockResolvedValueOnce(updatedFare),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { service } = createService(transaction);

    const result = await service.update(15, { listedPrice: 275000 }, employeePrincipal);

    expect(result.data.listedPrice).toBe(275000);
    expect(transaction.bangGia.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { bangGiaId: 15, nhaXeId: 41 },
    }));
  });

  it('updates employee fare status only through the trusted tenant predicate', async () => {
    const activeFare = { ...currentFare, trangThai: 'HOAT_DONG' };
    const suspendedFare = { ...currentFare, trangThai: 'TAM_NGUNG' };
    const transaction = {
      bangGia: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(activeFare)
          .mockResolvedValueOnce(suspendedFare),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { service } = createService(transaction);

    const result = await service.updateStatus(15, 'TAM_NGUNG', employeePrincipal);

    expect(result.data.status).toBe('TAM_NGUNG');
    expect(transaction.bangGia.updateMany).toHaveBeenCalledWith({
      where: { bangGiaId: 15, nhaXeId: 41 },
      data: { trangThai: 'TAM_NGUNG' },
    });
  });

  it('resolves applicable employee fares only for tenant-owned route and type', async () => {
    const applicableFare = {
      bangGiaId: 15,
      giaNiemYet: new Prisma.Decimal(250000),
      tuNgay: new Date('2099-09-01T00:00:00.000Z'),
      denNgay: new Date('2099-09-30T00:00:00.000Z'),
    };
    const transaction = {
      tuyenXe: {
        findFirst: vi.fn().mockResolvedValue({ tuyenXeId: 3, nhaXeId: 41 }),
      },
      loaiXe: {
        findFirst: vi.fn().mockResolvedValue({ loaiXeId: 2, nhaXeId: 41 }),
      },
      bangGia: { findMany: vi.fn().mockResolvedValue([applicableFare]) },
    };
    const { service } = createService(transaction);

    const result = await service.resolveApplicableFare({
      routeId: 3,
      vehicleTypeId: 2,
      date: '2099-09-15',
    }, employeePrincipal);

    expect(result.data.listedPrice).toBe(250000);
    expect(transaction.bangGia.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        nhaXeId: 41,
        tuyenXeId: 3,
        loaiXeId: 2,
      }),
    }));
  });

  it('fails before opening a database transaction if trusted tenant scope is absent', async () => {
    const transaction = { bangGia: { findMany: vi.fn() } };
    const { service, prisma } = createService(transaction);

    await expect(service.findAll({
      page: 1,
      pageSize: 10,
      sortBy: 'validFrom',
      sortDirection: 'desc',
    }, { ...principal, nhaXeId: null })).rejects.toMatchObject({
      response: {
        error: 'TENANT_SCOPE_REQUIRED',
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.bangGia.findMany).not.toHaveBeenCalled();
  });
});
