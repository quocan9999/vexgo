import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsService } from '../../../src/reviews/reviews.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('ReviewsService', () => {
  const customer = { khachHangId: 10 };
  const mockTrip = {
    chuyenXeId: 101,
    ngayKhoiHanh: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
    trangThai: 'HOAN_THANH',
  };

  const prisma = {
    khachHang: { findUnique: vi.fn() },
    chuyenXe: { findUnique: vi.fn() },
    ve: { findFirst: vi.fn() },
    phanHoi: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(prisma)),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };

  const service = new ReviewsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.khachHang.findUnique.mockResolvedValue(customer);
    prisma.chuyenXe.findUnique.mockResolvedValue(mockTrip);
  });

  it('throws NotFoundException if trip does not exist', async () => {
    prisma.chuyenXe.findUnique.mockResolvedValue(null);
    await expect(
      service.createReview(42, { tripId: 999, rating: 5 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException if customer has no ticket or booking is unpaid', async () => {
    prisma.ve.findFirst.mockResolvedValue(null);

    await expect(
      service.createReview(42, { tripId: 101, rating: 5 }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.ve.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          phieuDatVe: {
            donGiaoDich: {
              khachHangId: 10,
              trangThai: 'DA_THANH_TOAN',
            },
            trangThai: {
              in: ['DA_THANH_TOAN', 'HOAN_TAT'],
            },
          },
        }),
      }),
    );
  });

  it('throws ConflictException if customer already reviewed this trip', async () => {
    prisma.ve.findFirst.mockResolvedValue({ veId: 1 });
    prisma.phanHoi.findFirst.mockResolvedValue({ phanHoiId: 50 });

    await expect(
      service.createReview(42, { tripId: 101, rating: 5 }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates review successfully when eligible', async () => {
    prisma.ve.findFirst.mockResolvedValue({ veId: 1 });
    prisma.phanHoi.findFirst.mockResolvedValue(null);
    prisma.phanHoi.create.mockResolvedValue({
      phanHoiId: 1,
      chuyenXeId: 101,
      mucDanhGia: 5,
      noiDung: 'Bác tài nhiệt tình, xe sạch sẽ',
      thoiGian: new Date('2026-10-06T08:00:00.000Z'),
      trangThai: 'HIEN_THI',
    });

    const res = await service.createReview(42, {
      tripId: 101,
      rating: 5,
      comment: 'Bác tài nhiệt tình, xe sạch sẽ',
    });

    expect(res.reviewId).toBe(1);
    expect(res.rating).toBe(5);
    expect(res.comment).toBe('Bác tài nhiệt tình, xe sạch sẽ');
    expect(prisma.phanHoi.create).toHaveBeenCalled();
  });

  it('maps Prisma P2002 duplicate error to ConflictException (discussion_r4222294117)', async () => {
    prisma.ve.findFirst.mockResolvedValue({ veId: 1 });
    prisma.phanHoi.findFirst.mockResolvedValue(null);
    const p2002Error = new Error('Unique constraint failed');
    (p2002Error as any).code = 'P2002';
    prisma.phanHoi.create.mockRejectedValue(p2002Error);

    await expect(
      service.createReview(42, { tripId: 101, rating: 5 }),
    ).rejects.toThrow(ConflictException);
  });

  it('computes average rating and formats reviews in getBusCompanyReviews', async () => {
    prisma.phanHoi.findMany.mockResolvedValue([
      {
        phanHoiId: 1,
        mucDanhGia: 5,
        noiDung: 'Xe tốt',
        thoiGian: new Date('2026-10-01T10:00:00Z'),
        khachHang: { taiKhoan: { hoTen: 'Nguyễn Văn A' } },
      },
      {
        phanHoiId: 2,
        mucDanhGia: 4,
        noiDung: 'Tài xế cẩn thận',
        thoiGian: new Date('2026-10-02T10:00:00Z'),
        khachHang: { taiKhoan: { hoTen: 'Trần Thị B' } },
      },
    ]);

    const result = await service.getBusCompanyReviews(1);

    expect(result.busCompanyId).toBe(1);
    expect(result.reviewsCount).toBe(2);
    expect(result.rating).toBe(4.5);
    expect(result.reviews).toHaveLength(2);
    expect(result.reviews[0].customerName).toBe('Nguyễn Văn A');
  });

  it('computes average rating and formats reviews in getTripReviews', async () => {
    prisma.phanHoi.findMany.mockResolvedValue([
      {
        phanHoiId: 3,
        mucDanhGia: 5,
        noiDung: 'Chuyến đi tuyệt vời',
        thoiGian: new Date('2026-10-03T10:00:00Z'),
        khachHang: { taiKhoan: { hoTen: 'Lê Văn C' } },
      },
    ]);

    const result = await service.getTripReviews(101);

    expect(result.tripId).toBe(101);
    expect(result.reviewsCount).toBe(1);
    expect(result.rating).toBe(5);
    expect(result.reviews[0].customerName).toBe('Lê Văn C');
  });

  it('retrieves customer reviews in getMyReviews', async () => {
    prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10 });
    prisma.phanHoi.findMany.mockResolvedValue([
      {
        phanHoiId: 1,
        chuyenXeId: 100,
        mucDanhGia: 5,
        noiDung: 'Xe tốt',
        thoiGian: new Date('2026-10-01T10:00:00Z'),
        chuyenXe: {
          chuyenXeId: 100,
          maChuyenXe: 'CX-100',
          ngayKhoiHanh: new Date('2026-10-01'),
          gioKhoiHanh: new Date('2026-10-01T07:00:00Z'),
          tuyenXe: { diemDi: 'TP.HCM', diemDen: 'Đà Lạt' },
        },
      },
    ]);

    const result = await service.getMyReviews(1);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].tripId).toBe(100);
    expect(result.reviews[0].rating).toBe(5);
  });

  it('deletes review successfully when customer owns the review', async () => {
    prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10 });
    prisma.phanHoi.findUnique.mockResolvedValue({
      phanHoiId: 5,
      khachHangId: 10,
    });
    prisma.phanHoi.delete.mockResolvedValue({ phanHoiId: 5 });

    const result = await service.deleteReview(1, 5);
    expect(result.success).toBe(true);
    expect(prisma.phanHoi.delete).toHaveBeenCalledWith({
      where: { phanHoiId: 5 },
    });
  });

  it('throws ForbiddenException when deleting another customer review', async () => {
    prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10 });
    prisma.phanHoi.findUnique.mockResolvedValue({
      phanHoiId: 5,
      khachHangId: 99, // different customer
    });

    await expect(service.deleteReview(1, 5)).rejects.toThrow();
  });

  it('updates review successfully when customer owns the review', async () => {
    prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10 });
    prisma.phanHoi.findFirst.mockResolvedValue({
      phanHoiId: 7,
      khachHangId: 10,
      chuyenXeId: 101,
      createdAt: new Date(),
      thoiGian: new Date(),
    });
    prisma.phanHoi.update.mockResolvedValue({
      phanHoiId: 7,
      chuyenXeId: 101,
      mucDanhGia: 4,
      noiDung: 'Bác tài nhiệt tình, xe rất êm',
      updatedAt: new Date('2026-10-07T09:00:00Z'),
    });

    const result = await service.updateTripReview(1, 101, {
      rating: 4,
      comment: 'Bác tài nhiệt tình, xe rất êm',
    });

    expect(result.success).toBe(true);
    expect(result.review.rating).toBe(4);
    expect(result.review.comment).toBe('Bác tài nhiệt tình, xe rất êm');
    expect(prisma.phanHoi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phanHoiId: 7 },
        data: expect.objectContaining({
          mucDanhGia: 4,
          noiDung: 'Bác tài nhiệt tình, xe rất êm',
        }),
      }),
    );
  });

  it('throws ConflictException if trip departed more than 7 days ago', async () => {
    prisma.chuyenXe.findUnique.mockResolvedValue({
      chuyenXeId: 101,
      ngayKhoiHanh: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
      trangThai: 'HOAN_THANH',
    });
    prisma.ve.findFirst.mockResolvedValue({ veId: 1 });

    await expect(
      service.createReview(42, { tripId: 101, rating: 5 }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException if review was created more than 3 days ago when updating', async () => {
    prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10 });
    prisma.phanHoi.findFirst.mockResolvedValue({
      phanHoiId: 7,
      khachHangId: 10,
      chuyenXeId: 101,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      thoiGian: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    });

    await expect(
      service.updateTripReview(1, 101, { rating: 4 }),
    ).rejects.toThrow(ConflictException);
  });

  describe('Admin Review Management', () => {
    it('getAdminReviews returns paginated reviews with filters', async () => {
      prisma.phanHoi.count.mockResolvedValue(1);
      prisma.phanHoi.findMany.mockResolvedValue([
        {
          phanHoiId: 1,
          mucDanhGia: 5,
          noiDung: 'Rất tốt',
          thoiGian: new Date('2026-10-10T10:00:00Z'),
          trangThai: 'HIEN_THI',
          khachHang: {
            khachHangId: 10,
            hoTen: 'Nguyễn Văn A',
            taiKhoan: {
              soDienThoai: '0901234567',
              email: 'a@example.com',
            },
          },
          chuyenXe: {
            chuyenXeId: 101,
            ngayKhoiHanh: new Date('2026-10-10T00:00:00Z'),
            gioKhoiHanh: new Date('1970-01-01T08:00:00Z'),
            tuyenXe: {
              tuyenXeId: 1,
              diemDi: 'Sài Gòn',
              diemDen: 'Đà Lạt',
            },
            xe: {
              bienSoXe: '51B-12345',
              loaiXe: { tenLoai: 'Limousine 34 giường' },
              nhaXe: { nhaXeId: 2, tenNhaXe: 'Phương Trang' },
            },
          },
        },
      ]);

      const result = await service.getAdminReviews({
        page: 1,
        pageSize: 10,
        rating: 5,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].rating).toBe(5);
      expect(result.data[0].customer.fullName).toBe('Nguyễn Văn A');
      expect(result.data[0].trip?.routeName).toBe('Sài Gòn - Đà Lạt');
      expect(result.meta.totalItems).toBe(1);
    });

    it('getAdminReviewStats calculates CSAT, satisfaction rate and negative count', async () => {
      prisma.phanHoi.findMany.mockResolvedValue([
        { mucDanhGia: 5, trangThai: 'HIEN_THI' },
        { mucDanhGia: 4, trangThai: 'HIEN_THI' },
        { mucDanhGia: 2, trangThai: 'HIEN_THI' },
        { mucDanhGia: 1, trangThai: 'DA_AN' },
      ]);

      const result = await service.getAdminReviewStats();

      expect(result.data.totalReviews).toBe(4);
      expect(result.data.averageRating).toBe(3.7); // (5+4+2)/3 = 3.666... -> 3.7
      expect(result.data.satisfactionRate).toBe(67); // 2 out of 3 (5 & 4 sao)
      expect(result.data.negativeCount).toBe(1); // 1 out of 3 (2 sao)
      expect(result.data.hiddenCount).toBe(1);
      expect(result.data.visibleCount).toBe(3);
    });

    it('updateAdminReviewStatus updates status to DA_AN', async () => {
      prisma.phanHoi.findUnique.mockResolvedValue({
        phanHoiId: 1,
        chuyenXe: { nhaXeId: 2 },
      });
      prisma.phanHoi.update.mockResolvedValue({
        phanHoiId: 1,
        trangThai: 'DA_AN',
        updatedAt: new Date(),
      });

      const result = await service.updateAdminReviewStatus(1, { status: 'DA_AN' });

      expect(result.data.status).toBe('DA_AN');
      expect(result.message).toContain('Đã ẩn');
    });

    it('updateAdminReviewStatus throws ForbiddenException if tenant admin accesses another company review', async () => {
      prisma.phanHoi.findUnique.mockResolvedValue({
        phanHoiId: 1,
        chuyenXe: { nhaXeId: 99 },
      });

      await expect(
        service.updateAdminReviewStatus(
          1,
          { status: 'DA_AN' },
          { taiKhoanId: 1, vaiTro: 'ADMIN', nhaXeId: 2 } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('replyAdminReview saves reply from bus company', async () => {
      prisma.phanHoi.findUnique.mockResolvedValue({
        phanHoiId: 1,
        chuyenXe: {
          nhaXeId: 2,
          xe: { nhaXe: { tenNhaXe: 'Phương Trang' } },
        },
      });
      prisma.phanHoi.update.mockResolvedValue({
        phanHoiId: 1,
        traLoi: 'Cảm ơn quý khách đã tin tưởng nhà xe!',
        thoiGianTraLoi: new Date('2026-10-10T12:00:00Z'),
        nguoiTraLoi: 'Phương Trang',
      });

      const result = await service.replyAdminReview(
        1,
        { reply: 'Cảm ơn quý khách đã tin tưởng nhà xe!' },
        { taiKhoanId: 1, vaiTro: 'ADMIN', nhaXeId: 2 } as any,
      );

      expect(result.data.reply?.content).toBe('Cảm ơn quý khách đã tin tưởng nhà xe!');
      expect(result.data.reply?.responderName).toBe('Phương Trang');
      expect(result.message).toContain('Đã gửi phản hồi');
    });

    it('replyAdminReview clears reply when reply text is empty', async () => {
      prisma.phanHoi.findUnique.mockResolvedValue({
        phanHoiId: 1,
        chuyenXe: {
          nhaXeId: 2,
          xe: { nhaXe: { tenNhaXe: 'Phương Trang' } },
        },
      });
      prisma.phanHoi.update.mockResolvedValue({
        phanHoiId: 1,
        traLoi: null,
        thoiGianTraLoi: null,
        nguoiTraLoi: null,
      });

      const result = await service.replyAdminReview(
        1,
        { reply: '' },
        { taiKhoanId: 1, vaiTro: 'ADMIN', nhaXeId: 2 } as any,
      );

      expect(result.data.reply).toBeNull();
      expect(result.message).toContain('Đã xóa phản hồi');
    });

    it('replyAdminReview throws ForbiddenException for another company review', async () => {
      prisma.phanHoi.findUnique.mockResolvedValue({
        phanHoiId: 1,
        chuyenXe: { nhaXeId: 99 },
      });

      await expect(
        service.replyAdminReview(
          1,
          { reply: 'Phản hồi trái phép' },
          { taiKhoanId: 1, vaiTro: 'ADMIN', nhaXeId: 2 } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
