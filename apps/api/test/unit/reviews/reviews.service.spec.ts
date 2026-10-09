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
    ngayKhoiHanh: new Date('2026-10-05T00:00:00.000Z'),
    gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
    trangThai: 'HOAN_THANH',
  };

  const prisma = {
    khachHang: { findUnique: vi.fn() },
    chuyenXe: { findUnique: vi.fn() },
    ve: { findFirst: vi.fn() },
    phanHoi: { findFirst: vi.fn(), create: vi.fn() },
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
});
