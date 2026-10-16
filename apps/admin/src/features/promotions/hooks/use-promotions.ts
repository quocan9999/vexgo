'use client';

import { useEffect, useState } from 'react';
import type { DateRangeValue } from '@/components/data-filters/data-filters';
import { getPromotions } from '../services/promotion-service';
import type {
  PaginatedPromotions,
  PromotionListQuery,
  PromotionSortKey,
  PromotionStatus,
  SortDirection,
} from '../types/promotion';

const PAGE_SIZE = 10;

export function usePromotions() {
  const [result, setResult] = useState<{ key: string; page: PaginatedPromotions } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PromotionStatus | ''>('');
  const [dateRange, setDateRange] = useState<DateRangeValue | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<PromotionSortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [refreshCount, setRefreshCount] = useState(0);

  const requestKey = JSON.stringify([page, search, status, dateRange, sortBy, sortDirection]);
  const promotionPage = result?.key === requestKey ? result.page : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, searchInput.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const key = JSON.stringify([page, search, status, dateRange, sortBy, sortDirection]);
    const query: PromotionListQuery = {
      page,
      pageSize: PAGE_SIZE,
      search,
      status: status || undefined,
      fromDate: dateRange?.from,
      toDate: dateRange?.to,
      sortBy,
      sortDirection,
    };

    getPromotions(query, controller.signal)
      .then((data) => {
        if (current) setResult({ key, page: data });
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setError(
            requestError instanceof TypeError
              ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
              : 'Không thể tải danh sách khuyến mãi.',
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
  }, [page, search, status, dateRange, sortBy, sortDirection, refreshCount]);

  function updateSearch(value: string) {
    setLoading(true);
    setError(null);
    setSearchInput(value);
  }

  function updateStatus(value: string) {
    if (value === status) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setStatus(value === 'HOAT_DONG' || value === 'TAM_NGUNG' ? value : '');
  }

  function updateDateRange(value: DateRangeValue | null) {
    setLoading(true);
    setError(null);
    setPage(1);
    setDateRange(value);
  }

  function changePage(nextPage: number) {
    if (nextPage === page) return;
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function sortPromotions(key: PromotionSortKey) {
    setLoading(true);
    setError(null);
    setPage(1);
    if (sortBy === key) {
      setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  }

  function resetFilters() {
    setLoading(true);
    setError(null);
    setPage(1);
    setSearchInput('');
    setSearch('');
    setStatus('');
    setDateRange(null);
  }

  function refresh() {
    setLoading(true);
    setError(null);
    setRefreshCount((count) => count + 1);
  }

  return {
    promotionPage,
    error,
    loading,
    searchInput,
    status,
    dateRange,
    updateDateRange,
    sortBy,
    sortDirection,
    changePage,
    updateSearch,
    updateStatus,
    sortPromotions,
    resetFilters,
    refresh,
  };
}
