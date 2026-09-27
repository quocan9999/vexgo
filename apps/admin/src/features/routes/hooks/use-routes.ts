'use client';

import { useEffect, useState } from 'react';
import { getRoutes } from '../services/route-service';
import type { PaginatedRoutes, RouteSortKey, RouteStatus, SortDirection } from '../types/route';

const PAGE_SIZE = 10;

export function useRoutes() {
  const [result, setResult] = useState<{ key: string; page: PaginatedRoutes } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<RouteSortKey>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [status, setStatus] = useState<RouteStatus | ''>('');
  const [busCompanyId, setBusCompanyId] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const requestKey = JSON.stringify([page, search, sortBy, sortDirection, status, busCompanyId]);
  const routePage = result?.key === requestKey ? result.page : null;

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
    const key = JSON.stringify([page, search, sortBy, sortDirection, status, busCompanyId]);
    getRoutes({
      page, pageSize: PAGE_SIZE, search, sortBy, sortDirection,
      status: status || undefined,
      busCompanyId: busCompanyId ? Number(busCompanyId) : undefined,
    }, controller.signal)
      .then((data) => {
        if (current) setResult({ key, page: data });
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách tuyến xe.');
        }
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [page, search, sortBy, sortDirection, status, busCompanyId, refreshCount]);

  function updateSearch(value: string) {
    setLoading(value.trim() !== search);
    setError(null); setSearchInput(value);
  }
  function changePage(value: number) {
    if (value === page) return;
    setLoading(true); setError(null); setPage(value);
  }
  function updateStatus(value: string) {
    if (value === status) return;
    setLoading(true); setError(null); setPage(1);
    setStatus(value === 'HOAT_DONG' || value === 'TAM_NGUNG' ? value : '');
  }
  function updateBusCompany(value: string) {
    if (value === busCompanyId) return;
    setLoading(true); setError(null); setPage(1); setBusCompanyId(value);
  }
  function sortRoutes(key: RouteSortKey) {
    setLoading(true); setError(null); setPage(1);
    if (sortBy === key) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDirection('asc'); }
  }
  function refresh() {
    setLoading(true); setError(null); setRefreshCount((count) => count + 1);
  }

  return {
    routePage, error, loading, searchInput, status, busCompanyId, sortBy, sortDirection,
    changePage, updateSearch, updateStatus, updateBusCompany, sortRoutes, refresh,
  };
}
