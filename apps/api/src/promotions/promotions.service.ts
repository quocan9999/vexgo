import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async validatePromotion(params: {
    code: string;
    tripId?: number;
    nhaXeId?: number;
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

    let nhaXeId = params.nhaXeId;
    if (!nhaXeId && params.tripId) {
      const trip = await this.prisma.chuyenXe.findUnique({
        where: { chuyenXeId: params.tripId },
        select: { nhaXeId: true },
      });
      if (trip) {
        nhaXeId = trip.nhaXeId;
      }
    }

    // Bắt buộc xác định tenant (nhà xe) - không cho phép tìm kiếm toàn cục
    if (!nhaXeId) {
      throw new BadRequestException({
        error: 'TENANT_SCOPE_REQUIRED',
        message:
          'Vui lòng cung cấp nhaXeId hoặc tripId để xác định nhà xe áp dụng mã khuyến mãi.',
      });
    }

    const promo = await this.prisma.khuyenMai.findFirst({
      where: {
        maKhuyenMai: cleanCode,
        nhaXeId,
        trangThai: 'HOAT_DONG',
      },
    });

    if (!promo) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: 'Mã khuyến mãi không tồn tại hoặc không áp dụng cho nhà xe này.',
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

    const originalTotal = Number(params.totalAmount || 0);
    if (
      promo.giaTriDonToiThieu &&
      originalTotal < Number(promo.giaTriDonToiThieu)
    ) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: `Đơn hàng tối thiểu ${Number(promo.giaTriDonToiThieu).toLocaleString('vi-VN')}đ để sử dụng mã này.`,
      };
    }

    let discountAmount = 0;
    if (promo.loaiGiamGia === 'PHAN_TRAM') {
      const percentage = Number(promo.giaTriGiam);
      discountAmount = Math.round((originalTotal * percentage) / 100);
      if (
        promo.giamToiDa &&
        discountAmount > Number(promo.giamToiDa)
      ) {
        discountAmount = Number(promo.giamToiDa);
      }
    } else {
      discountAmount = Number(promo.giaTriGiam);
    }

    return {
      code: cleanCode,
      isValid: true,
      discountAmount: Math.min(originalTotal, discountAmount),
      promotionId: promo.khuyenMaiId,
      message: 'Áp dụng mã khuyến mãi thành công.',
    };
  }
}
