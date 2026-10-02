import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildHomeSearchQuery,
  deriveHomeSearchState,
} from '../../../src/features/home/services/home-search-state.ts';

const TODAY = '2026-10-02';

test('Home search state initializes with empty form and initialHasSearched on /', () => {
  const params = new URLSearchParams('');
  const state = deriveHomeSearchState(params, false, TODAY);

  assert.equal(state.selectedProvince, '');
  assert.equal(state.selectedDistrict, '');
  assert.equal(state.selectedPrice, TODAY);
  assert.equal(state.tripType, 'one-way');
  assert.equal(state.returnDate, '');
  assert.equal(state.hasSearched, false);
  assert.equal(state.shouldScroll, false);
});

test('Home search state populates from canonical params (from, to, departureDate)', () => {
  const params = new URLSearchParams(
    'from=TP.HCM&to=%C4%90%C3%A0+L%E1%BA%A1t&departureDate=2026-10-15',
  );
  const state = deriveHomeSearchState(params, false, TODAY);

  assert.equal(state.selectedProvince, 'TP.HCM');
  assert.equal(state.selectedDistrict, 'Đà Lạt');
  assert.equal(state.selectedPrice, '2026-10-15');
  assert.equal(state.hasSearched, true);
  assert.equal(state.shouldScroll, true);
});

test('Home search state populates from alias params (origin, destination, date)', () => {
  const params = new URLSearchParams(
    'origin=C%E1%BA%A7n+Th%C6%A1&destination=R%E1%BA%A1ch+Gi%C3%A1&date=2026-11-01',
  );
  const state = deriveHomeSearchState(params, false, TODAY);

  assert.equal(state.selectedProvince, 'Cần Thơ');
  assert.equal(state.selectedDistrict, 'Rạch Giá');
  assert.equal(state.selectedPrice, '2026-11-01');
  assert.equal(state.hasSearched, true);
  assert.equal(state.shouldScroll, true);
});

test('Home search state resets completely when navigating from search query back to /', () => {
  const searchParams = new URLSearchParams(
    'from=TP.HCM&to=%C4%90%C3%A0+L%E1%BA%A1t&departureDate=2026-10-15',
  );
  const searchState = deriveHomeSearchState(searchParams, false, TODAY);
  assert.equal(searchState.hasSearched, true);

  const clearedParams = new URLSearchParams('');
  const clearedState = deriveHomeSearchState(clearedParams, false, TODAY);

  assert.equal(clearedState.selectedProvince, '');
  assert.equal(clearedState.selectedDistrict, '');
  assert.equal(clearedState.hasSearched, false);
  assert.equal(clearedState.shouldScroll, false);
});

test('Home search state preserves round-trip mode and return date from URL', () => {
  const params = new URLSearchParams(
    'origin=TP.HCM&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-10-15&tripType=round-trip&returnDate=2026-10-20',
  );

  const state = deriveHomeSearchState(params, false, TODAY);

  assert.equal(state.tripType, 'round-trip');
  assert.equal(state.returnDate, '2026-10-20');
});

test('Home search state drops stale return date for one-way URLs', () => {
  const params = new URLSearchParams(
    'origin=TP.HCM&destination=%C4%90%C3%A0+L%E1%BA%A1t&date=2026-10-15&tripType=one-way&returnDate=2026-10-20',
  );

  const state = deriveHomeSearchState(params, false, TODAY);

  assert.equal(state.tripType, 'one-way');
  assert.equal(state.returnDate, '');
});

test('Home search query only includes a return date for round trips', () => {
  const oneWayQuery = new URLSearchParams(
    buildHomeSearchQuery({
      tripType: 'one-way',
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      departureDate: '2026-10-15',
      returnDate: '2026-10-20',
    }),
  );
  const roundTripQuery = new URLSearchParams(
    buildHomeSearchQuery({
      tripType: 'round-trip',
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      departureDate: '2026-10-15',
      returnDate: '2026-10-20',
    }),
  );

  assert.equal(oneWayQuery.get('returnDate'), null);
  assert.equal(roundTripQuery.get('returnDate'), '2026-10-20');
});
