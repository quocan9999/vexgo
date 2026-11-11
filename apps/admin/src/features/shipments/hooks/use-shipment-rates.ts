'use client';

import { useCallback, useEffect, useState } from 'react';
import { getShipmentRates } from '../services/shipment-rate-service';
import type {
  PaginatedShipmentRates,
  ShipmentRateEffectiveState,
  ShipmentRateSortKey,
  ShipmentRateStatus,
  SortDirection,
} from '../types/shipment-rate';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 250;

export function useShipmentRates(enabled = true) {
  const [ratePage, setRatePage] = useState<PaginatedShipmentRates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [routeId, setRouteId] = useState<string>('');
  const [cargoTypeId, setCargoTypeId] = useState<string>('');
  const [status, setStatus] = useState<ShipmentRateStatus | ''>('');
  const [effectiveState, setEffectiveState] = useState<
    ShipmentRateEffectiveState | ''
  >('');
  const [sortBy, setSortBy] = useState<ShipmentRateSortKey>('weightFrom');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const trimmed = searchInput.trim();
    const delay = trimmed === '' ? 0 : SEARCH_DEBOUNCE_MS;
    const timer = window.setTimeout(() => {
      setPage((current) => (search === trimmed ? current : 1));
      setSearch(trimmed);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [search, searchInput]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const nextPage = await getShipmentRates(
          {
            page,
            pageSize: PAGE_SIZE,
            search: search || undefined,
            routeId: routeId ? Number(routeId) : undefined,
            cargoTypeId: cargoTypeId ? Number(cargoTypeId) : undefined,
            status: status || undefined,
            effectiveState: effectiveState || undefined,
            sortBy,
            sortDirection,
          },
          controller.signal,
        );

        if (nextPage.meta.totalPages > 0 && page > nextPage.meta.totalPages) {
          setPage(nextPage.meta.totalPages);
          return;
        }

        setRatePage(nextPage);
        setLoading(false);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === 'AbortError'
        ) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load shipment rate list.',
        );
        setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, [
    enabled,
    effectiveState,
    page,
    reloadTick,
    routeId,
    cargoTypeId,
    search,
    sortBy,
    sortDirection,
    status,
  ]);

  const refresh = useCallback(() => {
    setReloadTick((value) => value + 1);
  }, []);

  function updateSearch(value: string) {
    setSearchInput(value);
  }

  function updateRoute(value: string) {
    setPage(1);
    setRouteId(value);
  }

  function updateCargoType(value: string) {
    setPage(1);
    setCargoTypeId(value);
  }

  function updateStatus(value: ShipmentRateStatus | '') {
    setPage(1);
    setStatus(value);
  }

  function updateEffectiveState(value: ShipmentRateEffectiveState | '') {
    setPage(1);
    setEffectiveState(value);
  }

  function sortRates(nextSortBy: ShipmentRateSortKey) {
    setPage(1);
    if (sortBy === nextSortBy) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(nextSortBy);
    setSortDirection('asc');
  }

  function resetFilters() {
    setPage(1);
    setSearchInput('');
    setSearch('');
    setRouteId('');
    setCargoTypeId('');
    setStatus('');
    setEffectiveState('');
  }

  function changePage(nextPage: number) {
    if (!ratePage) return;
    if (nextPage < 1 || nextPage > ratePage.meta.totalPages) return;
    setPage(nextPage);
  }

  return {
    ratePage,
    error,
    loading,
    searchInput,
    routeId,
    cargoTypeId,
    status,
    effectiveState,
    sortBy,
    sortDirection,
    changePage,
    updateSearch,
    updateRoute,
    updateCargoType,
    updateStatus,
    updateEffectiveState,
    sortRates,
    resetFilters,
    refresh,
  };
}
