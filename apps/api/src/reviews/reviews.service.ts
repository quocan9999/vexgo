import {
  BadRequestException,
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
import type { UpdateReviewDto } from './dto/update-review.dto.js';
import type {
  AdminReplyReviewDto,
  AdminReviewQueryDto,
  AdminUpdateReviewStatusDto,
} from './dto/admin-review.dto.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

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
    const departureTime =
      trip.ngayKhoiHanh && trip.gioKhoiHanh
        ? combineDeparture(
            trip.ngayKhoiHanh,
            trip.gioKhoiHanh,
            this.businessTimeZone,
          )
        : trip.ngayKhoiHanh
          ? new Date(trip.ngayKhoiHanh)
          : null;

    const now = new Date();

    const hasDepartedOrCompleted =
      trip.trangThai === 'HOAN_THANH' ||
      (departureTime ? departureTime <= now : true);

    if (!hasDepartedOrCompleted) {
      throw new ConflictException({
        error: 'CONFLICT',
        message:
          'Bạn chỉ có thể đánh giá chuyến xe sau khi chuyến xe đã khởi hành hoặc hoàn tất.',
      });
    }

    // 4. Giới hạn thời gian đánh giá: Chỉ cho phép đánh giá trong vòng 7 ngày kể từ khi chuyến xe khởi hành
    if (departureTime) {
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      if (now.getTime() - departureTime.getTime() > SEVEN_DAYS_MS) {
        throw new ConflictException({
          error: 'REVIEW_EXPIRED',
          message:
            'Chuyến xe đã kết thúc quá 7 ngày, đã hết thời hạn gửi đánh giá.',
        });
      }
    }

    // 5. Chống đánh giá trùng lặp bằng transaction và row-lock trên KhachHang
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
        throw new ConflictException({
          error: 'CONFLICT',
          message: 'Bạn đã gửi đánh giá cho chuyến xe này rồi.',
        });
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
        throw new ConflictException({
          error: 'CONFLICT',
          message: 'Bạn đã gửi đánh giá cho chuyến xe này rồi.',
        });
      }
      throw err;
    }
  }

  async getBusCompanyReviews(busCompanyId: number) {
    if (!this.prisma?.phanHoi || typeof this.prisma.phanHoi.findMany !== 'function') {
      return {
        busCompanyId,
        rating: null,
        reviewsCount: 0,
        reviews: [],
      };
    }

    const reviews = await this.prisma.phanHoi.findMany({
      where: {
        trangThai: 'HIEN_THI',
        chuyenXe: { nhaXeId: busCompanyId },
      },
      include: {
        khachHang: {
          select: {
            hoTen: true,
          },
        },
        chuyenXe: {
          select: {
            chuyenXeId: true,
            maChuyenXe: true,
            ngayKhoiHanh: true,
            gioKhoiHanh: true,
            tuyenXe: {
              select: {
                diemDi: true,
                diemDen: true,
              },
            },
          },
        },
      },
      orderBy: { thoiGian: 'desc' },
      take: 50,
    });

    const count = reviews.length;
    const avg =
      count > 0
        ? Math.round(
            (reviews.reduce((sum, r) => sum + r.mucDanhGia, 0) / count) * 10,
          ) / 10
        : null;

    return {
      busCompanyId,
      rating: avg,
      reviewsCount: count,
      reviews: reviews.map((r: any) => ({
        id: r.phanHoiId,
        rating: r.mucDanhGia,
        comment: r.noiDung,
        customerName:
          r.khachHang?.hoTen ||
          (r.khachHang as any)?.taiKhoan?.hoTen ||
          'Khách hàng VexGo',
        createdAt: r.thoiGian.toISOString(),
        isEdited: Boolean(
          r.updatedAt &&
            r.createdAt &&
            Math.abs(new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) > 5000,
        ),
        isEditable: Boolean(
          Date.now() - new Date(r.createdAt || r.thoiGian).getTime() <= 3 * 24 * 60 * 60 * 1000,
        ),
        tripDate: r.chuyenXe?.ngayKhoiHanh
          ? new Date(r.chuyenXe.ngayKhoiHanh).toISOString().slice(0, 10)
          : null,
        tripTime: r.chuyenXe?.gioKhoiHanh
          ? `${String(new Date(r.chuyenXe.gioKhoiHanh).getUTCHours()).padStart(2, '0')}:${String(new Date(r.chuyenXe.gioKhoiHanh).getUTCMinutes()).padStart(2, '0')}`
          : null,
        tripCode: r.chuyenXe?.maChuyenXe || null,
        routeName:
          r.chuyenXe?.tuyenXe?.diemDi && r.chuyenXe?.tuyenXe?.diemDen
            ? `${r.chuyenXe.tuyenXe.diemDi} - ${r.chuyenXe.tuyenXe.diemDen}`
            : null,
        reply: r.traLoi
          ? {
              content: r.traLoi,
              createdAt: r.thoiGianTraLoi
                ? r.thoiGianTraLoi.toISOString()
                : null,
              responderName: r.nguoiTraLoi || 'Nhà xe',
            }
          : null,
      })),
    };
  }

  async getTripReviews(tripId: number) {
    if (!this.prisma?.phanHoi || typeof this.prisma.phanHoi.findMany !== 'function') {
      return {
        tripId,
        rating: null,
        reviewsCount: 0,
        reviews: [],
      };
    }

    const reviews = await this.prisma.phanHoi.findMany({
      where: {
        trangThai: 'HIEN_THI',
        chuyenXeId: tripId,
      },
      include: {
        khachHang: {
          select: {
            hoTen: true,
          },
        },
        chuyenXe: {
          select: {
            chuyenXeId: true,
            maChuyenXe: true,
            ngayKhoiHanh: true,
            gioKhoiHanh: true,
            tuyenXe: {
              select: {
                diemDi: true,
                diemDen: true,
              },
            },
          },
        },
      },
      orderBy: { thoiGian: 'desc' },
      take: 50,
    });

    const count = reviews.length;
    const avg =
      count > 0
        ? Math.round(
            (reviews.reduce((sum, r) => sum + r.mucDanhGia, 0) / count) * 10,
          ) / 10
        : null;

    return {
      tripId,
      rating: avg,
      reviewsCount: count,
      reviews: reviews.map((r: any) => ({
        id: r.phanHoiId,
        rating: r.mucDanhGia,
        comment: r.noiDung,
        customerName:
          r.khachHang?.hoTen ||
          (r.khachHang as any)?.taiKhoan?.hoTen ||
          'Khách hàng VexGo',
        createdAt: r.thoiGian.toISOString(),
        isEdited: Boolean(
          r.updatedAt &&
            r.createdAt &&
            Math.abs(new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) > 5000,
        ),
        isEditable: Boolean(
          Date.now() - new Date(r.createdAt || r.thoiGian).getTime() <= 3 * 24 * 60 * 60 * 1000,
        ),
        tripDate: r.chuyenXe?.ngayKhoiHanh
          ? new Date(r.chuyenXe.ngayKhoiHanh).toISOString().slice(0, 10)
          : null,
        tripTime: r.chuyenXe?.gioKhoiHanh
          ? `${String(new Date(r.chuyenXe.gioKhoiHanh).getUTCHours()).padStart(2, '0')}:${String(new Date(r.chuyenXe.gioKhoiHanh).getUTCMinutes()).padStart(2, '0')}`
          : null,
        tripCode: r.chuyenXe?.maChuyenXe || null,
        routeName:
          r.chuyenXe?.tuyenXe?.diemDi && r.chuyenXe?.tuyenXe?.diemDen
            ? `${r.chuyenXe.tuyenXe.diemDi} - ${r.chuyenXe.tuyenXe.diemDen}`
            : null,
        reply: r.traLoi
          ? {
              content: r.traLoi,
              createdAt: r.thoiGianTraLoi
                ? r.thoiGianTraLoi.toISOString()
                : null,
              responderName: r.nguoiTraLoi || 'Nhà xe',
            }
          : null,
      })),
    };
  }

  async getMyReviews(taiKhoanId: number) {
    const customer = await this.resolveCustomer(taiKhoanId);
    const reviews = await this.prisma.phanHoi.findMany({
      where: {
        khachHangId: customer.khachHangId,
      },
      include: {
        chuyenXe: {
          select: {
            chuyenXeId: true,
            maChuyenXe: true,
            ngayKhoiHanh: true,
            gioKhoiHanh: true,
            tuyenXe: {
              select: {
                diemDi: true,
                diemDen: true,
              },
            },
          },
        },
      },
      orderBy: { thoiGian: 'desc' },
    });

    return {
      reviews: reviews.map((r: any) => ({
        id: r.phanHoiId,
        tripId: r.chuyenXeId,
        rating: r.mucDanhGia,
        comment: r.noiDung,
        createdAt: r.thoiGian.toISOString(),
        isEdited: Boolean(
          r.updatedAt &&
            r.createdAt &&
            Math.abs(new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) > 5000,
        ),
        isEditable: Boolean(
          Date.now() - new Date(r.createdAt || r.thoiGian).getTime() <= 3 * 24 * 60 * 60 * 1000,
        ),
        tripDate: r.chuyenXe?.ngayKhoiHanh
          ? new Date(r.chuyenXe.ngayKhoiHanh).toISOString().slice(0, 10)
          : null,
        tripTime: r.chuyenXe?.gioKhoiHanh
          ? `${String(new Date(r.chuyenXe.gioKhoiHanh).getUTCHours()).padStart(2, '0')}:${String(new Date(r.chuyenXe.gioKhoiHanh).getUTCMinutes()).padStart(2, '0')}`
          : null,
        tripCode: r.chuyenXe?.maChuyenXe || null,
        routeName:
          r.chuyenXe?.tuyenXe?.diemDi && r.chuyenXe?.tuyenXe?.diemDen
            ? `${r.chuyenXe.tuyenXe.diemDi} - ${r.chuyenXe.tuyenXe.diemDen}`
            : null,
        reply: r.traLoi
          ? {
              content: r.traLoi,
              createdAt: r.thoiGianTraLoi
                ? r.thoiGianTraLoi.toISOString()
                : null,
              responderName: r.nguoiTraLoi || 'Nhà xe',
            }
          : null,
      })),
    };
  }

  async deleteTripReview(taiKhoanId: number, tripId: number) {
    const customer = await this.resolveCustomer(taiKhoanId);

    const review = await this.prisma.phanHoi.findFirst({
      where: {
        khachHangId: customer.khachHangId,
        chuyenXeId: tripId,
      },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá cho chuyến xe này.');
    }

    await this.prisma.phanHoi.delete({
      where: { phanHoiId: review.phanHoiId },
    });

    return {
      success: true,
      message: 'Đã xóa đánh giá thành công.',
    };
  }

  async deleteReview(taiKhoanId: number, reviewId: number) {
    const customer = await this.resolveCustomer(taiKhoanId);

    const review = await this.prisma.phanHoi.findUnique({
      where: { phanHoiId: reviewId },
      select: { phanHoiId: true, khachHangId: true },
    });

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại.');
    }

    if (review.khachHangId !== customer.khachHangId) {
      throw new ForbiddenException('Bạn không có quyền xóa đánh giá của người khác.');
    }

    await this.prisma.phanHoi.delete({
      where: { phanHoiId: reviewId },
    });

    return {
      success: true,
      message: 'Đã xóa đánh giá thành công.',
    };
  }

  async updateTripReview(
    taiKhoanId: number,
    tripId: number,
    dto: UpdateReviewDto,
  ) {
    const customer = await this.resolveCustomer(taiKhoanId);

    const review = await this.prisma.phanHoi.findFirst({
      where: {
        khachHangId: customer.khachHangId,
        chuyenXeId: tripId,
      },
      select: {
        phanHoiId: true,
        createdAt: true,
        thoiGian: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá cho chuyến xe này.');
    }

    // Giới hạn thời gian chỉnh sửa: Chỉ được sửa trong vòng 3 ngày kể từ khi gửi đánh giá
    const reviewCreatedAt = review.createdAt
      ? new Date(review.createdAt)
      : new Date(review.thoiGian);
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - reviewCreatedAt.getTime() > THREE_DAYS_MS) {
      throw new ConflictException({
        error: 'EDIT_EXPIRED',
        message:
          'Đã quá thời hạn 3 ngày kể từ khi gửi đánh giá, bạn không thể chỉnh sửa nhận xét này nữa.',
      });
    }

    const updated = await this.prisma.phanHoi.update({
      where: { phanHoiId: review.phanHoiId },
      data: {
        ...(dto.rating !== undefined ? { mucDanhGia: dto.rating } : {}),
        ...(dto.comment !== undefined
          ? { noiDung: dto.comment.trim() || null }
          : {}),
        thoiGian: new Date(),
      },
    });

    return {
      success: true,
      message: 'Cập nhật đánh giá thành công.',
      review: {
        id: updated.phanHoiId,
        tripId: updated.chuyenXeId,
        rating: updated.mucDanhGia,
        comment: updated.noiDung,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }

  async updateReview(
    taiKhoanId: number,
    reviewId: number,
    dto: UpdateReviewDto,
  ) {
    const customer = await this.resolveCustomer(taiKhoanId);

    const review = await this.prisma.phanHoi.findUnique({
      where: { phanHoiId: reviewId },
      select: {
        phanHoiId: true,
        khachHangId: true,
        chuyenXeId: true,
        createdAt: true,
        thoiGian: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại.');
    }

    if (review.khachHangId !== customer.khachHangId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa đánh giá của người khác.',
      );
    }

    // Giới hạn thời gian chỉnh sửa: Chỉ được sửa trong vòng 3 ngày kể từ khi gửi đánh giá
    const reviewCreatedAt = review.createdAt
      ? new Date(review.createdAt)
      : new Date(review.thoiGian);
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - reviewCreatedAt.getTime() > THREE_DAYS_MS) {
      throw new ConflictException({
        error: 'EDIT_EXPIRED',
        message:
          'Đã quá thời hạn 3 ngày kể từ khi gửi đánh giá, bạn không thể chỉnh sửa nhận xét này nữa.',
      });
    }

    const updated = await this.prisma.phanHoi.update({
      where: { phanHoiId: reviewId },
      data: {
        ...(dto.rating !== undefined ? { mucDanhGia: dto.rating } : {}),
        ...(dto.comment !== undefined
          ? { noiDung: dto.comment.trim() || null }
          : {}),
        thoiGian: new Date(),
      },
    });

    return {
      success: true,
      message: 'Cập nhật đánh giá thành công.',
      review: {
        id: updated.phanHoiId,
        tripId: updated.chuyenXeId,
        rating: updated.mucDanhGia,
        comment: updated.noiDung,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }

  // ================= ADMIN REVIEW MANAGEMENT =================

  async getAdminReviews(query: AdminReviewQueryDto, principal?: AuthPrincipal) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));
    const skip = (page - 1) * pageSize;

    const where: any = {};

    // Phạm vi phân quyền: Nếu là tenant admin, chỉ được xem đánh giá của nhà xe mình
    if (principal && principal.nhaXeId) {
      where.chuyenXe = { nhaXeId: principal.nhaXeId };
    } else if (query.busCompanyId) {
      where.chuyenXe = { nhaXeId: query.busCompanyId };
    }

    // Lọc theo rating (số sao)
    if (query.rating) {
      where.mucDanhGia = query.rating;
    }

    // Lọc theo trạng thái kiểm duyệt
    if (query.status) {
      where.trangThai = query.status;
    }

    // Lọc theo tuyến xe
    if (query.routeId) {
      where.chuyenXe = {
        ...(where.chuyenXe ?? {}),
        tuyenXeId: query.routeId,
      };
    }

    // Lọc theo việc có nhận xét viết kèm hay không
    if (query.hasComment === 'WITH_COMMENT') {
      where.AND = [
        ...(where.AND ?? []),
        { noiDung: { not: null } },
        { NOT: { noiDung: '' } },
      ];
    } else if (query.hasComment === 'WITHOUT_COMMENT') {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [{ noiDung: null }, { noiDung: '' }],
        },
      ];
    }

    // Lọc theo khoảng thời gian gửi
    if (query.timeRange && query.timeRange !== 'ALL') {
      const now = new Date();
      let fromDate: Date | null = null;
      if (query.timeRange === '7_DAYS') {
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (query.timeRange === '30_DAYS') {
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (query.timeRange === 'THIS_MONTH') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      if (fromDate) {
        where.thoiGian = { gte: fromDate };
      }
    }

    // Tìm kiếm theo từ khóa (khách hàng, SĐT, nội dung)
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { noiDung: { contains: term } },
        { khachHang: { hoTen: { contains: term } } },
        { khachHang: { taiKhoan: { soDienThoai: { contains: term } } } },
      ];
    }

    const orderByField = query.sortBy === 'mucDanhGia' ? 'mucDanhGia' : 'thoiGian';
    const sortDir = query.sortDirection === 'asc' ? 'asc' : 'desc';

    const [totalItems, items] = await Promise.all([
      this.prisma.phanHoi.count({ where }),
      this.prisma.phanHoi.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [orderByField]: sortDir },
        include: {
          khachHang: {
            select: {
              khachHangId: true,
              hoTen: true,
              taiKhoan: {
                select: {
                  soDienThoai: true,
                  email: true,
                },
              },
            },
          },
          chuyenXe: {
            select: {
              chuyenXeId: true,
              ngayKhoiHanh: true,
              gioKhoiHanh: true,
              tuyenXe: {
                select: {
                  tuyenXeId: true,
                  diemDi: true,
                  diemDen: true,
                },
              },
              xe: {
                select: {
                  bienSoXe: true,
                  loaiXe: { select: { tenLoai: true } },
                  nhaXe: { select: { nhaXeId: true, tenNhaXe: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const mappedData = items.map((item) => ({
      id: item.phanHoiId,
      rating: item.mucDanhGia,
      comment: item.noiDung,
      createdAt: item.thoiGian.toISOString(),
      isEdited: Boolean(
        item.updatedAt &&
          item.createdAt &&
          Math.abs(new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime()) > 5000,
      ),
      status: item.trangThai,
      reply: item.traLoi
        ? {
            content: item.traLoi,
            createdAt: item.thoiGianTraLoi
              ? item.thoiGianTraLoi.toISOString()
              : null,
            responderName: item.nguoiTraLoi || 'Nhà xe',
          }
        : null,
      customer: {
        id: item.khachHang.khachHangId,
        fullName: item.khachHang.hoTen ?? 'Khách hàng',
        phoneNumber: item.khachHang.taiKhoan?.soDienThoai ?? '',
        email: item.khachHang.taiKhoan?.email ?? null,
      },
      trip: item.chuyenXe
        ? {
            id: item.chuyenXe.chuyenXeId,
            departureDate: item.chuyenXe.ngayKhoiHanh.toISOString().split('T')[0],
            departureTime: item.chuyenXe.gioKhoiHanh ? new Date(item.chuyenXe.gioKhoiHanh).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
            routeName: `${item.chuyenXe.tuyenXe?.diemDi} - ${item.chuyenXe.tuyenXe?.diemDen}`,
            busCompanyName: item.chuyenXe.xe?.nhaXe?.tenNhaXe || '',
            busCompanyId: item.chuyenXe.xe?.nhaXe?.nhaXeId || 0,
            vehicleType: item.chuyenXe.xe?.loaiXe?.tenLoai || '',
            licensePlate: item.chuyenXe.xe?.bienSoXe || '',
          }
        : null,
    }));

    return {
      data: mappedData,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 1,
      },
    };
  }

  async getAdminReviewStats(principal?: AuthPrincipal, busCompanyId?: number) {
    const where: any = {};
    if (principal && principal.nhaXeId) {
      where.chuyenXe = { nhaXeId: principal.nhaXeId };
    } else if (busCompanyId) {
      where.chuyenXe = { nhaXeId: busCompanyId };
    }

    const reviews = await this.prisma.phanHoi.findMany({
      where,
      select: {
        mucDanhGia: true,
        trangThai: true,
      },
    });

    const total = reviews.length;
    if (total === 0) {
      return {
        data: {
          averageRating: 0,
          totalReviews: 0,
          satisfactionRate: 0,
          negativeCount: 0,
          hiddenCount: 0,
          visibleCount: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
      };
    }

    let positive = 0;
    let negative = 0;
    let hidden = 0;
    let visibleCount = 0;
    let visibleSum = 0;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const r of reviews) {
      distribution[r.mucDanhGia] = (distribution[r.mucDanhGia] || 0) + 1;
      if (r.trangThai === 'DA_AN') {
        hidden++;
      } else {
        visibleCount++;
        visibleSum += r.mucDanhGia;
        if (r.mucDanhGia >= 4) positive++;
        if (r.mucDanhGia <= 2) negative++;
      }
    }

    const avg =
      visibleCount > 0
        ? Math.round((visibleSum / visibleCount) * 10) / 10
        : 0;
    const satisfactionRate =
      visibleCount > 0 ? Math.round((positive / visibleCount) * 100) : 0;

    return {
      data: {
        averageRating: avg,
        totalReviews: total,
        satisfactionRate,
        negativeCount: negative,
        hiddenCount: hidden,
        visibleCount,
        ratingDistribution: distribution,
      },
    };
  }

  async updateAdminReviewStatus(
    reviewId: number,
    dto: AdminUpdateReviewStatusDto,
    principal?: AuthPrincipal,
  ) {
    if (principal && principal.nhaXeId) {
      throw new ForbiddenException(
        'Chỉ quản trị viên hệ thống (Super Admin) mới có quyền kiểm duyệt ẩn hoặc hiển thị đánh giá.',
      );
    }

    const review = await this.prisma.phanHoi.findUnique({
      where: { phanHoiId: reviewId },
      include: { chuyenXe: true },
    });

    const updated = await this.prisma.phanHoi.update({
      where: { phanHoiId: reviewId },
      data: {
        trangThai: dto.status,
      },
    });

    return {
      data: {
        id: updated.phanHoiId,
        status: updated.trangThai,
        updatedAt: updated.updatedAt.toISOString(),
      },
      message: dto.status === 'DA_AN' ? 'Đã ẩn đánh giá thành công.' : 'Đã hiển thị lại đánh giá.',
    };
  }

  async replyAdminReview(
    reviewId: number,
    dto: AdminReplyReviewDto,
    principal?: AuthPrincipal,
  ) {
    if (!principal || !principal.nhaXeId) {
      throw new ForbiddenException(
        'Chỉ quản trị viên nhà xe mới có quyền phản hồi đánh giá của hành khách.',
      );
    }

    const review = await this.prisma.phanHoi.findUnique({
      where: { phanHoiId: reviewId },
      include: {
        chuyenXe: {
          include: {
            xe: {
              include: { nhaXe: true },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại.');
    }

    if (
      principal &&
      principal.nhaXeId &&
      review.chuyenXe?.nhaXeId !== principal.nhaXeId
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền phản hồi đánh giá của nhà xe khác.',
      );
    }

    const replyContent = dto.reply?.trim() || null;
    const operatorName =
      review.chuyenXe?.xe?.nhaXe?.tenNhaXe || 'Ban quản trị Nhà xe';
    const responderName = replyContent ? operatorName : null;
    const replyTime = replyContent ? new Date() : null;

    const updated = await this.prisma.phanHoi.update({
      where: { phanHoiId: reviewId },
      data: {
        traLoi: replyContent,
        thoiGianTraLoi: replyTime,
        nguoiTraLoi: responderName,
      },
    });

    return {
      data: {
        id: updated.phanHoiId,
        reply: updated.traLoi
          ? {
              content: updated.traLoi,
              createdAt: updated.thoiGianTraLoi
                ? updated.thoiGianTraLoi.toISOString()
                : null,
              responderName: updated.nguoiTraLoi || 'Nhà xe',
            }
          : null,
      },
      message: replyContent
        ? 'Đã gửi phản hồi đánh giá thành công.'
        : 'Đã xóa phản hồi đánh giá thành công.',
    };
  }
}
