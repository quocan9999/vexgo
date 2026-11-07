'use client';

import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Clock,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/action-button';
import type { UrgentAlerts } from '../types/tenant-dashboard';

interface TenantUrgentAlertsProps {
  alerts: UrgentAlerts;
}

export function TenantUrgentAlerts({ alerts }: TenantUrgentAlertsProps) {
  const hasUrgentIssues =
    alerts.pendingBookingsCount > 0 ||
    alerts.unassignedShipmentsCount > 0 ||
    alerts.departingSoonLowOccupancyCount > 0;

  return (
    <Card className="shadow-xs border border-border">
      <CardHeader className="border-b border-border/80 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <AlertCircle
                className={`size-4 ${
                  hasUrgentIssues ? 'text-amber-500' : 'text-emerald-500'
                }`}
              />
              Việc cần xử lý ngay
            </CardTitle>
            {hasUrgentIssues && (
              <span className="size-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            Thời gian thực
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 space-y-2.5">
        {!hasUrgentIssues ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-emerald-900">
            <div className="grid size-7.5 place-items-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold">Vận hành ổn định</p>
              <p className="text-[11px] text-emerald-700/90 mt-0.5 leading-snug">
                Không có vé giữ chỗ quá hạn hay kiện hàng chưa xếp. Mọi việc đang theo đúng kế hoạch.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Phiếu đặt vé chờ thanh toán */}
            {alerts.pendingBookingsCount > 0 && (
              <div className="flex items-center justify-between gap-2.5 p-3 rounded-lg bg-amber-50/70 border border-amber-200/80">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="grid size-7.5 place-items-center rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                    <Clock className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-amber-900 truncate">
                      {alerts.pendingBookingsCount} vé giữ chỗ chờ thanh toán
                    </p>
                    <p className="text-[11px] text-amber-800/85 mt-0.5 leading-tight">
                      Cần thu tiền hoặc giải phóng ghế
                    </p>
                  </div>
                </div>
                <Link
                  href="/booking-management"
                  className={
                    buttonVariants({ variant: 'outline', size: 'sm' }) +
                    ' text-xs h-7 px-2 gap-1 shrink-0 bg-white hover:bg-amber-100/50 border-amber-300 text-amber-900 font-medium'
                  }
                >
                  <span>Xử lý</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            )}

            {/* 2. Kiện hàng chưa xếp chuyến */}
            {alerts.unassignedShipmentsCount > 0 && (
              <div className="flex items-center justify-between gap-2.5 p-3 rounded-lg bg-blue-50/70 border border-blue-200/80">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="grid size-7.5 place-items-center rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                    <PackageCheck className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-blue-900 truncate">
                      {alerts.unassignedShipmentsCount} kiện hàng chưa gán xe
                    </p>
                    <p className="text-[11px] text-blue-800/85 mt-0.5 leading-tight">
                      Hàng tại bãi chưa xếp lên chuyến
                    </p>
                  </div>
                </div>
                <Link
                  href="/shipments"
                  className={
                    buttonVariants({ variant: 'outline', size: 'sm' }) +
                    ' text-xs h-7 px-2 gap-1 shrink-0 bg-white hover:bg-blue-100/50 border-blue-300 text-blue-900 font-medium'
                  }
                >
                  <span>Xếp xe</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            )}

            {/* 3. Chuyến sắp chạy vắng khách */}
            {alerts.departingSoonLowOccupancyCount > 0 && (
              <div className="flex items-center justify-between gap-2.5 p-3 rounded-lg bg-rose-50/70 border border-rose-200/80">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="grid size-7.5 place-items-center rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                    <AlertTriangle className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-rose-900 truncate">
                      {alerts.departingSoonLowOccupancyCount} chuyến ghế &lt; 30%
                    </p>
                    <p className="text-[11px] text-rose-800/85 mt-0.5 leading-tight">
                      Khởi hành &lt; 2h nhưng ít khách
                    </p>
                  </div>
                </div>
                <Link
                  href="/trips"
                  className={
                    buttonVariants({ variant: 'outline', size: 'sm' }) +
                    ' text-xs h-7 px-2 gap-1 shrink-0 bg-white hover:bg-rose-100/50 border-rose-300 text-rose-900 font-medium'
                  }
                >
                  <span>Xem</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
