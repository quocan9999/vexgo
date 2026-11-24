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

  assert.deepEqual(
    buildTripListSearchParams({
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      date: '2026-10-15',
      page: 1,
      sort: 'departure-desc',
    }),
    {
      from: 'TP.HCM',
      to: 'Đà Lạt',
      departureDate: '2026-10-15',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'desc',
    },
  );

  assert.deepEqual(
    buildTripListSearchParams({
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      date: '2026-10-15',
      page: 1,
      sort: 'price-desc',
    }),
    {
      from: 'TP.HCM',
      to: 'Đà Lạt',
      departureDate: '2026-10-15',
      page: 1,
      pageSize: 10,
      sortBy: 'price',
      sortDirection: 'desc',
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

test('selected pickup and dropoff filters stay visible after sorting changes the loaded page', () => {
  assert.deepEqual(
    tripListState.keepSelectedFilterValue?.(
      ['Bến xe Miền Đông mới'],
      'Ngã tư Thủ Đức',
    ),
    ['Ngã tư Thủ Đức', 'Bến xe Miền Đông mới'],
  );
  assert.deepEqual(
    tripListState.keepSelectedFilterValue?.(
      ['Bến xe Đà Lạt'],
      'Văn phòng trung tâm',
    ),
    ['Văn phòng trung tâm', 'Bến xe Đà Lạt'],
  );
  assert.deepEqual(
    tripListState.keepSelectedFilterValue?.(['Bến xe Đà Lạt'], 'all'),
    ['Bến xe Đà Lạt'],
  );
});

test('isTripUpcoming and filterUpcomingTrips filter out trips whose departure time has passed', () => {
  const now = new Date('2026-11-08T05:15:00.000Z').getTime();

  const pastTrip = {
    id: '1',
    departureDate: '2026-11-08T04:00:00.000Z',
  };
  const futureTrip = {
    id: '2',
    departureDate: '2026-11-08T06:00:00.000Z',
  };

  assert.equal(tripListState.isTripUpcoming(pastTrip, now), false);
  assert.equal(tripListState.isTripUpcoming(futureTrip, now), true);

  const filtered = tripListState.filterUpcomingTrips(
    [pastTrip, futureTrip],
    now,
  );
  assert.deepEqual(filtered, [futureTrip]);
});
