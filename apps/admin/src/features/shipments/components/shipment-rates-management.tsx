/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Luggage,
  Package,
  Ticket,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceCreateAction,
  ResourceDetailAction,
  ResourcePagination,
  ResourceRefreshAction,
  ResourceState,
  ResourceStatusBadge,
  ResourceTableSkeleton,
} from '@/components/admin/resource-ui';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/resource-filters';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useTranslations } from 'next-intl';
import { useShipmentRates } from '../hooks/use-shipment-rates';
import {
  getShipmentRateCargoTypeOptions,
  getShipmentRateRouteOptions,
} from '../services/shipment-rate-service';
import type {
  ShipmentRate,
  ShipmentRateEffectiveState,
  ShipmentRateOption,
  ShipmentRateOptionsState,
  ShipmentRateSortKey,
  ShipmentRateStatus,
  SortDirection,
} from '../types/shipment-rate';
import { formatWeightBand } from './shipment-rate-workspace';
import { ShipmentRateFormDialog } from './shipment-rate-form-dialog';
import { LuggagePackagesManagement } from './luggage-packages-management';

const STATUS_LABELS: Record<ShipmentRateStatus, string> = {
  HOAT_DONG: 'Active',
  TAM_NGUNG: 'Paused',
};

const EFFECTIVE_LABELS: Record<ShipmentRateEffectiveState, string> = {
  CHUA_DEN_NGAY: 'Upcoming',
  DANG_HIEU_LUC: 'Active',
  HET_HIEU_LUC: 'Expired',
};

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'HOAT_DONG', label: STATUS_LABELS.HOAT_DONG },
  { value: 'TAM_NGUNG', label: STATUS_LABELS.TAM_NGUNG },
];

const EFFECTIVE_OPTIONS: FilterOption[] = [
  { value: 'DANG_HIEU_LUC', label: EFFECTIVE_LABELS.DANG_HIEU_LUC },
  { value: 'CHUA_DEN_NGAY', label: EFFECTIVE_LABELS.CHUA_DEN_NGAY },
  { value: 'HET_HIEU_LUC', label: EFFECTIVE_LABELS.HET_HIEU_LUC },
];

const INITIAL_OPTIONS: ShipmentRateOptionsState = {
  routes: [],
  cargoTypes: [],
  loading: true,
  error: null,
};

export function ShipmentRatesManagement() {
  const tShipments = useTranslations('shipments');
  const tFare = useTranslations('farePrices');
  const tCommon = useTranslations('common');
  const {
    ratePage,
    error,
    loading,
    searchInput,
    routeId,
    cargoTypeId,
    status,
    effectiveState,
    sortBy,
    sortDirection,
    changePage,
    updateSearch,
    updateRoute,
    updateCargoType,
    updateStatus,
    updateEffectiveState,
    sortRates,
    resetFilters,
    refresh,
  } = useShipmentRates();
  const { can } = useAdminPermissions();
  const canCreate = can('shipment:update') || can('fare-price:create');
  const canUpdate = can('shipment:update') || can('fare-price:update');

  const [filterOptions, setFilterOptions] =
    useState<ShipmentRateOptionsState>(INITIAL_OPTIONS);
  const [formOptions, setFormOptions] =
    useState<ShipmentRateOptionsState>(INITIAL_OPTIONS);
  const [optionsReloadTick, setOptionsReloadTick] = useState(0);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShipmentRate | null>(null);
  const [rateTab, setRateTab] = useState<'freight' | 'luggage'>('freight');

  const statusOptions: FilterOption[] = [
    { value: 'HOAT_DONG', label: tShipments('ratesStatusActive') },
    { value: 'TAM_NGUNG', label: tShipments('ratesStatusPaused') },
  ];

  const effectiveOptions: FilterOption[] = [
    { value: 'DANG_HIEU_LUC', label: tShipments('validityActive') },
    { value: 'CHUA_DEN_NGAY', label: tShipments('validityUpcoming') },
    { value: 'HET_HIEU_LUC', label: tShipments('validityExpired') },
  ];

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

  useEffect(() => {
    const controller = new AbortController();

    async function loadOptions() {
      setFilterOptions((current) => ({
        ...current,
        loading: true,
        error: null,
      }));
      setFormOptions((current) => ({ ...current, loading: true, error: null }));

      try {
        const [allRoutes, activeRoutes, cargoTypes] = await Promise.all([
          getShipmentRateRouteOptions({ signal: controller.signal }),
          getShipmentRateRouteOptions({
            activeOnly: true,
            signal: controller.signal,
          }),
          getShipmentRateCargoTypeOptions(controller.signal),
        ]);
        setFilterOptions({
          routes: allRoutes,
          cargoTypes,
          loading: false,
          error: null,
        });
        setFormOptions({
          routes: activeRoutes,
          cargoTypes,
          loading: false,
          error: null,
        });
      } catch (optionsError) {
        if (
          optionsError instanceof DOMException &&
          optionsError.name === 'AbortError'
        ) {
          return;
        }
        const message =
          optionsError instanceof Error
            ? optionsError.message
            : tShipments('cannotLoadRoutesOrCargo');
        setFilterOptions((current) => ({
          ...current,
          loading: false,
          error: message,
        }));
        setFormOptions((current) => ({
          ...current,
          loading: false,
          error: message,
        }));
      }
    }

    void loadOptions();

    return () => controller.abort();
  }, [optionsReloadTick]);

  const reloadOptions = useCallback(() => {
    setOptionsReloadTick((value) => value + 1);
  }, []);

  const handleOpenCreate = useCallback(() => {
    if (!canCreate) return;
    setEditingRate(null);
    setFormMode('create');
    setFormOpen(true);
  }, [canCreate]);

  const handleRateSaved = useCallback(
    (saved: ShipmentRate, message: string) => {
      setFormOpen(false);
      setEditingRate(null);
      toast.success(message);
      refresh();
    },
    [refresh],
  );

  useEffect(() => {
    if (
      (formMode === 'create' && !canCreate) ||
      (formMode === 'edit' && !canUpdate)
    ) {
      setFormOpen(false);
      setEditingRate(null);
    }
  }, [canCreate, canUpdate, formMode]);

  const rates = ratePage?.data ?? [];
  const meta = ratePage?.meta ?? {
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  };
  const isFiltered = Boolean(
    searchInput.trim() || routeId || cargoTypeId || status || effectiveState,
  );

  function renderSortButton(column: ShipmentRateSortKey, label: string) {
    const active = sortBy === column;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2 font-semibold"
        onClick={() => sortRates(column)}
      >
        <span>{label}</span>
        {active ? (
          sortDirection === 'asc' ? (
            <ArrowUp aria-hidden className="size-3.5" />
          ) : (
            <ArrowDown aria-hidden className="size-3.5" />
          )
        ) : (
          <ArrowUpDown
            aria-hidden
            className="size-3.5 text-muted-foreground"
          />
        )}
      </Button>
    );
  }

  return (
    <SuperAdminLayout
      activeSection="shipments"
      breadcrumbs={[
        { label: tShipments('shipmentsTitle'), href: '/shipments' },
        { label: tShipments('ratesTitle') },
      ]}
    >
      <div className="admin-page-content admin-ui space-y-6">
        <nav
          aria-label={tFare('navPriceSwitchAria')}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3"
        >
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/70 p-1.5 shadow-xs">
            <Link
              href="/fare-prices"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-background/80 hover:text-foreground"
            >
              <Ticket className="size-4" />
              {tFare('tabPassengerFares')}
            </Link>
            <Link
              href="/shipments/rates"
              aria-current="page"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all"
            >
              <Package className="size-4" />
              {tFare('tabCargoRates')}
            </Link>
          </div>

          <Link
            href="/shipments"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {tShipments('backToShipments')}
          </Link>
        </nav>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRateTab('freight')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer',
              rateTab === 'freight'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
          >
            <Package className="size-4" />
            {tShipments('tabRouteFreight')}
          </button>
          <button
            type="button"
            onClick={() => setRateTab('luggage')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer',
              rateTab === 'luggage'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
          >
            <Luggage className="size-4" />
            {tShipments('tabLuggage')}
          </button>
        </div>

        {rateTab === 'luggage' ? (
          <div className="space-y-4">
            <div>
              <AdminPageHeader
                eyebrow={tShipments('luggageTabEyebrow')}
                title={tShipments('luggageTabTitle')}
                titleId="luggage-rates-title"
              />
              <p className="mt-2 text-[13px] text-muted-foreground">
                {tShipments('luggageTabDesc')}
              </p>
            </div>
            <LuggagePackagesManagement canUpdate={canUpdate} />
          </div>
        ) : (
          <>
            <div>
              <AdminPageHeader
                eyebrow={tShipments('ratesEyebrow')}
                title={tShipments('ratesTitle')}
                titleId="shipment-rates-title"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <ResourceRefreshAction loading={loading} onClick={refresh} />
                    {canCreate && (
                      <ResourceCreateAction
                        label={tShipments('addRate')}
                        onClick={handleOpenCreate}
                      />
                    )}
                  </div>
                }
              />
              <p className="mt-2 text-[13px] text-muted-foreground">
                {tShipments('ratesSubtitle')}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
              <span>
                💡 <strong>{tShipments('ratesTipTitle')}</strong> {tShipments('ratesTipText')}{' '}
                <strong>{tShipments('ratesTipTabName')}</strong>.
              </span>
              <button
                type="button"
                onClick={() => setRateTab('luggage')}
                className="shrink-0 font-bold text-primary hover:underline cursor-pointer"
              >
                {tShipments('ratesTipLink')}
              </button>
            </div>

            <section
              className="overflow-hidden rounded-xl border bg-card shadow-sm"
              aria-labelledby="shipment-rates-table-heading"
            >
          <h2 id="shipment-rates-table-heading" className="sr-only">
            {tShipments('ratesListTitle')}
          </h2>

          <FilterToolbar>
            <SearchInput
              label={tShipments('ratesSearchLabel')}
              value={searchInput}
              onChange={updateSearch}
              placeholder={tShipments('ratesSearchPlaceholder')}
            />

            <SelectFilter
              label={tShipments('filterRouteLabel')}
              value={routeId}
              allLabel={tShipments('filterAllRoutes')}
              options={toFilterOptions(filterOptions.routes)}
              onChange={updateRoute}
            />

            <SelectFilter
              label={tShipments('filterCargoLabel')}
              value={cargoTypeId}
              allLabel={tShipments('filterAllCargo')}
              options={toFilterOptions(filterOptions.cargoTypes)}
              onChange={updateCargoType}
            />

            <SelectFilter
              label={tShipments('filterStatusLabel')}
              value={status}
              allLabel={tShipments('filterAllStatus')}
              options={statusOptions}
              onChange={(value) =>
                updateStatus(value as ShipmentRateStatus | '')
              }
            />

            <SelectFilter
              label={tShipments('filterValidityLabel')}
              value={effectiveState}
              allLabel={tShipments('filterAllValidity')}
              options={effectiveOptions}
              onChange={(value) =>
                updateEffectiveState(value as ShipmentRateEffectiveState | '')
              }
            />
          </FilterToolbar>

          {error && (
            <ResourceState error>
              <p>{error}</p>
              <Button type="button" variant="outline" onClick={refresh}>
                {tCommon('retry')}
              </Button>
            </ResourceState>
          )}

          {loading && !ratePage ? (
            <ResourceTableSkeleton resourceLabel={tShipments('ratesResourceLabel')} />
          ) : rates.length === 0 ? (
            error ? null : (
              <ResourceState>
                <p>
                  {isFiltered
                    ? tShipments('ratesEmptyFiltered')
                    : tShipments('ratesEmptyNoData')}
                </p>
                {isFiltered ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetFilters}
                  >
                    {tShipments('resetFiltersBtn')}
                  </Button>
                ) : (
                  canCreate && (
                    <ResourceCreateAction
                      label={tShipments('addFirstRate')}
                      onClick={handleOpenCreate}
                    />
                  )
                )}
              </ResourceState>
            )
          ) : (
            <>
              <div className="hidden md:block" aria-busy={loading}>
                <Table>
                  <caption className="sr-only">
                    {tShipments('tableCaption')}
                  </caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{tShipments('colRouteCode')}</TableHead>
                      <TableHead scope="col">{tShipments('colJourney')}</TableHead>
                      <TableHead scope="col">{tShipments('colCargoType')}</TableHead>
                      <TableHead
                        scope="col"
                        aria-sort={getAriaSort(
                          sortBy,
                          sortDirection,
                          'weightFrom',
                        )}
                      >
                        {renderSortButton('weightFrom', tShipments('colWeightBracket'))}
                      </TableHead>
                      <TableHead
                        scope="col"
                        aria-sort={getAriaSort(sortBy, sortDirection, 'fee')}
                      >
                        {renderSortButton('fee', tShipments('colRateFee'))}
                      </TableHead>
                      <TableHead
                        scope="col"
                        aria-sort={getAriaSort(
                          sortBy,
                          sortDirection,
                          'validFrom',
                        )}
                      >
                        {renderSortButton('validFrom', tShipments('colValidFrom'))}
                      </TableHead>
                      <TableHead
                        scope="col"
                        aria-sort={getAriaSort(
                          sortBy,
                          sortDirection,
                          'validTo',
                        )}
                      >
                        {renderSortButton('validTo', tShipments('colValidTo'))}
                      </TableHead>
                      <TableHead
                        scope="col"
                        aria-sort={getAriaSort(sortBy, sortDirection, 'status')}
                      >
                        {renderSortButton('status', tShipments('colStatus'))}
                      </TableHead>
                      <TableHead scope="col">{tShipments('colValidity')}</TableHead>
                      <TableHead scope="col">
                        <span className="sr-only">{tCommon('actions')}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((item) => (
                      <TableRow key={item.rateId}>
                        <TableCell>
                          <span className="admin-data-mono">
                            {item.route.code}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.route.origin} → {item.route.destination}
                        </TableCell>
                        <TableCell>{item.cargoType.name}</TableCell>
                        <TableCell className="font-medium">
                          {formatWeightBand(item.weightFrom, item.weightTo)}
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">
                          {formatVnd(item.fee)}
                        </TableCell>
                        <TableCell>{formatDateOnly(item.validFrom)}</TableCell>
                        <TableCell>
                          {item.validTo
                            ? formatDateOnly(item.validTo)
                            : tShipments('unlimited')}
                        </TableCell>
                        <TableCell>
                          <ResourceStatusBadge
                            tone={
                              item.status === 'HOAT_DONG' ? 'active' : 'muted'
                            }
                          >
                            {getLocalizedRateStatus(item.status)}
                          </ResourceStatusBadge>
                        </TableCell>
                        <TableCell>
                          <ResourceStatusBadge
                            tone={
                              item.effectiveState === 'DANG_HIEU_LUC'
                                ? 'active'
                                : 'muted'
                            }
                          >
                            {getLocalizedEffectiveState(item.effectiveState)}
                          </ResourceStatusBadge>
                        </TableCell>
                        <TableCell>
                          <ResourceDetailAction
                            href={`/shipments/rates/${item.rateId}`}
                            resourceName={item.route.code}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div
                className="grid gap-3 p-3 md:hidden"
                aria-label={tShipments('cardListAriaRates')}
              >
                {rates.map((item) => (
                  <Card
                    className="gap-3 rounded-lg p-4 ring-1 ring-border"
                    key={item.rateId}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="admin-data-mono text-xs text-muted-foreground">
                          {item.route.code}
                        </span>
                        <h3 className="font-semibold">
                          {item.route.origin} → {item.route.destination}
                        </h3>
                      </div>
                      <ResourceDetailAction
                        href={`/shipments/rates/${item.rateId}`}
                        resourceName={item.route.code}
                      />
                    </div>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatVnd(item.fee)}
                    </p>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">{tShipments('colCargoType')}</dt>
                        <dd className="font-medium">{item.cargoType.name}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {tShipments('colWeightBracket')}
                        </dt>
                        <dd className="font-medium">
                          {formatWeightBand(item.weightFrom, item.weightTo)}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">{tShipments('colValidity')}</dt>
                        <dd>
                          {formatDateOnly(item.validFrom)} →{' '}
                          {item.validTo
                            ? formatDateOnly(item.validTo)
                            : tShipments('unlimited')}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      <ResourceStatusBadge
                        tone={item.status === 'HOAT_DONG' ? 'active' : 'muted'}
                      >
                        {getLocalizedRateStatus(item.status)}
                      </ResourceStatusBadge>
                      <ResourceStatusBadge
                        tone={
                          item.effectiveState === 'DANG_HIEU_LUC'
                            ? 'active'
                            : 'muted'
                        }
                      >
                        {getLocalizedEffectiveState(item.effectiveState)}
                      </ResourceStatusBadge>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          <ResourcePagination
            currentPage={meta.page}
            pageSize={meta.pageSize}
            totalPages={meta.totalPages}
            totalItems={meta.totalItems}
            disabled={loading}
            summaryLabel={tShipments('rateSummaryLabel')}
            onPageChange={changePage}
          />
        </section>
        </>
        )}

        {((formMode === 'create' && canCreate) ||
          (formMode === 'edit' && canUpdate)) && (
          <ShipmentRateFormDialog
            open={formOpen}
            mode={formMode}
            rate={editingRate}
            options={formOptions}
            onRetryOptions={reloadOptions}
            onClose={() => setFormOpen(false)}
            onSaved={handleRateSaved}
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}

function toFilterOptions(options: ShipmentRateOption[]): FilterOption[] {
  return options.map((option) => ({
    value: String(option.id),
    label: option.label,
  }));
}

function getAriaSort(
  activeSortBy: ShipmentRateSortKey,
  direction: SortDirection,
  column: ShipmentRateSortKey,
): 'ascending' | 'descending' | 'none' {
  if (activeSortBy !== column) return 'none';
  return direction === 'asc' ? 'ascending' : 'descending';
}

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}
