'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceCreateAction,
  ResourceRefreshAction,
  ResourceDetailAction,
  ResourcePagination,
  ResourceTableSkeleton,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/resource-filters';
import { DateRangeFilter } from '@/components/data-filters/data-filters';
import { LocationPicker } from '@/features/locations/components/location-picker';
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
import { useTripLookupOptions } from '../hooks/use-trip-lookup-options';
import { useTrips } from '../hooks/use-trips';
import type { TripSortKey } from '../types/trip';
import { TripFormDialog } from './trip-form-dialog';

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

export function TripsManagement() {
  const tTrips = useTranslations('trips');
  const tCommon = useTranslations('common');
  const tVehicleTypes = useTranslations('vehicleTypes');
  const {
    tripPage,
    error,
    loading,
    searchInput,
    status,
    departureDate,
    departureDateRange,
    updateDepartureDateRange,
    origin,
    destination,
    timeRange,
    updateOrigin,
    updateDestination,
    updateTimeRange,
    sortBy,
    sortDirection,
    changePage,
    updateSearch,
    updateStatus,
    sortTrips,
    refresh,
  } = useTrips();

  const { can } = useAdminPermissions();
  const canCreate = can('trip:create');
  const { routeOptions, vehicleOptions, retryRoutes, retryVehicles } =
    useTripLookupOptions();

  const [createOpen, setCreateOpen] = useState(false);

  function getTripStatusLabel(tripStatus: string) {
    switch (tripStatus) {
      case 'CHUA_KHOI_HANH':
        return tTrips('statusScheduled');
      case 'DANG_CHAY':
        return tTrips('statusInTransit');
      case 'HOAN_THANH':
        return tTrips('statusCompleted');
      case 'DA_HUY':
        return tTrips('statusCancelled');
      default:
        return tripStatus;
    }
  }

  const statusOptions: FilterOption[] = [
    { value: 'CHUA_KHOI_HANH', label: tTrips('statusScheduled') },
    { value: 'DANG_CHAY', label: tTrips('statusInTransit') },
    { value: 'HOAN_THANH', label: tTrips('statusCompleted') },
    { value: 'DA_HUY', label: tTrips('statusCancelled') },
  ];

  const timeRangeOptions: FilterOption[] = [
    { value: 'early-morning', label: tTrips('earlyMorning') },
    { value: 'morning', label: tTrips('morning') },
    { value: 'afternoon', label: tTrips('afternoon') },
    { value: 'evening', label: tTrips('evening') },
  ];

  const sortOptions: FilterOption[] = [
    { value: 'departureDate', label: tTrips('colDepartureDate') },
    { value: 'departureTime', label: tTrips('colDepartureTime') },
    { value: 'code', label: tTrips('colTrip') },
    { value: 'status', label: tTrips('colStatus') },
    { value: 'createdAt', label: tCommon('createdAt') },
    { value: 'updatedAt', label: tCommon('updatedAt') },
  ];

  function sortButton(label: string, field: TripSortKey) {
    const selected = sortBy === field;
    return (
      <Button
        aria-label={`${tCommon('sortBy')} ${label}`}
        className="-ml-3 font-semibold"
        size="sm"
        variant="ghost"
        onClick={() => sortTrips(field)}
        type="button"
      >
        {label}
        {selected ? (
          sortDirection === 'asc' ? (
            <ArrowUp aria-hidden="true" size={14} />
          ) : (
            <ArrowDown aria-hidden="true" size={14} />
          )
        ) : (
          <ArrowUpDown aria-hidden="true" size={14} />
        )}
      </Button>
    );
  }

  const hasFilters = Boolean(
    searchInput.trim() ||
      status ||
      departureDate ||
      departureDateRange?.from ||
      departureDateRange?.to ||
      origin ||
      destination ||
      timeRange,
  );
  const items = tripPage?.data ?? [];

  return (
    <SuperAdminLayout activeSection="trips">
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              {canCreate && (
                <ResourceCreateAction
                  label={tTrips('createTrip')}
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.assign('/trips/create');
                    }
                  }}
                />
              )}
              <ResourceRefreshAction
                loading={loading}
                onClick={refresh}
                label={tCommon('refresh')}
              />
            </div>
          }
          eyebrow={tTrips('eyebrow')}
          title={tTrips('tripsTitle')}
          titleId="trips-title"
        />

        <section
          aria-busy={loading}
          aria-labelledby="trips-title"
          className="min-w-0"
        >
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <FilterToolbar>
              <SearchInput
                label={tTrips('tripsTitle')}
                onChange={updateSearch}
                placeholder={tTrips('searchPlaceholder')}
                value={searchInput}
                clearLabel={tCommon('clearSearch')}
              />
              <div className="min-w-0 flex-[1_1_180px] sm:flex-[1_1_200px]">
                <label
                  className="mb-2 block text-[13px] font-semibold"
                  htmlFor="trip-filter-origin"
                >
                  {tTrips('originLabel')}
                </label>
                <LocationPicker
                  id="trip-filter-origin"
                  placeholder={tTrips('originAll')}
                  value={origin}
                  onChange={updateOrigin}
                  excludeValue={destination}
                />
              </div>
              <div className="min-w-0 flex-[1_1_180px] sm:flex-[1_1_200px]">
                <label
                  className="mb-2 block text-[13px] font-semibold"
                  htmlFor="trip-filter-destination"
                >
                  {tTrips('destinationLabel')}
                </label>
                <LocationPicker
                  id="trip-filter-destination"
                  placeholder={tTrips('destinationAll')}
                  value={destination}
                  onChange={updateDestination}
                  excludeValue={origin}
                />
              </div>
              <DateRangeFilter
                label={tTrips('departureDateLabel')}
                title={tTrips('departureDateRangeTitle')}
                emptyValueLabel={tTrips('allDates')}
                fromLabel={tTrips('fromDate')}
                toLabel={tTrips('toDate')}
                value={departureDateRange}
                onApply={updateDepartureDateRange}
              />
              <SelectFilter
                allLabel={tTrips('allTimeRanges')}
                label={tTrips('departureTimeLabel')}
                onChange={updateTimeRange}
                options={timeRangeOptions}
                value={timeRange}
              />
              <SelectFilter
                allLabel={tTrips('allStatuses')}
                label={tTrips('colStatus')}
                onChange={updateStatus}
                options={statusOptions}
                value={status}
              />
            </FilterToolbar>

            <div className="flex items-end gap-3 border-b p-4 min-[901px]:hidden">
              <SelectFilter
                allLabel={tTrips('colDepartureDate')}
                label={tCommon('sortBy')}
                onChange={(value) =>
                  sortTrips((value || 'departureDate') as TripSortKey)
                }
                options={sortOptions}
                value={sortBy}
              />
              <Button
                aria-label={tCommon('toggleSortOrder', {
                  order: sortDirection === 'asc' ? tCommon('ascending') : tCommon('descending'),
                })}
                onClick={() => sortTrips(sortBy)}
                type="button"
                variant="outline"
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp aria-hidden="true" size={15} />
                ) : (
                  <ArrowDown aria-hidden="true" size={15} />
                )}
                {sortDirection === 'asc'
                  ? tCommon('sortAscending')
                  : tCommon('sortDescending')}
              </Button>
            </div>

            {loading && !tripPage && (
              <ResourceTableSkeleton resourceLabel={tTrips('resourceLabel')} />
            )}

            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={refresh} type="button" variant="outline">
                  {tCommon('retry')}
                </Button>
              </ResourceState>
            )}

            {!error && !loading && tripPage && items.length === 0 && (
              <ResourceState>
                <p>
                  {hasFilters
                    ? tTrips('noMatch')
                    : tTrips('emptyList')}
                </p>
              </ResourceState>
            )}

            {!error && tripPage && (
              <>
                {items.length > 0 && (
                  <>
                    <div
                      aria-busy={loading}
                      className="hidden min-[901px]:block"
                    >
                      <Table className="text-[13px]">
                        <TableCaption className="sr-only">
                          {tTrips('tableCaption')}
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              aria-sort={
                                sortBy === 'code'
                                  ? sortDirection === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                  : 'none'
                              }
                              scope="col"
                            >
                              {sortButton(tTrips('colTrip'), 'code')}
                            </TableHead>
                            <TableHead
                              aria-sort={
                                sortBy === 'departureDate'
                                  ? sortDirection === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                  : 'none'
                              }
                              scope="col"
                            >
                              {sortButton(tTrips('colDepartureDate'), 'departureDate')}
                            </TableHead>
                            <TableHead
                              aria-sort={
                                sortBy === 'departureTime'
                                  ? sortDirection === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                  : 'none'
                              }
                              scope="col"
                            >
                              {sortButton(tTrips('colDepartureTime'), 'departureTime')}
                            </TableHead>
                            <TableHead scope="col">{tTrips('colVehicle')}</TableHead>
                            <TableHead scope="col">{tTrips('colAcceptsShipments')}</TableHead>
                            <TableHead scope="col">{tTrips('colCargoCapacity')}</TableHead>
                            <TableHead
                              aria-sort={
                                sortBy === 'status'
                                  ? sortDirection === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                  : 'none'
                              }
                              scope="col"
                            >
                              {sortButton(tTrips('colStatus'), 'status')}
                            </TableHead>
                            <TableHead scope="col">
                              <span className="sr-only">{tCommon('actions')}</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((trip) => (
                            <TableRow key={trip.tripId}>
                              <TableHead
                                className="bg-transparent py-3 text-[13px] font-normal"
                                scope="row"
                              >
                                <div className="font-semibold text-foreground">
                                  {trip.route.origin} → {trip.route.destination}
                                </div>
                                <span className="admin-data-mono mt-1 block text-xs text-muted-foreground">
                                  {trip.code}
                                </span>
                              </TableHead>
                              <TableCell>
                                {formatDate(trip.departureDate)}
                              </TableCell>
                              <TableCell>
                                {formatTime(trip.departureTime)}
                              </TableCell>
                              <TableCell>
                                <span className="admin-data-mono">
                                  {trip.vehicle.licensePlate}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {trip.vehicle.vehicleType.name}
                                </span>
                              </TableCell>
                              <TableCell>
                                {trip.acceptsShipments ? tCommon('yes') : tCommon('no')}
                              </TableCell>
                              <TableCell>
                                <div className="grid gap-1 text-xs">
                                  <span>
                                    {tVehicleTypes('motorbike')}: {trip.cargoCapacity.motorbikes}
                                  </span>
                                  <span>
                                    {tVehicleTypes('bulkyCargo')}:{' '}
                                    {trip.cargoCapacity.bulkyCargo}
                                  </span>
                                  <span>
                                    {tVehicleTypes('lightCargo')}: {trip.cargoCapacity.lightCargo}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <ResourceStatusBadge
                                  tone={
                                    trip.status === 'DANG_CHAY'
                                      ? 'active'
                                      : 'muted'
                                  }
                                >
                                  {getTripStatusLabel(trip.status)}
                                </ResourceStatusBadge>
                              </TableCell>
                              <TableCell>
                                <ResourceDetailAction
                                  href={`/trips/${trip.tripId}`}
                                  label={tCommon('viewDetails')}
                                  resourceName={`chuyến ${trip.code}`}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid gap-4 p-4 min-[901px]:hidden">
                      {items.map((trip) => (
                        <Card className="gap-4 p-4" key={trip.tripId}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h2 className="text-sm font-semibold">
                                {trip.route.origin} → {trip.route.destination}
                              </h2>
                              <span className="admin-data-mono text-xs text-muted-foreground">
                                {trip.code}
                              </span>
                            </div>
                            <ResourceStatusBadge
                              tone={
                                trip.status === 'DANG_CHAY' ? 'active' : 'muted'
                              }
                            >
                              {getTripStatusLabel(trip.status)}
                            </ResourceStatusBadge>
                          </div>
                          <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                            <div>
                              <dt>{tTrips('departureLabel')}</dt>
                              <dd>
                                {formatTime(trip.departureTime)} -{' '}
                                {formatDate(trip.departureDate)}
                              </dd>
                            </div>
                            <div>
                              <dt>{tTrips('colVehicle')}</dt>
                              <dd>
                                <span className="admin-data-mono">
                                  {trip.vehicle.licensePlate}
                                </span>{' '}
                                ({trip.vehicle.vehicleType.name})
                              </dd>
                            </div>
                            <div>
                              <dt>{tTrips('colAcceptsShipments')}</dt>
                              <dd>{trip.acceptsShipments ? tCommon('yes') : tCommon('no')}</dd>
                            </div>
                            <div className="col-span-2">
                              <dt>{tTrips('colCargoCapacity')}</dt>
                              <dd className="grid gap-1 text-xs">
                                <span>
                                  {tVehicleTypes('motorbike')}: {trip.cargoCapacity.motorbikes}
                                </span>
                                <span>
                                  {tVehicleTypes('bulkyCargo')}:{' '}
                                  {trip.cargoCapacity.bulkyCargo}
                                </span>
                                <span>
                                  {tVehicleTypes('lightCargo')}: {trip.cargoCapacity.lightCargo}
                                </span>
                              </dd>
                            </div>
                          </dl>
                          <div className="flex justify-end border-t pt-3">
                            <ResourceDetailAction
                              href={`/trips/${trip.tripId}`}
                              label={tCommon('viewDetails')}
                              resourceName={`chuyến ${trip.code}`}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                )}

                <ResourcePagination
                  currentPage={tripPage.meta.page}
                  disabled={loading}
                  onPageChange={changePage}
                  pageSize={tripPage.meta.pageSize}
                  summaryLabel={tTrips('resourceLabel')}
                  totalItems={tripPage.meta.totalItems}
                  totalPages={tripPage.meta.totalPages}
                  showingLabel={tCommon('showing')}
                  ofLabel={tCommon('of')}
                  pageLabel={tCommon('page')}
                  prevPageLabel={tCommon('prevPage')}
                  nextPageLabel={tCommon('nextPage')}
                />
              </>
            )}
          </div>
        </section>
      </div>

      {createOpen && (
        <TripFormDialog
          onClose={() => setCreateOpen(false)}
          onRetryRouteOptions={retryRoutes}
          onRetryVehicleOptions={retryVehicles}
          onSaved={(created) => {
            setCreateOpen(false);
            toast.success(tTrips('createdSuccess', { code: created.code }));
            refresh();
          }}
          routeOptions={routeOptions}
          vehicleOptions={vehicleOptions}
        />
      )}
    </SuperAdminLayout>
  );
}
