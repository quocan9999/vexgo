import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TripsService } from '../../../src/trips/trips.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('TripsService - getTripAlternatives', () => {
  const baseDate = new Date('2026-10-10T08:00:00.000Z');

  const mockOriginalTrip = {
    chuyenXeId: 101,
    maChuyenXe: 'CX-101',
    ngayKhoiHanh: baseDate,
    gioKhoiHanh: baseDate,
    nhaXeId: 1,
    tuyenXeId: 5,
    trangThai: 'DANG_BAN',
    tuyenXe: {
      tuyenXeId: 5,
      diemDi: 'TP.HCM',
      diemDen: 'Đà Lạt',
      nhaXe: { tenNhaXe: 'Phương Trang' },
    },
    xe: {
      nhaXeId: 1,
      loaiXeId: 2,
      nhaXe: { tenNhaXe: 'Phương Trang' },
      loaiXe: { tenLoai: 'Limousine' },
    },
    gheChuyenXes: [
      { gheChuyenXeId: 1, trangThai: 'DA_DAT', ghe: { gheId: 1 } },
    ],
  };

  // Chuyến 1: Cùng nhà xe, sau 30 phút, giá 250k, còn 10 ghế
  const candidate1 = {
    chuyenXeId: 102,
    maChuyenXe: 'CX-102',
    ngayKhoiHanh: baseDate,
    gioKhoiHanh: new Date(baseDate.getTime() + 30 * 60 * 1000), // +30 mins
    nhaXeId: 1, // Cùng nhà xe
    tuyenXeId: 5,
    trangThai: 'DANG_BAN',
    tuyenXe: mockOriginalTrip.tuyenXe,
    xe: mockOriginalTrip.xe,
    gheChuyenXes: Array.from({ length: 10 }, (_, i) => ({
      gheChuyenXeId: 10 + i,
      trangThai: 'TRONG',
      ghe: { gheId: 10 + i },
    })),
  };

  // Chuyến 2: Khác nhà xe, sau 5 tiếng, giá rẻ hơn 200k, còn 5 ghế
  const candidate2 = {
    chuyenXeId: 103,
    maChuyenXe: 'CX-103',
    ngayKhoiHanh: baseDate,
    gioKhoiHanh: new Date(baseDate.getTime() + 5 * 60 * 60 * 1000), // +5 hours
    nhaXeId: 2, // Khác nhà xe
    tuyenXeId: 5,
    trangThai: 'DANG_BAN',
    tuyenXe: mockOriginalTrip.tuyenXe,
    xe: {
      nhaXeId: 2,
      loaiXeId: 2,
      nhaXe: { tenNhaXe: 'Thành Bưởi' },
      loaiXe: { tenLoai: 'Limousine' },
    },
    gheChuyenXes: Array.from({ length: 5 }, (_, i) => ({
      gheChuyenXeId: 30 + i,
      trangThai: 'TRONG',
      ghe: { gheId: 30 + i },
    })),
  };

  // Chuyến 3: Hết chỗ (0 available seats) -> Phải bị loại bỏ
  const candidateSoldOut = {
    chuyenXeId: 104,
    maChuyenXe: 'CX-104',
    ngayKhoiHanh: baseDate,
    gioKhoiHanh: new Date(baseDate.getTime() + 15 * 60 * 1000),
    nhaXeId: 1,
    tuyenXeId: 5,
    trangThai: 'DANG_BAN',
    tuyenXe: mockOriginalTrip.tuyenXe,
    xe: mockOriginalTrip.xe,
    gheChuyenXes: [
      { gheChuyenXeId: 99, trangThai: 'DA_DAT', ghe: { gheId: 99 } },
    ],
  };

  const prisma = {
    chuyenXe: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    bangGia: { findFirst: vi.fn() },
  };

  const service = new TripsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.chuyenXe.findUnique.mockResolvedValue(mockOriginalTrip);
    prisma.bangGia.findFirst.mockImplementation(async ({ where }) => {
      if (where.nhaXeId === 2) {
        return { bangGiaId: 2, giaNiemYet: 200000 };
      }
      return { bangGiaId: 1, giaNiemYet: 250000 };
    });
  });

  it('throws NotFoundException when original trip does not exist', async () => {
    prisma.chuyenXe.findUnique.mockResolvedValue(null);
    await expect(service.getTripAlternatives(999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('filters out trips with zero available seats and recommends valid trips', async () => {
    prisma.chuyenXe.findMany.mockResolvedValue([
      candidate1,
      candidate2,
      candidateSoldOut,
    ]);

    const alternatives = await service.getTripAlternatives(101, 5);

    expect(alternatives).toHaveLength(2);
    // candidateSoldOut (id: 104) is completely excluded
    expect(alternatives.map((a) => a.tripId)).not.toContain(104);

    // candidate1 has closer departure time (+30m) and same operator -> higher score
    expect(alternatives[0].tripId).toBe(102);
    expect(alternatives[0].recommendationReason).toContain('Cùng nhà xe');
    expect(alternatives[0].recommendationReason).toContain('30 phút');
    expect(alternatives[0].availableSeats).toBe(10);

    // candidate2 is present
    expect(alternatives[1].tripId).toBe(103);
    expect(alternatives[1].recommendationReason).toContain('tiết kiệm');
  });
});
