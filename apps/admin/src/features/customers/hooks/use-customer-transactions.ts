'use client';

import { useEffect, useState } from 'react';
import { getCustomerTransactions } from '../services/customer-service';
import type { CustomerTransactionsResponse } from '../types/customer';

const PAGE_SIZE = 10;

export function useCustomerTransactions(customerId: number) {
  const [result, setResult] = useState<{
    key: string;
    page: CustomerTransactionsResponse;
  } | null>(null);
  const isValidId = Number.isSafeInteger(customerId) && customerId > 0;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isValidId);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'createdDate' | 'totalAmount'>('createdDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [refreshCount, setRefreshCount] = useState(0);

  const requestKey = JSON.stringify([
    customerId,
    page,
    search,
    sortBy,
    sortDirection,
  ]);
  const transactionsPage = result?.key === requestKey ? result.page : null;

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
      sortBy,
      sortDirection,
    ]);

    getCustomerTransactions(
      customerId,
      {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        sortBy,
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
            : 'Không thể tải lịch sử giao dịch.',
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
  }, [customerId, isValidId, page, search, sortBy, sortDirection, refreshCount]);

  function handleSort(key: 'createdDate' | 'totalAmount') {
    setLoading(true);
    setError(null);
    if (sortBy === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('desc');
    }
    setPage(1);
  }

  function refresh() {
    setRefreshing(true);
    setError(null);
    setRefreshCount((c) => c + 1);
  }

  return {
    transactions: transactionsPage?.data ?? result?.page.data ?? [],
    meta: transactionsPage?.meta ??
      result?.page.meta ?? {
        page: 1,
        pageSize: PAGE_SIZE,
        totalItems: 0,
        totalPages: 0,
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
    sortBy,
    sortDirection,
    handleSort,
    refresh,
  };
}
