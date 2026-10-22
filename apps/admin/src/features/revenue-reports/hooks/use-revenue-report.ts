'use client';

import { useEffect, useState } from 'react';
import type { DateRangeValue } from '@/components/data-filters/data-filters';
import {
  getRevenueReport,
  RevenueReportApiError,
} from '../services/revenue-report-service';
import type {
  RevenueReportGroupBy,
  RevenueReportResponse,
} from '../types/revenue-report';

type RevenueReportLoadError = {
  message: string;
  accessDenied: boolean;
  retryable: boolean;
};

function toLoadError(error: unknown): RevenueReportLoadError {
  if (error instanceof RevenueReportApiError) {
    return {
      message: error.message,
      accessDenied: error.accessDenied,
      retryable: error.retryable,
    };
  }
  if (error instanceof TypeError) {
    return {
      message: 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.',
      accessDenied: false,
      retryable: true,
    };
  }
  return {
    message: 'Không thể tải báo cáo doanh thu. Vui lòng thử lại.',
    accessDenied: false,
    retryable: true,
  };
}

export function useRevenueReport() {
  const [dateRange, setDateRange] = useState<DateRangeValue | null>(null);
  const [groupBy, setGroupBy] = useState<RevenueReportGroupBy>('day');
  const [retryCount, setRetryCount] = useState(0);
  const requestKey = JSON.stringify([
    dateRange?.from ?? null,
    dateRange?.to ?? null,
    groupBy,
    retryCount,
  ]);
  const [result, setResult] = useState<{
    key: string;
    report: RevenueReportResponse;
  } | null>(null);
  const [errorState, setErrorState] = useState<{
    key: string;
    error: RevenueReportLoadError;
  } | null>(null);

  const report = result?.key === requestKey ? result.report : null;
  const error = errorState?.key === requestKey ? errorState.error : null;
  const loading = report === null && error === null;

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const query = {
      fromDate: dateRange?.from,
      toDate: dateRange?.to,
      groupBy,
    };

    getRevenueReport(query, controller.signal)
      .then((response) => {
        if (current) setResult({ key: requestKey, report: response });
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setErrorState({ key: requestKey, error: toLoadError(requestError) });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [dateRange, groupBy, requestKey]);

  function updateDateRange(value: DateRangeValue | null) {
    setDateRange((current) =>
      current?.from === value?.from && current?.to === value?.to
        ? current
        : value,
    );
  }

  function updateGroupBy(value: string) {
    if (value === 'day' || value === 'month' || value === 'quarter') {
      setGroupBy(value);
    }
  }

  function retry() {
    setRetryCount((count) => count + 1);
  }

  return {
    dateRange,
    error,
    groupBy,
    loading,
    report,
    retry,
    updateDateRange,
    updateGroupBy,
  };
}
