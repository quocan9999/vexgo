import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async validatePromotion(params: {
    code: string;
    tripId?: number;
    seatCount?: number;
    totalAmount?: number;
  }) {
    const cleanCode = (params.code || '').trim().toUpperCase();
    if (!cleanCode) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: 'Mã khuyến mãi không hợp lệ.',
      };
    }

    const promo = await this.prisma.khuyenMai.findFirst({
      where: {
        maKhuyenMai: cleanCode,
      },
    });

    if (!promo) {
      // Check if it matches demo vouchers like VEXGO50 or SUMMER26
      if (cleanCode === 'VEXGO50' || cleanCode === 'SUMMER26') {
        const discount = Math.min(50000, Number(params.totalAmount || 0));
        return {
          code: cleanCode,
          isValid: true,
          discountAmount: discount,
          description: 'Khuyến mãi hè VexGo - Giảm 50.000đ',
          minOrderAmount: 0,
        };
      }

      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: 'Mã khuyến mãi không tồn tại trong hệ thống.',
      };
    }

    const now = new Date();
    if (promo.tuNgay && new Date(promo.tuNgay) > now) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: 'Chương trình khuyến mãi chưa bắt đầu.',
      };
    }

    if (promo.denNgay && new Date(promo.denNgay) < now) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: 'Mã khuyến mãi đã hết hạn sử dụng.',
      };
    }

    const minAmount = promo.giaTriDonToiThieu ? Number(promo.giaTriDonToiThieu) : 0;
    const currentTotal = Number(params.totalAmount || 0);

    if (minAmount > 0 && currentTotal < minAmount) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: `Đơn hàng tối thiểu ${minAmount.toLocaleString('vi-VN')}đ để áp dụng mã này.`,
      };
    }

    let discount = 0;
    const val = Number(promo.giaTriGiam);
    if (promo.loaiGiamGia === 'PHAN_TRAM') {
      discount = (currentTotal * val) / 100;
      if (promo.giamToiDa) {
        discount = Math.min(discount, Number(promo.giamToiDa));
      }
    } else {
      discount = val;
    }

    discount = Math.min(discount, currentTotal);

    return {
      code: cleanCode,
      isValid: true,
      discountAmount: Math.round(discount),
      description: promo.tenChuongTrinh,
      minOrderAmount: minAmount,
    };
  }
}
