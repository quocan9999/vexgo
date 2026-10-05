import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkTicketCancelEligibility,
  formatTimeAndDate,
} from '../../../src/features/tickets/services/cancel-eligibility.ts';

test('checkTicketCancelEligibility rejects already cancelled ticket', () => {
  const result = checkTicketCancelEligibility({
    status: 'HUY',
    departureTime: '2026-10-15T08:00:00.000Z',
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'ALREADY_CANCELLED');
  assert.equal(result.title, 'Vé đã được hủy');
  assert.match(result.message, /đã hoàn tất thủ tục hủy/);
});

test('checkTicketCancelEligibility rejects trip that has already departed', () => {
  const now = new Date('2026-10-05T10:00:00.000Z').getTime();
  const pastDeparture = '2026-10-05T08:00:00.000Z';

  const result = checkTicketCancelEligibility(
    {
      status: 'DA_THANH_TOAN',
      departureTime: pastDeparture,
    },
    now,
  );

  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'ALREADY_DEPARTED');
  assert.equal(result.title, 'Chuyến xe đã khởi hành');
  assert.match(result.message, /vé không còn giá trị hủy hoặc hoàn tiền/);
});

test('checkTicketCancelEligibility rejects trip departing in less than 12 hours', () => {
  const now = new Date('2026-10-05T10:00:00.000Z').getTime();
  const nearDeparture = '2026-10-05T18:00:00.000Z'; // 8 hours later

  const result = checkTicketCancelEligibility(
    {
      status: 'DA_THANH_TOAN',
      departureTime: nearDeparture,
    },
    now,
  );

  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'LESS_THAN_12_HOURS');
  assert.equal(result.title, 'Vé không đủ điều kiện hủy');
  assert.match(result.message, /dưới 12 tiếng/);
});

test('checkTicketCancelEligibility approves ticket departing in >= 12 hours', () => {
  const now = new Date('2026-10-05T10:00:00.000Z').getTime();
  const validDeparture = '2026-10-06T10:00:00.000Z'; // 24 hours later

  const result = checkTicketCancelEligibility(
    {
      status: 'DA_THANH_TOAN',
      departureTime: validDeparture,
    },
    now,
  );

  assert.equal(result.eligible, true);
  assert.equal(result.title, '');
});

test('checkTicketCancelEligibility uses the authoritative quote returned by the API', () => {
  const result = checkTicketCancelEligibility({
    status: 'DA_THANH_TOAN',
    departureTime: '2026-10-06T10:00:00.000Z',
    cancellation: {
      eligible: true,
      cancelFeeRate: 0.2,
      cancelFee: 50000,
      refundAmount: 200000,
    },
  });

  assert.equal(result.eligible, true);
  assert.equal(result.cancelFeeRate, 0.2);
  assert.equal(result.cancelFee, 50000);
  assert.equal(result.refundAmount, 200000);
});

test('checkTicketCancelEligibility honors an authoritative rejection from the API', () => {
  const result = checkTicketCancelEligibility({
    status: 'DA_THANH_TOAN',
    departureTime: '2029-10-06T10:00:00.000Z',
    cancellation: {
      eligible: false,
      reason: 'LESS_THAN_12_HOURS',
      cancelFeeRate: 0,
      cancelFee: 0,
      refundAmount: 0,
    },
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'LESS_THAN_12_HOURS');
});

test('checkTicketCancelEligibility calculates 10% fee when departure is > 24 hours away', () => {
  const now = new Date('2026-10-05T10:00:00.000Z').getTime();
  const departure = '2026-10-06T11:00:00.000Z'; // 25 hours later

  const result = checkTicketCancelEligibility(
    {
      status: 'DA_THANH_TOAN',
      price: 200000,
      departureTime: departure,
    },
    now,
  );

  assert.equal(result.eligible, true);
  assert.equal(result.cancelFeeRate, 0.1);
  assert.equal(result.cancelFee, 20000);
  assert.equal(result.refundAmount, 180000);
});

test('checkTicketCancelEligibility calculates 20% fee when departure is <= 24 hours and >= 12 hours away', () => {
  const now = new Date('2026-10-05T10:00:00.000Z').getTime();
  const departure24h = '2026-10-06T10:00:00.000Z'; // exactly 24 hours later
  const departure18h = '2026-10-06T04:00:00.000Z'; // 18 hours later
  const departure12h = '2026-10-05T22:00:00.000Z'; // exactly 12 hours later

  const res24 = checkTicketCancelEligibility(
    { status: 'DA_THANH_TOAN', price: 200000, departureTime: departure24h },
    now,
  );
  assert.equal(res24.eligible, true);
  assert.equal(res24.cancelFeeRate, 0.2);
  assert.equal(res24.cancelFee, 40000);
  assert.equal(res24.refundAmount, 160000);

  const res18 = checkTicketCancelEligibility(
    { status: 'DA_THANH_TOAN', price: 200000, departureTime: departure18h },
    now,
  );
  assert.equal(res18.eligible, true);
  assert.equal(res18.cancelFeeRate, 0.2);
  assert.equal(res18.cancelFee, 40000);
  assert.equal(res18.refundAmount, 160000);

  const res12 = checkTicketCancelEligibility(
    { status: 'DA_THANH_TOAN', price: 200000, departureTime: departure12h },
    now,
  );
  assert.equal(res12.eligible, true);
  assert.equal(res12.cancelFeeRate, 0.2);
  assert.equal(res12.cancelFee, 40000);
  assert.equal(res12.refundAmount, 160000);
});

test('checkTicketCancelEligibility does not lock into stale snapshot across 24h and 12h boundaries', () => {
  const lookupTime = new Date('2026-10-05T10:00:00.000Z').getTime();
  const departureTime = '2026-10-06T10:30:00.000Z'; // 24h 30m away at lookup

  const ticket = {
    status: 'DA_THANH_TOAN',
    price: 300000,
    departureTime,
    cancellation: {
      eligible: true,
      cancelFeeRate: 0.1,
      cancelFee: 30000,
      refundAmount: 270000,
    },
  };

  // At lookup time (>24h): 10%
  const initial = checkTicketCancelEligibility(ticket, lookupTime);
  assert.equal(initial.eligible, true);
  assert.equal(initial.cancelFeeRate, 0.1);
  assert.equal(initial.refundAmount, 270000);

  // User stays on page 1 hour later (now 23h 30m away, <= 24h): MUST recalculate to 20%
  const oneHourLater = lookupTime + 60 * 60 * 1000;
  const rechecked24h = checkTicketCancelEligibility(ticket, oneHourLater);
  assert.equal(rechecked24h.eligible, true);
  assert.equal(rechecked24h.cancelFeeRate, 0.2);
  assert.equal(rechecked24h.cancelFee, 60000);
  assert.equal(rechecked24h.refundAmount, 240000);

  // User confirms 13 hours later (now 11h 30m away, < 12h): MUST become ineligible
  const thirteenHoursLater = lookupTime + 13 * 60 * 60 * 1000;
  const rechecked12h = checkTicketCancelEligibility(ticket, thirteenHoursLater);
  assert.equal(rechecked12h.eligible, false);
  assert.equal(rechecked12h.reason, 'LESS_THAN_12_HOURS');
});

test('formatTimeAndDate formats valid date correctly', () => {
  const info = formatTimeAndDate('2026-10-07T08:30:00.000Z');
  assert.ok(info.date.includes('2026'));
  assert.ok(info.time.length === 5);
});

