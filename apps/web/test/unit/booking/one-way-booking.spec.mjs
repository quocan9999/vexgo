import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canPayForOneWayBooking,
  formatTripDateTime,
} from '../../../src/features/booking/utils/one-way-booking.ts';

test('does not allow one-way payment after every seat is deselected', () => {
  assert.equal(canPayForOneWayBooking([], true), false);
});

test('requires both a selected seat and accepted terms for one-way payment', () => {
  assert.equal(canPayForOneWayBooking(['B05'], false), false);
  assert.equal(canPayForOneWayBooking(['B05'], true), true);
});

test('formatTripDateTime formats ISO date to display string with fallback', () => {
  const formatted = formatTripDateTime('2026-10-15T08:30:00.000Z', '08:30 15/10/2026');
  assert.ok(formatted.includes('15/10/2026'));
  assert.equal(formatTripDateTime('', 'fallback-time'), 'fallback-time');
});
