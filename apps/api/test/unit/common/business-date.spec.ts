import { describe, expect, it } from 'vitest';
import * as businessDateModule from '../../../src/common/time/business-date.js';

const businessDate = businessDateModule as unknown as {
  getBusinessDate?: (timeZone: string, now: Date) => string;
  businessDateStartUtc?: (dateOnly: string, timeZone: string) => Date;
  resolveBusinessTimeZone?: (configuredTimeZone: string | undefined) => string;
};

describe('business date helpers', () => {
  it('uses the configured timezone at the local midnight boundary', () => {
    expect(
      businessDate.getBusinessDate?.(
        'Asia/Ho_Chi_Minh',
        new Date('2026-08-31T16:59:59.000Z'),
      ),
    ).toBe('2026-08-31');
    expect(
      businessDate.getBusinessDate?.(
        'Asia/Ho_Chi_Minh',
        new Date('2026-08-31T17:00:00.000Z'),
      ),
    ).toBe('2026-09-01');
  });

  it('resolves a date-only value to the start of that business date in UTC', () => {
    expect(
      businessDate
        .businessDateStartUtc?.('2026-09-01', 'Asia/Ho_Chi_Minh')
        .toISOString(),
    ).toBe('2026-08-31T17:00:00.000Z');
  });

  it('uses the established Ho Chi Minh timezone fallback for an empty setting', () => {
    expect(businessDate.resolveBusinessTimeZone?.('')).toBe(
      'Asia/Ho_Chi_Minh',
    );
  });

  describe('computeArrival and calculateClockTime', () => {
    const tz = 'Asia/Ho_Chi_Minh';
    const departureDate = new Date('2026-10-05T00:00:00.000Z');
    const departureTime = new Date('1970-01-01T08:00:00.000Z');

    it('computes arrival time accurately for standard duration (7 hours / 420m)', () => {
      const arrival = businessDateModule.computeArrival(
        departureDate,
        departureTime,
        420,
        null,
        tz,
      );
      // Dep: 2026-10-05 08:00 VN = 2026-10-05T01:00:00.000Z
      // Arr: +7h = 2026-10-05 15:00 VN = 2026-10-05T08:00:00.000Z
      expect(arrival).toBe('2026-10-05T08:00:00.000Z');
    });

    it('preserves the next day for a 24-hour journey (1440m) instead of same-day arrival', () => {
      const arrival = businessDateModule.computeArrival(
        departureDate,
        departureTime,
        1440,
        null,
        tz,
      );
      // Dep: 2026-10-05 08:00 VN = 2026-10-05T01:00:00.000Z
      // Arr: +24h = 2026-10-06 08:00 VN = 2026-10-06T01:00:00.000Z (Next day!)
      expect(arrival).toBe('2026-10-06T01:00:00.000Z');
    });

    it('preserves multi-day journeys (36 hours / 2160m)', () => {
      const arrival = businessDateModule.computeArrival(
        departureDate,
        departureTime,
        2160,
        null,
        tz,
      );
      // Dep: 2026-10-05 08:00 VN = 2026-10-05T01:00:00.000Z
      // Arr: +36h = 2026-10-06 20:00 VN = 2026-10-06T13:00:00.000Z (Next day evening)
      expect(arrival).toBe('2026-10-06T13:00:00.000Z');
    });

    it('falls back to gioDen when durationMinutes is null', () => {
      const fallbackGioDen = new Date('1970-01-01T15:00:00.000Z');
      const arrival = businessDateModule.computeArrival(
        departureDate,
        departureTime,
        null,
        fallbackGioDen,
        tz,
      );
      expect(arrival).toBe('2026-10-05T08:00:00.000Z');
    });

    it('calculateClockTime calculates correct 24h clock time', () => {
      const clock8 = new Date('1970-01-01T08:00:00.000Z');
      // +7h = 15:00
      expect(businessDateModule.calculateClockTime(clock8, 420)?.toISOString()).toBe(
        '1970-01-01T15:00:00.000Z',
      );
      // +24h = 08:00
      expect(businessDateModule.calculateClockTime(clock8, 1440)?.toISOString()).toBe(
        '1970-01-01T08:00:00.000Z',
      );
      // +26h = 10:00
      expect(businessDateModule.calculateClockTime(clock8, 1560)?.toISOString()).toBe(
        '1970-01-01T10:00:00.000Z',
      );
    });
  });
});

