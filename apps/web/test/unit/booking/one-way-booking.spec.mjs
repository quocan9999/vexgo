import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canPayForOneWayBooking,
  formatTripDateTime,
  buildOneWayPaymentQuery,
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

test('buildOneWayPaymentQuery includes customer-entered info and dynamic trip details', () => {
  const query = buildOneWayPaymentQuery({
    post: {
      title: 'Hà Nội - Hải Phòng',
      province: 'Hà Nội',
      district: 'Hải Phòng',
      createdAt: '2026-11-20T06:00:00.000Z',
    },
    selectedSeats: ['A01', 'A02'],
    baseFare: 150000,
    totalFare: 300000,
    customerName: 'Trần Thị Mai',
    customerPhone: '0987654321',
    customerEmail: 'mai.tran@example.com',
    pickup: 'Bến xe Gia Lâm',
    dropoff: 'Bến xe Niệm Nghĩa',
    luggageFee: 20000,
    luggageWeight: 10,
  });

  assert.equal(query.get('customerName'), 'Trần Thị Mai');
  assert.equal(query.get('customerPhone'), '0987654321');
  assert.equal(query.get('customerEmail'), 'mai.tran@example.com');
  assert.equal(query.get('pickup'), 'Bến xe Gia Lâm');
  assert.equal(query.get('dropoff'), 'Bến xe Niệm Nghĩa');
  assert.equal(query.get('seats'), 'A01, A02');
  assert.equal(query.get('count'), '2');
  assert.equal(query.get('totalFare'), '300000');
  assert.ok(query.get('departureTime')?.includes('20/11/2026'));
});
