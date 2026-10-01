import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRoundTripBookingHref,
  getReturnTripLocations,
} from '../../../src/features/booking/utils/round-trip-booking.ts';

test('keeps both selected trip IDs in a round-trip booking URL', () => {
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

test('encodes trip IDs without losing round-trip mode', () => {
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

test('builds a complete query when the current search is empty', () => {
  const href = buildRoundTripBookingHref({
    currentSearch: '',
    outboundId: '1',
    returnId: '2',
  });

  assert.equal(href, '/posts/1?tripType=round-trip&outboundId=1&returnId=2');
});

test('replaces stale selected trip IDs while preserving unrelated filters', () => {
  const href = buildRoundTripBookingHref({
    currentSearch: 'tripType=one-way&outboundId=old&returnId=stale&promo=SAVE',
    outboundId: 'new',
    returnId: 'back',
  });

  assert.equal(
    href,
    '/posts/new?tripType=round-trip&outboundId=new&returnId=back&promo=SAVE',
  );
});

test('getReturnTripLocations correctly maps origin to pickup and destination to dropoff', () => {
  const returnPost = {
    province: 'Đà Lạt',
    district: 'TP.HCM',
  };

  const locations = getReturnTripLocations(returnPost);

  assert.equal(locations.pickup, 'Đà Lạt', 'Pickup must be return trip origin');
  assert.equal(locations.dropoff, 'TP.HCM', 'Dropoff must be return trip destination');
});
