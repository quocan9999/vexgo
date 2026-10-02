import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { FarePricesService } from '../../../src/fare-prices/fare-prices.service.js';

function createService(records: unknown[]) {
  const prisma = {
    bangGia: { findMany: vi.fn().mockResolvedValue(records) },
  } as unknown as PrismaService;
  const config = {
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;
  return { service: new FarePricesService(prisma, config), prisma };
}

function applicableFare(id: number, price: string) {
  return {
    bangGiaId: id,
    giaNiemYet: new Prisma.Decimal(price),
    tuNgay: new Date('2099-09-01T00:00:00.000Z'),
    denNgay: new Date('2099-09-30T00:00:00.000Z'),
  };
}

describe('FarePricesService trip fare resolution', () => {
  it('resolves the active fare by company, route, vehicle type, and trip date', async () => {
    const { service, prisma } = createService([
      applicableFare(15, '250000.50'),
    ]);

    const result = await service.resolveForTrip({
      nhaXeId: 41,
      routeId: 3,
      vehicleTypeId: 2,
      date: '2099-09-15',
    });

    expect(prisma.bangGia.findMany).toHaveBeenCalledWith({
      where: {
        nhaXeId: 41,
        tuyenXeId: 3,
        loaiXeId: 2,
        trangThai: 'HOAT_DONG',
        tuNgay: { lte: new Date('2099-09-15T00:00:00.000Z') },
        OR: [
          { denNgay: null },
          { denNgay: { gte: new Date('2099-09-15T00:00:00.000Z') } },
        ],
      },
      orderBy: { bangGiaId: 'asc' },
      select: expect.any(Object),
      take: 2,
    });
    expect(result.farePriceId).toBe(15);
    expect(result.listedPrice.toFixed(2)).toBe('250000.50');
  });

  it('does not substitute a fallback when no fare matches the trip date', async () => {
    const { service } = createService([]);

    await expect(
      service.resolveForTrip({
        nhaXeId: 41,
        routeId: 3,
        vehicleTypeId: 2,
        date: '2099-09-15',
      }),
    ).rejects.toMatchObject({
      response: { error: 'APPLICABLE_FARE_NOT_FOUND' },
    });
  });

  it('fails on overlapping active fares instead of choosing one by ID', async () => {
    const { service } = createService([
      applicableFare(15, '250000.00'),
      applicableFare(16, '260000.00'),
    ]);

    await expect(
      service.resolveForTrip({
        nhaXeId: 41,
        routeId: 3,
        vehicleTypeId: 2,
        date: '2099-09-15',
      }),
    ).rejects.toThrow(/FARE_PRICE_INVARIANT_VIOLATION/);
  });
});
