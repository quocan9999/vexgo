'use client';

import { useEffect, useState } from 'react';
import { getBusCompanies } from '../services/bus-company-service';
import type {
  BusCompanySortKey,
  PaginatedBusCompanies,
  SortDirection,
} from '../types/bus-company';

const PAGE_SIZE = 10;

export function useBusCompanies() {
  const [companyPage, setCompanyPage] = useState<PaginatedBusCompanies | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<BusCompanySortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
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

    getBusCompanies(
      { search, page, pageSize: PAGE_SIZE, sortBy, sortDirection },
      controller.signal,
    )
      .then((data) => {
        if (current) setCompanyPage(data);
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Không thể tải danh sách nhà xe.',
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
  }, [page, refreshCount, search, sortBy, sortDirection]);

  function updateSearch(value: string) {
    setLoading(true);
    setError(null);
    setSearchInput(value);
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function sortCompanies(key: BusCompanySortKey) {
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
    companyPage,
    error,
    loading,
    page,
    searchInput,
    sortBy,
    sortDirection,
    changePage,
    refresh,
    sortCompanies,
    updateSearch,
  };
}
