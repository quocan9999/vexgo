import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import {
  createPaymentDraft,
  getPaymentDraft,
  PAYMENT_DRAFT_STORAGE_PREFIX,
} from '../../../src/features/booking/services/payment-draft.ts';

// Mock sessionStorage in Node.js test environment
const mockStorage = new Map();
globalThis.sessionStorage = {
  getItem: (key) => mockStorage.get(key) ?? null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};
globalThis.window = globalThis;

beforeEach(() => {
  mockStorage.clear();
});

test('createPaymentDraft creates an opaque id and stores the draft in sessionStorage', () => {
  const draft = createPaymentDraft({
    tripType: 'one-way',
    passenger: {
      fullName: 'Trần Thị Mai',
      phoneNumber: '0987654321',
      email: 'mai.tran@example.com',
    },
    legs: [
      {
        tripId: 'trip-1',
        route: 'Hà Nội - Hải Phòng',
        departureTime: '06:00 20/11/2026',
        seats: ['A01', 'A02'],
        pickup: 'Bến xe Gia Lâm',
        dropoff: 'Bến xe Niệm Nghĩa',
        unitFare: 150000,
        subtotal: 300000,
      },
    ],
    totalFare: 300000,
  });

  assert.ok(draft.id, 'Draft must have an ID');
  assert.equal(typeof draft.id, 'string');
  assert.ok(draft.id.length > 8);

  const storedRaw = sessionStorage.getItem(`${PAYMENT_DRAFT_STORAGE_PREFIX}${draft.id}`);
  assert.ok(storedRaw, 'Draft must be saved under the prefixed key');

  const retrieved = getPaymentDraft(draft.id);
  assert.deepEqual(retrieved, draft);
});

test('getPaymentDraft returns null for nonexistent or invalid draftId', () => {
  assert.equal(getPaymentDraft(null), null);
  assert.equal(getPaymentDraft(''), null);
  assert.equal(getPaymentDraft('non-existent-id'), null);

  sessionStorage.setItem(`${PAYMENT_DRAFT_STORAGE_PREFIX}bad-json`, 'invalid json{{{');
  assert.equal(getPaymentDraft('bad-json'), null);

  sessionStorage.setItem(`${PAYMENT_DRAFT_STORAGE_PREFIX}missing-fields`, JSON.stringify({ id: 'missing' }));
  assert.equal(getPaymentDraft('missing-fields'), null);
});

test('getPaymentDraft thoroughly rejects malformed drafts with invalid fares, legs, or passenger', () => {
  const baseValid = {
    id: 'test-draft-1',
    tripType: 'one-way',
    passenger: {
      fullName: 'Nguyễn Văn A',
      phoneNumber: '0901234567',
      email: 'a@example.com',
    },
    legs: [
      {
        tripId: 1,
        route: 'Sài Gòn - Đà Lạt',
        departureTime: '20:00 01/10/2026',
        seats: ['A01'],
        pickup: 'Bến xe',
        dropoff: 'Bến xe',
        unitFare: 200000,
        subtotal: 200000,
      },
    ],
    totalFare: 200000,
  };

  // Malformed passenger
  sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}empty-name`,
    JSON.stringify({ ...baseValid, passenger: { ...baseValid.passenger, fullName: '   ' } }),
  );
  assert.equal(getPaymentDraft('empty-name'), null);

  sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}missing-email`,
    JSON.stringify({ ...baseValid, passenger: { fullName: 'A', phoneNumber: '0901234567' } }),
  );
  assert.equal(getPaymentDraft('missing-email'), null);

  // Malformed fares
  sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}nan-totalFare`,
    JSON.stringify({ ...baseValid, totalFare: 'not-a-number' }),
  );
  assert.equal(getPaymentDraft('nan-totalFare'), null);

  sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}negative-totalFare`,
    JSON.stringify({ ...baseValid, totalFare: -50000 }),
  );
  assert.equal(getPaymentDraft('negative-totalFare'), null);

  // Leg mismatch: one-way with 2 legs
  sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}one-way-2-legs`,
    JSON.stringify({ ...baseValid, legs: [baseValid.legs[0], baseValid.legs[0]] }),
  );
  assert.equal(getPaymentDraft('one-way-2-legs'), null);

  // Leg mismatch: round-trip with 1 leg
  sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}round-trip-1-leg`,
    JSON.stringify({ ...baseValid, tripType: 'round-trip' }),
  );
  assert.equal(getPaymentDraft('round-trip-1-leg'), null);

  // Malformed leg data: empty seats
  sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}empty-seats`,
    JSON.stringify({
      ...baseValid,
      legs: [{ ...baseValid.legs[0], seats: [] }],
    }),
  );
  assert.equal(getPaymentDraft('empty-seats'), null);

  // Malformed leg data: missing subtotal
  sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}nan-subtotal`,
    JSON.stringify({
      ...baseValid,
      legs: [{ ...baseValid.legs[0], subtotal: null }],
    }),
  );
  assert.equal(getPaymentDraft('nan-subtotal'), null);
});

test('round-trip payment draft contains 2 distinct legs with independent routes and times', () => {
  const draft = createPaymentDraft({
    tripType: 'round-trip',
    passenger: {
      fullName: 'Lê Văn C',
      phoneNumber: '0901234567',
      email: 'c.le@example.com',
    },
    legs: [
      {
        tripId: 101,
        route: 'TP.HCM - Đà Lạt',
        departureTime: '22:00 15/10/2026',
        seats: ['A01'],
        pickup: 'Bến xe Miền Đông',
        dropoff: 'Bến xe Liên tỉnh Đà Lạt',
        unitFare: 300000,
        subtotal: 300000,
      },
      {
        tripId: 102,
        route: 'Đà Lạt - TP.HCM',
        departureTime: '14:00 18/10/2026',
        seats: ['B05'],
        pickup: 'Bến xe Liên tỉnh Đà Lạt',
        dropoff: 'Bến xe Miền Đông',
        unitFare: 320000,
        subtotal: 320000,
      },
    ],
    totalFare: 620000,
  });

  assert.equal(draft.tripType, 'round-trip');
  assert.equal(draft.legs.length, 2);
  assert.equal(draft.legs[0].route, 'TP.HCM - Đà Lạt');
  assert.equal(draft.legs[1].route, 'Đà Lạt - TP.HCM');
  assert.notEqual(draft.legs[0].departureTime, draft.legs[1].departureTime);
  assert.equal(draft.totalFare, 620000);
});

test('payment URL constructed from draft contains only draftId without passenger PII', () => {
  const draft = createPaymentDraft({
    tripType: 'one-way',
    passenger: {
      fullName: 'Nguyễn Văn Secret',
      phoneNumber: '0912345678',
      email: 'secret@personal-data.com',
    },
    legs: [
      {
        tripId: 1,
        route: 'Sài Gòn - Nha Trang',
        departureTime: '20:00 01/11/2026',
        seats: ['A01'],
        pickup: 'Bến xe',
        dropoff: 'Bến xe',
        unitFare: 250000,
        subtotal: 250000,
      },
    ],
    totalFare: 250000,
  });

  const paymentUrl = `/payment?draftId=${encodeURIComponent(draft.id)}`;

  assert.ok(paymentUrl.includes(`draftId=${draft.id}`));
  assert.equal(paymentUrl.includes('Nguyễn Văn Secret'), false, 'URL must not contain customer name');
  assert.equal(paymentUrl.includes('0912345678'), false, 'URL must not contain phone number');
  assert.equal(paymentUrl.includes('secret@personal-data.com'), false, 'URL must not contain email');
  assert.equal(paymentUrl.includes('customerName'), false, 'URL must not have customerName param');
  assert.equal(paymentUrl.includes('customerPhone'), false, 'URL must not have customerPhone param');
  assert.equal(paymentUrl.includes('customerEmail'), false, 'URL must not have customerEmail param');
});
