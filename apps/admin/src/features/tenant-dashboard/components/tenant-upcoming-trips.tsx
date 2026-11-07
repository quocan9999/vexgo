'use client';

import Link from 'next/link';
import { Clock, Eye, ArrowUpRight, Bus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/status-badge';
import { buttonVariants } from '@/components/ui/action-button';
import type { UpcomingTripItem } from '../types/tenant-dashboard';

interface TenantUpcomingTripsProps {
  trips: UpcomingTripItem[];
}

function getTripStatusBadge(status: string) {
  switch (status) {
    case 'CHUA_KHOI_HANH':
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">Chưa xuất bến</Badge>;
    case 'DANG_CHAY':
      return <Badge variant="warning">Đang di chuyển</Badge>;
    case 'HOAN_THANH':
      return <Badge variant="success">Hoàn thành</Badge>;
    case 'DA_HUY':
      return <Badge variant="destructive">Đã hủy</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function TenantUpcomingTrips({ trips }: TenantUpcomingTripsProps) {
  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-emerald-500';
    if (percent >= 50) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  return (
    <Card className="shadow-xs border border-border">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Chuyến xe sắp khởi hành
            </CardTitle>
            <span className="inline-flex items-center justify-center size-5 text-xs font-semibold rounded-full bg-primary/10 text-primary">
              {trips.length}
            </span>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Lịch khởi hành và tiến độ lấp đầy khách của các chuyến xe trong ngày
          </CardDescription>
        </div>
        <Link
          href="/trips"
          className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' text-xs h-8 gap-1 self-start sm:self-auto'}
        >
          <span>Tất cả chuyến xe</span>
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {trips.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="mx-auto size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Bus className="size-6" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Không có chuyến xe nào sắp xuất bến
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Tất cả các chuyến xe trong ngày hôm nay đã xuất bến hoặc chưa có chuyến xe nào được lên lịch chạy.
            </p>
            <Link
              href="/trips"
              className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' mt-4 text-xs'}
            >
              Xem danh sách chuyến xe
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Giờ chạy</TableHead>
                <TableHead>Tuyến đường</TableHead>
                <TableHead>Phương tiện</TableHead>
                <TableHead className="min-w-[170px]">Lấp đầy ghế</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip) => (
                <TableRow key={trip.tripId} className="hover:bg-slate-50/70">
                  {/* Giờ xuất bến */}
                  <TableCell className="font-semibold text-slate-900">
                    <div className="flex items-center gap-1.5 font-mono text-sm">
                      <Clock className="size-3.5 text-primary shrink-0" />
                      <span>{trip.departureTime}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-sans">
                      {trip.departureDate}
                    </span>
                  </TableCell>

                  {/* Tuyến xe */}
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {trip.routeName}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <span>{trip.departureLocation}</span>
                      <span>→</span>
                      <span>{trip.arrivalLocation}</span>
                    </div>
                  </TableCell>

                  {/* Phương tiện */}
                  <TableCell>
                    <span className="font-mono text-xs font-semibold px-1.5 py-0.5 bg-slate-100 rounded text-slate-800">
                      {trip.licensePlate}
                    </span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {trip.vehicleTypeName}
                    </div>
                  </TableCell>

                  {/* Tiến độ lấp đầy */}
                  <TableCell>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold tabular-nums text-foreground">
                          {trip.loadFactorPercent}%
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {trip.bookedSeats}/{trip.totalSeats} ghế
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${getProgressColor(
                            trip.loadFactorPercent,
                          )}`}
                          style={{
                            width: `${Math.min(100, Math.max(0, trip.loadFactorPercent))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </TableCell>

                  {/* Trạng thái */}
                  <TableCell>
                    {getTripStatusBadge(trip.status)}
                  </TableCell>

                  {/* Thao tác */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/trips/${trip.tripId}/seats`}
                        title="Xem sơ đồ ghế"
                        className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' h-7 px-2 text-xs gap-1 text-primary hover:text-primary'}
                      >
                        <Eye className="size-3.5" />
                        <span>Sơ đồ</span>
                      </Link>
                      <Link
                        href={`/trips/${trip.tripId}`}
                        title="Chi tiết chuyến"
                        className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 px-2 text-xs'}
                      >
                        Chi tiết
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
