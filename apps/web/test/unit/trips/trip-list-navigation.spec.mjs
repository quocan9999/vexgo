import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTripBookingHref,
  buildTripListSearchParams,
} from '../../../src/features/trips/services/trip-list-state.ts';

test('round-trip booking navigation keeps both trip IDs and travel dates', () => {
  const href = buildTripBookingHref({
    currentSearch:
      'from=TP.HCM&to=%C4%90%C3%A0+L%E1%BA%A1t&departureDate=2026-10-15&returnDate=2026-10-18&tripType=round-trip',
    outboundId: '21',
    returnId: '35',
  });

  assert.equal(
    href,
    '/trips/21?from=TP.HCM&to=%C4%90%C3%A0+L%E1%BA%A1t&departureDate=2026-10-15&returnDate=2026-10-18&tripType=round-trip&outboundId=21&returnId=35',
  );
});

test('one-way booking navigation removes stale return-trip context', () => {
  const href = buildTripBookingHref({
    currentSearch: 'tripType=round-trip&returnId=35&returnDate=2026-10-18',
    outboundId: '21',
  });

  assert.equal(href, '/trips/21?tripType=one-way&outboundId=21');
});

test('trip list query sends the requested page and server-side sort', () => {
  assert.deepEqual(
    buildTripListSearchParams({
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      date: '2026-10-15',
      page: 2,
      sort: 'price',
    }),
    {
      from: 'TP.HCM',
      to: 'Đà Lạt',
      departureDate: '2026-10-15',
      page: 2,
      pageSize: 10,
      sortBy: 'price',
      sortDirection: 'asc',
    },
  );
});
