'use client';

import { useEffect, useState } from 'react';
import { getFarePrices } from '../services/fare-price-service';
import type {
  FarePriceEffectiveState,
  FarePriceListQuery,
  FarePriceSortKey,
  FarePriceStatus,
  PaginatedFarePrices,
  SortDirection,
} from '../types/fare-price';

const PAGE_SIZE = 10;

export function useFarePrices() {
  const [result, setResult] = useState<{
    key: string;
    page: PaginatedFarePrices;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<FarePriceSortKey>('validFrom');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [routeId, setRouteId] = useState('');
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const [status, setStatus] = useState<FarePriceStatus | ''>('');
  const [effectiveState, setEffectiveState] =
    useState<FarePriceEffectiveState | ''>('');
  const [refreshCount, setRefreshCount] = useState(0);

  const requestKey = JSON.stringify([
    page,
    search,
    sortBy,
    sortDirection,
    routeId,
    vehicleTypeId,
    status,
    effectiveState,
  ]);
  const farePricePage = result?.key === requestKey ? result.page : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, searchInput.trim() ? 300 : 0);
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
      routeId,
      vehicleTypeId,
      status,
      effectiveState,
    ]);
    const query: FarePriceListQuery = {
      page,
      pageSize: PAGE_SIZE,
      search,
      sortBy,
      sortDirection,
      routeId: routeId ? Number(routeId) : undefined,
      vehicleTypeId: vehicleTypeId ? Number(vehicleTypeId) : undefined,
      status: status || undefined,
      effectiveState: effectiveState || undefined,
    };

    getFarePrices(query, controller.signal)
      .then((data) => {
        if (current) setResult({ key, page: data });
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setError(
            requestError instanceof Error && requestError.name === 'TypeError'
              ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
              : 'Không thể tải danh sách bảng giá.',
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
  }, [
    page,
    search,
    sortBy,
    sortDirection,
    routeId,
    vehicleTypeId,
    status,
    effectiveState,
    refreshCount,
  ]);

  function updateSearch(value: string) {
    setLoading(value.trim() !== search);
    setError(null);
    setSearchInput(value);
  }

  function changePage(nextPage: number) {
    if (nextPage === page) return;
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function updateRoute(value: string) {
    if (value === routeId) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setRouteId(value);
  }

  function updateVehicleType(value: string) {
    if (value === vehicleTypeId) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setVehicleTypeId(value);
  }

  function updateStatus(value: string) {
    if (value === status) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setStatus(
      value === 'HOAT_DONG' || value === 'TAM_NGUNG' ? value : '',
    );
  }

  function updateEffectiveState(value: string) {
    if (value === effectiveState) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setEffectiveState(
      value === 'CHUA_HIEU_LUC' ||
        value === 'DANG_HIEU_LUC' ||
        value === 'HET_HIEU_LUC' ||
        value === 'TAM_NGUNG'
        ? value
        : '',
    );
  }

  function sortFarePrices(key: FarePriceSortKey) {
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

  function resetFilters() {
    setLoading(true);
    setError(null);
    setPage(1);
    setSearchInput('');
    setSearch('');
    setRouteId('');
    setVehicleTypeId('');
    setStatus('');
    setEffectiveState('');
  }

  function refresh() {
    setLoading(true);
    setError(null);
    setRefreshCount((count) => count + 1);
  }

  return {
    farePricePage,
    error,
    loading,
    searchInput,
    routeId,
    vehicleTypeId,
    status,
    effectiveState,
    sortBy,
    sortDirection,
    changePage,
    updateSearch,
    updateRoute,
    updateVehicleType,
    updateStatus,
    updateEffectiveState,
    sortFarePrices,
    resetFilters,
    refresh,
  };
}
