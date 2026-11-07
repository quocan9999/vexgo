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
      <div className="admin-ui admin-page-content space-y-6">
        {/* Context Command Bar */}
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
          <div
            className="space-y-6"
            role="status"
            aria-label="Đang tải dữ liệu tổng quan"
          >
            {/* Metrics Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx} className="p-5.5 space-y-3 border border-border">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="size-9.5 rounded-xl" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-full mt-2" />
                </Card>
              ))}
            </div>

            {/* Asymmetric 8:4 Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main Column Skeleton (8 cols) */}
              <div className="lg:col-span-8">
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

              {/* Side Column Skeleton (4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="p-4 space-y-3 border border-border">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </Card>
                <Card className="p-4 space-y-3 border border-border">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </Card>
              </div>
            </div>
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

        {/* Success Data State: Bento Grid 8:4 */}
        {data && (
          <div className="space-y-6">
            {/* 1. 4 Thẻ KPI Chỉ số Hôm nay */}
            <TenantMetricsGrid metrics={data.metrics} />

            {/* 2. Cụm Bento Grid 8:4 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Cột chính (8/12 cột): Chuyến xe sắp khởi hành */}
              <div className="lg:col-span-8">
                <TenantUpcomingTrips trips={data.upcomingTrips} />
              </div>

              {/* Cột phụ (4/12 cột): Cảnh báo việc khẩn & Lối tắt thao tác nhanh */}
              <div className="lg:col-span-4 space-y-6">
                <TenantUrgentAlerts alerts={data.urgentAlerts} />
                <TenantQuickActions />
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
