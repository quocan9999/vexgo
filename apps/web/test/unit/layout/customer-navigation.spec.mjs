import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACCOUNT_NAVIGATION_ITEMS,
  RESET_PASSWORD_PATH,
  getMobileMenuLabel,
  isAccountNavigationItemActive,
} from '../../../src/components/layout/customer-navigation.ts';

test('the customer account menu sends reset-password navigation to the password screen', () => {
  assert.equal(RESET_PASSWORD_PATH, '/account/profile/password');
});

test('customer account sidebar uses the canonical account routes', () => {
  assert.deepEqual(
    ACCOUNT_NAVIGATION_ITEMS.map(({ id, href }) => ({ id, href })),
    [
      { id: 'profile', href: '/account/profile' },
      { id: 'history', href: '/account/tickets' },
      { id: 'security', href: '/account/profile/password' },
    ],
  );
});

test('customer account sidebar marks each canonical account route active', () => {
  for (const item of ACCOUNT_NAVIGATION_ITEMS) {
    assert.equal(isAccountNavigationItemActive(item, item.href), true, item.href);
  }

  assert.equal(
    isAccountNavigationItemActive(ACCOUNT_NAVIGATION_ITEMS[0], '/account/profile/password'),
    false,
    'The profile link must not also be active on the password screen',
  );
});

test('mobile menu label describes the action for its current state', () => {
  assert.equal(getMobileMenuLabel(false), 'Mở menu');
  assert.equal(getMobileMenuLabel(true), 'Đóng menu');
});
