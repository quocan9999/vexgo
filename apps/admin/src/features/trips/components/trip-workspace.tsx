'use client';

import { useTranslations } from 'next-intl';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  BusFront,
  CalendarDays,
  Clock,
  LoaderCircle,
  MapPin,
  Pencil,
  RefreshCw,
  Route as RouteIcon,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceConfirmation,
  ResourceRefreshAction,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/action-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/status-badge';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { StopListEditor } from '@/features/stops/components/stop-list-editor';
import { applyRouteTemplate, getTripStops } from '@/features/stops/services/stop-service';
import type { TripPassengerPointItem } from '@/features/stops/types/stop';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  cancelTrip,
  deleteTrip,
  getTripById,
  isTripNotFoundError,
  TripApiError,
  updateTripStatus,
} from '../services/trip-service';
import type { Trip, TripLookupOptionsState, TripStatus } from '../types/trip';
import { TripFormDialog } from './trip-form-dialog';
import '../trips.css';

export function tripStatusLabel(status: TripStatus | string, t?: (key: string) => string) {
  switch (status) {
    case 'CHUA_KHOI_HANH':
      return t ? t('statusScheduled') : 'Scheduled';
    case 'DANG_CHAY':
      return t ? t('statusInTransit') : 'In Transit';
    case 'HOAN_THANH':
      return t ? t('statusCompleted') : 'Completed';
    case 'DA_HUY':
      return t ? t('statusCancelled') : 'Cancelled';
  }
}

export function TripStatusBadge({ status }: { status: TripStatus }) {
  const tTrips = useTranslations('trips');
  return (
    <ResourceStatusBadge tone={status === 'DANG_CHAY' ? 'active' : 'muted'}>
      {tripStatusLabel(status, tTrips)}
    </ResourceStatusBadge>
  );
}

function formatDate(dateStr: string) {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

function formatTime(timeStr: string) {
  return timeStr.slice(0, 5);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(value))
    .replaceAll('/', '-');
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; trip: Trip };

export interface TripWorkspaceProps {
  tripId: number;
  initialTrip?: Trip;
  routeOptions?: TripLookupOptionsState;
  vehicleOptions?: TripLookupOptionsState;
  onRetryRouteOptions?: () => void;
  onRetryVehicleOptions?: () => void;
  onClose?: () => void;
  onNotFound?: () => void;
  onUpdated?: (trip: Trip, options?: { silent?: boolean }) => void;
  onDeleted?: () => void;
}

export function TripWorkspace({
  tripId,
  initialTrip,
  routeOptions,
  vehicleOptions,
  onRetryRouteOptions,
  onRetryVehicleOptions,
  onClose,
  onNotFound,
  onUpdated,
  onDeleted,
}: TripWorkspaceProps) {
  const tTrips = useTranslations('trips');
  const tCommon = useTranslations('common');
  const { can } = useAdminPermissions();
  const canRead = can('trip:read');
  const canUpdate = can('trip:update');
  const canCancel = can('trip:cancel');
  const canDelete = can('trip:delete');

  const [detail, setDetail] = useState<DetailState>(
    initialTrip
      ? { status: 'success', trip: initialTrip }
      : { status: 'loading' },
  );
  const [retryCount, setRetryCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const statusPending = useRef(false);
  const cancelPending = useRef(false);
  const deletePending = useRef(false);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<'HOAN_THANH' | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [stopsEditorOpen, setStopsEditorOpen] = useState(false);
  const [tripStops, setTripStops] = useState<TripPassengerPointItem[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  function openStatusDialog(target: 'HOAN_THANH') {
    setStatusTarget(target);
    setStatusDialogOpen(true);
  }

  async function handleConfirmStatus() {
    if (!statusTarget || statusPending.current) return;
    statusPending.current = true;
    setStatusSubmitting(true);
    try {
      const updated = await updateTripStatus(tripId, statusTarget);
      setStatusDialogOpen(false);
      setDetail({ status: 'success', trip: updated });
      toast.success(tTrips('tripCompletedSuccess'));
      onUpdated?.(updated);
    } catch (err: unknown) {
      if (
        err instanceof TripApiError &&
        err.code === 'TRIP_STATUS_TRANSITION_NOT_ALLOWED'
      ) {
        toast.error(tTrips('tripStatusChangedNotice'));
        setRetryCount((c) => c + 1);
        getTripById(tripId)
          .then((latest) => onUpdated?.(latest, { silent: true }))
          .catch(() => {});
      } else {
        toast.error(
          err instanceof Error
            ? err.message
            : tTrips('cannotUpdateStatus'),
        );
      }
    } finally {
      statusPending.current = false;
      setStatusSubmitting(false);
    }
  }

  function openCancelDialog() {
    setCancelDialogOpen(true);
  }

  async function handleConfirmCancel() {
    if (cancelPending.current) return;
    cancelPending.current = true;
    setCancelSubmitting(true);
    try {
      const updated = await cancelTrip(tripId);
      setCancelDialogOpen(false);
      setDetail({ status: 'success', trip: updated });
      toast.success(tTrips('tripCancelledSuccess', { code: updated.code }));
      onUpdated?.(updated, { silent: true });
    } catch (err: unknown) {
      if (
        err instanceof TripApiError &&
        err.code === 'TRIP_STATUS_TRANSITION_NOT_ALLOWED'
      ) {
        toast.error(tTrips('tripStatusChangedNotice'));
        setRetryCount((c) => c + 1);
        getTripById(tripId)
          .then((latest) => onUpdated?.(latest, { silent: true }))
          .catch(() => {});
      } else {
        toast.error(
          err instanceof Error ? err.message : tTrips('cannotCancelTrip'),
        );
      }
    } finally {
      cancelPending.current = false;
      setCancelSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (deletePending.current) return;
    deletePending.current = true;
    setDeleteSubmitting(true);
    try {
      const deleted = await deleteTrip(tripId);
      setDeleteDialogOpen(false);
      toast.success(tTrips('tripDeletedSuccess', { code: deleted.code }));
      if (onDeleted) {
        onDeleted();
      } else if (typeof window !== 'undefined') {
        window.location.assign('/trips');
      }
    } catch (err: unknown) {
      if (isTripNotFoundError(err)) {
        if (onNotFound) {
          onNotFound();
        } else if (typeof window !== 'undefined') {
          window.location.assign('/trips');
        }
      } else {
        toast.error(
          err instanceof Error ? err.message : tTrips('cannotDeleteTrip'),
        );
      }
    } finally {
      deletePending.current = false;
      setDeleteSubmitting(false);
    }
  }

  const loadTripStops = () => {
    void Promise.resolve().then(() => setLoadingStops(true));
    getTripStops(tripId)
      .then(setTripStops)
      .catch(() => {})
      .finally(() => setLoadingStops(false));
  };

  async function handleConfirmApplyTemplate() {
    setApplyingTemplate(true);
    try {
      const res = await applyRouteTemplate(tripId);
      toast.success(tTrips('templateAppliedSuccess'));
      setApplyTemplateOpen(false);
      loadTripStops();
      setRetryCount((c) => c + 1);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : tTrips('cannotApplyTemplate'),
      );
    } finally {
      setApplyingTemplate(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    getTripById(tripId, controller.signal)
      .then((trip) => {
        if (!controller.signal.aborted) {
          setDetail({ status: 'success', trip });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          if (isTripNotFoundError(error)) {
            onNotFound?.();
          }
          const message =
            error instanceof Error
              ? error.message
              : tTrips('cannotLoadTrip');
          setDetail({
            status: 'error',
            message,
          });
        }
      });

    void Promise.resolve().then(() => setLoadingStops(true));
    getTripStops(tripId)
      .then((stops) => {
        if (!controller.signal.aborted) setTripStops(stops);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStops(false);
      });

    return () => controller.abort();
  }, [tripId, retryCount, onNotFound]);

  useEffect(() => {
    if (editOpen || statusDialogOpen || cancelDialogOpen) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible')
        setRetryCount((count) => count + 1);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [editOpen, statusDialogOpen, cancelDialogOpen]);

  const trip = detail.status === 'success' ? detail.trip : null;

  return (
    <SuperAdminLayout
      activeSection="trips"
      breadcrumbs={[
        { label: tCommon('operations'), href: '/trips' },
        { label: tTrips('tripsTitle'), href: '/trips' },
        { label: trip ? trip.code : `#${tripId}` },
      ]}
    >
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                nativeButton={false}
                render={
                  <Link
                    href="/trips"
                    onClick={onClose ? (e) => { e.preventDefault(); onClose(); } : undefined}
                  />
                }
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                {tTrips('backToTrips')}
              </Button>

              {canRead && trip && (
                <>
                  <Button
                    nativeButton={false}
                    render={<Link href={`/trips/${trip.tripId}/seats`} />}
                    variant="outline"
                  >
                    <Ticket aria-hidden="true" className="size-4" />
                    {tTrips('viewSeats')}
                  </Button>
                  <Button
                    nativeButton={false}
                    render={<Link href={`/trips/${trip.tripId}/manifest`} />}
                    variant="outline"
                  >
                    <Users aria-hidden="true" className="size-4" />
                    {tTrips('manifestPassengers')}
                  </Button>
                </>
              )}

              {canUpdate && trip && trip.status === 'CHUA_KHOI_HANH' && (
                <Button onClick={() => setEditOpen(true)} variant="outline">
                  <Pencil aria-hidden="true" />
                  {tCommon('edit')}
                </Button>
              )}

              {canUpdate && trip && trip.status === 'DANG_CHAY' && (
                <Button onClick={() => openStatusDialog('HOAN_THANH')}>
                  {tTrips('completeTrip')}
                </Button>
              )}

              {canCancel && trip && trip.status === 'CHUA_KHOI_HANH' && (
                <Button onClick={openCancelDialog} variant="outline">
                  {tTrips('cancelTrip')}
                </Button>
              )}

              {canDelete &&
                trip &&
                (trip.status === 'CHUA_KHOI_HANH' || trip.status === 'DA_HUY') && (
                  <Button
                    onClick={() => setDeleteDialogOpen(true)}
                    variant="destructive"
                  >
                    <Trash2 aria-hidden="true" />
                    {tTrips('deleteTrip')}
                  </Button>
                )}

              <ResourceRefreshAction
                loading={detail.status === 'loading'}
                onClick={() => setRetryCount((c) => c + 1)}
              />
            </div>
          }
          eyebrow={tTrips('eyebrow')}
          title={trip ? tTrips('tripWorkspaceTitleWithCode', { code: trip.code }) : tTrips('tripWorkspaceTitle')}
          titleId="trip-workspace-title"
        />

        {detail.status === 'loading' && (
          <ResourceState loading>{tTrips('loadingTripInfo')}</ResourceState>
        )}

        {detail.status === 'error' && (
          <ResourceState error>
            <p>{detail.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => {
                  setDetail({ status: 'loading' });
                  setRetryCount((c) => c + 1);
                }}
                variant="outline"
              >
                {tCommon('retry')}
              </Button>
              <Button nativeButton={false} render={<Link href="/trips" />}>
                {tTrips('backToTripsButton')}
              </Button>
            </div>
          </ResourceState>
        )}

        {detail.status === 'success' && trip && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary"
                  >
                    <BusFront size={28} />
                  </span>
                  <div>
                    <h2 className="admin-data-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {trip.code}
                    </h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {trip.route.origin}
                      </span>
                      <span aria-hidden="true">→</span>
                      <span className="font-semibold text-foreground">
                        {trip.route.destination}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <span className="admin-data-mono text-foreground font-medium">
                        {formatTime(trip.departureTime)}
                      </span>
                      <span className="tabular-nums">{formatDate(trip.departureDate)}</span>
                    </p>
                  </div>
                </div>
                <TripStatusBadge status={trip.status} />
              </div>
            </Card>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Tuyến xe */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <RouteIcon className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tTrips('operatingRoute')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>{tTrips('routeCode')}</dt>
                      <dd className="admin-data-mono font-semibold text-foreground">
                        {trip.route.code}
                      </dd>
                    </div>
                    <div>
                      <dt>{tTrips('originPoint')}</dt>
                      <dd className="font-medium text-foreground">{trip.route.origin}</dd>
                    </div>
                    <div>
                      <dt>{tTrips('destinationPoint')}</dt>
                      <dd className="font-medium text-foreground">
                        {trip.route.destination}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Xe phục vụ */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <BusFront className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tTrips('assignedVehicle')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>{tTrips('licensePlate')}</dt>
                      <dd className="admin-data-mono font-semibold text-foreground">
                        {trip.vehicle.licensePlate}
                      </dd>
                    </div>
                    <div>
                      <dt>{tTrips('vehicleType')}</dt>
                      <dd className="font-medium text-foreground">
                        {trip.vehicle.vehicleType.name}
                      </dd>
                    </div>
                    <div>
                      <dt>{tTrips('vehicleStatus')}</dt>
                      <dd>
                        <ResourceStatusBadge
                          tone={
                            trip.vehicle.status === 'HOAT_DONG' ? 'active' : 'muted'
                          }
                        >
                          {trip.vehicle.status === 'HOAT_DONG'
                            ? tTrips('statusOperating')
                            : trip.vehicle.status === 'BAO_TRI'
                              ? tTrips('statusMaintenance')
                              : tTrips('statusUnknown')}
                        </ResourceStatusBadge>
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 3: Hàng hóa & Gửi hàng */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Boxes className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tTrips('cargoInfo')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>{tTrips('acceptsCargo')}</dt>
                      <dd>{trip.acceptsShipments ? tCommon('yes') : tCommon('no')}</dd>
                    </div>
                  </dl>
                  <h5 className="pt-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {tTrips('cargoCapacityTitle')}
                  </h5>
                  <dl className="mt-2 grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-2.5 text-center [&_dt]:text-[11px] [&_dt]:text-muted-foreground [&_dd]:font-bold [&_dd]:text-foreground">
                    <div>
                      <dt>{tTrips('motorbikes')}</dt>
                      <dd>{trip.cargoCapacity.motorbikes}</dd>
                    </div>
                    <div>
                      <dt>{tTrips('bulkyCargo')}</dt>
                      <dd>{trip.cargoCapacity.bulkyCargo}</dd>
                    </div>
                    <div>
                      <dt>{tTrips('lightCargo')}</dt>
                      <dd>{trip.cargoCapacity.lightCargo}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>

            {/* Ghế chuyến summary */}
            {trip.seatSummary && (
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket className="size-4 text-muted-foreground" />
                      <CardTitle className="text-base font-semibold">
                        {tTrips('seatStatusTitle')}
                      </CardTitle>
                    </div>
                    {canRead && (
                      <Button
                        nativeButton={false}
                        render={<Link href={`/trips/${trip.tripId}/seats`} />}
                        size="sm"
                        variant="outline"
                      >
                        {tTrips('openSeatMap')}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="trips-seat-summary-grid">
                    <div className="trips-seat-card">
                      <span className="trips-seat-card__count">
                        {trip.seatSummary.total}
                      </span>
                      <span className="trips-seat-card__label">{tTrips('totalSeatsCount')}</span>
                    </div>
                    <div className="trips-seat-card trips-seat-card--available">
                      <span className="trips-seat-card__count">
                        {trip.seatSummary.available}
                      </span>
                      <span className="trips-seat-card__label">{tTrips('availableSeatsCount')}</span>
                    </div>
                    <div className="trips-seat-card trips-seat-card--held">
                      <span className="trips-seat-card__count">
                        {trip.seatSummary.held}
                      </span>
                      <span className="trips-seat-card__label">{tTrips('heldSeatsCount')}</span>
                    </div>
                    <div className="trips-seat-card trips-seat-card--booked">
                      <span className="trips-seat-card__count">
                        {trip.seatSummary.booked}
                      </span>
                      <span className="trips-seat-card__label">{tTrips('bookedSeatsCount')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lộ trình đón / trả */}
            <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
              <CardHeader className="p-0 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <RouteIcon className="size-4 text-primary" />
                      <CardTitle className="text-base font-semibold">
                        {tTrips('hourlyStops', { count: tripStops.length })}
                      </CardTitle>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tTrips('routeStopsSubtitle')}
                    </p>
                  </div>

                  {canUpdate && trip.status === 'CHUA_KHOI_HANH' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setApplyTemplateOpen(true)}
                        size="sm"
                        variant="outline"
                      >
                        {tTrips('applyTemplate')}
                      </Button>
                      <Button
                        onClick={() => setStopsEditorOpen(true)}
                        size="sm"
                        variant="outline"
                      >
                        {tTrips('editRoute')}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {trip.thieuDiem && (
                  <Alert className="mb-4" variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>{tTrips('missingStopsAlertTitle')}</AlertTitle>
                    <AlertDescription className="text-xs">
                      {tTrips('missingStopsAlertDesc')}
                    </AlertDescription>
                  </Alert>
                )}

                {loadingStops ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    {tTrips('loadingStops')}
                  </p>
                ) : tripStops.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground italic">
                    {tTrips('noStopsAssigned')}
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {tripStops.map((stop, idx) => (
                      <div
                        className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-xs"
                        key={stop.diemDonTraChuyenXeId ?? idx}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Badge
                            className="text-[10px] font-semibold"
                            variant={
                              stop.loaiDiem === 'DON'
                                ? 'secondary'
                                : stop.loaiDiem === 'TRA'
                                  ? 'outline'
                                  : 'warning'
                            }
                          >
                            {stop.loaiDiem === 'DON'
                              ? tTrips('stopPickupBadge')
                              : stop.loaiDiem === 'TRA'
                                ? tTrips('stopDropoffBadge')
                                : tTrips('stopRestBadge')}
                          </Badge>
                          <span className="truncate font-medium text-foreground">
                            {stop.diemDonTra?.tenDiem ?? `#${stop.diemDonTraId}`}
                          </span>
                          {stop.phuPhi > 0 && (
                            <span className="admin-data-mono text-[11px] text-muted-foreground">
                              (+{Number(stop.phuPhi).toLocaleString('vi-VN')} ₫)
                            </span>
                          )}
                          {(stop.veCount ?? 0) > 0 && (
                            <Badge className="text-[10px] font-semibold" variant="warning">
                              {tTrips('ticketsCount', { count: stop.veCount ?? 0 })}
                            </Badge>
                          )}
                        </div>
                        <div className="admin-data-mono font-semibold text-primary shrink-0">
                          {stop.gioThucTe ?? `${stop.phutLech >= 0 ? '+' : ''}${stop.phutLech}p`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Thông tin hệ thống */}
            <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  {tTrips('systemInfoTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">{tTrips('tripCreatedAt')}</dt>
                    <dd className="mt-1 font-medium text-foreground tabular-nums">
                      {formatTimestamp(trip.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{tTrips('lastUpdated')}</dt>
                    <dd className="mt-1 font-medium text-foreground tabular-nums">
                      {formatTimestamp(trip.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dialogs */}
        {editOpen && canUpdate && trip && (
          <TripFormDialog
            onClose={() => setEditOpen(false)}
            onRetryRouteOptions={onRetryRouteOptions ?? (() => {})}
            onRetryVehicleOptions={onRetryVehicleOptions ?? (() => {})}
            onSaved={(saved) => {
              setEditOpen(false);
              setDetail({ status: 'success', trip: saved });
              onUpdated?.(saved);
              toast.success(tTrips('tripUpdatedSuccess', { code: saved.code }));
            }}
            routeOptions={routeOptions ?? { status: 'success', options: [] }}
            trip={trip}
            vehicleOptions={vehicleOptions ?? { status: 'success', options: [] }}
          />
        )}

        {stopsEditorOpen && canUpdate && trip && (
          <StopListEditor
            departureTime={trip.departureTime}
            mode="trip"
            onClose={() => setStopsEditorOpen(false)}
            onSaved={() => {
              loadTripStops();
              setRetryCount((c) => c + 1);
            }}
            targetId={tripId}
            title={tTrips('tripStopsModalTitle', { code: trip.code })}
          />
        )}

        {applyTemplateOpen && trip && (
          <ResourceConfirmation
            busy={applyingTemplate}
            description={tTrips('applyTemplateConfirmDesc')}
            onClose={() => setApplyTemplateOpen(false)}
            title={tTrips('applyTemplateConfirmTitle', { code: trip.code })}
          >
            <Button disabled={applyingTemplate} onClick={handleConfirmApplyTemplate}>
              {applyingTemplate && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {applyingTemplate ? tTrips('applyingTemplate') : tTrips('applyTemplate')}
            </Button>
          </ResourceConfirmation>
        )}

        {statusDialogOpen && statusTarget && trip && (
          <ResourceConfirmation
            busy={statusSubmitting}
            description={tTrips('completeTripConfirmDesc', { code: trip.code })}
            onClose={() => setStatusDialogOpen(false)}
            title={tTrips('completeTripConfirmTitle')}
          >
            <Button disabled={statusSubmitting} onClick={handleConfirmStatus}>
              {statusSubmitting && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {statusSubmitting ? tTrips('completingTrip') : tTrips('completeTrip')}
            </Button>
          </ResourceConfirmation>
        )}

        {cancelDialogOpen && trip && (
          <ResourceConfirmation
            busy={cancelSubmitting}
            description={tTrips('cancelTripConfirmDesc', { origin: trip.route.origin, destination: trip.route.destination, time: formatTime(trip.departureTime), date: formatDate(trip.departureDate) })}
            onClose={() => setCancelDialogOpen(false)}
            title={tTrips('cancelTripConfirmTitle', { code: trip.code })}
          >
            <Button
              disabled={cancelSubmitting}
              onClick={handleConfirmCancel}
              variant="destructive"
            >
              {cancelSubmitting && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {cancelSubmitting ? tTrips('cancellingTrip') : tTrips('cancelTrip')}
            </Button>
          </ResourceConfirmation>
        )}

        {deleteDialogOpen && trip && (
          <ResourceConfirmation
            busy={deleteSubmitting}
            description={tTrips('deleteTripConfirmDesc')}
            onClose={() => setDeleteDialogOpen(false)}
            title={tTrips('deleteTripConfirmTitle', { code: trip.code })}
          >
            <Button
              disabled={deleteSubmitting}
              onClick={handleConfirmDelete}
              variant="destructive"
            >
              {deleteSubmitting && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {deleteSubmitting ? tTrips('deletingTrip') : tTrips('deleteTrip')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}

export { TripWorkspace as TripDetailSheet };
