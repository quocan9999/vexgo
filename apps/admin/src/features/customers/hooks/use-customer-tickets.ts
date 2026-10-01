'use client';

import { useEffect, useState } from 'react';
import { getCustomerTickets } from '../services/customer-service';
import type { CustomerTicketsResponse } from '../types/customer';

const PAGE_SIZE = 10;

export function useCustomerTickets(customerId: number) {
  const [result, setResult] = useState<{
    key: string;
    page: CustomerTicketsResponse;
  } | null>(null);
  const isValidId = Number.isSafeInteger(customerId) && customerId > 0;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isValidId);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [refreshCount, setRefreshCount] = useState(0);

  const requestKey = JSON.stringify([
    customerId,
    page,
    search,
    sortDirection,
  ]);
  const ticketsPage = result?.key === requestKey ? result.page : null;

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        setSearch(searchInput.trim());
        setPage(1);
      },
      searchInput.trim() ? 300 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!isValidId) {
      return;
    }

    const controller = new AbortController();
    let current = true;
    const key = JSON.stringify([
      customerId,
      page,
      search,
      sortDirection,
    ]);

    getCustomerTickets(
      customerId,
      {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        sortDirection,
      },
      controller.signal,
    )
      .then((data) => {
        if (!current) return;
        setResult({ key, page: data });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!current || controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải lịch sử vé.',
        );
      })
      .finally(() => {
        if (current) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [customerId, isValidId, page, search, sortDirection, refreshCount]);

  function refresh() {
    setRefreshing(true);
    setError(null);
    setRefreshCount((c) => c + 1);
  }

  return {
    tickets: ticketsPage?.data ?? result?.page.data ?? [],
    meta: ticketsPage?.meta ??
      result?.page.meta ?? {
        page: 1,
        pageSize: PAGE_SIZE,
        totalItems: 0,
        totalPages: 1,
      },
    loading,
    refreshing,
    error,
    searchInput,
    setSearchInput: (value: string) => {
      setSearchInput(value);
      setLoading(value.trim() !== search);
      setError(null);
    },
    page,
    setPage: (value: number) => {
      if (value === page) return;
      setLoading(true);
      setError(null);
      setPage(value);
    },
    sortDirection,
    setSortDirection: (dir: 'asc' | 'desc') => {
      setLoading(true);
      setError(null);
      setSortDirection(dir);
      setPage(1);
    },
    refresh,
  };
}
