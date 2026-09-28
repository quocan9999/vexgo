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
});
