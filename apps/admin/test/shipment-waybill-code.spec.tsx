import { describe, expect, it } from 'vitest';
import {
  normalizeScannedWaybill,
  WAYBILL_PATTERN,
} from '../src/features/shipments/utils/waybill-code';

describe('waybill-code utility', () => {
  it('validates standard waybill format with WAYBILL_PATTERN', () => {
    expect(WAYBILL_PATTERN.test('FUTA-VD-20261104-ABCD123')).toBe(true);
    expect(WAYBILL_PATTERN.test('VG-VD-TEST-601')).toBe(true);
    expect(WAYBILL_PATTERN.test('123456')).toBe(true);
    expect(WAYBILL_PATTERN.test('A')).toBe(false); // quá ngắn
    expect(WAYBILL_PATTERN.test('VD@123')).toBe(false); // ký tự đặc biệt
  });

  it('normalizes valid raw waybill codes with whitespace or casing', () => {
    expect(normalizeScannedWaybill('  futa-vd-123456  ')).toBe('FUTA-VD-123456');
    expect(normalizeScannedWaybill('VG-VD-999\r\n')).toBe('VG-VD-999');
    expect(normalizeScannedWaybill('vg-vd-test-01')).toBe('VG-VD-TEST-01');
  });

  it('extracts waybill from lookup URL query parameters or path', () => {
    expect(
      normalizeScannedWaybill('https://vexgo.vn/shipments?code=FUTA-VD-8888'),
    ).toBe('FUTA-VD-8888');
    expect(
      normalizeScannedWaybill('https://vexgo.vn/tra-cuu?waybill=vg-vd-777'),
    ).toBe('VG-VD-777');
    expect(
      normalizeScannedWaybill('https://vexgo.vn/shipments/VG-VD-LOOKUP-01'),
    ).toBe('VG-VD-LOOKUP-01');
  });

  it('returns null for null, empty or invalid input', () => {
    expect(normalizeScannedWaybill(null)).toBeNull();
    expect(normalizeScannedWaybill(undefined)).toBeNull();
    expect(normalizeScannedWaybill('')).toBeNull();
    expect(normalizeScannedWaybill('   \n\r   ')).toBeNull();
    expect(normalizeScannedWaybill('INVALID!@#$%^')).toBeNull();
    expect(normalizeScannedWaybill('short')).toBeNull();
  });
});
