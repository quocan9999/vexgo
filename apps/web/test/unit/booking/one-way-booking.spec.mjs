import assert from 'node:assert/strict';
import test from 'node:test';
import { canPayForOneWayBooking } from '../../../src/features/booking/utils/one-way-booking.ts';

test('does not allow one-way payment after every seat is deselected', () => {
  assert.equal(canPayForOneWayBooking([], true), false);
});

test('requires both a selected seat and accepted terms for one-way payment', () => {
  assert.equal(canPayForOneWayBooking(['B05'], false), false);
  assert.equal(canPayForOneWayBooking(['B05'], true), true);
});
