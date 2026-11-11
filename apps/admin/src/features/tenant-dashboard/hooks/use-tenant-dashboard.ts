'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getTenantDashboardOverview } from '../services/tenant-dashboard-service';
import type { TenantDashboardOverview } from '../types/tenant-dashboard';

export function useTenantDashboard() {
  const [data, setData] = useState<TenantDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // 30s default

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchOverview = useCallback(async (isSilent = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isSilent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const overview = await getTenantDashboardOverview(controller.signal);
      setData(overview);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load bus company dashboard data. Please try again.',
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    getTenantDashboardOverview(controller.signal)
      .then((overview) => {
        if (!ignore) {
          setData(overview);
          setLastUpdated(new Date());
          setError(null);
          setLoading(false);
          setIsRefreshing(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load bus company dashboard data. Please try again.',
          );
          setLoading(false);
          setIsRefreshing(false);
        }
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setIsRefreshing(true);
        void fetchOverview(true);
      }
    }, autoRefreshInterval * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshInterval, fetchOverview]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    return fetchOverview(true);
  }, [fetchOverview]);

  return {
    data,
    loading,
    isRefreshing,
    error,
    lastUpdated,
    autoRefreshInterval,
    setAutoRefreshInterval,
    refresh,
  };
}
