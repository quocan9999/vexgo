'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Compass,
  LoaderCircle,
  Pencil,
  Ticket,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceConfirmation,
  ResourceRefreshAction,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useTranslations } from 'next-intl';
import {
  FarePriceApiError,
  getFarePriceById,
  getFarePriceRouteOptions,
  getFarePriceVehicleTypeOptions,
  updateFarePriceStatus,
} from '../services/fare-price-service';
import type {
  FarePrice,
  FarePriceOptionsState,
  FarePriceStatus,
} from '../types/fare-price';
import { FarePriceFormDialog } from './fare-price-form-dialog';

function formatPrice(listedPrice: number) {
  return `${new Intl.NumberFormat('vi-VN').format(listedPrice)} ₫`;
}

function formatDateOnly(value: string | null, unlimitedLabel = 'N/A') {
  if (value === null) return unlimitedLabel;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(`${value}T00:00:00.000Z`))
    .replaceAll('/', '-');
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

function getStatusLabel(status: FarePrice['status'], tFare: (key: any) => string) {
  return status === 'HOAT_DONG' ? tFare('statusActive') : tFare('statusSuspended');
}

function getEffectiveStateLabel(state: FarePrice['effectiveState'], tFare: (key: any) => string) {
  switch (state) {
    case 'CHUA_HIEU_LUC':
      return tFare('statePending');
    case 'DANG_HIEU_LUC':
      return tFare('stateActive');
    case 'HET_HIEU_LUC':
      return tFare('stateExpired');
    case 'TAM_NGUNG':
      return tFare('statusSuspended');
  }
}

export interface FarePriceWorkspaceProps {
  farePriceId: number;
  initialFarePrice?: FarePrice;
  routeOptions?: FarePriceOptionsState;
  vehicleTypeOptions?: FarePriceOptionsState;
  onRetryRouteOptions?: () => void;
  onRetryVehicleTypeOptions?: () => void;
  onClose?: () => void;
  onUpdated?: (farePrice: FarePrice) => void;
  onNotFound?: () => void;
}

export function FarePriceWorkspace({
  farePriceId,
  initialFarePrice,
  routeOptions: propRouteOptions,
  vehicleTypeOptions: propVehicleTypeOptions,
  onRetryRouteOptions,
  onRetryVehicleTypeOptions,
  onClose,
  onUpdated,
  onNotFound,
}: FarePriceWorkspaceProps) {
  const tFare = useTranslations('farePrices');
  const tCommon = useTranslations('common');
  const { can } = useAdminPermissions();
  const canUpdate = can('fare-price:update');

  const [request, setRequest] = useState<{
    key: string;
    status: 'loading' | 'success' | 'error';
    farePrice?: FarePrice;
  }>({
    key: '',
    status: initialFarePrice ? 'success' : 'loading',
    farePrice: initialFarePrice,
  });

  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const statusSubmittingRef = useRef(false);
  const onNotFoundRef = useRef(onNotFound);

  const [internalRouteOptions, setInternalRouteOptions] =
    useState<FarePriceOptionsState>({ status: 'loading' });
  const [internalVehicleTypeOptions, setInternalVehicleTypeOptions] =
    useState<FarePriceOptionsState>({ status: 'loading' });

  useEffect(() => {
    onNotFoundRef.current = onNotFound;
  }, [onNotFound]);

  useEffect(() => {
    if (!propRouteOptions) {
      getFarePriceRouteOptions()
        .then((options) => setInternalRouteOptions({ status: 'success', options }))
        .catch(() => setInternalRouteOptions({ status: 'error' }));
    }
    if (!propVehicleTypeOptions) {
      getFarePriceVehicleTypeOptions()
        .then((options) =>
          setInternalVehicleTypeOptions({ status: 'success', options }),
        )
        .catch(() => setInternalVehicleTypeOptions({ status: 'error' }));
    }
  }, [propRouteOptions, propVehicleTypeOptions]);

  const routeOptions = propRouteOptions ?? internalRouteOptions;
  const vehicleTypeOptions = propVehicleTypeOptions ?? internalVehicleTypeOptions;

  const requestKey = `${farePriceId}:${retryCount}`;
  const requestMatches = request.key === requestKey;
  const loading =
    !initialFarePrice && (!requestMatches || request.status === 'loading');
  const error =
    requestMatches && request.status === 'error'
      ? tFare('errors.loadDetailsFailed')
      : null;
  const farePrice =
    request.farePrice ??
    (requestMatches && request.status === 'success'
      ? (request.farePrice ?? null)
      : null);

  function handleFarePriceUpdated(updated: FarePrice) {
    setRequest({ key: requestKey, status: 'success', farePrice: updated });
    setEditDialogOpen(false);
    onUpdated?.(updated);
    toast.success(tFare('updatedSuccess'));
  }

  const targetStatus: FarePriceStatus | null = farePrice
    ? farePrice.status === 'HOAT_DONG'
      ? 'TAM_NGUNG'
      : 'HOAT_DONG'
    : null;

  function openStatusDialog() {
    setStatusDialogOpen(true);
  }

  async function confirmStatusChange() {
    if (!canUpdate || !targetStatus || statusSubmittingRef.current) return;

    statusSubmittingRef.current = true;
    setStatusSubmitting(true);

    try {
      const updated = await updateFarePriceStatus(farePriceId, targetStatus);
      setRequest({ key: requestKey, status: 'success', farePrice: updated });
      setStatusDialogOpen(false);
      onUpdated?.(updated);
      toast.success(tFare('updatedSuccess'));
    } catch (requestError: unknown) {
      if (
        requestError instanceof FarePriceApiError &&
        requestError.code === 'FARE_PRICE_NOT_FOUND'
      ) {
        toast.error(tFare('errors.notFound'));
        onNotFoundRef.current?.();
      } else if (
        requestError instanceof FarePriceApiError &&
        requestError.code === 'FARE_PRICE_OVERLAP' &&
        targetStatus === 'HOAT_DONG'
      ) {
        toast.error(
          tFare('errors.overlapActive'),
        );
      } else if (
        requestError instanceof FarePriceApiError &&
        requestError.code === 'FARE_PRICE_CONCURRENT_MODIFICATION'
      ) {
        toast.error(
          tFare('errors.concurrentModification'),
        );
      } else {
        toast.error(
          requestError instanceof TypeError
            ? tFare('networkError')
            : requestError instanceof Error
              ? requestError.message
              : tFare('errors.updateStatusFailed'),
        );
      }
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const key = `${farePriceId}:${retryCount}`;

    getFarePriceById(farePriceId, controller.signal)
      .then((data) => {
        if (current) setRequest({ key, status: 'success', farePrice: data });
      })
      .catch((requestError: unknown) => {
        if (!current || controller.signal.aborted) return;
        if (
          requestError instanceof FarePriceApiError &&
          requestError.code === 'FARE_PRICE_NOT_FOUND'
        ) {
          toast.error(tFare('errors.notFound'));
          onNotFoundRef.current?.();
          setRequest({ key, status: 'error' });
          return;
        }
        setRequest({ key, status: 'error' });
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [farePriceId, retryCount, tFare]);

  return (
    <SuperAdminLayout
      activeSection="fare-prices"
      breadcrumbs={[
        { label: tFare('eyebrow'), href: '/fare-prices' },
        { label: tFare('farePricesTitle'), href: '/fare-prices' },
        {
          label: farePrice
            ? `${farePrice.route.code} (${farePrice.vehicleType.name})`
            : `${tFare('resourceLabel')} #${farePriceId}`,
        },
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
                    href="/fare-prices"
                    onClick={onClose ? (e) => { e.preventDefault(); onClose(); } : undefined}
                  />
                }
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                {tFare('backToList')}
              </Button>

              {canUpdate && farePrice && (
                <>
                  <Button onClick={openStatusDialog} variant="outline">
                    {farePrice.status === 'HOAT_DONG' ? tFare('suspendAction') : tFare('activateAction')}
                  </Button>
                  <Button onClick={() => setEditDialogOpen(true)}>
                    <Pencil aria-hidden="true" />
                    {tCommon('edit')}
                  </Button>
                </>
              )}

              <ResourceRefreshAction
                loading={loading}
                onClick={() => setRetryCount((c) => c + 1)}
              />
            </div>
          }
          eyebrow={tFare('eyebrow')}
          title={tFare('farePriceDetails')}
          titleId="fare-price-workspace-title"
        />

        {loading && (
          <ResourceState loading>{tCommon('loading')}</ResourceState>
        )}

        {error && (
          <ResourceState error>
            <p>{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => setRetryCount((count) => count + 1)}
                variant="outline"
              >
                {tCommon('retry')}
              </Button>
              <Button nativeButton={false} render={<Link href="/fare-prices" />}>
                {tFare('backToList')}
              </Button>
            </div>
          </ResourceState>
        )}

        {farePrice && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary"
                  >
                    <Ticket size={28} />
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {farePrice.route.origin} → {farePrice.route.destination}
                    </h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="admin-data-mono font-semibold text-foreground">
                        {farePrice.route.code}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-foreground">
                        {farePrice.vehicleType.name}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ResourceStatusBadge
                    tone={farePrice.status === 'HOAT_DONG' ? 'active' : 'muted'}
                  >
                    {getStatusLabel(farePrice.status, tFare)}
                  </ResourceStatusBadge>
                  <ResourceStatusBadge
                    tone={
                      farePrice.effectiveState === 'DANG_HIEU_LUC'
                        ? 'active'
                        : 'muted'
                    }
                  >
                    {getEffectiveStateLabel(farePrice.effectiveState, tFare)}
                  </ResourceStatusBadge>
                </div>
              </div>
            </Card>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Listed Price */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm border-primary/20 bg-primary/5">
                <CardHeader className="p-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    {tFare('colListedPrice')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-3xl font-bold tracking-tight text-primary tabular-nums">
                    {formatPrice(farePrice.listedPrice)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Currency: <strong className="text-foreground">{farePrice.currency}</strong>
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Route & Vehicle Type Info */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Compass className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tFare('infoRoute')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>{tFare('colRoute')}</dt>
                      <dd>{farePrice.route.origin} → {farePrice.route.destination}</dd>
                    </div>
                    <div>
                      <dt>{tFare('colVehicleType')}</dt>
                      <dd>{farePrice.vehicleType.name}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 3: Validity Period */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tFare('colEffectiveDates')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>{tFare('colValidFrom')}</dt>
                      <dd className="admin-data-mono">
                        {formatDateOnly(farePrice.validFrom, tFare('unlimitedDate'))}
                      </dd>
                    </div>
                    <div>
                      <dt>{tFare('colValidTo')}</dt>
                      <dd className="admin-data-mono">
                        {farePrice.validTo ? formatDateOnly(farePrice.validTo, tFare('unlimitedDate')) : tFare('unlimitedDate')}
                      </dd>
                    </div>
                    <div>
                      <dt>{tFare('colCurrentEffective')}</dt>
                      <dd>{getEffectiveStateLabel(farePrice.effectiveState, tFare)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>

            {/* System Info */}
            <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  {tFare('colStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">{tFare('colStatus')}</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {getStatusLabel(farePrice.status, tFare)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="mt-1 font-medium text-foreground tabular-nums">
                      {formatTimestamp(farePrice.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Updated</dt>
                    <dd className="mt-1 font-medium text-foreground tabular-nums">
                      {formatTimestamp(farePrice.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dialogs */}
        {editDialogOpen && canUpdate && farePrice && (
          <FarePriceFormDialog
            farePrice={farePrice}
            onClose={() => setEditDialogOpen(false)}
            onNotFound={() => {
              setEditDialogOpen(false);
              toast.error(tFare('emptyNoData'));
              onNotFound?.();
            }}
            onRetryRouteOptions={onRetryRouteOptions ?? (() => {})}
            onRetryVehicleTypeOptions={onRetryVehicleTypeOptions ?? (() => {})}
            onSaved={handleFarePriceUpdated}
            routeOptions={routeOptions}
            vehicleTypeOptions={vehicleTypeOptions}
          />
        )}

        {statusDialogOpen && canUpdate && targetStatus && (
          <ResourceConfirmation
            busy={statusSubmitting}
            description={
              targetStatus === 'TAM_NGUNG'
                ? tFare('confirmSuspendDesc')
                : tFare('confirmActivateDesc')
            }
            onClose={() => {
              if (!statusSubmittingRef.current) setStatusDialogOpen(false);
            }}
            title={
              targetStatus === 'TAM_NGUNG'
                ? tFare('suspendAction')
                : tFare('activateAction')
            }
          >
            <Button
              aria-busy={statusSubmitting}
              disabled={statusSubmitting}
              onClick={confirmStatusChange}
            >
              {statusSubmitting && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {statusSubmitting
                ? tCommon('saving')
                : targetStatus === 'TAM_NGUNG'
                  ? tFare('suspendAction')
                  : tFare('activateAction')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}


