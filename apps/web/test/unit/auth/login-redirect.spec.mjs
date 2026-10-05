import assert from 'node:assert/strict';
import { test } from 'node:test';

test('sanitizeLoginRedirect only accepts an internal absolute path', async () => {
  const redirectHelpers =
    await import('../../../src/features/auth/services/login-redirect.ts').catch(
      () => ({}),
    );

  assert.equal(typeof redirectHelpers.sanitizeLoginRedirect, 'function');
  const { sanitizeLoginRedirect } = redirectHelpers;

  assert.equal(
    sanitizeLoginRedirect('/account/tickets?status=paid#latest'),
    '/account/tickets?status=paid#latest',
  );

  for (const unsafeValue of [
    'https://evil.example/phishing',
    '//evil.example/phishing',
    'javascript:alert(1)',
    '/\\evil.example/phishing',
    '/%2F%2Fevil.example/phishing',
    '/%5Cevil.example/phishing',
    '/account\njavascript:alert(1)',
  ]) {
    assert.equal(sanitizeLoginRedirect(unsafeValue), '/');
  }
});
