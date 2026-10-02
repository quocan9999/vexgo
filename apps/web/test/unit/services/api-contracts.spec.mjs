import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { authApi } from '../../../src/features/auth/services/auth.api.ts';
import { customerApi } from '../../../src/features/account/services/customer.api.ts';
import { routesApi } from '../../../src/features/routes/services/routes.api.ts';
import { tripsApi } from '../../../src/features/trips/services/trips.api.ts';
import { bookingsApi } from '../../../src/features/account/services/bookings.api.ts';
import { ticketsApi } from '../../../src/features/account/services/tickets.api.ts';
import { contactApi } from '../../../src/features/content/services/contact.api.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('former demo credentials are sent to the real login endpoint', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ data: { accessToken: 'server-token' } });
  };

  const response = await authApi.login('0912.345.678', '123456');

  assert.equal(calls[0].url, 'http://localhost:4000/api/v1/auth/login');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    phoneNumber: '+84912345678',
    password: '123456',
  });
  assert.equal(response.data.accessToken, 'server-token');
});

test('registration OTP methods preserve the common response envelope', async () => {
  const responses = [
    { data: { challengeId: 'challenge-id' } },
    { data: { otpProof: 'otp-proof' } },
  ];
  globalThis.fetch = async () => jsonResponse(responses.shift());

  const challenge = await authApi.requestOtp('0912.345.678');
  const proof = await authApi.verifyOtp(
    '0912.345.678',
    challenge.data.challengeId,
    '654321',
  );

  assert.equal(challenge.data.challengeId, 'challenge-id');
  assert.equal(proof.data.otpProof, 'otp-proof');
});

test('profile reads and updates the documented /me resource', async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ data: { accountId: 42 } });
  };

  await customerApi.getMe('access-token');
  await customerApi.updateMe('access-token', { fullName: 'Nguyễn Văn An' });

  assert.deepEqual(
    calls.map(({ url }) => url),
    ['http://localhost:4000/api/v1/me', 'http://localhost:4000/api/v1/me'],
  );
  assert.equal(calls[1].init.method, 'PATCH');
});

test('trip search sends the documented query names and keeps pagination metadata', async () => {
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return jsonResponse({
      data: [],
      meta: { page: 2, pageSize: 5, totalItems: 0, totalPages: 0 },
    });
  };

  const response = await tripsApi.searchTrips({
    from: 'TP.HCM',
    to: 'Đà Lạt',
    departureDate: '2026-10-15',
    busCompanyId: 3,
    vehicleTypeId: 2,
    minPrice: 100000,
    maxPrice: 500000,
    page: 2,
    pageSize: 5,
    sortBy: 'price',
    sortDirection: 'desc',
  });

  assert.equal(
    requestedUrl,
    'http://localhost:4000/api/v1/trips/search?from=TP.HCM&to=%C4%90%C3%A0+L%E1%BA%A1t&departureDate=2026-10-15&busCompanyId=3&vehicleTypeId=2&minPrice=100000&maxPrice=500000&page=2&pageSize=5&sortBy=price&sortDirection=desc',
  );
  assert.deepEqual(response.meta, {
    page: 2,
    pageSize: 5,
    totalItems: 0,
    totalPages: 0,
  });
});

test('route options are loaded through the shared API service', async () => {
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return jsonResponse({
      data: [{ routeId: 1, origin: 'TP.HCM', destination: 'Đà Lạt' }],
      meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
    });
  };

  const response = await routesApi.listRoutes({
    pageSize: 100,
    status: 'HOAT_DONG',
  });

  assert.equal(
    requestedUrl,
    'http://localhost:4000/api/v1/routes?pageSize=100&status=HOAT_DONG',
  );
  assert.equal(response.data[0].origin, 'TP.HCM');
});

test('authApi.refresh sends refreshToken in request body and returns rotated tokens', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({
      data: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      },
    });
  };

  const response = await authApi.refresh('valid-refresh-token');

  assert.equal(calls[0].url, 'http://localhost:4000/api/v1/auth/refresh');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    refreshToken: 'valid-refresh-token',
  });
  assert.equal(response.data.accessToken, 'new-access-token');
  assert.equal(response.data.refreshToken, 'new-refresh-token');
});

test('authApi.logout sends refreshToken in request body and access token in auth header', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 204 });
  };

  await authApi.logout('current-refresh-token', 'current-access-token');

  assert.equal(calls[0].url, 'http://localhost:4000/api/v1/auth/logout');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    refreshToken: 'current-refresh-token',
  });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer current-access-token');
});

test('bookingsApi.getBookingDetail returns response with data envelope', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ data: { bookingId: 101, bookingCode: 'PDV-101' } });
  };

  const response = await bookingsApi.getBookingDetail('token', 101);

  assert.equal(calls[0].url, 'http://localhost:4000/api/v1/bookings/101');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token');
  assert.equal(response.data.bookingId, 101);
});

test('ticketsApi.getTicketDetail returns response with data envelope', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ data: { ticketId: 1, ticketCode: 'VE-001' } });
  };

  const response = await ticketsApi.getTicketDetail('token', 1);

  assert.equal(calls[0].url, 'http://localhost:4000/api/v1/tickets/1');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token');
  assert.equal(response.data.ticketId, 1);
});

test('ticketsApi.lookupTicket returns response with data envelope', async () => {
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return jsonResponse({ data: { ticketId: 1, ticketCode: 'VE-001' } });
  };

  const response = await ticketsApi.lookupTicket('VE-001', '0901234567');

  assert.equal(
    requestedUrl,
    'http://localhost:4000/api/v1/tickets/lookup?ticketCode=VE-001&phoneNumber=0901234567',
  );
  assert.equal(response.data.ticketId, 1);
});

test('contactApi.submitContact returns response with data envelope', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ data: { contactId: 1, fullName: 'Nguyễn Văn A' } });
  };

  const response = await contactApi.submitContact({
    fullName: 'Nguyễn Văn A',
    phoneNumber: '0912345678',
    subject: 'Hỗ trợ',
    message: 'Nội dung',
  });

  assert.equal(calls[0].url, 'http://localhost:4000/api/v1/contacts');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(response.data.contactId, 1);
});
