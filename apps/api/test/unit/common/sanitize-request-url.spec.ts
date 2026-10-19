import { describe, expect, it } from 'vitest';
import { sanitizeRequestUrl } from '../../../src/common/configure-api.js';

describe('sanitizeRequestUrl (Unit - discussion_r4226252855)', () => {
  const rawSignedHoldToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0cmlwSWQiOjUwLCJzZWF0cyI6WzEwMV0sImV4cCI6MTc2MDAwMDAwMCwibm9uY2UiOiI1NTBhZjEwOC1mMTFkLTQ1OTAtYTY2ZC0yOTAxZTIzYWRhMTIifQ.SAMPLE_SIGNATURE_SECRET';

  it('redacts raw holdToken in path param /seat-holds/:holdToken', () => {
    const url = `/api/v1/seat-holds/${rawSignedHoldToken}`;
    const sanitized = sanitizeRequestUrl(url);

    expect(sanitized).toBe('/api/v1/seat-holds/[REDACTED_HOLD_TOKEN]');
    expect(sanitized).not.toContain(rawSignedHoldToken);
  });

  it('redacts raw holdToken in path param with query string attached', () => {
    const url = `/api/v1/seat-holds/${rawSignedHoldToken}?foo=bar&baz=123`;
    const sanitized = sanitizeRequestUrl(url);

    expect(sanitized).toBe('/api/v1/seat-holds/[REDACTED_HOLD_TOKEN]?foo=bar&baz=123');
    expect(sanitized).not.toContain(rawSignedHoldToken);
  });

  it('redacts holdToken and sensitive tokens in query params', () => {
    const url = `/api/v1/trips/search?holdToken=${rawSignedHoldToken}&other=1`;
    const sanitized = sanitizeRequestUrl(url);

    expect(sanitized).toBe('/api/v1/trips/search?holdToken=[REDACTED]&other=1');
    expect(sanitized).not.toContain(rawSignedHoldToken);
  });

  it('leaves standard non-sensitive routes untouched', () => {
    const url = '/api/v1/bookings/quote';
    expect(sanitizeRequestUrl(url)).toBe('/api/v1/bookings/quote');
  });

  it('handles empty or undefined url safely', () => {
    expect(sanitizeRequestUrl('')).toBe('');
    expect(sanitizeRequestUrl(null as any)).toBe('');
  });
});
