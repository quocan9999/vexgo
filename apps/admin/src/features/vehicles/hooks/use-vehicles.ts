'use client';

import { useEffect, useState } from 'react';
import { getVehicles } from '../services/vehicle-service';
import type {
  PaginatedVehicles,
  SortDirection,
  VehicleListQuery,
  VehicleSortKey,
  VehicleStatus,
} from '../types/vehicle';

const PAGE_SIZE = 10;

type VehicleFilters = {
  busCompanyId: string;
  vehicleTypeId: string;
  status: VehicleStatus | '';
};

function requestErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.';
  }
  return error instanceof Error ? error.message : 'Không thể tải danh sách xe.';
}

export function useVehicles() {
  const [vehiclePage, setVehiclePage] = useState<PaginatedVehicles | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<VehicleFilters>({
    busCompanyId: '',
    vehicleTypeId: '',
    status: '',
  });
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<VehicleSortKey>('licensePlate');
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
    const query: VehicleListQuery = {
      search,
      page,
      pageSize: PAGE_SIZE,
      sortBy,
      sortDirection,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.busCompanyId
        ? { busCompanyId: Number(filters.busCompanyId) }
        : {}),
      ...(filters.vehicleTypeId
        ? { vehicleTypeId: Number(filters.vehicleTypeId) }
        : {}),
    };

    getVehicles(query, controller.signal)
      .then((result) => {
        if (current) setVehiclePage(result);
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
  }, [filters, page, refreshCount, search, sortBy, sortDirection]);

  function updateSearch(value: string) {
    const nextSearch = value.trim();
    setSearchInput(value);
    if (nextSearch === search && page === 1) return;
    setLoading(true);
    setError(null);
  }

  function updateFilters(nextFilters: Partial<VehicleFilters>) {
    const changed = Object.entries(nextFilters).some(
      ([key, value]) => filters[key as keyof VehicleFilters] !== value,
    );
    if (!changed) return;

    setFilters((currentFilters) => ({ ...currentFilters, ...nextFilters }));
    setPage(1);
    setLoading(true);
    setError(null);
  }

  function changePage(nextPage: number) {
    if (nextPage === page) return;
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function sortVehicles(key: VehicleSortKey) {
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
    vehiclePage,
    error,
    loading,
    page,
    searchInput,
    filters,
    sortBy,
    sortDirection,
    changePage,
    refresh,
    retry: refresh,
    sortVehicles,
    updateFilters,
    updateSearch,
  };
}
