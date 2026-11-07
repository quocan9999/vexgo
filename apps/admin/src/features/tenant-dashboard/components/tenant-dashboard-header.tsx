'use client';

import { RefreshCw, Radio } from 'lucide-react';
import { Button } from '@/components/ui/action-button';

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
    <div className="flex flex-col gap-4 pb-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Trung tâm Điều hành Nhà xe
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Trực tiếp
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {businessDate
            ? `Giám sát hoạt động vận tải & điều độ ngày ${businessDate}`
            : 'Giám sát hoạt động vận tải & điều độ trong ca trực'}
        </p>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/70 text-xs">
          <span className="text-muted-foreground px-1.5 font-medium flex items-center gap-1">
            <Radio className="size-3 text-primary" />
            Làm mới:
          </span>
          <button
            type="button"
            onClick={() => onAutoRefreshChange(30)}
            className={`px-2 py-1 rounded font-medium transition-colors ${
              autoRefreshInterval === 30
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            30s
          </button>
          <button
            type="button"
            onClick={() => onAutoRefreshChange(60)}
            className={`px-2 py-1 rounded font-medium transition-colors ${
              autoRefreshInterval === 60
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            60s
          </button>
          <button
            type="button"
            onClick={() => onAutoRefreshChange(0)}
            className={`px-2 py-1 rounded font-medium transition-colors ${
              autoRefreshInterval === 0
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tắt
          </button>
        </div>

        {lastUpdated && (
          <span className="text-xs text-muted-foreground hidden lg:inline-block tabular-nums">
            Cập nhật lúc: {formatTime(lastUpdated)}
          </span>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-1.5 h-8 px-2.5 text-xs font-medium"
        >
          <RefreshCw
            className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`}
          />
          <span>Làm mới</span>
        </Button>
      </div>
    </div>
  );
}
