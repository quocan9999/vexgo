import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  combineDeparture,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { CreateReviewDto } from './dto/create-review.dto.js';

@Injectable()
export class ReviewsService {
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config?: ConfigService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config?.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

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
      select: {
        chuyenXeId: true,
        ngayKhoiHanh: true,
        gioKhoiHanh: true,
        trangThai: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Chuyến xe không tồn tại.');
    }

    // 2. Kiểm tra điều kiện: Khách hàng phải có vé hợp lệ và đã thanh toán thành công
    const eligibleTicket = await this.prisma.ve.findFirst({
      where: {
        gheChuyenXe: {
          chuyenXeId: dto.tripId,
        },
        phieuDatVe: {
          donGiaoDich: {
            khachHangId: customer.khachHangId,
            trangThai: 'DA_THANH_TOAN',
          },
          trangThai: {
            in: ['DA_THANH_TOAN', 'HOAN_TAT'],
          },
        },
        trangThai: {
          in: ['DA_DAT', 'DA_XUAT', 'HOAN_TAT', 'DA_SU_DUNG', 'DA_THANH_TOAN'],
        },
      },
    });

    if (!eligibleTicket) {
      throw new ForbiddenException(
        'Bạn chỉ có thể đánh giá chuyến xe mà bạn đã đặt vé và thanh toán thành công.',
      );
    }

    // 3. Kiểm tra điều kiện hoàn tất hoặc đã khởi hành
    const hasDepartedOrCompleted =
      trip.trangThai === 'HOAN_THANH' ||
      (trip.ngayKhoiHanh && trip.gioKhoiHanh
        ? combineDeparture(
            trip.ngayKhoiHanh,
            trip.gioKhoiHanh,
            this.businessTimeZone,
          ) <= new Date()
        : true);

    if (!hasDepartedOrCompleted) {
      throw new ConflictException(
        'Bạn chỉ có thể đánh giá chuyến xe sau khi chuyến xe đã khởi hành hoặc hoàn tất.',
      );
    }

    // 4. Chống đánh giá trùng lặp bằng transaction và row-lock trên KhachHang
    const runInTx = async (tx: any) => {
      if (typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw`SELECT khachHangId FROM KhachHang WHERE khachHangId = ${customer.khachHangId} FOR UPDATE`;
      }

      const existingReview = await tx.phanHoi.findFirst({
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

      return await tx.phanHoi.create({
        data: {
          mucDanhGia: dto.rating,
          noiDung: dto.comment?.trim() || null,
          thoiGian: new Date(),
          trangThai: 'HIEN_THI',
          khachHangId: customer.khachHangId,
          chuyenXeId: dto.tripId,
        },
      });
    };

    try {
      const review =
        typeof this.prisma.$transaction === 'function'
          ? await this.prisma.$transaction(async (tx) => runInTx(tx))
          : await runInTx(this.prisma);

      return {
        reviewId: review.phanHoiId,
        tripId: review.chuyenXeId,
        rating: review.mucDanhGia,
        comment: review.noiDung,
        createdAt: review.thoiGian.toISOString(),
        status: review.trangThai,
      };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'Bạn đã gửi đánh giá cho chuyến xe này rồi.',
        );
      }
      throw err;
    }
  }
}
