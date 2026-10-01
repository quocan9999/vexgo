import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWithAuthRetry } from '../../../src/features/auth/services/auth-retry.ts';
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
