import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionsService } from '../../../src/promotions/promotions.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      chuyenXe: {
        findUnique: vi.fn(),
      },
      khuyenMai: {
        findFirst: vi.fn(),
      },
    };

    service = new PromotionsService(prisma as unknown as PrismaService);
  });

  describe('validatePromotion - Tenant Scope', () => {
    it('throws BadRequestException when neither nhaXeId nor tripId is provided', async () => {
      await expect(
        service.validatePromotion({ code: 'DISCOUNT10' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves nhaXeId from tripId and validates within tenant scope', async () => {
      prisma.chuyenXe.findUnique.mockResolvedValue({ nhaXeId: 5 });
      prisma.khuyenMai.findFirst.mockResolvedValue({
        khuyenMaiId: 1,
        maKhuyenMai: 'DISCOUNT10',
        nhaXeId: 5,
        trangThai: 'HOAT_DONG',
        loaiGiamGia: 'TIEN_MAT',
        giaTriGiam: '20000',
      });

      const result = await service.validatePromotion({
        code: 'DISCOUNT10',
        tripId: 100,
        totalAmount: 100000,
      });

      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBe(20000);
      expect(prisma.khuyenMai.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            maKhuyenMai: 'DISCOUNT10',
            nhaXeId: 5,
            trangThai: 'HOAT_DONG',
          },
        }),
      );
    });

    it('rejects promotion when code does not belong to the requested nhaXeId', async () => {
      prisma.khuyenMai.findFirst.mockResolvedValue(null);

      const result = await service.validatePromotion({
        code: 'OTHERBUS10',
        nhaXeId: 5,
        totalAmount: 100000,
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('không áp dụng cho nhà xe này');
    });
  });
});
