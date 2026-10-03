import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTripBookingHref,
  buildTripListSearchParams,
} from '../../../src/features/trips/services/trip-list-state.ts';
import * as tripListState from '../../../src/features/trips/services/trip-list-state.ts';

test('only the active trip leg summary card is highlighted', () => {
  assert.deepEqual(tripListState.getTripSummaryCardStates?.('outbound'), {
    outbound: 'active',
    return: 'muted',
  });
  assert.deepEqual(tripListState.getTripSummaryCardStates?.('return'), {
    outbound: 'muted',
    return: 'active',
  });
});

test('choosing the return trip after an outbound trip opens round-trip booking', () => {
  assert.equal(
    tripListState.buildRoundTripBookingHrefAfterSelection?.({
      currentSearch:
        'from=TP.HCM&to=%C4%90%C3%A0+L%E1%BA%A1t&departureDate=2026-10-15&returnDate=2026-10-18&tripType=round-trip',
      activeLeg: 'return',
      chosenTripId: '35',
      selectedOutboundId: '21',
      selectedReturnId: null,
    }),
    '/trips/21?from=TP.HCM&to=%C4%90%C3%A0+L%E1%BA%A1t&departureDate=2026-10-15&returnDate=2026-10-18&tripType=round-trip&outboundId=21&returnId=35',
  );
});

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

test('trip list sends keyword and vehicle filters before server pagination', () => {
  assert.deepEqual(
    buildTripListSearchParams({
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      date: '2026-10-15',
      page: 1,
      sort: 'departure',
      search: 'Nhà xe A',
      vehicleType: 'Giường',
    }),
    {
      from: 'TP.HCM',
      to: 'Đà Lạt',
      departureDate: '2026-10-15',
      search: 'Nhà xe A',
      vehicleType: 'Giường',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    },
  );
});
