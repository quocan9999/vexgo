import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeatHoldsService } from '../../../src/seat-holds/seat-holds.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('SeatHoldsService', () => {
  let service: SeatHoldsService;
  let prisma: any;

  const validFutureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const sampleTrip = {
    chuyenXeId: 50,
    trangThai: 'CHUA_KHOI_HANH',
    ngayKhoiHanh: validFutureDate,
    gioKhoiHanh: new Date('1970-01-01T08:00:00Z'),
  };

  const sampleTripSeats = [
    {
      gheChuyenXeId: 101,
      chuyenXeId: 50,
      gheId: 1,
      trangThai: 'TRONG',
      ghe: { soGhe: 'A01', viTri: 'Tầng dưới' },
    },
  ];

  beforeEach(() => {
    prisma = {
      chuyenXe: {
        findUnique: vi.fn().mockResolvedValue(sampleTrip),
      },
      gheChuyenXe: {
        findMany: vi.fn().mockResolvedValue(sampleTripSeats),
        findFirst: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    service = new SeatHoldsService(prisma as unknown as PrismaService);
  });

  describe('Concurrency CAS Regression Test', () => {
    it('ensures two competing requests cannot hold the same seat simultaneously', async () => {
      let callCount = 0;
      prisma.$transaction.mockImplementation(async (cb: any) => {
        callCount++;
        if (callCount === 1) {
          // Request 1 / Transaction 1: Ghế còn trống, update thành công
          const tx1 = {
            ...prisma,
            gheChuyenXe: {
              ...prisma.gheChuyenXe,
              findFirst: vi.fn().mockResolvedValue(null),
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          };
          return cb(tx1);
        } else {
          // Request 2 / Transaction 2: Ghế đã bị giữ, xung đột CAS
          const tx2 = {
            ...prisma,
            gheChuyenXe: {
              ...prisma.gheChuyenXe,
              findFirst: vi.fn().mockResolvedValue({
                ...sampleTripSeats[0],
                trangThai: 'DANG_GIU',
              }),
              updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
          };
          return cb(tx2);
        }
      });

      // Chạy 2 request cạnh tranh đồng thời qua Promise.allSettled
      const [result1, result2] = await Promise.allSettled([
        service.createSeatHold(50, [101]),
        service.createSeatHold(50, [101]),
      ]);

      // Chính xác 1 request thành công và 1 request thất bại vì xung đột
      const fulfilled = [result1, result2].filter(
        (r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled',
      );
      const rejected = [result1, result2].filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );

      expect(fulfilled).toHaveLength(1);
      expect(fulfilled[0].value.holdToken).toBeDefined();
      expect(fulfilled[0].value.seatIds).toEqual([101]);

      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    });
  });

  describe('Seat Identity Contract', () => {
    it('uses gheChuyenXeId (tripSeatId) to hold seats', async () => {
      prisma.gheChuyenXe.findFirst.mockResolvedValue(null);
      prisma.gheChuyenXe.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.createSeatHold(50, [101]);

      expect(result.seatIds).toEqual([101]);
      expect(prisma.gheChuyenXe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            chuyenXeId: 50,
            gheChuyenXeId: { in: [101] },
          },
        }),
      );
    });
  });

  describe('Durability: Stale Hold Cleanup', () => {
    it('reverts expired DANG_GIU seats back to TRONG', async () => {
      prisma.gheChuyenXe.updateMany.mockResolvedValue({ count: 3 });

      const released = await service.releaseStaleHolds();

      expect(released).toBe(3);
      expect(prisma.gheChuyenXe.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            trangThai: 'DANG_GIU',
          }),
          data: {
            trangThai: 'TRONG',
          },
        }),
      );
    });
  });
});
