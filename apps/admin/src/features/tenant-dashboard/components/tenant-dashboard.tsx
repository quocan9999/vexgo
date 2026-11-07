'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useTenantDashboard } from '../hooks/use-tenant-dashboard';
import { TenantDashboardHeader } from './tenant-dashboard-header';
import { TenantMetricsGrid } from './tenant-metrics-grid';
import { TenantUpcomingTrips } from './tenant-upcoming-trips';
import { TenantUrgentAlerts } from './tenant-urgent-alerts';
import { TenantQuickActions } from './tenant-quick-actions';

export function TenantDashboard() {
  const {
    data,
    loading,
    isRefreshing,
    error,
    lastUpdated,
    autoRefreshInterval,
    setAutoRefreshInterval,
    refresh,
  } = useTenantDashboard();

  return (
    <SuperAdminLayout activeSection="overview">
      <div className="space-y-6 pb-12">
        {/* Header */}
        <TenantDashboardHeader
          businessDate={data?.businessDate}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          autoRefreshInterval={autoRefreshInterval}
          onRefresh={refresh}
          onAutoRefreshChange={setAutoRefreshInterval}
        />

        {/* Loading State */}
        {loading && !data && (
          <div className="space-y-6" role="status" aria-label="Đang tải dữ liệu tổng quan">
            {/* Metrics Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx} className="p-5 space-y-3 border border-border">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="size-9.5 rounded-xl" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-full mt-2" />
                </Card>
              ))}
            </div>

            {/* Urgent Alerts Skeleton */}
            <Card className="p-4 space-y-3 border border-border">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </Card>

            {/* Upcoming Trips Skeleton */}
            <Card className="p-5 space-y-4 border border-border">
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-8 w-28" />
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </Card>
          </div>
        )}

        {/* Error State */}
        {error && !data && (
          <Card className="p-8 text-center border-rose-200 bg-rose-50/50 shadow-xs">
            <div className="mx-auto size-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-3">
              <AlertCircle className="size-6" />
            </div>
            <h2 className="text-base font-semibold text-rose-950">
              Không thể tải dữ liệu điều hành nhà xe
            </h2>
            <p className="text-sm text-rose-700 mt-1 max-w-md mx-auto">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              className="mt-4 gap-1.5 border-rose-300 text-rose-800 hover:bg-rose-100"
            >
              <RefreshCw className="size-3.5" />
              <span>Thử lại</span>
            </Button>
          </Card>
        )}

        {/* Success Data State */}
        {data && (
          <div className="space-y-6">
            {/* 1. Chỉ số hôm nay */}
            <TenantMetricsGrid metrics={data.metrics} />

            {/* 2. Cảnh báo việc cần xử lý ngay */}
            <TenantUrgentAlerts alerts={data.urgentAlerts} />

            {/* 3. Lịch chuyến sắp chạy */}
            <TenantUpcomingTrips trips={data.upcomingTrips} />

            {/* 4. Lối tắt thao tác nhanh */}
            <TenantQuickActions />
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
