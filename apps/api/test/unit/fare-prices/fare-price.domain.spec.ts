import { describe, expect, it } from 'vitest';
import * as farePriceDomainModule from '../../../src/fare-prices/fare-price.domain.js';

const farePriceDomain = farePriceDomainModule as unknown as {
  deriveEffectiveState?: (
    status: string,
    validFrom: string,
    validTo: string | null,
    businessDate: string,
  ) => string;
};

describe('Fare Price effective state', () => {
  it('keeps suspended configuration suspended regardless of its date range', () => {
    expect(
      farePriceDomain.deriveEffectiveState?.(
        'TAM_NGUNG',
        '2026-09-01',
        '2026-09-30',
        '2026-10-01',
      ),
    ).toBe('TAM_NGUNG');
  });

  it('treats the start date and end date as inclusive', () => {
    expect(
      farePriceDomain.deriveEffectiveState?.(
        'HOAT_DONG',
        '2026-09-01',
        '2026-09-30',
        '2026-09-01',
      ),
    ).toBe('DANG_HIEU_LUC');
    expect(
      farePriceDomain.deriveEffectiveState?.(
        'HOAT_DONG',
        '2026-09-01',
        '2026-09-30',
        '2026-09-30',
      ),
    ).toBe('DANG_HIEU_LUC');
  });

  it('distinguishes future and expired active intervals', () => {
    expect(
      farePriceDomain.deriveEffectiveState?.(
        'HOAT_DONG',
        '2026-09-01',
        '2026-09-30',
        '2026-08-31',
      ),
    ).toBe('CHUA_HIEU_LUC');
    expect(
      farePriceDomain.deriveEffectiveState?.(
        'HOAT_DONG',
        '2026-09-01',
        '2026-09-30',
        '2026-10-01',
      ),
    ).toBe('HET_HIEU_LUC');
  });

  it('treats a null end date as open-ended', () => {
    expect(
      farePriceDomain.deriveEffectiveState?.(
        'HOAT_DONG',
        '2026-09-01',
        null,
        '2099-01-01',
      ),
    ).toBe('DANG_HIEU_LUC');
  });

  it('rejects a legacy persisted DANG_AP_DUNG status instead of exposing it', () => {
    expect(() =>
      farePriceDomain.deriveEffectiveState?.(
        'DANG_AP_DUNG',
        '2026-09-01',
        null,
        '2026-09-15',
      ),
    ).toThrow('Invalid persisted fare price status: DANG_AP_DUNG');
  });
});
