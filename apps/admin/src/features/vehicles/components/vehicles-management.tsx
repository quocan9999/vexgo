'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceCreateAction,
  ResourceDetailAction,
  ResourceNotice,
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  VEHICLE_STATUSES,
  type VehicleFilterOption,
  type VehicleListItem,
  type VehicleSortKey,
  type VehicleStatus,
} from '../types/vehicle';
import { useVehicleFilterOptions } from '../hooks/use-vehicle-filter-options';
import { useVehicles } from '../hooks/use-vehicles';
import { VehicleFormDialog } from './vehicle-form-dialog';
import styles from './vehicles-management.module.css';

function timestampFormat(value: string) {
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

function statusLabel(status: VehicleStatus) {
  switch (status) {
    case 'HOAT_DONG':
      return 'Đang hoạt động';
    case 'BAO_TRI':
      return 'Bảo trì';
  }
}

function statusTone(status: VehicleStatus) {
  return status === 'HOAT_DONG' ? 'active' : 'warning';
}

const VEHICLE_STATUS_OPTIONS: FilterOption[] = VEHICLE_STATUSES.map(
  (status) => ({ value: status, label: statusLabel(status) }),
);

const VEHICLE_MOBILE_SORT_OPTIONS: FilterOption[] = [
  { value: 'status', label: 'Trạng thái' },
  { value: 'createdAt', label: 'Ngày tạo' },
  { value: 'updatedAt', label: 'Cập nhật' },
];

function filterOptions(options: VehicleFilterOption[]): FilterOption[] {
  return options.map((option) => ({
    value: String(option.id),
    label: option.label,
  }));
}

function sortIcon(
  field: VehicleSortKey,
  currentField: VehicleSortKey,
  direction: 'asc' | 'desc',
) {
  if (field !== currentField)
    return <ArrowUpDown aria-hidden="true" size={14} />;
  return direction === 'asc' ? (
    <ArrowUp aria-hidden="true" size={14} />
  ) : (
    <ArrowDown aria-hidden="true" size={14} />
  );
}

function vehicleStatusBadge(vehicle: VehicleListItem) {
  return (
    <ResourceStatusBadge tone={statusTone(vehicle.status)}>
      {statusLabel(vehicle.status)}
    </ResourceStatusBadge>
  );
}

export function VehiclesManagement() {
  const router = useRouter();
  const { can } = useAdminPermissions();
  const canCreate = can('vehicle:create');
  const {
    vehiclePage,
    error,
    loading,
    page,
    searchInput,
    filters,
    sortBy,
    sortDirection,
    changePage,
    refresh,
    retry,
    sortVehicles,
    updateFilters,
    updateSearch,
  } = useVehicles();
  const options = useVehicleFilterOptions();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const items = vehiclePage?.data ?? [];
  const hasActiveFilters = Boolean(filters.vehicleTypeId || filters.status);
  const optionErrors = [
    options.busCompanies.status === 'error'
      ? `Nhà xe: ${options.busCompanies.message}`
      : null,
    options.vehicleTypes.status === 'error'
      ? `Loại xe: ${options.vehicleTypes.message}`
      : null,
  ].filter((message): message is string => message !== null);

  function sortButton(label: string, field: VehicleSortKey) {
    return (
      <Button
        aria-label={`Sắp xếp theo ${label}`}
        className="-ml-3"
        size="sm"
        variant="ghost"
        onClick={() => sortVehicles(field)}
        type="button"
      >
        {label}
        {sortIcon(field, sortBy, sortDirection)}
      </Button>
    );
  }

  return (
    <SuperAdminLayout activeSection="vehicles">
      <div className={`admin-ui admin-page-content ${styles.page}`}>
        <AdminPageHeader
          eyebrow="QUẢN LÝ PHƯƠNG TIỆN"
          title="Danh sách xe"
          titleId="vehicles-title"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && (
                <ResourceCreateAction
                  label="Thêm xe"
                  onClick={() => setCreateDialogOpen(true)}
                />
              )}
              <ResourceRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
        />
        <section aria-busy={loading} aria-labelledby="vehicles-title">
          <Card className="gap-0 py-0 shadow-sm overflow-hidden">
            <FilterToolbar>
              <SearchInput
                label="Tìm kiếm xe"
                onChange={updateSearch}
                placeholder="Tìm biển số hoặc loại xe…"
                value={searchInput}
              />
              {options.vehicleTypes.status === 'success' && (
                <SelectFilter
                  allLabel="Tất cả loại xe"
                  label="Loại xe"
                  onChange={(value) => updateFilters({ vehicleTypeId: value })}
                  options={filterOptions(options.vehicleTypes.options)}
                  value={filters.vehicleTypeId}
                />
              )}
              <SelectFilter
                allLabel="Tất cả trạng thái xe"
                label="Trạng thái xe"
                onChange={(value) =>
                  updateFilters({ status: value as VehicleStatus | '' })
                }
                options={VEHICLE_STATUS_OPTIONS}
                value={filters.status}
              />
            </FilterToolbar>
            <div className="flex flex-wrap items-end gap-3 border-b p-4 md:hidden">
              <SelectFilter
                allLabel="Biển số xe"
                label="Sắp xếp theo"
                onChange={(value) =>
                  sortVehicles((value || 'licensePlate') as VehicleSortKey)
                }
                options={VEHICLE_MOBILE_SORT_OPTIONS}
                value={sortBy === 'licensePlate' ? '' : sortBy}
              />
              <Button
                aria-label={`Đổi thứ tự sắp xếp, hiện tại ${sortDirection === 'asc' ? 'tăng dần' : 'giảm dần'}`}
                onClick={() => sortVehicles(sortBy)}
                variant="outline"
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp aria-hidden />
                ) : (
                  <ArrowDown aria-hidden />
                )}
                {sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần'}
              </Button>
            </div>
            {(options.busCompanies.status === 'loading' ||
              options.vehicleTypes.status === 'loading') && (
              <p
                className="px-5 py-3 text-xs text-muted-foreground"
                role="status"
              >
                Đang tải tùy chọn bộ lọc…
              </p>
            )}
            {optionErrors.length > 0 && (
              <div className="p-4">
                <ResourceNotice kind="error">
                  <p>{optionErrors.join(' ')}</p>
                  <Button
                    className="mt-3"
                    onClick={options.retry}
                    size="sm"
                    variant="outline"
                  >
                    Thử tải lại bộ lọc
                  </Button>
                </ResourceNotice>
              </div>
            )}
            {loading && !vehiclePage && (
              <ResourceTableSkeleton resourceLabel="xe" />
            )}
            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={retry} variant="outline">
                  Thử lại
                </Button>
              </ResourceState>
            )}
            {!error && vehiclePage && items.length === 0 && !loading && (
              <ResourceState>
                <p>
                  {searchInput.trim() || hasActiveFilters
                    ? 'Không tìm thấy xe phù hợp với tìm kiếm hoặc bộ lọc.'
                    : 'Chưa có xe trong hệ thống.'}
                </p>
                {(searchInput.trim() || hasActiveFilters) && (
                  <Button
                    onClick={() => {
                      updateSearch('');
                      updateFilters({ status: '', vehicleTypeId: '' });
                    }}
                    variant="outline"
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </ResourceState>
            )}
            {!error && vehiclePage && (
              <>
                {items.length > 0 && (
                  <>
                    <div className="hidden md:block">
                      <Table className="min-w-[960px]">
                        <TableCaption className="sr-only">
                          Danh sách xe
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            {(
                              [
                                { key: 'licensePlate', label: 'Biển số xe' },
                                { key: null, label: 'Nhà xe' },
                                { key: null, label: 'Loại xe' },
                                { key: 'status', label: 'Trạng thái' },
                                { key: 'createdAt', label: 'Ngày tạo' },
                                { key: 'updatedAt', label: 'Cập nhật' },
                              ] as const
                            ).map((column) => (
                              <TableHead
                                aria-sort={
                                  column.key
                                    ? sortBy === column.key
                                      ? sortDirection === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                    : undefined
                                }
                                key={column.label}
                                scope="col"
                              >
                                {column.key
                                  ? sortButton(column.label, column.key)
                                  : column.label}
                              </TableHead>
                            ))}
                            <TableHead scope="col">
                              <span className="sr-only">Thao tác</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((vehicle) => (
                            <TableRow key={vehicle.vehicleId}>
                              <th
                                className="admin-data-mono whitespace-nowrap px-4 py-3 text-left font-semibold"
                                scope="row"
                              >
                                {vehicle.licensePlate}
                              </th>
                              <TableCell>
                                <span className="block">
                                  {vehicle.busCompany.name}
                                </span>
                                <span className="admin-data-mono text-xs text-muted-foreground">
                                  {vehicle.busCompany.code}
                                </span>
                              </TableCell>
                              <TableCell>{vehicle.vehicleType.name}</TableCell>
                              <TableCell>
                                {vehicleStatusBadge(vehicle)}
                              </TableCell>
                              <TableCell className="text-muted-foreground tabular-nums">
                                {timestampFormat(vehicle.createdAt)}
                              </TableCell>
                              <TableCell className="text-muted-foreground tabular-nums">
                                {timestampFormat(vehicle.updatedAt)}
                              </TableCell>
                              <TableCell>
                                <ResourceDetailAction
                                  href={`/vehicles/${vehicle.vehicleId}`}
                                  onClick={() =>
                                    router.push(`/vehicles/${vehicle.vehicleId}`)
                                  }
                                  resourceName={`xe ${vehicle.licensePlate}`}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="grid gap-4 bg-background p-4 md:hidden">
                      {items.map((vehicle) => (
                        <Card
                          className="gap-4 p-4 ring-0"
                          key={vehicle.vehicleId}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h2 className="admin-data-mono text-base font-semibold">
                                {vehicle.licensePlate}
                              </h2>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Xe #
                                <span className="admin-data-mono">
                                  {vehicle.vehicleId}
                                </span>
                              </p>
                            </div>
                            {vehicleStatusBadge(vehicle)}
                          </div>
                          <dl className={styles.detailFields}>
                            <div>
                              <dt>Nhà xe</dt>
                              <dd>{vehicle.busCompany.name}</dd>
                            </div>
                            <div>
                              <dt>Loại xe</dt>
                              <dd>{vehicle.vehicleType.name}</dd>
                            </div>
                            <div>
                              <dt>Ngày tạo</dt>
                              <dd>{timestampFormat(vehicle.createdAt)}</dd>
                            </div>
                            <div>
                              <dt>Cập nhật</dt>
                              <dd>{timestampFormat(vehicle.updatedAt)}</dd>
                            </div>
                          </dl>
                          <div className="flex justify-end border-t pt-3">
                            <ResourceDetailAction
                              href={`/vehicles/${vehicle.vehicleId}`}
                              onClick={() =>
                                router.push(`/vehicles/${vehicle.vehicleId}`)
                              }
                              resourceName={`xe ${vehicle.licensePlate}`}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
                <ResourcePagination
                  currentPage={page}
                  disabled={loading}
                  onPageChange={changePage}
                  pageSize={vehiclePage.meta.pageSize}
                  summaryLabel="xe"
                  totalItems={vehiclePage.meta.totalItems}
                  totalPages={vehiclePage.meta.totalPages}
                />
              </>
            )}
          </Card>
        </section>
      </div>
      {createDialogOpen && canCreate && (
        <VehicleFormDialog
          busCompanies={options.busCompanies}
          onClose={() => setCreateDialogOpen(false)}
          onRetryOptions={options.retry}
          onSaved={(vehicle) => {
            setCreateDialogOpen(false);
            toast.success(`Đã thêm xe ${vehicle.licensePlate}.`);
            refresh();
          }}
          vehicleTypes={options.vehicleTypes}
        />
      )}
    </SuperAdminLayout>
  );
}
