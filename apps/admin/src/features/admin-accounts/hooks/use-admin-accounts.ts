'use client';

import { useEffect, useState } from 'react';
import {
  ADMIN_ACCOUNT_STATUSES,
  type AdminAccountListQuery,
  type AdminAccountSortKey,
  type AdminAccountStatus,
  type AdminAccountSortDirection,
  type PaginatedAdminAccounts,
} from '../types/admin-account';
import { getAdminAccounts } from '../services/admin-account-service';

const PAGE_SIZE = 10;

export function useAdminAccounts() {
  const [accountPage, setAccountPage] = useState<PaginatedAdminAccounts | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<AdminAccountSortKey>('createdAt');
  const [sortDirection, setSortDirection] =
    useState<AdminAccountSortDirection>('desc');
  const [status, setStatus] = useState<AdminAccountStatus | ''>('');
  const [busCompanyId, setBusCompanyId] = useState<number | undefined>();
  const [refreshCount, setRefreshCount] = useState(0);

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
    const query: AdminAccountListQuery = {
      page,
      pageSize: PAGE_SIZE,
      search,
      sortBy,
      sortDirection,
      ...(status ? { status } : {}),
      ...(busCompanyId !== undefined ? { busCompanyId } : {}),
    };

    getAdminAccounts(query, controller.signal)
      .then((data) => {
        if (current) setAccountPage(data);
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Không thể tải danh sách tài khoản quản trị.',
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [busCompanyId, page, refreshCount, search, sortBy, sortDirection, status]);

  function updateSearch(value: string) {
    setLoading(true);
    setError(null);
    setSearchInput(value);
  }

  function changePage(nextPage: number) {
    if (!Number.isSafeInteger(nextPage) || nextPage < 1) return;
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function updateStatus(value: string) {
    setLoading(true);
    setError(null);
    setPage(1);
    setStatus(
      ADMIN_ACCOUNT_STATUSES.includes(value as AdminAccountStatus)
        ? (value as AdminAccountStatus)
        : '',
    );
  }

  function updateBusCompany(value: string) {
    const nextBusCompanyId = /^\d+$/.test(value) ? Number(value) : undefined;
    setLoading(true);
    setError(null);
    setPage(1);
    setBusCompanyId(
      nextBusCompanyId !== undefined &&
        Number.isSafeInteger(nextBusCompanyId) &&
        nextBusCompanyId > 0
        ? nextBusCompanyId
        : undefined,
    );
  }

  function sortAccounts(key: AdminAccountSortKey) {
    setLoading(true);
    setError(null);
    setPage(1);
    if (sortBy === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  }

  function refresh() {
    setLoading(true);
    setError(null);
    setRefreshCount((count) => count + 1);
  }

  return {
    accountPage,
    busCompanyId,
    error,
    loading,
    page,
    searchInput,
    sortBy,
    sortDirection,
    status,
    changePage,
    refresh,
    sortAccounts,
    updateBusCompany,
    updateSearch,
    updateStatus,
  };
}
