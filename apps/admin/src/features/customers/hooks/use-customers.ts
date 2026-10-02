'use client';

import { useEffect, useState } from 'react';
import { getCustomers } from '../services/customer-service';
import type {
  CustomerAccountStatus,
  CustomerPageResponse,
  CustomerSortKey,
} from '../types/customer';

const PAGE_SIZE = 10;

export function useCustomers() {
  const [result, setResult] = useState<{
    key: string;
    page: CustomerPageResponse;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<CustomerSortKey>('customerCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [accountStatus, setAccountStatus] = useState<
    CustomerAccountStatus | ''
  >('');
  const [refreshCount, setRefreshCount] = useState(0);

  const requestKey = JSON.stringify([
    page,
    search,
    sortBy,
    sortDirection,
    accountStatus,
  ]);
  const customerPage = result?.key === requestKey ? result.page : null;

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
    const controller = new AbortController();
    let current = true;
    const key = JSON.stringify([
      page,
      search,
      sortBy,
      sortDirection,
      accountStatus,
    ]);

    getCustomers(
      {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        accountStatus: accountStatus || undefined,
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
            : 'Không thể tải danh sách khách hàng.',
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
  }, [page, search, sortBy, sortDirection, accountStatus, refreshCount]);

  function handleSort(key: CustomerSortKey) {
    setLoading(true);
    setError(null);
    if (sortBy === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
    setPage(1);
  }

  function refresh() {
    setRefreshing(true);
    setError(null);
    setRefreshCount((c) => c + 1);
  }

  function resetFilters() {
    setLoading(true);
    setError(null);
    setSearchInput('');
    setSearch('');
    setAccountStatus('');
    setSortBy('customerCode');
    setSortDirection('asc');
    setPage(1);
  }

  return {
    customers: customerPage?.data ?? result?.page.data ?? [],
    meta: customerPage?.meta ??
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
    accountStatus,
    setAccountStatus: (status: CustomerAccountStatus | '') => {
      setLoading(true);
      setError(null);
      setAccountStatus(status);
      setPage(1);
    },
    sortBy,
    sortDirection,
    handleSort,
    refresh,
    resetFilters,
  };
}
