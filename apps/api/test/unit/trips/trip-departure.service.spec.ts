import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripDepartureService } from '../../../src/trips/trip-departure.service.js';
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

function setup() {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const service = new TripDepartureService(
    { chuyenXe: { updateMany } } as unknown as PrismaService,
    new ConfigService({ BUSINESS_TIME_ZONE: 'Asia/Ho_Chi_Minh' }),
  );
  return { service, updateMany };
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
      const { service, updateMany } = setup();
      await service.startDueTrips(new Date(now));
      expect(updateMany).toHaveBeenCalledWith({
        where: {
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
    await vi.advanceTimersByTimeAsync(1000);
    expect(updateMany).toHaveBeenCalledTimes(2);
    service.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(5000);
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
    await vi.advanceTimersByTimeAsync(3000);
    expect(updateMany).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(1000);
    expect(updateMany).toHaveBeenCalledTimes(2);
    service.onApplicationShutdown();
  });
});
