'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Package, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceCreateAction,
  ResourceRefreshAction,
  ResourceDetailAction,
  ResourceStatusBadge,
  ResourcePagination,
  ResourceTableSkeleton,
  ResourceState,
  ResourceNotice,
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useTranslations } from 'next-intl';
import {
  getFarePriceRouteOptions,
  getFarePriceVehicleTypeOptions,
} from '../services/fare-price-service';
import type {
  FarePrice,
  FarePriceEffectiveState,
  FarePriceOption,
  FarePriceOptionsState,
  FarePriceSortKey,
} from '../types/fare-price';
import { useFarePrices } from '../hooks/use-fare-prices';
import { FarePriceFormDialog } from './fare-price-form-dialog';

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}

function formatDateOnly(value: string | null, unlimitedLabel = 'Unlimited') {
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

function statusTone(status: FarePrice['status']) {
  return status === 'HOAT_DONG' ? 'active' : 'muted';
}

function stateTone(state: FarePriceEffectiveState) {
  return state === 'DANG_HIEU_LUC' ? 'active' : 'muted';
}

function optionFilters(options: FarePriceOption[]): FilterOption[] {
  return options.map((option) => ({
    value: String(option.id),
    label: option.label,
  }));
}

export function FarePricesManagement() {
  const tFare = useTranslations('farePrices');
  const tCommon = useTranslations('common');
  const { can } = useAdminPermissions();
  const canCreate = can('fare-price:create');
  const {
    farePricePage,
    error,
    loading,
    searchInput,
    routeId,
    vehicleTypeId,
    status,
    effectiveState,
    sortBy,
    sortDirection,
    changePage,
    updateSearch,
    updateRoute,
    updateVehicleType,
    updateStatus,
    updateEffectiveState,
    sortFarePrices,
    resetFilters,
    refresh,
  } = useFarePrices();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [routeOptions, setRouteOptions] = useState<FarePriceOptionsState>({
    status: 'loading',
  });
  const [vehicleTypeOptions, setVehicleTypeOptions] =
    useState<FarePriceOptionsState>({ status: 'loading' });
  const [routeOptionsRetry, setRouteOptionsRetry] = useState(0);
  const [vehicleTypeOptionsRetry, setVehicleTypeOptionsRetry] = useState(0);

  const statusOptions: FilterOption[] = [
    { value: 'HOAT_DONG', label: tFare('statusActive') },
    { value: 'TAM_NGUNG', label: tFare('statusSuspended') },
  ];

  const effectiveStateOptions: FilterOption[] = [
    { value: 'CHUA_HIEU_LUC', label: tFare('statePending') },
    { value: 'DANG_HIEU_LUC', label: tFare('stateActive') },
    { value: 'HET_HIEU_LUC', label: tFare('stateExpired') },
    { value: 'TAM_NGUNG', label: tFare('statusSuspended') },
  ];

  function getEffectiveStateLabel(state: FarePriceEffectiveState) {
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

  function getFareStatusLabel(itemStatus: FarePrice['status']) {
    return itemStatus === 'HOAT_DONG'
      ? tFare('statusActive')
      : tFare('statusSuspended');
  }

  function formatDisplayDateOnly(value: string | null) {
    if (value === null) return tFare('unlimitedDate');
    return formatDateOnly(value);
  }

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    getFarePriceRouteOptions(controller.signal)
      .then((options) => {
        if (current) setRouteOptions({ status: 'success', options });
      })
      .catch(() => {
        if (current && !controller.signal.aborted) {
          setRouteOptions({ status: 'error' });
        }
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [routeOptionsRetry]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    getFarePriceVehicleTypeOptions(controller.signal)
      .then((options) => {
        if (current) setVehicleTypeOptions({ status: 'success', options });
      })
      .catch(() => {
        if (current && !controller.signal.aborted) {
          setVehicleTypeOptions({ status: 'error' });
        }
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [vehicleTypeOptionsRetry]);

  const items = farePricePage?.data ?? [];
  const hasFilters = Boolean(
    searchInput.trim() || routeId || vehicleTypeId || status || effectiveState,
  );

  function openCreateDialog() {
    setCreateDialogOpen(true);
  }

  function handleFarePriceCreated(farePrice: FarePrice) {
    setCreateDialogOpen(false);
    toast.success(tFare('createdSuccess', { code: farePrice.route.code }));
    refresh();
  }

  function retryRouteOptions() {
    setRouteOptions({ status: 'loading' });
    setRouteOptionsRetry((count) => count + 1);
  }

  function retryVehicleTypeOptions() {
    setVehicleTypeOptions({ status: 'loading' });
    setVehicleTypeOptionsRetry((count) => count + 1);
  }

  function sortButton(label: string, field: FarePriceSortKey) {
    return (
      <Button
        className="-ml-3"
        aria-label={`${tFare('sortBy')} ${label}`}
        size="sm"
        variant="ghost"
        onClick={() => sortFarePrices(field)}
      >
        {label}
        {sortBy === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp aria-hidden />
          ) : (
            <ArrowDown aria-hidden />
          )
        ) : (
          <ArrowUpDown aria-hidden />
        )}
      </Button>
    );
  }
  function fareStatus(item: FarePrice) {
    return (
      <ResourceStatusBadge tone={statusTone(item.status)}>
        {getFareStatusLabel(item.status)}
      </ResourceStatusBadge>
    );
  }
  function effectiveStateBadge(item: FarePrice) {
    return (
      <ResourceStatusBadge tone={stateTone(item.effectiveState)}>
        {getEffectiveStateLabel(item.effectiveState)}
      </ResourceStatusBadge>
    );
  }
  return (
    <SuperAdminLayout activeSection="fare-prices">
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <nav
          aria-label={tFare('navPriceSwitchAria')}
          className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-3"
        >
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/70 p-1.5 shadow-xs">
            <Link
              href="/fare-prices"
              aria-current="page"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all"
            >
              <Ticket className="size-4" />
              {tFare('tabPassengerFares')}
            </Link>
            <Link
              href="/shipments/rates"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-background/80 hover:text-foreground"
            >
              <Package className="size-4" />
              {tFare('tabCargoRates')}
            </Link>
          </div>
        </nav>
        <div>
          <AdminPageHeader
            eyebrow={tFare('eyebrow')}
            title={tFare('farePricesTitle')}
            titleId="fare-prices-title"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {canCreate && (
                  <ResourceCreateAction
                    label={tFare('createFarePrice')}
                    onClick={openCreateDialog}
                  />
                )}
                <ResourceRefreshAction loading={loading} onClick={refresh} />
              </div>
            }
          />
          <p className="mt-2 text-[13px] text-muted-foreground">
            {tFare('subtitle')}
          </p>
        </div>
        <section aria-busy={loading} aria-labelledby="fare-prices-title">
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label={tFare('searchFarePrices')}
                value={searchInput}
                onChange={updateSearch}
                placeholder={tFare('searchPlaceholder')}
              />
              {routeOptions.status === 'success' && (
                <SelectFilter
                  label={tFare('route')}
                  allLabel={tFare('filterRoute')}
                  value={routeId}
                  options={optionFilters(routeOptions.options)}
                  onChange={updateRoute}
                />
              )}
              {vehicleTypeOptions.status === 'success' && (
                <SelectFilter
                  label={tFare('vehicleType')}
                  allLabel={tFare('filterVehicleType')}
                  value={vehicleTypeId}
                  options={optionFilters(vehicleTypeOptions.options)}
                  onChange={updateVehicleType}
                />
              )}
              <SelectFilter
                label={tFare('fareStatus')}
                allLabel={tFare('filterStatus')}
                value={status}
                options={statusOptions}
                onChange={updateStatus}
              />
              <SelectFilter
                label={tFare('colEffectiveState')}
                allLabel={tFare('filterEffectiveState')}
                value={effectiveState}
                options={effectiveStateOptions}
                onChange={updateEffectiveState}
              />
            </FilterToolbar>
            {(routeOptions.status === 'loading' ||
              vehicleTypeOptions.status === 'loading') && (
              <p
                className="px-5 py-3 text-xs text-muted-foreground"
                role="status"
              >
                {tFare('loadingFilters')}
              </p>
            )}
            {(routeOptions.status === 'error' ||
              vehicleTypeOptions.status === 'error') && (
              <div className="p-4">
                <ResourceNotice kind="error">
                  <p>{tFare('failedFilters')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {routeOptions.status === 'error' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={retryRouteOptions}
                      >
                        {tFare('retryRoute')}
                      </Button>
                    )}
                    {vehicleTypeOptions.status === 'error' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={retryVehicleTypeOptions}
                      >
                        {tFare('retryVehicleType')}
                      </Button>
                    )}
                  </div>
                </ResourceNotice>
              </div>
            )}
            <div className="border-b p-4 md:hidden">
              <div className="flex items-end gap-3">
                <SelectFilter
                  label={tFare('sortBy')}
                  allLabel={tFare('colListedPrice')}
                  value={sortBy === 'listedPrice' ? '' : sortBy}
                  options={[
                    { value: 'validFrom', label: tFare('colValidFrom') },
                    { value: 'validTo', label: tFare('colValidTo') },
                    { value: 'status', label: tFare('colStatus') },
                  ]}
                  onChange={(value) => {
                    const field = (value || 'listedPrice') as FarePriceSortKey;
                    if (field !== sortBy) sortFarePrices(field);
                  }}
                />
                <Button
                  variant="outline"
                  aria-label={`${tFare('sortBy')}, ${sortDirection === 'asc' ? tFare('sortAscending') : tFare('sortDescending')}`}
                  onClick={() => sortFarePrices(sortBy)}
                >
                  {sortDirection === 'asc' ? (
                    <ArrowUp aria-hidden />
                  ) : (
                    <ArrowDown aria-hidden />
                  )}
                  {sortDirection === 'asc' ? tFare('sortAscending') : tFare('sortDescending')}
                </Button>
              </div>
            </div>
            {loading && !farePricePage && (
              <ResourceTableSkeleton resourceLabel={tFare('resourceLabel')} />
            )}
            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button variant="outline" onClick={refresh}>
                  {tCommon('retry')}
                </Button>
              </ResourceState>
            )}
            {!loading && !error && farePricePage && items.length === 0 && (
              <ResourceState>
                <p>
                  {hasFilters
                    ? tFare('emptyFiltered')
                    : tFare('emptyNoData')}
                </p>
                {hasFilters && (
                  <Button variant="outline" onClick={resetFilters}>
                    {tCommon('clearFilters')}
                  </Button>
                )}
              </ResourceState>
            )}
            {!error && farePricePage && (
              <>
                {items.length > 0 && (
                  <>
                    <div className="hidden md:block">
                      <Table className="min-w-[1080px]">
                        <TableCaption className="sr-only">
                          {tFare('tableCaption')}
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            {(
                              [
                                { key: null, label: tFare('colRoute') },
                                { key: null, label: tFare('colVehicleType') },
                                { key: 'listedPrice', label: tFare('colListedPrice') },
                                { key: 'validFrom', label: tFare('colValidFrom') },
                                { key: 'validTo', label: tFare('colValidTo') },
                                { key: 'status', label: tFare('colStatus') },
                                { key: null, label: tFare('colCurrentEffective') },
                              ] as const
                            ).map((column) => (
                              <TableHead
                                key={column.label}
                                scope="col"
                                aria-sort={
                                  column.key
                                    ? sortBy === column.key
                                      ? sortDirection === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                    : undefined
                                }
                              >
                                {column.key
                                  ? sortButton(column.label, column.key)
                                  : column.label}
                              </TableHead>
                            ))}
                            <TableHead scope="col">
                              <span className="sr-only">{tCommon('actions')}</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item.farePriceId}>
                              <TableHead
                                scope="row"
                                className="min-w-44 max-w-56 whitespace-normal bg-transparent py-3 text-[13px]"
                              >
                                <span className="block break-words">
                                  {item.route.origin} → {item.route.destination}
                                </span>
                                <span className="admin-data-mono mt-1 block text-xs font-normal text-muted-foreground">
                                  {item.route.code}
                                </span>
                              </TableHead>
                              <TableCell>{item.vehicleType.name}</TableCell>
                              <TableCell className="font-semibold tabular-nums">
                                {formatPrice(item.listedPrice)}
                              </TableCell>
                              <TableCell>
                                {formatDisplayDateOnly(item.validFrom)}
                              </TableCell>
                              <TableCell>
                                {formatDisplayDateOnly(item.validTo)}
                              </TableCell>
                              <TableCell>{fareStatus(item)}</TableCell>
                              <TableCell>{effectiveStateBadge(item)}</TableCell>
                              <TableCell>
                                <ResourceDetailAction
                                  href={`/fare-prices/${item.farePriceId}`}
                                  resourceName={item.route.code}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div
                      className="grid gap-4 p-4 md:hidden"
                      aria-label={tFare('cardListAria')}
                    >
                      {items.map((item) => (
                        <Card
                          key={item.farePriceId}
                          className="gap-4 p-4 ring-0"
                        >
                          <div>
                            <h2 className="break-words text-base font-semibold">
                              {item.route.origin} → {item.route.destination}
                            </h2>
                            <p className="admin-data-mono mt-1 text-xs text-muted-foreground">
                              {item.route.code}
                            </p>
                          </div>
                          <p className="text-xl font-semibold tabular-nums">
                            {formatPrice(item.listedPrice)}
                          </p>
                          <dl className="grid grid-cols-2 gap-3 text-[13px] [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-muted-foreground">
                            <div className="col-span-2">
                              <dt>{tFare('colVehicleType')}</dt>
                              <dd>{item.vehicleType.name}</dd>
                            </div>
                            <div>
                              <dt>{tFare('colValidFrom')}</dt>
                              <dd>{formatDisplayDateOnly(item.validFrom)}</dd>
                            </div>
                            <div>
                              <dt>{tFare('colValidTo')}</dt>
                              <dd>{formatDisplayDateOnly(item.validTo)}</dd>
                            </div>
                            <div>
                              <dt>{tFare('colStatus')}</dt>
                              <dd>{fareStatus(item)}</dd>
                            </div>
                            <div>
                              <dt>{tFare('colCurrentEffective')}</dt>
                              <dd>{effectiveStateBadge(item)}</dd>
                            </div>
                          </dl>
                          <div className="flex justify-end border-t pt-3">
                            <ResourceDetailAction
                              href={`/fare-prices/${item.farePriceId}`}
                              resourceName={item.route.code}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
                <ResourcePagination
                  currentPage={farePricePage.meta.page}
                  disabled={loading}
                  onPageChange={changePage}
                  pageSize={farePricePage.meta.pageSize}
                  summaryLabel={tFare('resourceLabel')}
                  totalItems={farePricePage.meta.totalItems}
                  totalPages={farePricePage.meta.totalPages}
                />
              </>
            )}
          </Card>
        </section>
      </div>
      {createDialogOpen && canCreate && (
        <FarePriceFormDialog
          onClose={() => setCreateDialogOpen(false)}
          onRetryRouteOptions={retryRouteOptions}
          onRetryVehicleTypeOptions={retryVehicleTypeOptions}
          onSaved={handleFarePriceCreated}
          routeOptions={routeOptions}
          vehicleTypeOptions={vehicleTypeOptions}
        />
      )}
    </SuperAdminLayout>
  );
}
