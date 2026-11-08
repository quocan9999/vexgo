'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Layers,
  MapPin,
  Package,
  Pencil,
  RefreshCw,
  Scale,
  ShieldAlert,
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
import { useTranslations } from 'next-intl';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  getShipmentRateById,
  getShipmentRateCargoTypeOptions,
  getShipmentRateRouteOptions,
  ShipmentRateApiError,
  updateShipmentRateStatus,
} from '../services/shipment-rate-service';
import type {
  ShipmentRate,
  ShipmentRateEffectiveState,
  ShipmentRateOptionsState,
  ShipmentRateStatus,
} from '../types/shipment-rate';
import { ShipmentRateFormDialog } from './shipment-rate-form-dialog';

export const STATUS_LABELS: Record<ShipmentRateStatus, string> = {
  HOAT_DONG: 'Active',
  TAM_NGUNG: 'Paused',
};

export const EFFECTIVE_LABELS: Record<ShipmentRateEffectiveState, string> = {
  CHUA_DEN_NGAY: 'Upcoming',
  DANG_HIEU_LUC: 'Active',
  HET_HIEU_LUC: 'Expired',
};

export function formatWeightBand(
  weightFrom: number,
  weightTo: number | null,
  tAbove?: string,
): string {
  if (weightTo === null) {
    return tAbove ? `${tAbove} ${weightFrom} kg` : `Over ${weightFrom} kg`;
  }
  return `${weightFrom} → ${weightTo} kg`;
}

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

export type ShipmentRateWorkspaceProps = {
  rateId: number;
  initialRate?: ShipmentRate;
  onChanged?: (rate: ShipmentRate, message?: string) => void;
  onMissing?: (message: string) => void;
};

type RateDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; rate: ShipmentRate };

const INITIAL_OPTIONS: ShipmentRateOptionsState = {
  routes: [],
  cargoTypes: [],
  loading: true,
  error: null,
};

export function ShipmentRateWorkspace({
  rateId,
  initialRate,
  onChanged,
  onMissing,
}: ShipmentRateWorkspaceProps) {
  const tShipments = useTranslations('shipments');
  const tCommon = useTranslations('common');
  const { can } = useAdminPermissions();
  const canUpdate = can('shipment:update') || can('fare-price:update');

  function getLocalizedRateStatus(st: ShipmentRateStatus): string {
    return st === 'HOAT_DONG'
      ? tShipments('ratesStatusActive')
      : tShipments('ratesStatusPaused');
  }

  function getLocalizedEffectiveState(eff: ShipmentRateEffectiveState): string {
    switch (eff) {
      case 'CHUA_DEN_NGAY':
        return tShipments('validityUpcoming');
      case 'DANG_HIEU_LUC':
        return tShipments('validityActive');
      case 'HET_HIEU_LUC':
        return tShipments('validityExpired');
      default:
        return eff;
    }
  }

  const [detailState, setDetailState] = useState<RateDetailState>(
    initialRate
      ? { status: 'success', rate: initialRate }
      : { status: 'loading' },
  );
  const [retryCount, setRetryCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [formOptions, setFormOptions] =
    useState<ShipmentRateOptionsState>(INITIAL_OPTIONS);
  const [optionsReloadTick, setOptionsReloadTick] = useState(0);

  const onMissingRef = useRef(onMissing);
  useEffect(() => {
    onMissingRef.current = onMissing;
  }, [onMissing]);

  useEffect(() => {
    const controller = new AbortController();

    getShipmentRateById(rateId, controller.signal)
      .then((rate) => {
        if (!controller.signal.aborted) {
          setDetailState({ status: 'success', rate });
          onChanged?.(rate);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          if (
            err instanceof ShipmentRateApiError &&
            err.statusCode === 404
          ) {
            onMissingRef.current?.(tShipments('rateNotFound'));
          }
          setDetailState({
            status: 'error',
            message:
              err instanceof Error
                ? err.message
                : tShipments('rateLoadError'),
          });
        }
      });

    return () => controller.abort();
  }, [rateId, retryCount, onChanged, tShipments]);

  useEffect(() => {
    if (!editOpen) return;
    const controller = new AbortController();

    async function loadOptions() {
      setFormOptions((curr) => ({ ...curr, loading: true, error: null }));
      try {
        const [allRoutes, cargoTypes] = await Promise.all([
          getShipmentRateRouteOptions({ signal: controller.signal }),
          getShipmentRateCargoTypeOptions(controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setFormOptions({
            routes: allRoutes,
            cargoTypes,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setFormOptions({
            routes: [],
            cargoTypes: [],
            loading: false,
            error:
              err instanceof Error
                ? err.message
                : tShipments('cannotLoadRoutesOrCargo'),
          });
        }
      }
    }

    void loadOptions();
    return () => controller.abort();
  }, [editOpen, optionsReloadTick, tShipments]);

  const rate = detailState.status === 'success' ? detailState.rate : null;
  const nextStatus: ShipmentRateStatus =
    rate?.status === 'HOAT_DONG' ? 'TAM_NGUNG' : 'HOAT_DONG';
  const nextStatusLabel =
    nextStatus === 'TAM_NGUNG'
      ? tShipments('ratesStatusPaused')
      : tShipments('rateConfirmResumeBtn');

  async function handleConfirmStatus() {
    if (!rate || statusLoading) return;
    setStatusLoading(true);

    try {
      const updated = await updateShipmentRateStatus(rate.rateId, {
        status: nextStatus,
      });
      setDetailState({ status: 'success', rate: updated });
      setConfirmOpen(false);
      setStatusLoading(false);
      const message =
        nextStatus === 'TAM_NGUNG'
          ? tShipments('ratePauseSuccess')
          : tShipments('rateResumeSuccess');
      toast.success(message);
      onChanged?.(updated, message);
    } catch (statusError) {
      setConfirmOpen(false);
      setStatusLoading(false);
      if (
        statusError instanceof ShipmentRateApiError &&
        statusError.statusCode === 404
      ) {
        onMissingRef.current?.(tShipments('rateNotFound'));
        return;
      }
      const message =
        statusError instanceof Error
          ? statusError.message
          : tShipments('rateStatusUpdateError');
      toast.error(message);
    }
  }

  return (
    <SuperAdminLayout
      activeSection="shipments"
      breadcrumbs={[
        { label: tShipments('rateBreadcrumbRates'), href: '/shipments/rates' },
        {
          label: rate
            ? `${rate.route.code} · ${rate.cargoType.name}`
            : tShipments('rateBreadcrumbDetail'),
        },
      ]}
    >
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                nativeButton={false}
                render={<Link href="/shipments/rates" />}
                variant="outline"
              >
                <ArrowLeft aria-hidden />
                {tShipments('rateBreadcrumbRates')}
              </Button>

              {canUpdate && rate && (
                <>
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    variant="outline"
                    disabled={statusLoading}
                  >
                    {nextStatusLabel}
                  </Button>
                  <Button onClick={() => setEditOpen(true)}>
                    <Pencil aria-hidden />
                    {tCommon('edit')}
                  </Button>
                </>
              )}

              <ResourceRefreshAction
                loading={detailState.status === 'loading'}
                onClick={() => setRetryCount((c) => c + 1)}
              />
            </div>
          }
          title={tShipments('rateDetailTitle')}
          titleId="shipment-rate-workspace-title"
        />

        {detailState.status === 'loading' && (
          <ResourceState loading>
            {tShipments('rateLoadingText')}
          </ResourceState>
        )}

        {detailState.status === 'error' && (
          <ResourceState error>
            <p>{detailState.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => setRetryCount((count) => count + 1)}
                variant="outline"
              >
                {tCommon('retry')}
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/shipments/rates" />}
              >
                {tShipments('rateBreadcrumbRates')}
              </Button>
            </div>
          </ResourceState>
        )}

        {rate && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] border-border bg-gradient-to-r from-card to-muted/30 p-6 shadow-sm">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary shadow-xs"
                  >
                    <Package size={28} />
                  </span>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="admin-data-mono font-semibold text-primary">
                        {rate.route.code}
                      </span>
                      <span>·</span>
                      <span className="text-sm font-medium text-muted-foreground">
                        {rate.cargoType.name}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                      {rate.route.origin} → {rate.route.destination}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {tShipments('rateBracketApplied', {
                        bracket: formatWeightBand(
                          rate.weightFrom,
                          rate.weightTo,
                          tShipments('rateAboveKg', { kg: '' }),
                        ),
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-muted-foreground">{tShipments('rateBaseFee')}</span>
                    <p className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                      {formatVnd(rate.fee)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ResourceStatusBadge
                      tone={rate.status === 'HOAT_DONG' ? 'active' : 'muted'}
                    >
                      {getLocalizedRateStatus(rate.status)}
                    </ResourceStatusBadge>
                    <ResourceStatusBadge
                      tone={
                        rate.effectiveState === 'DANG_HIEU_LUC'
                          ? 'active'
                          : 'muted'
                      }
                    >
                      {getLocalizedEffectiveState(rate.effectiveState)}
                    </ResourceStatusBadge>
                  </div>
                </div>
              </div>
            </Card>

            {/* Bento Grid 3 Cards */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Card 1: Route */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2 text-primary">
                    <MapPin size={18} />
                    <CardTitle className="text-base font-semibold">
                      {tShipments('rateRouteCardTitle')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>{tShipments('rateRouteCodeLabel')}</dt>
                      <dd className="admin-data-mono font-semibold">
                        {rate.route.code}
                      </dd>
                    </div>
                    <div>
                      <dt>{tShipments('rateOriginLabel')}</dt>
                      <dd>{rate.route.origin}</dd>
                    </div>
                    <div>
                      <dt>{tShipments('rateDestinationLabel')}</dt>
                      <dd>{rate.route.destination}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Specifications & Weight */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Scale size={18} />
                    <CardTitle className="text-base font-semibold">
                      {tShipments('rateSpecsCardTitle')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>{tShipments('rateCargoTypeLabel')}</dt>
                      <dd>{rate.cargoType.name}</dd>
                    </div>
                    <div>
                      <dt>{tShipments('rateWeightBracketLabel')}</dt>
                      <dd>{formatWeightBand(rate.weightFrom, rate.weightTo, tShipments('rateAboveKg', { kg: '' }))}</dd>
                    </div>
                    <div>
                      <dt>{tShipments('rateMinWeightLabel')}</dt>
                      <dd className="tabular-nums">{rate.weightFrom} kg</dd>
                    </div>
                    <div>
                      <dt>{tShipments('rateMaxWeightLabel')}</dt>
                      <dd className="tabular-nums">
                        {rate.weightTo !== null ? `${rate.weightTo} kg` : tShipments('unlimited')}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 3: Validity Period */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Calendar size={18} />
                    <CardTitle className="text-base font-semibold">
                      {tShipments('rateValidityCardTitle')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>{tShipments('rateValidFromLabel')}</dt>
                      <dd className="tabular-nums">{formatDateOnly(rate.validFrom)}</dd>
                    </div>
                    <div>
                      <dt>{tShipments('rateValidToLabel')}</dt>
                      <dd className="tabular-nums">
                        {rate.validTo ? formatDateOnly(rate.validTo) : tShipments('unlimited')}
                      </dd>
                    </div>
                    <div>
                      <dt>{tShipments('rateStatusLabel')}</dt>
                      <dd>{getLocalizedEffectiveState(rate.effectiveState)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Dialogs */}
        {rate && canUpdate && editOpen && (
          <ShipmentRateFormDialog
            mode="edit"
            onClose={() => setEditOpen(false)}
            onRetryOptions={() => setOptionsReloadTick((t) => t + 1)}
            onSaved={(updated) => {
              setDetailState({ status: 'success', rate: updated });
              setEditOpen(false);
              onChanged?.(updated, tShipments('rateUpdateSuccess'));
            }}
            open={editOpen}
            options={formOptions}
            rate={rate}
          />
        )}

        {rate && canUpdate && confirmOpen && (
          <ResourceConfirmation
            busy={statusLoading}
            description={
              nextStatus === 'TAM_NGUNG'
                ? tShipments('rateConfirmPauseDesc', {
                    code: rate.route.code,
                    name: rate.cargoType.name,
                    bracket: formatWeightBand(rate.weightFrom, rate.weightTo, tShipments('rateAboveKg', { kg: '' })),
                  })
                : tShipments('rateConfirmResumeDesc', {
                    code: rate.route.code,
                    name: rate.cargoType.name,
                    bracket: formatWeightBand(rate.weightFrom, rate.weightTo, tShipments('rateAboveKg', { kg: '' })),
                  })
            }
            onClose={() => {
              if (!statusLoading) setConfirmOpen(false);
            }}
            title={
              nextStatus === 'TAM_NGUNG'
                ? tShipments('rateConfirmPauseTitle')
                : tShipments('rateConfirmResumeTitle')
            }
          >
            <Button
              disabled={statusLoading}
              aria-busy={statusLoading}
              onClick={handleConfirmStatus}
              variant={nextStatus === 'TAM_NGUNG' ? 'destructive' : 'default'}
            >
              {statusLoading
                ? tShipments('updatingStatus')
                : nextStatus === 'TAM_NGUNG'
                  ? tShipments('rateConfirmPauseBtn')
                  : tShipments('rateConfirmResumeBtn')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
