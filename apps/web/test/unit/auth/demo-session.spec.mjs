import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoSessionStore } from '../../../src/features/auth/demo-session-state.ts';

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('the pure session state starts with the source demo user', () => {
  const store = createDemoSessionStore();
  const state = store.getState();
  
  assert.equal(state.user.fullName, 'Nguyễn Văn Hùng');
  assert.equal(state.user.phone, '0912.345.678');
  assert.equal(state.isAuthenticated, true);
});

test('signIn updates customer identity', () => {
  const store = createDemoSessionStore();
  
  store.signIn({
    fullName: 'Lê Văn Khách',
    phone: '0988.777.666'
  });
  
  const state = store.getState();
  assert.equal(state.user.fullName, 'Lê Văn Khách');
  assert.equal(state.user.phone, '0988.777.666');
  assert.equal(state.isAuthenticated, true);
});

test('signOut clears customer identity', () => {
  const store = createDemoSessionStore();
  
  store.signOut();
  
  const state = store.getState();
  assert.equal(state.user, null);
  assert.equal(state.isAuthenticated, false);
});

test('signOut remains effective when the demo session is recreated after a refresh', () => {
  const storage = createMemoryStorage();
  const currentSession = createDemoSessionStore(storage);

  currentSession.signOut();

  const refreshedSession = createDemoSessionStore(storage);
  assert.deepEqual(refreshedSession.getState(), {
    user: null,
    isAuthenticated: false,
  });
});
