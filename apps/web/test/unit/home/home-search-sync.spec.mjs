import assert from 'node:assert/strict';
import { test } from 'node:test';

function computeHomeSearchState(params, initialHasSearched = false) {
  const urlOrigin = params.get('from') || params.get('origin') || '';
  const urlDestination = params.get('to') || params.get('destination') || '';
  const urlDate = params.get('departureDate') || params.get('date') || '';

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());

  if (urlOrigin || urlDestination || urlDate) {
    return {
      selectedProvince: urlOrigin,
      selectedDistrict: urlDestination,
      selectedPrice: urlDate || today,
      hasSearched: true,
      shouldScroll: true,
    };
  }

  return {
    selectedProvince: '',
    selectedDistrict: '',
    selectedPrice: today,
    hasSearched: initialHasSearched,
    shouldScroll: false,
  };
}

test('Home search state initializes with empty form and initialHasSearched on /', () => {
  const params = new URLSearchParams('');
  const state = computeHomeSearchState(params, false);

  assert.equal(state.selectedProvince, '');
  assert.equal(state.selectedDistrict, '');
  assert.match(state.selectedPrice, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(state.hasSearched, false);
  assert.equal(state.shouldScroll, false);
});

test('Home search state populates from canonical params (from, to, departureDate)', () => {
  const params = new URLSearchParams(
    'from=TP.HCM&to=%C4%90%C3%A0+L%E1%BA%A1t&departureDate=2026-10-15',
  );
  const state = computeHomeSearchState(params);

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
  const state = computeHomeSearchState(params);

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
  const searchState = computeHomeSearchState(searchParams);
  assert.equal(searchState.hasSearched, true);

  const clearedParams = new URLSearchParams('');
  const clearedState = computeHomeSearchState(clearedParams, false);

  assert.equal(clearedState.selectedProvince, '');
  assert.equal(clearedState.selectedDistrict, '');
  assert.equal(clearedState.hasSearched, false);
  assert.equal(clearedState.shouldScroll, false);
});
