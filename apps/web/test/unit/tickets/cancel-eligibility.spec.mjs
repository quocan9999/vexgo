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

test('formatTimeAndDate formats valid date correctly', () => {
  const info = formatTimeAndDate('2026-10-07T08:30:00.000Z');
  assert.ok(info.date.includes('2026'));
  assert.ok(info.time.length === 5);
});
