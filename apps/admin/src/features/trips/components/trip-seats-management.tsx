'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Armchair,
  ArrowLeft,
  BusFront,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Route,
  Ticket,
} from 'lucide-react';
import { ResourceState } from '@/components/admin/resource-ui';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/action-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getTripById, getTripSeats, isTripNotFoundError } from '../services/trip-service';
import { TripStatusBadge } from './trip-detail-sheet';
import type {
  Trip,
  TripSeat,
  TripSeatsResponse,
  TripSeatStatus,
} from '../types/trip';

const tripSeatStatusPresentation = {
  TRONG: { label: 'Trống', variant: 'success' },
  DANG_GIU: { label: 'Đang giữ', variant: 'warning' },
  DA_DAT: { label: 'Đã đặt', variant: 'destructive' },
} satisfies Record<
  TripSeatStatus,
  {
    label: string;
    variant: 'success' | 'warning' | 'destructive';
  }
>;

const tripSeatMapStatusPresentation = {
  TRONG: {
    label: 'Trống',
    icon: CheckCircle2,
    className: 'border-primary/40 bg-primary/5 text-primary',
    badgeVariant: 'outline',
  },
  DANG_GIU: {
    label: 'Đang giữ',
    icon: Clock3,
    className:
      'border-amber-200 bg-[var(--admin-status-warning-soft)] text-[var(--admin-status-warning)]',
    badgeVariant: 'warning',
  },
  DA_DAT: {
    label: 'Đã đặt',
    icon: Ticket,
    className: 'border-border bg-muted text-muted-foreground',
    badgeVariant: 'secondary',
  },
} satisfies Record<
  TripSeatStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    className: string;
    badgeVariant: 'outline' | 'warning' | 'secondary';
  }
>;

function formatDate(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  }
  return dateStr;
}

function formatTime(timeStr: string) {
  return timeStr.slice(0, 5);
}

function formatCount(value: number) {
  return value.toLocaleString('vi-VN');
}

export function TripSeatStatusBadge({ status }: { status: TripSeatStatus }) {
  const { label, variant } = tripSeatStatusPresentation[status];

  return (
    <Badge data-status={status} variant={variant}>
      {label}
    </Badge>
  );
}

type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error'; message: string; isNotFound?: boolean }
  | { status: 'success'; trip: Trip; seatsData: TripSeatsResponse };

type TripSeatFilter = '' | TripSeatStatus;

type PositionedTripSeat = {
  seat: TripSeat;
  floor: number;
  x: number;
  y: number;
};

type TripSeatFloorMap = {
  floor: number;
  seats: PositionedTripSeat[];
  height: number;
};

const SEAT_MAP_VERTICAL_UNIT_PX = 0.064;
const SEAT_MAP_FALLBACK_COLUMNS = [160, 360, 640, 840];

function getTripSeatFloorMaps(seats: TripSeat[]): TripSeatFloorMap[] {
  const seatsByFloor = new Map<number, TripSeat[]>();

  for (const seat of seats) {
    const floor = seat.seat.floor === 2 ? 2 : 1;
    const floorSeats = seatsByFloor.get(floor) ?? [];
    floorSeats.push(seat);
    seatsByFloor.set(floor, floorSeats);
  }

  return [...seatsByFloor.entries()]
    .sort(([left], [right]) => left - right)
    .map(([floor, floorSeats]) => {
      const occupied = floorSeats.flatMap((seat) =>
        typeof seat.seat.x === 'number' && typeof seat.seat.y === 'number'
          ? [{ x: seat.seat.x, y: seat.seat.y }]
          : [],
      );
      const positionedSeats = floorSeats.map((seat) => {
        if (
          typeof seat.seat.x === 'number' &&
          typeof seat.seat.y === 'number'
        ) {
          return { seat, floor, x: seat.seat.x, y: seat.seat.y };
        }

        let fallback: { x: number; y: number } | undefined;
        let row = 0;
        while (!fallback) {
          fallback = SEAT_MAP_FALLBACK_COLUMNS.map((x) => ({
            x,
            y: 1000 + row * 1000,
          })).find(
            (candidate) =>
              !occupied.some(
                (other) =>
                  Math.abs(other.x - candidate.x) < 180 &&
                  Math.abs(other.y - candidate.y) < 875,
              ),
          );
          row += 1;
        }
        occupied.push(fallback);
        return { seat, floor, ...fallback };
      });

      const maxY = Math.max(1000, ...positionedSeats.map((seat) => seat.y));
      const height = Math.max(
        320,
        (Math.floor(maxY / 1000) + 2) * 64,
      );

      return { floor, seats: positionedSeats, height };
    });
}

function TripSeatsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải thông tin ghế chuyến"
      className="space-y-4"
      role="status"
    >
      <span className="sr-only">Đang tải thông tin chuyến xe và danh sách ghế…</span>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card className="h-auto gap-3 py-4" key={index}>
            <CardContent className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="h-auto gap-4 py-5">
        <CardHeader className="space-y-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton className="h-16" key={index} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function TripSeatsManagement({
  tripId,
  initialTrip,
  initialSeats,
}: {
  tripId: number;
  initialTrip?: Trip;
  initialSeats?: TripSeatsResponse;
}) {
  const { can } = useAdminPermissions();
  const canRead = can('trip:read');
  const validTripId = Number.isSafeInteger(tripId) && tripId > 0;

  const [workspace, setWorkspace] = useState<WorkspaceState>(() => {
    if (!validTripId) {
      return { status: 'error', message: 'Mã chuyến xe không hợp lệ.' };
    }
    if (initialTrip && initialSeats) {
      return { status: 'success', trip: initialTrip, seatsData: initialSeats };
    }
    return { status: 'loading' };
  });
  const [statusFilter, setStatusFilter] = useState<TripSeatFilter>('');
  const [refreshCount, setRefreshCount] = useState(0);

  const currentWorkspace: WorkspaceState = !validTripId
    ? { status: 'error', message: 'Mã chuyến xe không hợp lệ.' }
    : workspace;

  function refresh() {
    setWorkspace({ status: 'loading' });
    setRefreshCount((count) => count + 1);
  }

  useEffect(() => {
    if (!validTripId || !canRead) {
      return;
    }

    const controller = new AbortController();
    Promise.all([
      getTripById(tripId, controller.signal),
      getTripSeats(
        tripId,
        statusFilter ? { status: statusFilter } : undefined,
        controller.signal,
      ),
    ])
      .then(([trip, seatsData]) => {
        if (!controller.signal.aborted) {
          setWorkspace({ status: 'success', trip, seatsData });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          const isNotFound = isTripNotFoundError(error);
          const message =
            error instanceof Error
              ? error.message
              : 'Không thể tải dữ liệu ghế chuyến.';
          setWorkspace({ status: 'error', message, isNotFound });
        }
      });

    return () => controller.abort();
  }, [tripId, validTripId, canRead, statusFilter, refreshCount]);

  if (!canRead) {
    return (
      <SuperAdminLayout activeSection="trips">
        <div className="admin-page-content space-y-5">
          <AdminPageHeader
            actions={
              <Button
                nativeButton={false}
                render={<Link href="/trips" />}
                variant="secondary"
              >
                <ArrowLeft aria-hidden="true" />
                Danh sách chuyến
              </Button>
            }
            eyebrow="QUẢN LÝ VẬN HÀNH"
            title="Ghế chuyến xe"
            titleId="trip-seats-title"
          />
          <Card className="h-auto gap-0 py-0">
            <ResourceState error>
              Bạn không có quyền xem thông tin ghế chuyến xe.
            </ResourceState>
          </Card>
        </div>
      </SuperAdminLayout>
    );
  }

  const seatFloorMaps =
    currentWorkspace.status === 'success'
      ? getTripSeatFloorMaps(currentWorkspace.seatsData.data)
      : [];

  const backAction = (
    <Button
      nativeButton={false}
      render={<Link href="/trips" />}
      variant="secondary"
    >
      <ArrowLeft aria-hidden="true" />
      Danh sách chuyến
    </Button>
  );

  return (
    <SuperAdminLayout activeSection="trips">
      <div className="admin-page-content space-y-5">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {backAction}
              <Button
                disabled={currentWorkspace.status === 'loading'}
                onClick={refresh}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" />
                Làm mới
              </Button>
            </div>
          }
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title={
            currentWorkspace.status === 'success'
              ? 'Ghế chuyến ' + currentWorkspace.trip.code
              : 'Ghế chuyến xe'
          }
          titleId="trip-seats-title"
        />

        {currentWorkspace.status === 'loading' && <TripSeatsLoading />}

        {currentWorkspace.status === 'error' && (
          <Card className="h-auto gap-0 py-0">
            <ResourceState error>
              <div className="grid justify-items-center gap-4">
                <p className="m-0">
                  {currentWorkspace.isNotFound
                    ? 'Không tìm thấy chuyến xe hoặc bạn không có quyền truy cập.'
                    : currentWorkspace.message}
                </p>
                {currentWorkspace.isNotFound ? (
                  backAction
                ) : (
                  <Button onClick={refresh} type="button" variant="secondary">
                    <RefreshCw aria-hidden="true" />
                    Thử lại
                  </Button>
                )}
              </div>
            </ResourceState>
          </Card>
        )}

        {currentWorkspace.status === 'success' && (
          <>
            <Card className="h-auto gap-0 py-0">
              <CardHeader className="border-b p-4 sm:p-5">
                <CardTitle className="text-base">Thông tin chuyến xe</CardTitle>
                <CardDescription>
                  Thông tin tuyến, thời gian khởi hành và phương tiện phục vụ.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Route aria-hidden="true" size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-muted-foreground">Tuyến xe</p>
                    <p className="m-0 break-words text-sm font-semibold text-foreground">
                      <span className="font-mono">
                        {currentWorkspace.trip.route.code}
                      </span>
                    </p>
                    <p className="mt-1 mb-0 break-words text-xs text-muted-foreground">
                      {currentWorkspace.trip.route.origin} →{' '}
                      {currentWorkspace.trip.route.destination}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <CalendarDays aria-hidden="true" size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-muted-foreground">
                      Khởi hành
                    </p>
                    <p className="m-0 text-sm font-semibold text-foreground">
                      {formatTime(currentWorkspace.trip.departureTime)}
                    </p>
                    <p className="mt-1 mb-0 text-xs text-muted-foreground">
                      {formatDate(currentWorkspace.trip.departureDate)}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <BusFront aria-hidden="true" size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-muted-foreground">Xe phục vụ</p>
                    <p className="m-0 break-all font-mono text-sm font-semibold text-foreground">
                      {currentWorkspace.trip.vehicle.licensePlate}
                    </p>
                    <p className="mt-1 mb-0 break-words text-xs text-muted-foreground">
                      {currentWorkspace.trip.vehicle.vehicleType.name}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Clock3 aria-hidden="true" size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Trạng thái chuyến
                    </p>
                    <TripStatusBadge status={currentWorkspace.trip.status} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <section
              aria-label="Tổng quan số lượng ghế"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {[
                {
                  label: 'Tổng số ghế',
                  value: currentWorkspace.seatsData.meta.total,
                  icon: Armchair,
                  tone: 'primary',
                  detail: 'Theo cấu hình chuyến',
                },
                {
                  label: 'Ghế trống',
                  value: currentWorkspace.seatsData.meta.available,
                  icon: CheckCircle2,
                  tone: 'success',
                  detail: 'Có thể đặt',
                },
                {
                  label: 'Đang giữ',
                  value: currentWorkspace.seatsData.meta.held,
                  icon: Clock3,
                  tone: 'warning',
                  detail: 'Đang được giữ tạm thời',
                },
                {
                  label: 'Đã đặt',
                  value: currentWorkspace.seatsData.meta.booked,
                  icon: Ticket,
                  tone: 'destructive',
                  detail: 'Đã có lượt đặt',
                },
              ].map((metric) => {
                const Icon = metric.icon;
                const isPrimary = metric.tone === 'primary';
                const iconTone =
                  metric.tone === 'success'
                    ? 'bg-[var(--admin-status-success-soft)] text-[var(--admin-status-success)]'
                    : metric.tone === 'warning'
                      ? 'bg-[var(--admin-status-warning-soft)] text-[var(--admin-status-warning)]'
                      : metric.tone === 'destructive'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-white/15 text-white';
                return (
                  <Card
                    className={
                      isPrimary
                        ? 'h-auto gap-0 border-primary bg-primary py-0 text-primary-foreground'
                        : 'h-auto gap-0 py-0'
                    }
                    key={metric.label}
                  >
                    <CardContent className="flex min-h-28 items-start gap-4 p-4 sm:p-5">
                      <span
                        className={
                          'grid size-10 shrink-0 place-items-center rounded-lg ' +
                          iconTone
                        }
                      >
                        <Icon aria-hidden="true" size={19} />
                      </span>
                      <div className="min-w-0">
                        <p
                          className={
                            'mb-1 text-xs font-medium ' +
                            (isPrimary
                              ? 'text-white/75'
                              : 'text-muted-foreground')
                          }
                        >
                          {metric.label}
                        </p>
                        <p
                          className={
                            'm-0 text-3xl font-semibold leading-none ' +
                            (isPrimary ? 'text-white' : 'text-foreground')
                          }
                        >
                          {formatCount(metric.value)}
                        </p>
                        <p
                          className={
                            'mt-2 mb-0 text-xs ' +
                            (isPrimary
                              ? 'text-white/75'
                              : 'text-muted-foreground')
                          }
                        >
                          {metric.detail}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <Card className="h-auto gap-0 py-0">
              <CardHeader className="flex flex-col gap-4 border-b p-4 sm:p-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base">Sơ đồ ghế chuyến</CardTitle>
                  <CardDescription className="max-w-3xl leading-relaxed">
                    Vị trí ghế theo sơ đồ 2D đã lưu của xe, kèm trạng thái trên chuyến.
                  </CardDescription>
                </div>
                <div
                  aria-label="Lọc theo trạng thái ghế"
                  className="flex flex-wrap gap-2"
                  role="group"
                >
                  <Button
                    aria-pressed={statusFilter === ''}
                    onClick={() => setStatusFilter('')}
                    size="sm"
                    type="button"
                    variant={statusFilter === '' ? 'default' : 'outline'}
                  >
                    Tất cả ({formatCount(currentWorkspace.seatsData.meta.total)})
                  </Button>
                  <Button
                    aria-pressed={statusFilter === 'TRONG'}
                    onClick={() => setStatusFilter('TRONG')}
                    size="sm"
                    type="button"
                    variant={statusFilter === 'TRONG' ? 'default' : 'outline'}
                  >
                    Trống ({formatCount(currentWorkspace.seatsData.meta.available)})
                  </Button>
                  <Button
                    aria-pressed={statusFilter === 'DANG_GIU'}
                    onClick={() => setStatusFilter('DANG_GIU')}
                    size="sm"
                    type="button"
                    variant={
                      statusFilter === 'DANG_GIU' ? 'default' : 'outline'
                    }
                  >
                    Đang giữ ({formatCount(currentWorkspace.seatsData.meta.held)})
                  </Button>
                  <Button
                    aria-pressed={statusFilter === 'DA_DAT'}
                    onClick={() => setStatusFilter('DA_DAT')}
                    size="sm"
                    type="button"
                    variant={statusFilter === 'DA_DAT' ? 'default' : 'outline'}
                  >
                    Đã đặt ({formatCount(currentWorkspace.seatsData.meta.booked)})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
                  Đang hiển thị {formatCount(currentWorkspace.seatsData.data.length)} ghế
                </p>

                {currentWorkspace.seatsData.data.length === 0 ? (
                  <ResourceState>
                    {statusFilter
                      ? 'Không có ghế nào ở trạng thái này.'
                      : 'Chuyến xe chưa có dữ liệu ghế.'}
                  </ResourceState>
                ) : (
                  <div className="space-y-4">
                    <div
                      aria-label="Chú thích trạng thái ghế"
                      className="flex flex-wrap gap-2"
                      role="list"
                    >
                      {(Object.keys(
                        tripSeatMapStatusPresentation,
                      ) as TripSeatStatus[]).map((status) => {
                        const presentation =
                          tripSeatMapStatusPresentation[status];
                        const StatusIcon = presentation.icon;
                        return (
                          <Badge
                            data-status={status}
                            key={status}
                            role="listitem"
                            variant={presentation.badgeVariant}
                          >
                            <StatusIcon aria-hidden="true" />
                            {presentation.label}
                          </Badge>
                        );
                      })}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      {seatFloorMaps.map(({ floor, seats, height }) => {
                        const floorLabel =
                          floor === 2 ? 'Tầng trên' : 'Tầng dưới';
                        const headingId = `trip-seat-floor-${floor}`;

                        return (
                          <section
                            aria-labelledby={headingId}
                            className="min-w-0 space-y-2"
                            key={floor}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <h3
                                className="m-0 text-sm font-semibold text-foreground"
                                id={headingId}
                              >
                                {floorLabel}
                              </h3>
                              <Badge variant="secondary">
                                {formatCount(seats.length)} ghế
                              </Badge>
                            </div>

                            <div className="overflow-x-auto rounded-xl border bg-muted/30 p-2 sm:p-3">
                              <div className="mx-auto min-w-[340px] max-w-[460px]">
                                <div className="grid h-11 grid-cols-3 items-center rounded-t-xl border-x border-t bg-background px-3 text-[11px] text-muted-foreground">
                                  <Badge
                                    className="justify-self-start"
                                    variant="outline"
                                  >
                                    <BusFront aria-hidden="true" />
                                    Tài xế
                                  </Badge>
                                  <span className="justify-self-center font-medium tracking-wide">
                                    ĐẦU XE
                                  </span>
                                  <span className="justify-self-end whitespace-nowrap">
                                    Cửa lên
                                  </span>
                                </div>
                                <div
                                  aria-label={`Sơ đồ ghế ${floorLabel.toLowerCase()}`}
                                  className="relative overflow-hidden rounded-b-xl border-x border-b bg-background"
                                  role="list"
                                  style={{ height }}
                                >
                                  {seats.map(({ seat, x, y }) => {
                                    const presentation =
                                      tripSeatMapStatusPresentation[seat.status];
                                    const StatusIcon = presentation.icon;
                                    const accessibleLabel = `${seat.seat.code}, ${floorLabel.toLowerCase()}, ${presentation.label.toLowerCase()}`;

                                    return (
                                      <div
                                        aria-label={accessibleLabel}
                                        className={`absolute z-10 flex h-[54px] w-[62px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-xl border shadow-sm ${presentation.className}`}
                                        data-seat-code={seat.seat.code}
                                        data-status={seat.status}
                                        key={seat.tripSeatId}
                                        role="listitem"
                                        style={{
                                          left: `${x / 10}%`,
                                          top: `${y * SEAT_MAP_VERTICAL_UNIT_PX}px`,
                                        }}
                                        title={accessibleLabel}
                                      >
                                        <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full border bg-background">
                                          <StatusIcon
                                            aria-hidden="true"
                                            className="size-2.5"
                                          />
                                        </span>
                                        <Armchair
                                          aria-hidden="true"
                                          className="size-[17px]"
                                        />
                                        <span className="max-w-full truncate px-1 font-mono text-[10px] font-semibold leading-none">
                                          {seat.seat.code}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
