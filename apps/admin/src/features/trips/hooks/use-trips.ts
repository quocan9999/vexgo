'use client';

import { useEffect, useState } from 'react';
import { getTrips } from '../services/trip-service';
import type {
  PaginatedTrips,
  TripSortKey,
  TripStatus,
  SortDirection,
} from '../types/trip';

const PAGE_SIZE = 10;

export function useTrips() {
  const [result, setResult] = useState<{
    key: string;
    page: PaginatedTrips;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<TripSortKey>('departureDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [status, setStatus] = useState<TripStatus | ''>('');
  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  const requestKey = JSON.stringify([
    page,
    search,
    sortBy,
    sortDirection,
    status,
    routeId,
    vehicleId,
    departureDate,
  ]);
  const tripPage = result?.key === requestKey ? result.page : null;

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
      status,
      routeId,
      vehicleId,
      departureDate,
    ]);

    getTrips(
      {
        page,
        pageSize: PAGE_SIZE,
        search,
        sortBy,
        sortDirection,
        status: status || undefined,
        routeId: routeId ? Number(routeId) : undefined,
        vehicleId: vehicleId ? Number(vehicleId) : undefined,
        departureDate: departureDate || undefined,
      },
      controller.signal,
    )
      .then((data) => {
        if (current) setResult({ key, page: data });
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Không thể tải danh sách chuyến xe.',
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
    status,
    routeId,
    vehicleId,
    departureDate,
    refreshCount,
  ]);

  function updateSearch(value: string) {
    setLoading(value.trim() !== search);
    setError(null);
    setSearchInput(value);
  }

  function changePage(value: number) {
    if (value === page) return;
    setLoading(true);
    setError(null);
    setPage(value);
  }

  function updateStatus(value: string) {
    if (value === status) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setStatus(
      value === 'CHUA_KHOI_HANH' ||
        value === 'DANG_CHAY' ||
        value === 'HOAN_THANH' ||
        value === 'DA_HUY'
        ? value
        : '',
    );
  }

  function updateRouteId(value: string) {
    if (value === routeId) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setRouteId(value);
  }

  function updateVehicleId(value: string) {
    if (value === vehicleId) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setVehicleId(value);
  }

  function updateDepartureDate(value: string) {
    if (value === departureDate) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setDepartureDate(value);
  }

  function sortTrips(key: TripSortKey) {
    setLoading(true);
    setError(null);
    setPage(1);
    if (sortBy === key) {
      setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
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
    tripPage,
    error,
    loading,
    searchInput,
    status,
    routeId,
    vehicleId,
    departureDate,
    sortBy,
    sortDirection,
    changePage,
    updateSearch,
    updateStatus,
    updateRouteId,
    updateVehicleId,
    updateDepartureDate,
    sortTrips,
    refresh,
  };
}
