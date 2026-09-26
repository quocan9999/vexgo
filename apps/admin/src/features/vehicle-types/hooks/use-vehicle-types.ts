'use client';

import { useEffect, useState } from 'react';
import { getVehicleTypes } from '../services/vehicle-type-service';
import type {
  PaginatedVehicleTypes,
  SortDirection,
  VehicleTypeSortKey,
} from '../types/vehicle-type';

const PAGE_SIZE = 10;

function requestErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.';
  }
  return error instanceof Error
    ? error.message
    : 'Không thể tải danh sách loại xe.';
}

export function useVehicleTypes() {
  const [vehicleTypePage, setVehicleTypePage] =
    useState<PaginatedVehicleTypes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<VehicleTypeSortKey>('name');
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

    getVehicleTypes(
      {
        search,
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortDirection,
      },
      controller.signal,
    )
      .then((result) => {
        if (current) setVehicleTypePage(result);
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setError(requestErrorMessage(requestError));
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
    const nextSearch = value.trim();
    setSearchInput(value);
    if (nextSearch === search && page === 1) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function sortVehicleTypes(key: VehicleTypeSortKey) {
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

  function retry() {
    setLoading(true);
    setError(null);
    setRefreshCount((count) => count + 1);
  }

  return {
    vehicleTypePage,
    error,
    loading,
    page,
    searchInput,
    sortBy,
    sortDirection,
    changePage,
    refresh,
    retry,
    sortVehicleTypes,
    updateSearch,
  };
}
