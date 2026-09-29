import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESET_PASSWORD_PATH } from '../../../src/components/layout/customer-navigation.ts';

test('the customer account menu sends reset-password navigation to the password screen', () => {
  assert.equal(RESET_PASSWORD_PATH, '/account/profile/password');
});
