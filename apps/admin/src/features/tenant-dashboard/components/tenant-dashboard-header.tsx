'use client';

import { Radio, Calendar } from 'lucide-react';
import { ResourceRefreshAction } from '@/components/admin/resource-ui';

interface TenantDashboardHeaderProps {
  businessDate?: string;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  autoRefreshInterval: number;
  onRefresh: () => void;
  onAutoRefreshChange: (interval: number) => void;
}

export function TenantDashboardHeader({
  businessDate,
  isRefreshing,
  lastUpdated,
  autoRefreshInterval,
  onRefresh,
  onAutoRefreshChange,
}: TenantDashboardHeaderProps) {
  const formatTime = (date: Date | null) => {
    if (!date) return '—';
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-1">
      {/* Screen-reader landmark */}
      <h1 className="sr-only">Tổng quan vận hành nhà xe</h1>

      {/* Left: Context chips */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200/80 shadow-2xs">
          <Calendar className="size-3.5 text-slate-500" />
          <span>
            Ca trực:{' '}
            <strong className="font-semibold text-slate-900">
              {businessDate ?? 'Hôm nay'}
            </strong>
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Trực tiếp
        </span>
      </div>

      {/* Right: Controls & Refresh */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          role="radiogroup"
          aria-label="Tần suất tự động làm mới"
          className="inline-flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-border text-xs"
        >
          <span className="text-muted-foreground px-2 py-1 font-medium flex items-center gap-1">
            <Radio className="size-3 text-primary" />
            <span>Làm mới:</span>
          </span>
          {[
            { value: 30, label: '30s' },
            { value: 60, label: '60s' },
            { value: 0, label: 'Tắt' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={autoRefreshInterval === option.value}
              onClick={() => onAutoRefreshChange(option.value)}
              className={`px-2 py-1 rounded-md font-medium text-xs transition-all ${
                autoRefreshInterval === option.value
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {lastUpdated && (
          <span className="text-xs text-muted-foreground hidden lg:inline-block tabular-nums">
            Cập nhật: {formatTime(lastUpdated)}
          </span>
        )}

        <ResourceRefreshAction loading={isRefreshing} onClick={onRefresh} />
      </div>
    </div>
  );
}
