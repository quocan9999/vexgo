import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { businessCode, nextBusinessCode } from '../../../src/common/business-code.js';
import type { Prisma } from '../../../src/generated/prisma/client.js';

describe('business codes', () => {
  it('generates a 32-character lowercase hex uuid v4', () => {
    const code = nextBusinessCode('FUTA-TX-', ['FUTA-TX-0002']);
    expect(code).toMatch(/^[0-9a-f]{32}$/);
    expect(code).toHaveLength(32);
  });

  it('generates unique business codes on each invocation', () => {
    const code1 = nextBusinessCode('FUTA-TX-', []);
    const code2 = nextBusinessCode('FUTA-TX-', []);
    expect(code1).not.toBe(code2);
  });

  it('generates businessCode without requiring tenant lock or database counter', async () => {
    const query = vi.fn();
    const execute = vi.fn();
    const db = { $queryRaw: query, $executeRaw: execute } as unknown as Prisma.TransactionClient;
    const code = await businessCode(db, 3, 'CX', '2026-10-23', true);
    expect(code).toMatch(/^[0-9a-f]{32}$/);
    expect(query).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('preview generates a uuid v4 without database queries', async () => {
    const query = vi.fn();
    const execute = vi.fn();
    const db = { $queryRaw: query, $executeRaw: execute } as unknown as Prisma.TransactionClient;
    const code = await businessCode(db, 4, 'TX');
    expect(code).toMatch(/^[0-9a-f]{32}$/);
    expect(query).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
