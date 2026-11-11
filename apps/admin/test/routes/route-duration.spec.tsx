import { describe, expect, it } from 'vitest';
import { parseRouteDuration } from '@/features/routes/utils/route-duration';

describe('parseRouteDuration', () => {
  it('accepts a positive whole number of minutes', () => {
    expect(parseRouteDuration('420')).toEqual({ value: 420 });
  });

  it.each(['', '0', '-5', '12.5', 'abc'])(
    'rejects invalid duration %j with a field error',
    (input) => {
      const res = parseRouteDuration(input);
      expect('error' in res).toBe(true);
      if ('error' in res) {
        expect(['Duration must be a positive integer in minutes.', 'Thời gian chạy phải là số phút nguyên lớn hơn 0.']).toContain(res.error);
      }
    },
  );
});
