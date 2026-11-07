'use client';

import { useCallback, useEffect, useState } from 'react';
import { getTenantDashboardOverview } from '../services/tenant-dashboard-service';
import type { TenantDashboardOverview } from '../types/tenant-dashboard';

export function useTenantDashboard() {
  const [data, setData] = useState<TenantDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // 30s default
  const [refreshCount, setRefreshCount] = useState(0);

  // Data fetching effect
  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    getTenantDashboardOverview(controller.signal)
      .then((overview) => {
        if (current) {
          setData(overview);
          setError(null);
          setLastUpdated(new Date());
          setLoading(false);
          setIsRefreshing(false);
        }
      })
      .catch((err: unknown) => {
        if (!current) return;
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải dữ liệu bảng điều khiển nhà xe. Vui lòng thử lại.',
        );
        setLoading(false);
        setIsRefreshing(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [refreshCount]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setIsRefreshing(true);
        setRefreshCount((c) => c + 1);
      }
    }, autoRefreshInterval * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshInterval]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshCount((c) => c + 1);
  }, []);

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
