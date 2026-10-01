import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUTH_STORAGE_KEY,
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth,
} from '../../../src/features/auth/auth-session-state.ts';

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const user = {
  accountId: 42,
  customerId: 12,
  fullName: 'Nguyễn Văn An',
  phoneNumber: '+84901234567',
  roles: ['KHACH_HANG'],
};

test('auth state starts unauthenticated when storage is unavailable', () => {
  assert.deepEqual(readStoredAuth(), {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isHydrated: true,
  });
});

test('writeStoredAuth persists tokens and readStoredAuth restores the session', () => {
  const storage = createMemoryStorage();

  writeStoredAuth(storage, {
    user,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    refreshToken: 'refresh-token',
  });

  assert.deepEqual(readStoredAuth(storage), {
    user,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    isAuthenticated: true,
    isHydrated: true,
  });
});

test('invalid stored auth is treated as unauthenticated', () => {
  const storage = createMemoryStorage();
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user }));

  assert.deepEqual(readStoredAuth(storage), {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isHydrated: true,
  });
});

test('clearStoredAuth keeps sign-out effective after a refresh', () => {
  const storage = createMemoryStorage();
  writeStoredAuth(storage, {
    user,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    refreshToken: 'refresh-token',
  });

  clearStoredAuth(storage);

  assert.deepEqual(readStoredAuth(storage), {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isHydrated: true,
  });
});
