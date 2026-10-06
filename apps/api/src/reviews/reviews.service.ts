import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateReviewDto } from './dto/create-review.dto.js';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCustomer(taiKhoanId: number) {
    const customer = await this.prisma.khachHang.findUnique({
      where: { taiKhoanId },
      select: { khachHangId: true },
    });

    if (!customer) {
      throw new ForbiddenException('Tài khoản không phải là khách hàng hợp lệ.');
    }

    return customer;
  }

  async createReview(taiKhoanId: number, dto: CreateReviewDto) {
    const customer = await this.resolveCustomer(taiKhoanId);

    // 1. Kiểm tra chuyến xe tồn tại
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: dto.tripId },
      select: { chuyenXeId: true, thoiDiemDi: true },
    });

    if (!trip) {
      throw new NotFoundException('Chuyến xe không tồn tại.');
    }

    // 2. Kiểm tra điều kiện: Khách hàng phải có vé/phiếu đặt vé hợp lệ cho chuyến xe này
    const eligibleBooking = await this.prisma.phieuDatVe.findFirst({
      where: {
        chuyenXeId: dto.tripId,
        khachHangId: customer.khachHangId,
        trangThai: { in: ['DA_THANH_TOAN', 'HOAN_TAT', 'DA_XAC_NHAN'] },
      },
    });

    const eligibleTicket = !eligibleBooking
      ? await this.prisma.ve.findFirst({
          where: {
            chuyenXeId: dto.tripId,
            khachHangId: customer.khachHangId,
            trangThai: {
              in: ['DA_XUAT', 'HOAN_TAT', 'DA_SU_DUNG', 'DA_THANH_TOAN'],
            },
          },
        })
      : null;

    if (!eligibleBooking && !eligibleTicket) {
      throw new ForbiddenException(
        'Bạn chỉ có thể đánh giá chuyến xe mà bạn đã đặt vé và thanh toán thành công.',
      );
    }

    // 3. Chống đánh giá trùng lặp
    const existingReview = await this.prisma.phanHoi.findFirst({
      where: {
        khachHangId: customer.khachHangId,
        chuyenXeId: dto.tripId,
      },
    });

    if (existingReview) {
      throw new ConflictException(
        'Bạn đã gửi đánh giá cho chuyến xe này rồi.',
      );
    }

    // 4. Tạo bản ghi đánh giá
    const review = await this.prisma.phanHoi.create({
      data: {
        mucDanhGia: dto.rating,
        noiDung: dto.comment?.trim() || null,
        thoiGian: new Date(),
        trangThai: 'HIEN_THI',
        khachHangId: customer.khachHangId,
        chuyenXeId: dto.tripId,
      },
    });

    return {
      reviewId: review.phanHoiId,
      tripId: review.chuyenXeId,
      rating: review.mucDanhGia,
      comment: review.noiDung,
      createdAt: review.thoiGian.toISOString(),
      status: review.trangThai,
    };
  }
}
