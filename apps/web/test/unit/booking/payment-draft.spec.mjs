import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import {
  createPaymentDraft,
  getPaymentDraft,
  getLatestActivePaymentDraft,
  markPaymentDraftTerminal,
  clearAllPaymentDrafts,
  PAYMENT_DRAFT_STORAGE_PREFIX,
} from '../../../src/features/booking/services/payment-draft.ts';

// Mock storage in Node.js test environment
function createMockStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const mockSessionStorage = createMockStorage();
const mockLocalStorage = createMockStorage();

globalThis.sessionStorage = mockSessionStorage;
globalThis.localStorage = mockLocalStorage;
globalThis.window = globalThis;

beforeEach(() => {
  mockSessionStorage.clear();
  mockLocalStorage.clear();
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

test('shipment payment drafts preserve the verified order references without requiring booking legs', () => {
  const draft = createPaymentDraft({
    kind: 'shipment',
    shipmentId: 601,
    paymentId: 801,
    waybillCode: 'VG-VD-TEST-601',
    orderCode: 'VG-DH-TEST-701',
    totalFare: 50000,
    sender: {
      fullName: 'Nguyễn An',
      phoneNumber: '0900000001',
      email: 'an@example.test',
    },
    receiver: {
      fullName: 'Trần Bình',
      phoneNumber: '0900000002',
    },
    route: {
      origin: 'Đà Lạt',
      destination: 'TP.HCM',
      departureTime: '2026-10-20T08:00:00.000Z',
    },
    pickupPoint: { name: 'Điểm gửi', address: 'Địa chỉ gửi' },
    dropoffPoint: { name: 'Điểm nhận', address: 'Địa chỉ nhận' },
  });

  assert.equal(draft.kind, 'shipment');
  assert.equal(getPaymentDraft(draft.id)?.paymentId, 801);
  assert.equal(getPaymentDraft(draft.id)?.waybillCode, 'VG-VD-TEST-601');

  sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}invalid-shipment-payment`,
    JSON.stringify({ ...draft, paymentId: 0 }),
  );
  assert.equal(getPaymentDraft('invalid-shipment-payment'), null);
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

test('unassigned shipment payment draft accepts a nullable departure and retains dropoff deadline', () => {
  const draft = createPaymentDraft({
    kind: 'shipment',
    shipmentId: 1,
    paymentId: 2,
    orderId: 3,
    waybillCode: 'VG-1',
    orderCode: 'ORDER-1',
    totalFare: 50000,
    dropoffDeadline: '2026-11-05T10:00:00Z',
    sender: { fullName: 'Người gửi', phoneNumber: '0900000001' },
    receiver: { fullName: 'Người nhận', phoneNumber: '0900000002' },
    route: { origin: 'Đà Lạt', destination: 'TP.HCM', departureTime: null },
    pickupPoint: { name: 'Bưu cục gửi', address: 'Địa chỉ gửi' },
    dropoffPoint: { name: 'Bưu cục nhận', address: 'Địa chỉ nhận' },
  });
  assert.equal(
    getPaymentDraft(draft.id)?.dropoffDeadline,
    '2026-11-05T10:00:00Z',
  );
  assert.equal(getPaymentDraft(draft.id)?.route.departureTime, null);
});

test('getPaymentDraft falls back to localStorage when sessionStorage is empty', () => {
  const draft = createPaymentDraft({
    tripType: 'one-way',
    passenger: {
      fullName: 'Phạm Văn B',
      phoneNumber: '0912345678',
      email: 'van.b@example.com',
    },
    legs: [
      {
        tripId: 'trip-99',
        route: 'Hà Nội - Sapa',
        departureTime: '22:00 20/11/2026',
        seats: ['A01'],
        pickup: 'Bến xe Mỹ Đình',
        dropoff: 'Bến xe Sapa',
        unitFare: 300000,
        subtotal: 300000,
      },
    ],
    totalFare: 300000,
  });

  // Verify it exists in both
  assert.ok(mockSessionStorage.getItem(`${PAYMENT_DRAFT_STORAGE_PREFIX}${draft.id}`));
  assert.ok(mockLocalStorage.getItem(`${PAYMENT_DRAFT_STORAGE_PREFIX}${draft.id}`));

  // Simulate tab close / reload in a new tab: clear sessionStorage
  mockSessionStorage.clear();

  const retrieved = getPaymentDraft(draft.id);
  assert.ok(retrieved, 'Should retrieve from localStorage');
  assert.equal(retrieved.id, draft.id);
  assert.equal(retrieved.passenger.fullName, 'Phạm Văn B');
});

test('getLatestActivePaymentDraft returns active unexpired draft and excludes expired or terminal drafts', () => {
  const now = Date.now();
  const futureExpiry = new Date(now + 10 * 60 * 1000).toISOString(); // +10 mins
  const pastExpiry = new Date(now - 1000).toISOString(); // expired

  const activeDraft = createPaymentDraft({
    tripType: 'one-way',
    paymentExpiresAt: futureExpiry,
    passenger: {
      fullName: 'Hoàng Văn C',
      phoneNumber: '0988888888',
      email: 'c@example.com',
    },
    legs: [
      {
        tripId: 'trip-1',
        route: 'Sài Gòn - Vũng Tàu',
        departureTime: '08:00 25/11/2026',
        seats: ['B01'],
        pickup: 'Bến xe Miền Đông',
        dropoff: 'Bến xe Vũng Tàu',
        unitFare: 150000,
        subtotal: 150000,
      },
    ],
    totalFare: 150000,
  });

  // 1. Should find active draft
  const activeInfo = getLatestActivePaymentDraft(now);
  assert.ok(activeInfo, 'Should find active draft');
  assert.equal(activeInfo.draft.id, activeDraft.id);
  assert.equal(activeInfo.expiresAtMs, Date.parse(futureExpiry));

  // 2. Draft expired should be ignored
  const pastActiveInfo = getLatestActivePaymentDraft(now + 15 * 60 * 1000);
  assert.equal(pastActiveInfo, null, 'Should return null when expired');

  // 3. Terminal draft should be ignored
  markPaymentDraftTerminal(activeDraft.id, 'paid');
  const terminalActiveInfo = getLatestActivePaymentDraft(now);
  assert.equal(terminalActiveInfo, null, 'Terminal draft must not be active');
});

test('clearAllPaymentDrafts completely removes all drafts and terminal keys from storage', () => {
  const now = Date.now();
  createPaymentDraft({
    tripType: 'one-way',
    paymentExpiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    passenger: {
      fullName: 'Khách A',
      phoneNumber: '0901234567',
      email: 'a@example.com',
    },
    legs: [
      {
        tripId: 'trip-1',
        route: 'Sài Gòn - Đà Lạt',
        departureTime: '08:00 25/11/2026',
        seats: ['A01'],
        pickup: 'Bến xe Miền Đông',
        dropoff: 'Bến xe Đà Lạt',
        unitFare: 200000,
        subtotal: 200000,
      },
    ],
    totalFare: 200000,
  });

  assert.ok(getLatestActivePaymentDraft(now) !== null, 'Draft should exist before clear');

  clearAllPaymentDrafts();

  assert.equal(getLatestActivePaymentDraft(now), null, 'Draft should be cleared');
  assert.equal(mockLocalStorage.length, 0, 'LocalStorage must be empty of drafts');
  assert.equal(mockSessionStorage.length, 0, 'SessionStorage must be empty of drafts');
});
