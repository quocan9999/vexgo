'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { AdminDetailAction } from '@/components/admin/admin-detail-action';
import {
  AdminCreateAction,
  AdminRefreshAction,
} from '@/components/admin/admin-page-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  SingleDateFilter,
  type FilterOption,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useTripLookupOptions } from '../hooks/use-trip-lookup-options';
import { useTrips } from '../hooks/use-trips';
import type { TripSortKey } from '../types/trip';
import { TripDetailSheet, TripStatusBadge } from './trip-detail-sheet';
import { TripFormDialog } from './trip-form-dialog';
import '../trips.css';

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
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  function sortButton(label: string, field: TripSortKey) {
    const selected = sortBy === field;
    return (
      <button
        aria-label={`Sắp xếp theo ${label}`}
        className="admin-resource-sort-button"
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
      </button>
    );
  }

  const hasFilters = Boolean(searchInput.trim() || status || departureDate);
  const items = tripPage?.data ?? [];

  return (
    <SuperAdminLayout activeSection="trips">
      <div className="admin-page-content">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              {canCreate && (
                <AdminCreateAction
                  label="Thêm chuyến"
                  onClick={() => {
                    setSuccessNotice(null);
                    setCreateOpen(true);
                  }}
                />
              )}
              <AdminRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title="Quản lý chuyến xe"
          titleId="trips-title"
        />

        {successNotice && (
          <div className="trips-success-notice" role="status">
            <CheckCircle2 aria-hidden="true" size={16} />
            <span>{successNotice}</span>
          </div>
        )}

        <section
          aria-busy={loading}
          aria-labelledby="trips-title"
          className="trips-section"
        >
          <div className="panel admin-resource-panel">
            <FilterToolbar
              totalItems={error ? null : tripPage?.meta.totalItems ?? null}
            >
              <SearchInput
                label="Tìm chuyến xe"
                onChange={updateSearch}
                placeholder="Tìm mã chuyến, điểm đi, điểm đến, biển số xe..."
                value={searchInput}
              />
              <SelectFilter
                allLabel="Tất cả trạng thái"
                label="Lọc theo trạng thái"
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

            <div className="trips-mobile-sort">
              <SelectFilter
                allLabel="Ngày khởi hành (mặc định)"
                label="Sắp xếp chuyến theo"
                onChange={(value) =>
                  sortTrips((value || 'departureDate') as TripSortKey)
                }
                options={SORT_OPTIONS}
                value={sortBy === 'departureDate' ? '' : sortBy}
              />
              <Button
                aria-label={`Đổi thứ tự sắp xếp, hiện tại ${
                  sortDirection === 'asc' ? 'tăng dần' : 'giảm dần'
                }`}
                onClick={() => sortTrips(sortBy)}
                type="button"
                variant="secondary"
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
              <AdminTableSkeleton resourceLabel="chuyến xe" />
            )}

            {error && (
              <div className="trips-list-state" role="alert">
                <p>{error}</p>
                <Button onClick={refresh} type="button" variant="secondary">
                  Thử lại
                </Button>
              </div>
            )}

            {!error && !loading && tripPage && items.length === 0 && (
              <div className="trips-list-state" role="status">
                <Search aria-hidden="true" size={21} />
                <p>
                  {hasFilters
                    ? 'Không tìm thấy chuyến xe phù hợp.'
                    : 'Chưa có chuyến xe trong hệ thống.'}
                </p>
              </div>
            )}

            {!error && tripPage && (
              <>
                {items.length > 0 && (
                  <>
                    <div
                      aria-busy={loading}
                      className="admin-resource-table-wrap"
                    >
                      <table className="admin-resource-table">
                        <caption className="sr-only">Danh sách chuyến xe</caption>
                        <thead>
                          <tr>
                            <th
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
                            </th>
                            <th
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
                            </th>
                            <th
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
                            </th>
                            <th scope="col">Tuyến xe</th>
                            <th scope="col">Xe</th>
                            <th
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
                            </th>
                            <th scope="col"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((trip) => (
                            <tr key={trip.tripId}>
                              <th className="admin-data-mono" scope="row">{trip.code}</th>
                              <td>{formatDate(trip.departureDate)}</td>
                              <td>{formatTime(trip.departureTime)}</td>
                              <td>
                                {trip.route.origin} → {trip.route.destination}
                                <span className="trips-route-code admin-data-mono">
                                  {trip.route.code}
                                </span>
                              </td>
                              <td>
                                <span className="admin-data-mono">
                                  {trip.vehicle.licensePlate}
                                </span>
                                <span className="trips-vehicle-type">
                                  {trip.vehicle.vehicleType.name}
                                </span>
                              </td>
                              <td>
                                <TripStatusBadge status={trip.status} />
                              </td>
                              <td>
                                <AdminDetailAction
                                  onClick={() => setSelectedTripId(trip.tripId)}
                                  resourceName={`chuyến ${trip.code}`}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="trips-mobile-list">
                      {items.map((trip) => (
                        <article
                          className="trips-mobile-card"
                          key={trip.tripId}
                        >
                          <div className="trips-mobile-card-header">
                            <h2 className="admin-data-mono">{trip.code}</h2>
                            <TripStatusBadge status={trip.status} />
                          </div>
                          <p className="trips-mobile-journey">
                            {trip.route.origin} → {trip.route.destination}
                          </p>
                          <dl className="trips-mobile-fields">
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
                          </dl>
                          <div className="trips-mobile-actions">
                            <AdminDetailAction
                              onClick={() => setSelectedTripId(trip.tripId)}
                              resourceName={`chuyến ${trip.code}`}
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}

                <AdminPagination
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
        <footer className="admin-page-footer">
          <span>© 2026 VexGo Platform</span>
        </footer>
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
          onUpdated={(updated) => {
            setSuccessNotice(`Đã cập nhật chuyến ${updated.code}.`);
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
            setSuccessNotice(`Đã tạo chuyến ${created.code}.`);
            refresh();
          }}
          routeOptions={routeOptions}
          vehicleOptions={vehicleOptions}
        />
      )}
    </SuperAdminLayout>
  );
}
