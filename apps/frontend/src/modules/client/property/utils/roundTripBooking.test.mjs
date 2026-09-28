import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRoundTripBookingHref } from './roundTripBooking.ts';

test('builds a round-trip booking URL with both selected trip IDs', () => {
  const href = buildRoundTripBookingHref({
    currentSearch: 'needType=BUY&tripType=round-trip&price=2026-09-27&returnDate=2026-09-30',
    outboundId: '1',
    returnId: '6',
  });

  assert.equal(
    href,
    '/posts/1?needType=BUY&tripType=round-trip&price=2026-09-27&returnDate=2026-09-30&outboundId=1&returnId=6',
  );
});

test('forces round-trip mode and encodes IDs safely', () => {
  const href = buildRoundTripBookingHref({
    currentSearch: 'tripType=one-way',
    outboundId: 'trip out',
    returnId: 'trip/back',
  });

  assert.equal(
    href,
    '/posts/trip%20out?tripType=round-trip&outboundId=trip+out&returnId=trip%2Fback',
  );
});
