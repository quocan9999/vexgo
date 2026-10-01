// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminAccounts } from '@/features/admin-accounts/services/admin-account-service';
import { useAdminAccounts } from '@/features/admin-accounts/hooks/use-admin-accounts';
import type { PaginatedAdminAccounts } from '@/features/admin-accounts/types/admin-account';

vi.mock('@/features/admin-accounts/services/admin-account-service', () => ({
  getAdminAccounts: vi.fn(),
}));

const emptyPage: PaginatedAdminAccounts = {
  data: [],
  meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
};

describe('useAdminAccounts', () => {
  beforeEach(() => {
    vi.mocked(getAdminAccounts).mockResolvedValue(emptyPage);
  });

  afterEach(() => vi.clearAllMocks());

  it('loads the default page and re-queries when status filter changes', async () => {
    const { result } = renderHook(() => useAdminAccounts());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accountPage).toEqual(emptyPage);
    expect(getAdminAccounts).toHaveBeenLastCalledWith(
      {
        page: 1,
        pageSize: 10,
        search: '',
        sortBy: 'createdAt',
        sortDirection: 'desc',
      },
      expect.any(AbortSignal),
    );

    act(() => result.current.updateStatus('HOAT_DONG'));

    await waitFor(() =>
      expect(getAdminAccounts).toHaveBeenLastCalledWith(
        {
          page: 1,
          pageSize: 10,
          search: '',
          sortBy: 'createdAt',
          sortDirection: 'desc',
          status: 'HOAT_DONG',
        },
        expect.any(AbortSignal),
      ),
    );
  });
});
