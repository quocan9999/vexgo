'use client';

import { useEffect, useState } from 'react';
import { getBusinessCodePreview } from '@/services/business-code-service';

export function useBusinessCodePreview(
  resource: 'routes' | 'trips',
  enabled: boolean,
  date?: string,
) {
  const [result, setResult] = useState<{
    key: string;
    code: string;
    error: string;
  }>({ key: '', code: '', error: '' });
  const [retry, setRetry] = useState(0);
  const key = `${resource}:${date ?? ''}:${retry}`;
  const ready =
    enabled &&
    (resource === 'routes' || /^\d{4}-\d{2}-\d{2}$/.test(date ?? ''));
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    getBusinessCodePreview(resource, date, controller.signal).then(
      (code) => {
        if (!controller.signal.aborted) setResult({ key, code, error: '' });
      },
      () => {
        if (!controller.signal.aborted)
          setResult({ key, code: '', error: 'Không thể tải mã tự động.' });
      },
    );
    return () => controller.abort();
  }, [resource, date, ready, key]);
  const current = result.key === key && ready;
  return {
    code: current ? result.code : '',
    error: current ? result.error : '',
    placeholder: !ready ? 'Chọn ngày khởi hành để sinh mã' : 'Đang sinh mã…',
    retry: () => setRetry((value) => value + 1),
  };
}
