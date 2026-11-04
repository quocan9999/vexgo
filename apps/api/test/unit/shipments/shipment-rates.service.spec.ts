import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { ShipmentRatesService } from '../../../src/shipments/shipment-rates.service.js';

const principal: AuthPrincipal = {
  taiKhoanId: 7,
  sessionId: 'shipment-rates-session',
  roles: ['NHA_XE_ADMIN'],
  permissions: ['shipment:read', 'shipment:update', 'fare-price:read', 'fare-price:create', 'fare-price:update'],
  nhanVienId: 9,
  nhaXeId: 41,
};

const sampleRateRecord = {
  bangCuocGuiHangId: 21,
  tuyenXeId: 3,
  loaiHangHoaId: 2,
  khoiLuongTu: new Prisma.Decimal('0.00'),
  khoiLuongDen: new Prisma.Decimal('1.00'),
  mucCuoc: new Prisma.Decimal('30000.00'),
  tuNgay: new Date('2026-09-01T00:00:00.000Z'),
  denNgay: null,
  trangThai: 'HOAT_DONG' as const,
  createdAt: new Date('2026-09-01T08:00:00.000Z'),
  updatedAt: new Date('2026-09-02T08:00:00.000Z'),
  tuyenXe: {
    tuyenXeId: 3,
    maTuyenXe: 'SG-DL-01',
    diemDi: 'TP. Hồ Chí Minh',
    diemDen: 'Lâm Đồng',
    nhaXeId: 41,
  },
  loaiHangHoa: {
    loaiHangHoaId: 2,
    tenLoai: 'Hàng nhẹ',
    nhomSucChua: 'HANG_NHE' as const,
  },
};

function createService(transaction: Record<string, unknown>) {
  const prisma = {
    ...transaction,
    $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
      operation(transaction),
    ),
  } as unknown as PrismaService;
  const config = {
    get: vi.fn().mockReturnValue('Asia/Ho_Chi_Minh'),
  } as unknown as ConfigService;
  return { service: new ShipmentRatesService(prisma, config), prisma };
}

describe('ShipmentRatesService', () => {
  it('filters shipment rates by the trusted tenant nhaXeId', async () => {
    const transaction = {
      bangCuocGuiHang: {
        findMany: vi.fn().mockResolvedValue([sampleRateRecord]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const { service } = createService(transaction);

    const result = await service.findAll(
      {
        page: 1,
        pageSize: 10,
        sortBy: 'weightFrom',
        sortDirection: 'asc',
      },
      principal,
    );

    expect(result.meta.totalItems).toBe(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        rateId: 21,
        weightFrom: 0,
        weightTo: 1,
        fee: 30000,
        currency: 'VND',
        status: 'HOAT_DONG',
        route: {
          routeId: 3,
          code: 'SG-DL-01',
          origin: 'TP. Hồ Chí Minh',
          destination: 'Lâm Đồng',
        },
        cargoType: {
          cargoTypeId: 2,
          name: 'Hàng nhẹ',
          capacityGroup: 'HANG_NHE',
        },
      }),
    );
    expect(transaction.bangCuocGuiHang.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tuyenXe: { is: { nhaXeId: 41 } },
        }),
      }),
    );
  });

  it('allows creating a contiguous weight tier (e.g. 1 -> 5kg next to 0 -> 1kg) without overlap error', async () => {
    const newTierRecord = {
      ...sampleRateRecord,
      bangCuocGuiHangId: 22,
      khoiLuongTu: new Prisma.Decimal('1.00'),
      khoiLuongDen: new Prisma.Decimal('5.00'),
      mucCuoc: new Prisma.Decimal('50000.00'),
    };
    const transaction = {
      tuyenXe: {
        findFirst: vi.fn().mockResolvedValue({ tuyenXeId: 3, nhaXeId: 41 }),
      },
      loaiHangHoa: {
        findFirst: vi.fn().mockResolvedValue({
          loaiHangHoaId: 2,
          trangThai: 'HOAT_DONG',
        }),
      },
      bangCuocGuiHang: {
        // Existing active tier is 0 -> 1kg; new tier is 1 -> 5kg (contiguous boundary at 1.00)
        findMany: vi.fn().mockResolvedValue([sampleRateRecord]),
        create: vi.fn().mockResolvedValue(newTierRecord),
      },
    };
    const { service } = createService(transaction);

    const result = await service.create(
      {
        routeId: 3,
        cargoTypeId: 2,
        weightFrom: 1,
        weightTo: 5,
        fee: 50000,
        validFrom: '2026-09-01',
        validTo: null,
        status: 'HOAT_DONG',
      },
      principal,
    );

    expect(result.data.rateId).toBe(22);
    expect(result.data.weightFrom).toBe(1);
    expect(result.data.weightTo).toBe(5);
    expect(result.data.fee).toBe(50000);
  });

  it('rejects creating an overlapping weight tier in the same active date range with 409 SHIPMENT_RATE_OVERLAP', async () => {
    const existingOneToFive = {
      ...sampleRateRecord,
      bangCuocGuiHangId: 22,
      khoiLuongTu: new Prisma.Decimal('1.00'),
      khoiLuongDen: new Prisma.Decimal('5.00'),
    };
    const transaction = {
      tuyenXe: {
        findFirst: vi.fn().mockResolvedValue({ tuyenXeId: 3, nhaXeId: 41 }),
      },
      loaiHangHoa: {
        findFirst: vi.fn().mockResolvedValue({
          loaiHangHoaId: 2,
          trangThai: 'HOAT_DONG',
        }),
      },
      bangCuocGuiHang: {
        findMany: vi.fn().mockResolvedValue([existingOneToFive]),
        create: vi.fn(),
      },
    };
    const { service } = createService(transaction);

    await expect(
      service.create(
        {
          routeId: 3,
          cargoTypeId: 2,
          weightFrom: 3,
          weightTo: 8,
          fee: 65000,
          validFrom: '2026-09-15',
          validTo: null,
          status: 'HOAT_DONG',
        },
        principal,
      ),
    ).rejects.toThrow(ConflictException);
    expect(transaction.bangCuocGuiHang.create).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant rate detail access with 404 SHIPMENT_RATE_NOT_FOUND', async () => {
    const transaction = {
      bangCuocGuiHang: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const { service } = createService(transaction);

    await expect(service.findOne(999, principal)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates shipment rate fee and weight tier within tenant scope', async () => {
    const updatedRecord = {
      ...sampleRateRecord,
      mucCuoc: new Prisma.Decimal('35000.00'),
    };
    const transaction = {
      bangCuocGuiHang: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(sampleRateRecord)
          .mockResolvedValueOnce(updatedRecord),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { service } = createService(transaction);

    const result = await service.update(21, { fee: 35000 }, principal);

    expect(result.data.fee).toBe(35000);
    expect(transaction.bangCuocGuiHang.updateMany).toHaveBeenCalledWith({
      where: {
        bangCuocGuiHangId: 21,
        tuyenXe: { is: { nhaXeId: 41 } },
      },
      data: {
        mucCuoc: new Prisma.Decimal(35000),
      },
    });
  });

  it('checks overlap when activating a paused shipment rate via updateStatus', async () => {
    const pausedRecord = {
      ...sampleRateRecord,
      trangThai: 'TAM_NGUNG' as const,
    };
    const activeRecord = {
      ...sampleRateRecord,
      trangThai: 'HOAT_DONG' as const,
    };
    const transaction = {
      bangCuocGuiHang: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(pausedRecord)
          .mockResolvedValueOnce(activeRecord),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { service } = createService(transaction);

    const result = await service.updateStatus(21, 'HOAT_DONG', principal);

    expect(result.data.status).toBe('HOAT_DONG');
    expect(transaction.bangCuocGuiHang.updateMany).toHaveBeenCalledWith({
      where: {
        bangCuocGuiHangId: 21,
        tuyenXe: { is: { nhaXeId: 41 } },
      },
      data: { trangThai: 'HOAT_DONG' },
    });
  });
});
