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
import { SingleDateFilter } from '@/components/data-filters/single-date-filter';
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
import { useTripLookupOptions } from '../hooks/use-trip-lookup-options';
import { useTrips } from '../hooks/use-trips';
import type { TripSortKey } from '../types/trip';
import { TripDetailSheet, tripStatusLabel } from './trip-detail-sheet';
import { TripFormDialog } from './trip-form-dialog';

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'CHUA_KHOI_HANH', label: 'Chưa khởi hành' },
  { value: 'DANG_CHAY', label: 'Đang chạy' },
  { value: 'HOAN_THANH', label: 'Hoàn thành' },
  { value: 'DA_HUY', label: 'Đã hủy' },
];

const SORT_OPTIONS: FilterOption[] = [
  { value: 'departureDate', label: 'Ngày khởi hành' },
  { value: 'departureTime', label: 'Giờ khởi hành' },
  { value: 'code', label: 'Mã chuyến' },
  { value: 'status', label: 'Trạng thái' },
  { value: 'createdAt', label: 'Ngày tạo' },
  { value: 'updatedAt', label: 'Cập nhật' },
];

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
  const {
    tripPage,
    error,
    loading,
    searchInput,
    status,
    departureDate,
    sortBy,
    sortDirection,
    changePage,
    updateSearch,
    updateStatus,
    updateDepartureDate,
    sortTrips,
    refresh,
  } = useTrips();

  const { can } = useAdminPermissions();
  const canCreate = can('trip:create');
  const { routeOptions, vehicleOptions, retryRoutes, retryVehicles } =
    useTripLookupOptions();

  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function sortButton(label: string, field: TripSortKey) {
    const selected = sortBy === field;
    return (
      <Button
        aria-label={`Sắp xếp theo ${label}`}
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

  const hasFilters = Boolean(searchInput.trim() || status || departureDate);
  const items = tripPage?.data ?? [];

  return (
    <SuperAdminLayout activeSection="trips">
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              {canCreate && (
                <ResourceCreateAction
                  label="Thêm chuyến"
                  onClick={() => {
                    setCreateOpen(true);
                  }}
                />
              )}
              <ResourceRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title="Quản lý chuyến xe"
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
                label="Tìm chuyến xe"
                onChange={updateSearch}
                placeholder="Tìm mã chuyến, điểm đi, điểm đến, biển số xe..."
                value={searchInput}
              />
              <SelectFilter
                allLabel="Tất cả trạng thái"
                label="Trạng thái"
                onChange={updateStatus}
                options={STATUS_OPTIONS}
                value={status}
              />
              <SingleDateFilter
                label="Ngày khởi hành"
                onChange={updateDepartureDate}
                value={departureDate}
              />
            </FilterToolbar>

            <div className="flex items-end gap-3 border-b p-4 min-[901px]:hidden">
              <SelectFilter
                allLabel="Ngày khởi hành (mặc định)"
                label="Sắp xếp chuyến theo"
                onChange={(value) =>
                  sortTrips((value || 'departureDate') as TripSortKey)
                }
                options={SORT_OPTIONS}
                value={sortBy}
              />
              <Button
                aria-label={`Đổi thứ tự sắp xếp, hiện tại ${
                  sortDirection === 'asc' ? 'tăng dần' : 'giảm dần'
                }`}
                onClick={() => sortTrips(sortBy)}
                type="button"
                variant="outline"
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp aria-hidden="true" size={15} />
                ) : (
                  <ArrowDown aria-hidden="true" size={15} />
                )}
                {sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần'}
              </Button>
            </div>

            {loading && !tripPage && (
              <ResourceTableSkeleton resourceLabel="chuyến xe" />
            )}

            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={refresh} type="button" variant="outline">
                  Thử lại
                </Button>
              </ResourceState>
            )}

            {!error && !loading && tripPage && items.length === 0 && (
              <ResourceState>
                <p>
                  {hasFilters
                    ? 'Không tìm thấy chuyến xe phù hợp.'
                    : 'Chưa có chuyến xe trong hệ thống.'}
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
                          Danh sách chuyến xe
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
                              {sortButton('Mã chuyến', 'code')}
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
                              {sortButton('Ngày khởi hành', 'departureDate')}
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
                              {sortButton('Giờ khởi hành', 'departureTime')}
                            </TableHead>
                            <TableHead scope="col">Tuyến xe</TableHead>
                            <TableHead scope="col">Xe</TableHead>
                            <TableHead scope="col">Nhận gửi hàng</TableHead>
                            <TableHead scope="col">Sức chứa hàng</TableHead>
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
                              {sortButton('Trạng thái', 'status')}
                            </TableHead>
                            <TableHead scope="col"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((trip) => (
                            <TableRow key={trip.tripId}>
                              <TableHead
                                className="admin-data-mono bg-transparent py-3 text-[13px]"
                                scope="row"
                              >
                                {trip.code}
                              </TableHead>
                              <TableCell>
                                {formatDate(trip.departureDate)}
                              </TableCell>
                              <TableCell>
                                {formatTime(trip.departureTime)}
                              </TableCell>
                              <TableCell>
                                {trip.route.origin} → {trip.route.destination}
                                <span className="admin-data-mono mt-1 block text-xs text-muted-foreground">
                                  {trip.route.code}
                                </span>
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
                                {trip.acceptsShipments ? 'Có' : 'Không'}
                              </TableCell>
                              <TableCell>
                                <div className="grid gap-1 text-xs">
                                  <span>
                                    Xe máy: {trip.cargoCapacity.motorbikes}
                                  </span>
                                  <span>
                                    Hàng cồng kềnh:{' '}
                                    {trip.cargoCapacity.bulkyCargo}
                                  </span>
                                  <span>
                                    Hàng nhẹ: {trip.cargoCapacity.lightCargo}
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
                                  {tripStatusLabel(trip.status)}
                                </ResourceStatusBadge>
                              </TableCell>
                              <TableCell>
                                <ResourceDetailAction
                                  onClick={() => setSelectedTripId(trip.tripId)}
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
                            <h2 className="admin-data-mono text-sm font-semibold break-all">
                              {trip.code}
                            </h2>
                            <ResourceStatusBadge
                              tone={
                                trip.status === 'DANG_CHAY' ? 'active' : 'muted'
                              }
                            >
                              {tripStatusLabel(trip.status)}
                            </ResourceStatusBadge>
                          </div>
                          <p className="text-sm font-medium">
                            {trip.route.origin} → {trip.route.destination}
                          </p>
                          <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                            <div>
                              <dt>Khởi hành</dt>
                              <dd>
                                {formatTime(trip.departureTime)} -{' '}
                                {formatDate(trip.departureDate)}
                              </dd>
                            </div>
                            <div>
                              <dt>Xe</dt>
                              <dd>
                                <span className="admin-data-mono">
                                  {trip.vehicle.licensePlate}
                                </span>{' '}
                                ({trip.vehicle.vehicleType.name})
                              </dd>
                            </div>
                            <div>
                              <dt>Nhận gửi hàng</dt>
                              <dd>{trip.acceptsShipments ? 'Có' : 'Không'}</dd>
                            </div>
                            <div className="col-span-2">
                              <dt>Sức chứa hàng</dt>
                              <dd className="grid gap-1 text-xs">
                                <span>
                                  Xe máy: {trip.cargoCapacity.motorbikes}
                                </span>
                                <span>
                                  Hàng cồng kềnh:{' '}
                                  {trip.cargoCapacity.bulkyCargo}
                                </span>
                                <span>
                                  Hàng nhẹ: {trip.cargoCapacity.lightCargo}
                                </span>
                              </dd>
                            </div>
                          </dl>
                          <div className="flex justify-end border-t pt-3">
                            <ResourceDetailAction
                              onClick={() => setSelectedTripId(trip.tripId)}
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
                  summaryLabel="chuyến xe"
                  totalItems={tripPage.meta.totalItems}
                  totalPages={tripPage.meta.totalPages}
                />
              </>
            )}
          </div>
        </section>
      </div>

      {selectedTripId !== null && (
        <TripDetailSheet
          initialTrip={items.find((t) => t.tripId === selectedTripId)}
          key={selectedTripId}
          onClose={() => setSelectedTripId(null)}
          onNotFound={() => {
            setSelectedTripId(null);
            refresh();
          }}
          onRetryRouteOptions={retryRoutes}
          onRetryVehicleOptions={retryVehicles}
          onUpdated={(updated, options) => {
            if (!options?.silent)
              toast.success(`Đã cập nhật chuyến ${updated.code}.`);
            refresh();
          }}
          routeOptions={routeOptions}
          tripId={selectedTripId}
          vehicleOptions={vehicleOptions}
        />
      )}

      {createOpen && (
        <TripFormDialog
          onClose={() => setCreateOpen(false)}
          onRetryRouteOptions={retryRoutes}
          onRetryVehicleOptions={retryVehicles}
          onSaved={(created) => {
            setCreateOpen(false);
            toast.success(`Đã tạo chuyến ${created.code}.`);
            refresh();
          }}
          routeOptions={routeOptions}
          vehicleOptions={vehicleOptions}
        />
      )}
    </SuperAdminLayout>
  );
}
