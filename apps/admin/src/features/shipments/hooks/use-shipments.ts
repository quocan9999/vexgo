'use client';

import { useEffect, useState } from 'react';
import { getShipments } from '../services/shipment-service';
import type {
  ShipmentPaginationMeta,
  ShipmentQuery,
  ShipmentSortDirection,
  ShipmentStatus,
  ShipmentSummary,
  ShipmentsResponse,
} from '../types/shipment';

const PAGE_SIZE = 10;

export function useShipments() {
  const [result, setResult] = useState<{
    key: string;
    response: ShipmentsResponse;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ShipmentStatus | ''>('');
  const [sortDirection, setSortDirection] =
    useState<ShipmentSortDirection>('desc');
  const [refreshCount, setRefreshCount] = useState(0);

  const requestKey = JSON.stringify([page, search, status, sortDirection]);
  const activePage = result?.key === requestKey ? result.response : null;

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
    const key = JSON.stringify([page, search, status, sortDirection]);

    const query: ShipmentQuery = {
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      status: status || undefined,
      sortDirection,
    };

    getShipments(query, controller.signal)
      .then((data) => {
        if (!current) return;
        setResult({ key, response: data });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!current || controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách phiếu gửi hàng.',
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
  }, [page, search, status, sortDirection, refreshCount]);

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
    setStatus('');
    setSortDirection('desc');
    setPage(1);
  }

  function handleSortDirectionChange(direction: ShipmentSortDirection) {
    if (direction === sortDirection) return;
    setLoading(true);
    setError(null);
    setSortDirection(direction);
    setPage(1);
  }

  const defaultMeta: ShipmentPaginationMeta = {
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  };

  return {
    shipments: activePage?.data ?? result?.response.data ?? [],
    meta: activePage?.meta ?? result?.response.meta ?? defaultMeta,
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
    status,
    setStatus: (val: ShipmentStatus | '') => {
      setLoading(true);
      setError(null);
      setStatus(val);
      setPage(1);
    },
    sortDirection,
    setSortDirection: handleSortDirectionChange,
    refresh,
    resetFilters,
  };
}
