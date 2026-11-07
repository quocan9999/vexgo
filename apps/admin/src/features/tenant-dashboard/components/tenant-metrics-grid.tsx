'use client';

import { Bus, Ticket, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatVnd } from '@/features/booking-management/services/booking-management-format';
import type { OperationalMetrics } from '../types/tenant-dashboard';

interface TenantMetricsGridProps {
  metrics: OperationalMetrics;
}

export function TenantMetricsGrid({ metrics }: TenantMetricsGridProps) {
  const formatNumber = (num: number) => num.toLocaleString('vi-VN');

  // Load factor progress color
  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-emerald-500';
    if (percent >= 50) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Chuyến xe hôm nay */}
      <Card className="flex flex-col justify-between p-5 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Chuyến xe hôm nay
            </h2>
            <div className="grid size-9.5 place-items-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs">
              <Bus className="size-4.5" />
            </div>
          </div>
          <div>
            <p className="text-[32px] font-bold leading-none tracking-tight tabular-nums text-foreground">
              {formatNumber(metrics.totalTripsToday)}
              <span className="text-sm font-normal text-muted-foreground ml-1.5">chuyến</span>
            </p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/80 text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
            {metrics.preparingTrips} sắp chạy
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
            {metrics.runningTrips} đang chạy
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
            {metrics.completedTrips} đã xong
          </span>
          {metrics.cancelledTrips > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium">
              {metrics.cancelledTrips} hủy
            </span>
          )}
        </div>
      </Card>

      {/* 2. Vé & Tỷ lệ lấp đầy ghế */}
      <Card className="flex flex-col justify-between p-5 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tỷ lệ lấp đầy ghế
            </h2>
            <div className="grid size-9.5 place-items-center rounded-xl bg-teal-50 text-teal-600 border border-teal-100 shadow-2xs">
              <Ticket className="size-4.5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-[32px] font-bold leading-none tracking-tight tabular-nums text-foreground">
                {metrics.loadFactorPercent}%
              </p>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {formatNumber(metrics.bookedTicketsToday)} / {formatNumber(metrics.totalSeatsToday)} ghế
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${getProgressColor(metrics.loadFactorPercent)}`}
                style={{ width: `${Math.min(100, Math.max(0, metrics.loadFactorPercent))}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/80 text-xs text-muted-foreground flex items-center justify-between">
          <span>Khách đã xác nhận giữ chỗ & mua vé</span>
          <span className="font-medium text-foreground">
            {metrics.totalSeatsToday > 0
              ? `${Math.max(0, metrics.totalSeatsToday - metrics.bookedTicketsToday)} trống`
              : '0 trống'}
          </span>
        </div>
      </Card>

      {/* 3. Bưu gửi & Hàng hóa */}
      <Card className="flex flex-col justify-between p-5 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bưu gửi & Hàng hóa
            </h2>
            <div className="grid size-9.5 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shadow-2xs">
              <Package className="size-4.5" />
            </div>
          </div>
          <div>
            <p className="text-[32px] font-bold leading-none tracking-tight tabular-nums text-foreground">
              {formatNumber(metrics.totalShipmentsToday)}
              <span className="text-sm font-normal text-muted-foreground ml-1.5">kiện</span>
            </p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/80 text-xs text-muted-foreground">
          {metrics.unassignedShipmentsToday > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <AlertTriangle className="size-3.5 shrink-0" />
              {metrics.unassignedShipmentsToday} kiện chưa xếp lên chuyến
            </span>
          ) : (
            <span className="text-emerald-700 font-medium">
              ✓ Toàn bộ kiện hàng đã được gán chuyến
            </span>
          )}
        </div>
      </Card>

      {/* 4. Doanh thu tạm tính hôm nay */}
      <Card className="flex flex-col justify-between p-5 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Doanh thu tạm tính
            </h2>
            <div className="grid size-9.5 place-items-center rounded-xl bg-violet-50 text-violet-600 border border-violet-100 shadow-2xs">
              <TrendingUp className="size-4.5" />
            </div>
          </div>
          <div>
            <p className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-foreground truncate">
              {formatVnd(metrics.estimatedRevenueToday.toString())}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/80 text-xs text-muted-foreground">
          <span>Tiền vé & cước bưu gửi phát sinh trong ngày</span>
        </div>
      </Card>
    </div>
  );
}
