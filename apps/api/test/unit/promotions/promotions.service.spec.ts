import {
  GoneException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { PromotionsService } from '../../../src/promotions/promotions.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('PromotionsService booking validation', () => {
  let service: PromotionsService;
  let prisma: any;

  const activePercentPromotion = () => ({
    khuyenMaiId: 1,
    maKhuyenMai: 'SAVE20',
    nhaXeId: 5,
    phamViApDung: 'DAT_VE',
    hinhThucApDung: 'NHAP_MA',
    loaiGiamGia: 'PHAN_TRAM',
    giaTriGiam: new Prisma.Decimal(20),
    giamToiDa: new Prisma.Decimal(15_000),
    giaTriDonToiThieu: new Prisma.Decimal(50_000),
    tuNgay: new Date('2026-01-01T00:00:00.000Z'),
    denNgay: new Date('2099-12-31T00:00:00.000Z'),
    trangThai: 'HOAT_DONG',
    soLuotToiDa: 2,
    soLuotDaSuDung: 0,
  });

  beforeEach(() => {
    prisma = {
      khuyenMai: { findFirst: vi.fn() },
      suDungKhuyenMai: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    service = new PromotionsService(prisma as unknown as PrismaService);
  });

  it('computes a server-side percentage discount capped by the promotion', async () => {
    prisma.khuyenMai.findFirst.mockResolvedValue(activePercentPromotion());

    const quote = await service.quotePromotion({
      code: ' save20 ',
      nhaXeId: 5,
      ticketOriginalTotal: new Prisma.Decimal(100_000),
      phoneNormalized: '0901234567',
    });

    expect(quote.discountAmount.toFixed(2)).toBe('15000.00');
    expect(quote.code).toBe('SAVE20');
    expect(quote.identityChecked).toBe(true);
    expect(prisma.khuyenMai.findFirst).toHaveBeenCalledWith({
      where: { maKhuyenMai: 'SAVE20', nhaXeId: 5 },
    });
  });

  it('rounds a fixed VND discount to the nearest whole đồng using HALF_UP', async () => {
    prisma.khuyenMai.findFirst.mockResolvedValue({
      ...activePercentPromotion(),
      loaiGiamGia: 'SO_TIEN',
      giaTriGiam: new Prisma.Decimal('30000.50'),
      giamToiDa: null,
      giaTriDonToiThieu: null,
    });

    const quote = await service.quotePromotion({
      code: 'SAVE20',
      nhaXeId: 5,
      ticketOriginalTotal: new Prisma.Decimal(100_000),
    });

    expect(quote.discountAmount.toFixed(2)).toBe('30001.00');
  });

  it('fails closed for a code that does not belong to the trip tenant', async () => {
    prisma.khuyenMai.findFirst.mockResolvedValue(null);

    await expect(
      service.quotePromotion({
        code: 'OTHER-TENANT',
        nhaXeId: 5,
        ticketOriginalTotal: new Prisma.Decimal(100_000),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'PROMOTION_CODE_INVALID' }),
    });
  });

  it('checks both the verified phone and customer identity for a signed-in customer', async () => {
    prisma.khuyenMai.findFirst.mockResolvedValue(activePercentPromotion());
    prisma.suDungKhuyenMai.findFirst.mockResolvedValue({ suDungKhuyenMaiId: 9 });

    await expect(
      service.quotePromotion({
        code: 'SAVE20',
        nhaXeId: 5,
        ticketOriginalTotal: new Prisma.Decimal(100_000),
        khachHangId: 44,
        phoneNormalized: '0901234567',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'PROMOTION_ALREADY_USED' }),
    });
    expect(prisma.suDungKhuyenMai.findFirst).toHaveBeenCalledWith({
      where: {
        khuyenMaiId: 1,
        OR: [
          { soDienThoaiChuanHoa: '0901234567' },
          { khachHangId: 44 },
        ],
      },
      select: { suDungKhuyenMaiId: true },
    });
  });

  it('does not claim guest identity was checked when phone is missing', async () => {
    prisma.khuyenMai.findFirst.mockResolvedValue(activePercentPromotion());

    const quote = await service.quotePromotion({
      code: 'SAVE20',
      nhaXeId: 5,
      ticketOriginalTotal: new Prisma.Decimal(100_000),
    });

    expect(quote.identityChecked).toBe(false);
    expect(prisma.suDungKhuyenMai.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an order below the minimum using original ticket subtotal', async () => {
    prisma.khuyenMai.findFirst.mockResolvedValue(activePercentPromotion());

    await expect(
      service.quotePromotion({
        code: 'SAVE20',
        nhaXeId: 5,
        ticketOriginalTotal: new Prisma.Decimal(49_999),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'PROMOTION_MINIMUM_NOT_MET' }),
    });
  });

  it('rejects a suspended promotion even when its configuration is valid', async () => {
    prisma.khuyenMai.findFirst.mockResolvedValue({
      ...activePercentPromotion(),
      trangThai: 'TAM_NGUNG',
    });

    await expect(
      service.quotePromotion({
        code: 'SAVE20',
        nhaXeId: 5,
        ticketOriginalTotal: new Prisma.Decimal(100_000),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'PROMOTION_UNAVAILABLE' }),
    });
  });

  it('treats the configured end date as inclusive through 23:59:59 Ho Chi Minh time', async () => {
    const promotion = {
      ...activePercentPromotion(),
      tuNgay: new Date('2026-05-11T00:00:00.000Z'),
      denNgay: new Date('2026-05-11T00:00:00.000Z'),
    };
    prisma.khuyenMai.findFirst.mockResolvedValue(promotion);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-05-10T16:59:59.999Z'));
      await expect(
        service.quotePromotion({
          code: 'SAVE20',
          nhaXeId: 5,
          ticketOriginalTotal: new Prisma.Decimal(100_000),
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'PROMOTION_NOT_STARTED' }),
      });

      vi.setSystemTime(new Date('2026-05-11T16:59:59.999Z'));
      const finalSecondQuote = await service.quotePromotion({
        code: 'SAVE20',
        nhaXeId: 5,
        ticketOriginalTotal: new Prisma.Decimal(100_000),
      });
      expect(finalSecondQuote.discountAmount.toFixed(2)).toBe('15000.00');

      vi.setSystemTime(new Date('2026-05-11T17:00:00.000Z'));
      await expect(
        service.quotePromotion({
          code: 'SAVE20',
          nhaXeId: 5,
          ticketOriginalTotal: new Prisma.Decimal(100_000),
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'PROMOTION_EXPIRED' }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('retires the legacy validation method instead of trusting client totals', async () => {
    await expect(
      service.validatePromotion({
        code: 'SAVE20',
        nhaXeId: 5,
        totalAmount: 1,
      }),
    ).rejects.toBeInstanceOf(GoneException);
    expect(prisma.khuyenMai.findFirst).not.toHaveBeenCalled();
  });

  describe('findAvailablePromotions', () => {
    it('returns active promotions with remaining quota for a bus company', async () => {
      prisma.khuyenMai.findMany = vi.fn().mockResolvedValue([
        activePercentPromotion(),
        {
          ...activePercentPromotion(),
          khuyenMaiId: 2,
          maKhuyenMai: 'FIX30K',
          loaiGiamGia: 'SO_TIEN',
          giaTriGiam: new Prisma.Decimal(30_000),
          giamToiDa: null,
          soLuotToiDa: 10,
          soLuotDaSuDung: 2,
        },
        {
          ...activePercentPromotion(),
          khuyenMaiId: 3,
          maKhuyenMai: 'EXHAUSTED',
          soLuotToiDa: 5,
          soLuotDaSuDung: 5, // Exhausted
        },
      ]);

      const result = await service.findAvailablePromotions({ nhaXeId: 5 });
      expect(result.data).toHaveLength(2);
      expect(result.data[0].code).toBe('SAVE20');
      expect(result.data[0].remainingUses).toBe(2);
      expect(result.data[1].code).toBe('FIX30K');
      expect(result.data[1].remainingUses).toBe(8);
    });

    it('resolves nhaXeId from tripId when provided', async () => {
      prisma.chuyenXe = {
        findUnique: vi.fn().mockResolvedValue({ nhaXeId: 5 }),
      };
      prisma.khuyenMai.findMany = vi.fn().mockResolvedValue([activePercentPromotion()]);

      const result = await service.findAvailablePromotions({ tripId: 101 });
      expect(prisma.chuyenXe.findUnique).toHaveBeenCalledWith({
        where: { chuyenXeId: 101 },
        select: { nhaXeId: true },
      });
      expect(result.data).toHaveLength(1);
    });

    it('throws when trip is not found', async () => {
      prisma.chuyenXe = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(
        service.findAvailablePromotions({ tripId: 999 }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'TRIP_NOT_FOUND' }),
      });
    });

    it('throws when neither tripId nor nhaXeId is provided', async () => {
      await expect(
        service.findAvailablePromotions({}),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'VALIDATION_ERROR' }),
      });
    });
  });
});

