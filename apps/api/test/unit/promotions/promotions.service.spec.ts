import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { PromotionsService } from '../../../src/promotions/promotions.service.js';

const promotion = {
  khuyenMaiId: 41,
  nhaXeId: 7,
  maKhuyenMai: 'TRIP20',
  tenChuongTrinh: 'Giảm vé 20%',
  phamViApDung: 'DAT_VE',
  hinhThucApDung: 'NHAP_MA',
  loaiGiamGia: 'PHAN_TRAM',
  giaTriGiam: new Prisma.Decimal('20'),
  giamToiDa: new Prisma.Decimal('50000'),
  giaTriDonToiThieu: null as Prisma.Decimal | null,
  dieuKienApDung: null as string | null,
  tuNgay: new Date('2026-10-01T00:00:00.000Z'),
  denNgay: null as Date | null,
  trangThai: 'DANG_HOAT_DONG',
};

function createService() {
  const prisma = {
    khuyenMai: { findMany: vi.fn() },
  };
  const config = { get: vi.fn(() => 'Asia/Ho_Chi_Minh') };
  return {
    prisma,
    service: new PromotionsService(
      prisma as never,
      config as unknown as ConfigService,
    ),
  };
}

describe('PromotionsService booking resolution', () => {
  let prisma: ReturnType<typeof createService>['prisma'];
  let service: PromotionsService;

  beforeEach(() => {
    ({ prisma, service } = createService());
  });

  it('resolves an active booking code and applies its decimal cap', async () => {
    prisma.khuyenMai.findMany.mockResolvedValue([promotion]);

    const result = await service.resolveBookingPromotion({
      nhaXeId: 7,
      subtotal: new Prisma.Decimal('500000.00'),
      businessDate: '2026-10-02',
      promotionCode: 'trip20',
    });

    expect(prisma.khuyenMai.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nhaXeId: 7,
          trangThai: 'DANG_HOAT_DONG',
          phamViApDung: { in: ['DAT_VE', 'CA_HAI'] },
          hinhThucApDung: 'NHAP_MA',
          maKhuyenMai: 'TRIP20',
          tuNgay: { lte: new Date('2026-10-02T00:00:00.000Z') },
          OR: [
            { denNgay: null },
            { denNgay: { gte: new Date('2026-10-02T00:00:00.000Z') } },
          ],
        }),
      }),
    );
    expect(result.discountAmount.toFixed(2)).toBe('50000.00');
    expect(result.totalAmount.toFixed(2)).toBe('450000.00');
    expect(result.promotionId).toBe(41);
  });

  it('computes percentage and fixed discounts without floating point', async () => {
    prisma.khuyenMai.findMany.mockResolvedValue([
      { ...promotion, giamToiDa: null, giaTriGiam: new Prisma.Decimal('12.5') },
    ]);
    const percentage = await service.resolveBookingPromotion({
      nhaXeId: 7,
      subtotal: new Prisma.Decimal('100000.00'),
      businessDate: '2026-10-02',
      promotionCode: 'TRIP20',
    });
    expect(percentage.discountAmount.toFixed(2)).toBe('12500.00');

    prisma.khuyenMai.findMany.mockResolvedValue([
      {
        ...promotion,
        loaiGiamGia: 'SO_TIEN',
        giaTriGiam: new Prisma.Decimal('25000.50'),
        giamToiDa: null,
      },
    ]);
    const fixed = await service.resolveBookingPromotion({
      nhaXeId: 7,
      subtotal: new Prisma.Decimal('100000.00'),
      businessDate: '2026-10-02',
      promotionCode: 'TRIP20',
    });
    expect(fixed.discountAmount.toFixed(2)).toBe('25000.50');
    expect(fixed.totalAmount.toFixed(2)).toBe('74999.50');
  });

  it('rejects a code with an unstructured condition rather than ignoring it', async () => {
    prisma.khuyenMai.findMany.mockResolvedValue([
      { ...promotion, dieuKienApDung: 'Chỉ áp dụng cho khách hàng mới.' },
    ]);

    await expect(
      service.resolveBookingPromotion({
        nhaXeId: 7,
        subtotal: new Prisma.Decimal('500000.00'),
        businessDate: '2026-10-02',
        promotionCode: 'TRIP20',
      }),
    ).rejects.toMatchObject({
      response: { error: 'PROMOTION_CONDITION_UNSUPPORTED' },
    });
  });

  it('rejects a manual code when the minimum order is not met', async () => {
    prisma.khuyenMai.findMany.mockResolvedValue([
      { ...promotion, giaTriDonToiThieu: new Prisma.Decimal('100000.01') },
    ]);

    await expect(
      service.resolveBookingPromotion({
        nhaXeId: 7,
        subtotal: new Prisma.Decimal('100000.00'),
        businessDate: '2026-10-02',
        promotionCode: 'TRIP20',
      }),
    ).rejects.toMatchObject({
      response: { error: 'PROMOTION_MINIMUM_NOT_MET' },
    });
  });

  it('ignores ineligible automatic promotions and applies one eligible rule', async () => {
    prisma.khuyenMai.findMany.mockResolvedValue([
      { ...promotion, hinhThucApDung: 'TU_DONG', maKhuyenMai: null },
    ]);
    const result = await service.resolveBookingPromotion({
      nhaXeId: 7,
      subtotal: new Prisma.Decimal('100000.00'),
      businessDate: '2026-10-02',
    });
    expect(result.discountAmount.toFixed(2)).toBe('20000.00');

    prisma.khuyenMai.findMany.mockResolvedValue([]);
    const noPromotion = await service.resolveBookingPromotion({
      nhaXeId: 7,
      subtotal: new Prisma.Decimal('100000.00'),
      businessDate: '2026-10-02',
    });
    expect(noPromotion.promotionId).toBeNull();
    expect(noPromotion.discountAmount.toFixed(2)).toBe('0.00');
  });

  it('rejects multiple eligible automatic promotions without an ordering rule', async () => {
    prisma.khuyenMai.findMany.mockResolvedValue([
      { ...promotion, hinhThucApDung: 'TU_DONG', maKhuyenMai: null },
      {
        ...promotion,
        khuyenMaiId: 42,
        hinhThucApDung: 'TU_DONG',
        maKhuyenMai: null,
      },
    ]);

    await expect(
      service.resolveBookingPromotion({
        nhaXeId: 7,
        subtotal: new Prisma.Decimal('100000.00'),
        businessDate: '2026-10-02',
      }),
    ).rejects.toMatchObject({
      response: { error: 'PROMOTION_AMBIGUOUS' },
    });
  });

  it('does not apply automatic promotions with unstructured conditions', async () => {
    prisma.khuyenMai.findMany.mockResolvedValue([
      {
        ...promotion,
        hinhThucApDung: 'TU_DONG',
        maKhuyenMai: null,
        dieuKienApDung: 'Chỉ áp dụng cho khách hàng mới.',
      },
    ]);

    const result = await service.resolveBookingPromotion({
      nhaXeId: 7,
      subtotal: new Prisma.Decimal('100000.00'),
      businessDate: '2026-10-02',
    });
    expect(result.promotionId).toBeNull();
    expect(result.discountAmount.toFixed(2)).toBe('0.00');
  });
});
