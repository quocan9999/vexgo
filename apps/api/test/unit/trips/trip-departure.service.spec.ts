import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripDepartureService } from '../../../src/trips/trip-departure.service.js';
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

function setup() {
  const findMany = vi
    .fn()
    .mockResolvedValue([{ chuyenXeId: 7 }, { chuyenXeId: 9 }]);
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const service = new TripDepartureService(
    { chuyenXe: { findMany, updateMany } } as unknown as PrismaService,
    new ConfigService({ BUSINESS_TIME_ZONE: 'Asia/Ho_Chi_Minh' }),
  );
  return { service, findMany, updateMany };
}

afterEach(() => vi.useRealTimers());

describe('automatic trip departure', () => {
  it.each([
    { now: '2026-10-22T16:59:59.000Z', date: '2026-10-22', time: '23:59:59' },
    { now: '2026-10-22T17:00:00.000Z', date: '2026-10-23', time: '00:00:00' },
    { now: '2026-10-23T00:00:00.000Z', date: '2026-10-23', time: '07:00:00' },
  ])(
    'uses business wall date/time including midnight for $now',
    async ({ now, date, time }) => {
      const { service, findMany, updateMany } = setup();
      await service.startDueTrips(new Date(now));
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { chuyenXeId: true },
          take: 100,
          orderBy: [
            { ngayKhoiHanh: 'asc' },
            { gioKhoiHanh: 'asc' },
            { chuyenXeId: 'asc' },
          ],
        }),
      );
      const read = findMany.mock.calls[0][0];
      expect(read.where).toEqual({
        trangThai: 'CHUA_KHOI_HANH',
        OR: [
          { ngayKhoiHanh: { lt: new Date(`${date}T00:00:00.000Z`) } },
          { ngayKhoiHanh: new Date(`${date}T00:00:00.000Z`), gioKhoiHanh: { lte: new Date(`1970-01-01T${time}.000Z`) } },
        ],
      });
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          chuyenXeId: { in: [7, 9] },
          trangThai: 'CHUA_KHOI_HANH',
          OR: [
            { ngayKhoiHanh: { lt: new Date(`${date}T00:00:00.000Z`) } },
            {
              ngayKhoiHanh: new Date(`${date}T00:00:00.000Z`),
              gioKhoiHanh: { lte: new Date(`1970-01-01T${time}.000Z`) },
            },
          ],
        },
        data: { trangThai: 'DANG_CHAY' },
      });
    },
  );
  it('starts polling on bootstrap, catches up overdue trips and clears its timer on shutdown', async () => {
    vi.useFakeTimers();
    const { service, updateMany } = setup();
    service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(updateMany).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(updateMany).toHaveBeenCalledTimes(2);
    service.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(updateMany).toHaveBeenCalledTimes(2);
  });
  it('does not overlap pending database updates', async () => {
    vi.useFakeTimers();
    const { service, updateMany } = setup();
    let finish!: () => void;
    updateMany.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(updateMany).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(updateMany).toHaveBeenCalledTimes(2);
    service.onApplicationShutdown();
  });
  it('does not write when no trips are due and bounds idle polling to two reads per minute', async () => {
    vi.useFakeTimers();
    const { service, findMany, updateMany } = setup();
    findMany.mockResolvedValue([]);
    service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(updateMany).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(updateMany).not.toHaveBeenCalled();
    service.onApplicationShutdown();
  });
});
