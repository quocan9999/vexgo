// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePromotions } from '@/features/promotions/hooks/use-promotions';

const state = vi.hoisted(() => ({ getPromotions: vi.fn() }));
vi.mock('@/features/promotions/services/promotion-service', () => ({ getPromotions: state.getPromotions }));

function page(code: string) {
  return {
    data: [{
      id: code === 'NEW' ? 2 : 1, name: code, code, discountType: 'SO_TIEN', discountValue: '1000.00',
      maxDiscount: null, minimumTicketAmount: null, startsOn: '2026-01-01', endsOn: '2027-12-31',
      status: 'HOAT_DONG', usageCount: 0, usageLimit: 10, remainingUses: 10, effectiveState: 'ACTIVE',
    }],
    meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  };
}

afterEach(() => state.getPromotions.mockReset());

describe('usePromotions request ordering', () => {
  it('filters dates on the server, resets pagination, and clears the range', async () => {
    state.getPromotions.mockResolvedValue(page('NEW'));
    const { result } = renderHook(() => usePromotions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.changePage(3));
    await waitFor(() => expect(state.getPromotions.mock.lastCall?.[0].page).toBe(3));
    act(() => result.current.updateDateRange({ from: '2026-10-01', to: '2026-10-31' }));
    await waitFor(() => expect(state.getPromotions.mock.lastCall?.[0]).toMatchObject({ page: 1, fromDate: '2026-10-01', toDate: '2026-10-31' }));
    act(() => result.current.resetFilters());
    await waitFor(() => expect(state.getPromotions.mock.lastCall?.[0]).toMatchObject({ page: 1, fromDate: undefined, toDate: undefined }));
    expect(result.current.dateRange).toBeNull();
  });

  it('aborts the stale list request and keeps its later search result', async () => {
    const pending: Array<(result: ReturnType<typeof page>) => void> = [];
    state.getPromotions.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const { result } = renderHook(() => usePromotions());

    await waitFor(() => expect(state.getPromotions).toHaveBeenCalledTimes(1));
    act(() => result.current.updateSearch('NEW'));
    await waitFor(() => expect(state.getPromotions).toHaveBeenCalledTimes(2), { timeout: 1500 });
    expect(state.getPromotions.mock.calls[0]?.[1]?.aborted).toBe(true);

    await act(async () => pending[1]?.(page('NEW')));
    await waitFor(() => expect(result.current.promotionPage?.data[0]?.code).toBe('NEW'));
    await act(async () => pending[0]?.(page('OLD')));
    expect(result.current.promotionPage?.data[0]?.code).toBe('NEW');
  });
});
