import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTripListSearchParams } from '../../../src/features/trips/services/trip-list-state.ts';

test('buildTripListSearchParams accurately attaches new timed pickup/dropoff and area query parameters', () => {
  const params = buildTripListSearchParams({
    origin: 'TP.HCM',
    destination: 'Vũng Tàu',
    date: '2026-11-02',
    page: 1,
    sort: 'departureTime',
    fromLocationId: 79,
    toLocationId: 77,
    fromStationId: 101,
    toStationId: 202,
    fromAreaId: 79,
    toAreaId: 77,
  });

  assert.equal(params.from, 'TP.HCM');
  assert.equal(params.to, 'Vũng Tàu');
  assert.equal(params.fromLocationId, 79);
  assert.equal(params.toLocationId, 77);
  assert.equal(params.fromStationId, 101);
  assert.equal(params.toStationId, 202);
  assert.equal(params.fromAreaId, 79);
  assert.equal(params.toAreaId, 77);
  assert.equal(params.departureDate, '2026-11-02');
  assert.equal(params.sortBy, 'departureTime');
});

test('buildTripListSearchParams omits undefined parameters to keep clean query object', () => {
  const params = buildTripListSearchParams({
    origin: 'TP.HCM',
    destination: 'Đà Lạt',
    date: '2026-11-05',
    page: 1,
    sort: 'price',
  });

  assert.equal(params.from, 'TP.HCM');
  assert.equal(params.to, 'Đà Lạt');
  assert.equal(params.fromLocationId, undefined);
  assert.equal(params.toLocationId, undefined);
  assert.equal(params.fromStationId, undefined);
  assert.equal(params.toStationId, undefined);
  assert.equal(params.fromAreaId, undefined);
  assert.equal(params.toAreaId, undefined);
  assert.equal(params.sortBy, 'price');
});
