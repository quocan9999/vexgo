'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2, ArrowRight, Clock, PackageCheck, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className={`size-4.5 ${hasUrgentIssues ? 'text-amber-500' : 'text-emerald-500'}`} />
              Việc cần xử lý ngay
            </CardTitle>
            {hasUrgentIssues && (
              <span className="size-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <span className="text-xs text-muted-foreground">Theo dõi thời gian thực</span>
        </div>
        <CardDescription className="text-xs text-muted-foreground mt-0.5">
          Các cảnh báo vận hành tồn đọng yêu cầu điều độ viên hoặc trưởng ca can thiệp
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {!hasUrgentIssues ? (
          <div className="flex items-center gap-3 p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-emerald-900">
            <div className="grid size-8 place-items-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
              <CheckCircle2 className="size-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Vận hành ổn định</p>
              <p className="text-xs text-emerald-700/90 mt-0.5">
                Không có vé giữ chỗ quá hạn hay kiện hàng tồn đọng. Hệ thống điều độ đang hoạt động tối ưu.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Phiếu đặt vé chờ thanh toán */}
            {alerts.pendingBookingsCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-amber-50/60 border border-amber-200/80">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-amber-900">
                        {alerts.pendingBookingsCount} vé giữ chỗ chờ thanh toán
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-800">
                        Khẩn cấp
                      </span>
                    </div>
                    <p className="text-xs text-amber-800/90 mt-0.5">
                      Khách hàng đang giữ chỗ chưa hoàn tất thanh toán. Cần xác nhận thu tiền hoặc giải phóng ghế.
                    </p>
                  </div>
                </div>
                <Link
                  href="/booking-management"
                  className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' text-xs h-7.5 px-2.5 gap-1 shrink-0 bg-white hover:bg-amber-100/50 border-amber-300 text-amber-900'}
                >
                  <span>Xử lý ngay</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            )}

            {/* 2. Kiện hàng chưa xếp chuyến */}
            {alerts.unassignedShipmentsCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-blue-50/60 border border-blue-200/80">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                    <PackageCheck className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-blue-900">
                        {alerts.unassignedShipmentsCount} kiện hàng chưa gán xe
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-200/60 text-blue-800">
                        Bốc dỡ
                      </span>
                    </div>
                    <p className="text-xs text-blue-800/90 mt-0.5">
                      Đã tiếp nhận tại kho bến nhưng chưa được điều phối lên các chuyến xe khởi hành phù hợp.
                    </p>
                  </div>
                </div>
                <Link
                  href="/shipments"
                  className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' text-xs h-7.5 px-2.5 gap-1 shrink-0 bg-white hover:bg-blue-100/50 border-blue-300 text-blue-900'}
                >
                  <span>Điều phối hàng</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            )}

            {/* 3. Chuyến sắp chạy vắng khách */}
            {alerts.departingSoonLowOccupancyCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-rose-50/60 border border-rose-200/80">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-rose-900">
                        {alerts.departingSoonLowOccupancyCount} chuyến sắp chạy có tỷ lệ ghế &lt; 30%
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-200/60 text-rose-800">
                        Lưu ý
                      </span>
                    </div>
                    <p className="text-xs text-rose-800/90 mt-0.5">
                      Chuyến xuất bến trong 2 giờ tới có lượng khách thấp. Điều độ viên cần xem xét điều tiết.
                    </p>
                  </div>
                </div>
                <Link
                  href="/trips"
                  className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' text-xs h-7.5 px-2.5 gap-1 shrink-0 bg-white hover:bg-rose-100/50 border-rose-300 text-rose-900'}
                >
                  <span>Kiểm tra</span>
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
