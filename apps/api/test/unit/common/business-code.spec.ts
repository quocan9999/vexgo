import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { businessCode, nextBusinessCode } from '../../../src/common/business-code.js';
import type { Prisma } from '../../../src/generated/prisma/client.js';

describe('business codes', () => {
  it('continues the numeric maximum, ignoring other tenants, dates and malformed suffixes', () => {
    expect(nextBusinessCode('FUTA-TX-', ['FUTA-TX-0002', 'FUTA-TX-0010', 'TB-TX-9999', 'FUTA-TX-x'])).toBe('FUTA-TX-0011');
    expect(nextBusinessCode('FUTA-CX-23102026-', ['FUTA-CX-22102026-0999'])).toBe('FUTA-CX-23102026-0001');
  });
  it('keeps the high-water mark after removal and expands beyond four digits', () => {
    expect(nextBusinessCode('FUTA-TX-', [], 9999)).toBe('FUTA-TX-10000');
    expect(nextBusinessCode('FUTA-TX-', ['FUTA-TX-0003'], 20)).toBe('FUTA-TX-0021');
  });
  it('fails closed on exhausted counters or codes longer than the schema permits', () => {
    expect(() => nextBusinessCode('FUTA-TX-', [], 2_147_483_647)).toThrow();
    expect(() => nextBusinessCode('A'.repeat(48), [])).toThrow();
  });
  it('locks the authenticated tenant before reading and persists the allocated sequence', async () => {
    const query = vi.fn().mockResolvedValueOnce([{ maNhaXe: 'FUTA' }]).mockResolvedValueOnce([{ code: 'FUTA-CX-23102026-0008' }]).mockResolvedValueOnce([{ soCuoi: 12 }]);
    const execute = vi.fn().mockResolvedValue(1);
    const db = { $queryRaw: query, $executeRaw: execute } as unknown as Prisma.TransactionClient;
    expect(await businessCode(db, 3, 'CX', '2026-10-23', true)).toBe('FUTA-CX-23102026-0013');
    expect(query.mock.calls[0][0].join('?')).toContain('FOR UPDATE');
    expect(query.mock.calls[0][1]).toBe(3);
    expect(execute.mock.calls[0].slice(1)).toEqual(['FUTA-CX-23102026-', 13, 13]);
  });
  it('preview neither locks nor consumes a number', async () => {
    const query = vi.fn().mockResolvedValueOnce([{ maNhaXe: 'TB' }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const execute = vi.fn();
    const db = { $queryRaw: query, $executeRaw: execute } as unknown as Prisma.TransactionClient;
    expect(await businessCode(db, 4, 'TX')).toBe('TB-TX-0001');
    expect(query.mock.calls[0][0].join('?')).not.toContain('FOR UPDATE');
    expect(execute).not.toHaveBeenCalled();
  });
});
