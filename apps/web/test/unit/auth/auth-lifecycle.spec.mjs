import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWithAuthRetry } from '../../../src/features/auth/services/auth-retry.ts';
import { authApi } from '../../../src/features/auth/services/auth.api.ts';
import { ApiError } from '../../../src/features/account/services/customer.api.ts';

test('runWithAuthRetry executes action with valid access token on happy path', async () => {
  let callCount = 0;
  const result = await runWithAuthRetry(
    async (token) => {
      callCount++;
      return `success with ${token}`;
    },
    {
      getTokens: () => ({
        accessToken: 'valid-access-token',
        refreshToken: 'valid-refresh-token',
      }),
      onRefresh: () => assert.fail('should not refresh'),
      onAuthFailed: () => assert.fail('should not fail auth'),
    },
  );

  assert.equal(callCount, 1);
  assert.equal(result, 'success with valid-access-token');
});

test('runWithAuthRetry refreshes token on 401 and retries original request with new token', async () => {
  let callCount = 0;
  let refreshedTokens = null;

  const result = await runWithAuthRetry(
    async (token) => {
      callCount++;
      if (token === 'expired-access-token') {
        throw new ApiError('Unauthorized', 401);
      }
      return `data fetched with ${token}`;
    },
    {
      getTokens: () => ({
        accessToken: 'expired-access-token',
        refreshToken: 'valid-refresh-token',
      }),
      refreshFn: async (rt) => {
        assert.equal(rt, 'valid-refresh-token');
        return {
          data: {
            accessToken: 'rotated-access-token',
            refreshToken: 'rotated-refresh-token',
          },
        };
      },
      onRefresh: (tokens) => {
        refreshedTokens = tokens;
      },
      onAuthFailed: () => assert.fail('should not fail auth when refresh succeeds'),
    },
  );

  assert.equal(callCount, 2);
  assert.deepEqual(refreshedTokens, {
    accessToken: 'rotated-access-token',
    refreshToken: 'rotated-refresh-token',
  });
  assert.equal(result, 'data fetched with rotated-access-token');
});

test('runWithAuthRetry signs out and throws error when refresh token is also rejected with 401', async () => {
  let failedCalled = false;

  await assert.rejects(
    async () => {
      await runWithAuthRetry(
        async () => {
          throw new ApiError('Token expired', 401);
        },
        {
          getTokens: () => ({
            accessToken: 'expired-access-token',
            refreshToken: 'expired-refresh-token',
          }),
          refreshFn: async () => {
            throw new ApiError('Refresh token expired', 401);
          },
          onRefresh: () => assert.fail('should not refresh'),
          onAuthFailed: () => {
            failedCalled = true;
          },
        },
      );
    },
    (err) => err instanceof ApiError && err.status === 401,
  );

  assert.equal(failedCalled, true);
});

test('runWithAuthRetry does not attempt refresh on non-401 errors', async () => {
  let refreshCalled = false;

  await assert.rejects(
    async () => {
      await runWithAuthRetry(
        async () => {
          throw new ApiError('Internal server error', 500);
        },
        {
          getTokens: () => ({
            accessToken: 'valid-token',
            refreshToken: 'valid-refresh-token',
          }),
          refreshFn: async () => {
            refreshCalled = true;
            return { data: { accessToken: 'x', refreshToken: 'y' } };
          },
          onRefresh: () => {},
          onAuthFailed: () => {},
        },
      );
    },
    (err) => err instanceof ApiError && err.status === 500,
  );

  assert.equal(refreshCalled, false);
});

test('runWithAuthRetry signs out when 401 occurs and no refresh token is available', async () => {
  let failedCalled = false;

  await assert.rejects(
    async () => {
      await runWithAuthRetry(
        async () => {
          throw new ApiError('Unauthorized', 401);
        },
        {
          getTokens: () => ({
            accessToken: 'expired-access-token',
            refreshToken: null,
          }),
          refreshFn: async () => {
            assert.fail('should not call refreshFn when refreshToken is null');
          },
          onRefresh: () => assert.fail('should not refresh'),
          onAuthFailed: () => {
            failedCalled = true;
          },
        },
      );
    },
    (err) => err instanceof ApiError && err.status === 401,
  );

  assert.equal(failedCalled, true);
});

test('runWithAuthRetry does not sign out when retry returns non-401 (e.g. 500)', async () => {
  let callCount = 0;
  let failedCalled = false;

  await assert.rejects(
    async () => {
      await runWithAuthRetry(
        async (token) => {
          callCount++;
          if (token === 'expired-access-token') {
            throw new ApiError('Unauthorized', 401);
          }
          throw new ApiError('Internal Server Error', 500);
        },
        {
          getTokens: () => ({
            accessToken: 'expired-access-token',
            refreshToken: 'valid-refresh-token',
          }),
          refreshFn: async () => ({
            data: {
              accessToken: 'rotated-access-token',
              refreshToken: 'rotated-refresh-token',
            },
          }),
          onRefresh: () => {},
          onAuthFailed: () => {
            failedCalled = true;
          },
        },
      );
    },
    (err) => err instanceof ApiError && err.status === 500,
  );

  assert.equal(callCount, 2);
  assert.equal(failedCalled, false, 'must not sign out when retry fails with non-401');
});

test('runWithAuthRetry signs out when retry returns 401 again', async () => {
  let callCount = 0;
  let failedCalled = false;

  await assert.rejects(
    async () => {
      await runWithAuthRetry(
        async () => {
          callCount++;
          throw new ApiError('Unauthorized', 401);
        },
        {
          getTokens: () => ({
            accessToken: 'expired-access-token',
            refreshToken: 'valid-refresh-token',
          }),
          refreshFn: async () => ({
            data: {
              accessToken: 'rotated-access-token',
              refreshToken: 'rotated-refresh-token',
            },
          }),
          onRefresh: () => {},
          onAuthFailed: () => {
            failedCalled = true;
          },
        },
      );
    },
    (err) => err instanceof ApiError && err.status === 401,
  );

  assert.equal(callCount, 2);
  assert.equal(failedCalled, true, 'must sign out when retry fails with 401');
});

test('runWithAuthRetry signs out immediately and does not retry on 403 ACCOUNT_LOCKED', async () => {
  let callCount = 0;
  let refreshCalled = false;
  let failedCalled = false;

  await assert.rejects(
    async () => {
      await runWithAuthRetry(
        async () => {
          callCount++;
          throw new ApiError('Tài khoản đã bị khóa vĩnh viễn.', 403, 'ACCOUNT_LOCKED');
        },
        {
          getTokens: () => ({
            accessToken: 'valid-token-but-locked',
            refreshToken: 'valid-refresh-token',
          }),
          refreshFn: async () => {
            refreshCalled = true;
            return { data: { accessToken: 'x', refreshToken: 'y' } };
          },
          onRefresh: () => {},
          onAuthFailed: () => {
            failedCalled = true;
          },
        },
      );
    },
    (err) => err instanceof ApiError && err.status === 403 && err.error === 'ACCOUNT_LOCKED',
  );

  assert.equal(callCount, 1);
  assert.equal(refreshCalled, false, 'must not attempt refresh when account is locked');
  assert.equal(failedCalled, true, 'must sign out immediately when account is locked');
});

test('runWithAuthRetry signs out immediately and does not retry on 403 ACCOUNT_SUSPENDED', async () => {
  let callCount = 0;
  let refreshCalled = false;
  let failedCalled = false;

  await assert.rejects(
    async () => {
      await runWithAuthRetry(
        async () => {
          callCount++;
          throw new ApiError('Tài khoản tạm thời bị khóa đến ngày 20-11-2026.', 403, 'ACCOUNT_SUSPENDED');
        },
        {
          getTokens: () => ({
            accessToken: 'valid-token-but-suspended',
            refreshToken: 'valid-refresh-token',
          }),
          refreshFn: async () => {
            refreshCalled = true;
            return { data: { accessToken: 'x', refreshToken: 'y' } };
          },
          onRefresh: () => {},
          onAuthFailed: () => {
            failedCalled = true;
          },
        },
      );
    },
    (err) => err instanceof ApiError && err.status === 403 && err.error === 'ACCOUNT_SUSPENDED',
  );

  assert.equal(callCount, 1);
  assert.equal(refreshCalled, false, 'must not attempt refresh when account is suspended');
  assert.equal(failedCalled, true, 'must sign out immediately when account is suspended');
});

test('authApi.login sends accountType: KHACH_HANG and formatted phoneNumber', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestBody = null;

  globalThis.fetch = async (url, init) => {
    requestUrl = String(url);
    requestBody = JSON.parse(String(init.body));
    return {
      ok: true,
      json: async () => ({ data: { accessToken: 'test-token' } }),
    };
  };

  try {
    const result = await authApi.login('0901234567', 'Password@123');
    assert.match(requestUrl, /\/auth\/login$/);
    assert.deepEqual(requestBody, {
      phoneNumber: '+84901234567',
      password: 'Password@123',
      accountType: 'KHACH_HANG',
    });
    assert.equal(result.data.accessToken, 'test-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('authApi forgot-password methods call respective endpoints and format phone', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return {
      ok: true,
      json: async () => ({ data: { success: true } }),
    };
  };

  try {
    await authApi.requestForgotPasswordOtp('0901234567');
    assert.match(calls[0].url, /\/auth\/forgot-password\/request-otp$/);
    assert.deepEqual(calls[0].body, { phoneNumber: '+84901234567' });

    await authApi.verifyForgotPasswordOtp('0901234567', 'ch-123', '123456');
    assert.match(calls[1].url, /\/auth\/forgot-password\/verify-otp$/);
    assert.deepEqual(calls[1].body, {
      phoneNumber: '+84901234567',
      challengeId: 'ch-123',
      otp: '123456',
    });

    await authApi.resetForgotPassword({
      phoneNumber: '0901234567',
      otpProof: 'proof-token',
      newPassword: 'NewPassword@123',
    });
    assert.match(calls[2].url, /\/auth\/forgot-password\/reset$/);
    assert.deepEqual(calls[2].body, {
      phoneNumber: '+84901234567',
      otpProof: 'proof-token',
      newPassword: 'NewPassword@123',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
