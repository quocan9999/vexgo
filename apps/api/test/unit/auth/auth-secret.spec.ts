import { describe, expect, it } from 'vitest';
import { requireAuthSecret } from '../../../src/auth/auth-secret.js';

describe('requireAuthSecret', () => {
  it.each([undefined, '', '   ', 'too-short', 'replace-with-a-real-secret']) (
    'rejects missing or unsafe secrets (%s)',
    (secret) => {
      expect(() => requireAuthSecret(secret, 'JWT_ACCESS_SECRET')).toThrow(
        'JWT_ACCESS_SECRET must contain at least 32 characters',
      );
    },
  );

  it('accepts a configured non-placeholder secret with at least 32 characters', () => {
    const secret = 'this-is-a-valid-test-secret-with-32-plus-characters';

    expect(requireAuthSecret(secret, 'JWT_ACCESS_SECRET')).toBe(secret);
  });
});
