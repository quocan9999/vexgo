import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBusCompanyFilterOptions } from '../src/features/bus-companies/services/bus-company-service';

vi.mock('@/lib/api-url', () => ({ getApiBaseUrl: () => 'http://localhost:4000' }));
afterEach(() => vi.restoreAllMocks());

describe('Bus company lookup options', () => {
  it('keeps company choices distinct when names repeat by including each unique code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [
        { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
        { busCompanyId: 8, code: 'PT', name: 'Phương Trang' },
      ],
      meta: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 },
    }), { status: 200 }));

    await expect(getBusCompanyFilterOptions()).resolves.toEqual([
      { id: 3, label: 'Phương Trang (FUTA)' },
      { id: 8, label: 'Phương Trang (PT)' },
    ]);
  });
});
