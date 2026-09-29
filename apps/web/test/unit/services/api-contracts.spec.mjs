import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { authApi } from '../../../src/features/auth/services/auth.api.ts';
import { customerApi } from '../../../src/features/account/services/customer.api.ts';
import { routesApi } from '../../../src/features/routes/services/routes.api.ts';
import { tripsApi } from '../../../src/features/trips/services/trips.api.ts';

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
