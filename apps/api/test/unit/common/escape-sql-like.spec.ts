import { describe, expect, it } from 'vitest';
import { escapeSqlLike } from '../../../src/common/escape-sql-like.js';

describe('escapeSqlLike', () => {
  it('escapes percentage sign (%)', () => {
    expect(escapeSqlLike('100%')).toBe('100\\%');
  });

  it('escapes underscore sign (_)', () => {
    expect(escapeSqlLike('booking_code')).toBe('booking\\_code');
  });

  it('escapes backslash (\\)', () => {
    expect(escapeSqlLike('path\\to')).toBe('path\\\\to');
  });

  it('escapes multiple mixed wildcards in a single string', () => {
    expect(escapeSqlLike('50%_discount\\code')).toBe('50\\%\\_discount\\\\code');
  });

  it('leaves normal text and Vietnamese unicode untouched', () => {
    expect(escapeSqlLike('Nguyễn Văn A - PD123')).toBe('Nguyễn Văn A - PD123');
  });

  it('handles empty string', () => {
    expect(escapeSqlLike('')).toBe('');
  });
});
