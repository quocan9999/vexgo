import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTripDateTime } from '../../../src/features/booking/utils/one-way-booking.ts';

test('formatTripDateTime formats ISO date to local Vietnam time and date', () => {
  // 2026-10-15T01:30:00.000Z in UTC+7 is 08:30 15/10/2026
  const formatted = formatTripDateTime('2026-10-15T01:30:00.000Z');
  assert.equal(formatted, '08:30 15/10/2026');
});

test('outbound and return trips produce their distinct departure times without hardcoded 20:00 or 00:45', () => {
  const outboundIso = '2026-11-05T07:15:00.000Z'; // 14:15 VN time
  const returnIso = '2026-11-08T10:30:00.000Z'; // 17:30 VN time

  const outboundFormatted = formatTripDateTime(outboundIso);
  const returnFormatted = formatTripDateTime(returnIso);

  assert.equal(outboundFormatted, '14:15 05/11/2026');
  assert.equal(returnFormatted, '17:30 08/11/2026');

  // Must not equal old hardcoded strings
  assert.notEqual(outboundFormatted, '20:00');
  assert.notEqual(returnFormatted, '00:45');
  assert.equal(outboundFormatted.includes('20:00'), false);
  assert.equal(returnFormatted.includes('00:45'), false);
});

test('formatTripDateTime gracefully falls back when date is missing or invalid', () => {
  assert.equal(formatTripDateTime(undefined), 'Chưa cập nhật');
  assert.equal(formatTripDateTime(''), 'Chưa cập nhật');
  assert.equal(formatTripDateTime('invalid-date-string'), 'Chưa cập nhật');
  assert.equal(formatTripDateTime(undefined, 'custom-fallback'), 'custom-fallback');
});
