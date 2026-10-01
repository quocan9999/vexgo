import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as roundTripBooking from '../../../src/features/booking/utils/round-trip-booking.ts';

test('round-trip fare keeps API prices in đồng without multiplying by 1000', () => {
  assert.equal(
    roundTripBooking.calculateRoundTripFare?.({
      outboundUnitFare: 300000,
      outboundSeatCount: 1,
      returnUnitFare: 300000,
      returnSeatCount: 1,
    }),
    600000,
  );
});
