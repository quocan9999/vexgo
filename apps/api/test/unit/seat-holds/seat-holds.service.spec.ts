import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeatHoldsService } from '../../../src/seat-holds/seat-holds.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('SeatHoldsService (Unit)', () => {
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
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      giuCho: {
        create: vi.fn().mockResolvedValue({ giuChoId: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    service = new SeatHoldsService(prisma as unknown as PrismaService);
  });

  describe('createSeatHold', () => {
    it('successfully creates hold, persists GiuCho and updates seat with giuChoId', async () => {
      const result = await service.createSeatHold(50, [101]);

      expect(result.holdToken).toBeDefined();
      expect(result.seatIds).toEqual([101]);
      expect(prisma.giuCho.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chuyenXeId: 50,
            trangThai: 'DANG_GIU',
          }),
        }),
      );
      expect(prisma.gheChuyenXe.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            chuyenXeId: 50,
            gheChuyenXeId: { in: [101] },
            trangThai: 'TRONG',
          },
          data: {
            trangThai: 'DANG_GIU',
            giuChoId: 1,
          },
        }),
      );
    });

    it('rejects with ConflictException if any seat is already occupied or held', async () => {
      prisma.gheChuyenXe.findFirst.mockResolvedValueOnce({
        ...sampleTripSeats[0],
        trangThai: 'DANG_GIU',
      });

      await expect(service.createSeatHold(50, [101])).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects with ConflictException if update count does not match requested seats', async () => {
      prisma.gheChuyenXe.updateMany.mockImplementation(async (args: any) => {
        if (args.where?.trangThai === 'TRONG') {
          return { count: 0 };
        }
        return { count: 1 };
      });

      await expect(service.createSeatHold(50, [101])).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('Seat Identity Contract', () => {
    it('uses gheChuyenXeId (tripSeatId) to hold seats', async () => {
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
    it('sweeps expired GiuCho records and reverts linked seats to TRONG', async () => {
      prisma.giuCho.findMany.mockResolvedValueOnce([{ giuChoId: 99 }]);
      prisma.gheChuyenXe.updateMany
        .mockResolvedValueOnce({ count: 2 }) // via giuChoId
        .mockResolvedValueOnce({ count: 0 }); // legacy fallback

      const released = await service.releaseStaleHolds();

      expect(released).toBe(2);
      expect(prisma.giuCho.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { giuChoId: { in: [99] } },
          data: { trangThai: 'HET_HAN' },
        }),
      );
      expect(prisma.gheChuyenXe.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { giuChoId: { in: [99] }, trangThai: 'DANG_GIU' },
          data: { trangThai: 'TRONG', giuChoId: null },
        }),
      );
    });
  });

  describe('verifyHold and consumeHold', () => {
    it('consumes hold and marks GiuCho as DA_DAT', async () => {
      const hold = await service.createSeatHold(50, [101]);
      const consumed = await service.consumeHold(hold.holdToken, 50, [101]);

      expect(consumed).toBe(true);
      expect(prisma.giuCho.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { trangThai: 'DA_DAT' },
        }),
      );
    });
  });

  describe('Credential leakage in logs prevention (discussion_r4222294130)', () => {
    it('does not log raw holdToken during create, release or consume operations', async () => {
      const logSpy = vi.spyOn((service as any).logger, 'log');

      const hold = await service.createSeatHold(50, [101]);
      const createLogCall = logSpy.mock.calls.find((call) =>
        String(call[0]).includes('Created seat hold'),
      );
      expect(createLogCall).toBeDefined();
      expect(String(createLogCall![0])).not.toContain(hold.holdToken);
      expect(String(createLogCall![0])).toContain('tokenHash:');

      await service.releaseSeatHold(hold.holdToken);
      const releaseLogCall = logSpy.mock.calls.find((call) =>
        String(call[0]).includes('Released seat hold'),
      );
      if (releaseLogCall) {
        expect(String(releaseLogCall[0])).not.toContain(hold.holdToken);
      }

      await service.consumeHold(hold.holdToken, 50, [101]);
      const consumeLogCall = logSpy.mock.calls.find((call) =>
        String(call[0]).includes('Consumed seat hold'),
      );
      if (consumeLogCall) {
        expect(String(consumeLogCall[0])).not.toContain(hold.holdToken);
      }
    });
  });
});
