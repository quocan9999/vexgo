'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
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
import { FarePriceDetailSheet } from './fare-price-detail-sheet';
import { FarePriceFormDialog } from './fare-price-form-dialog';

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'HOAT_DONG', label: 'Hoạt động' },
  { value: 'TAM_NGUNG', label: 'Tạm ngưng' },
];

const EFFECTIVE_STATE_OPTIONS: FilterOption[] = [
  { value: 'CHUA_HIEU_LUC', label: 'Chưa hiệu lực' },
  { value: 'DANG_HIEU_LUC', label: 'Đang hiệu lực' },
  { value: 'HET_HIEU_LUC', label: 'Hết hiệu lực' },
  { value: 'TAM_NGUNG', label: 'Tạm ngưng' },
];

const EFFECTIVE_STATE_LABELS: Record<FarePriceEffectiveState, string> = {
  CHUA_HIEU_LUC: 'Chưa hiệu lực',
  DANG_HIEU_LUC: 'Đang hiệu lực',
  HET_HIEU_LUC: 'Hết hiệu lực',
  TAM_NGUNG: 'Tạm ngưng',
};

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}

function formatDateOnly(value: string | null) {
  if (value === null) return 'Không giới hạn';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(`${value}T00:00:00.000Z`))
    .replaceAll('/', '-');
}

function statusLabel(status: FarePrice['status']) {
  return status === 'HOAT_DONG' ? 'Hoạt động' : 'Tạm ngưng';
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
  const [selectedFarePriceId, setSelectedFarePriceId] = useState<number | null>(
    null,
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [routeOptions, setRouteOptions] = useState<FarePriceOptionsState>({
    status: 'loading',
  });
  const [vehicleTypeOptions, setVehicleTypeOptions] =
    useState<FarePriceOptionsState>({ status: 'loading' });
  const [routeOptionsRetry, setRouteOptionsRetry] = useState(0);
  const [vehicleTypeOptionsRetry, setVehicleTypeOptionsRetry] = useState(0);

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

  function openDetails(farePrice: FarePrice) {
    setSelectedFarePriceId(farePrice.farePriceId);
  }

  function openCreateDialog() {
    setCreateDialogOpen(true);
  }

  function handleFarePriceCreated(farePrice: FarePrice) {
    setCreateDialogOpen(false);
    toast.success(`Đã tạo bảng giá vé ${farePrice.route.code}.`);
    refresh();
  }

  function handleFarePriceUpdated(farePrice: FarePrice) {
    toast.success(`Đã cập nhật bảng giá vé ${farePrice.route.code}.`);
    refresh();
  }

  function handleFarePriceNotFound() {
    setSelectedFarePriceId(null);
    toast.error('Bảng giá không còn tồn tại. Danh sách đã được làm mới.');
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
        aria-label={`Sắp xếp theo ${label}`}
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
        {statusLabel(item.status)}
      </ResourceStatusBadge>
    );
  }
  function effectiveStateBadge(item: FarePrice) {
    return (
      <ResourceStatusBadge tone={stateTone(item.effectiveState)}>
        {EFFECTIVE_STATE_LABELS[item.effectiveState]}
      </ResourceStatusBadge>
    );
  }
  return (
    <SuperAdminLayout activeSection="fare-prices">
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <div>
          <AdminPageHeader
            eyebrow="QUẢN LÝ VẬN HÀNH"
            title="Quản lý bảng giá vé"
            titleId="fare-prices-title"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {canCreate && (
                  <ResourceCreateAction
                    label="Thêm bảng giá"
                    onClick={openCreateDialog}
                  />
                )}
                <ResourceRefreshAction loading={loading} onClick={refresh} />
              </div>
            }
          />
          <p className="mt-2 text-[13px] text-muted-foreground">
            Theo dõi giá vé theo tuyến, loại xe và thời gian hiệu lực.
          </p>
        </div>
        <section aria-busy={loading} aria-labelledby="fare-prices-title">
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label="Tìm bảng giá"
                value={searchInput}
                onChange={updateSearch}
                placeholder="Tìm theo tuyến hoặc loại xe…"
              />
              {routeOptions.status === 'success' && (
                <SelectFilter
                  label="Tuyến xe"
                  allLabel="Tất cả tuyến xe"
                  value={routeId}
                  options={optionFilters(routeOptions.options)}
                  onChange={updateRoute}
                />
              )}
              {vehicleTypeOptions.status === 'success' && (
                <SelectFilter
                  label="Loại xe"
                  allLabel="Tất cả loại xe"
                  value={vehicleTypeId}
                  options={optionFilters(vehicleTypeOptions.options)}
                  onChange={updateVehicleType}
                />
              )}
              <SelectFilter
                label="Trạng thái"
                allLabel="Tất cả trạng thái"
                value={status}
                options={STATUS_OPTIONS}
                onChange={updateStatus}
              />
              <SelectFilter
                label="Hiệu lực"
                allLabel="Tất cả hiệu lực"
                value={effectiveState}
                options={EFFECTIVE_STATE_OPTIONS}
                onChange={updateEffectiveState}
              />
            </FilterToolbar>
            {(routeOptions.status === 'loading' ||
              vehicleTypeOptions.status === 'loading') && (
              <p
                className="px-5 py-3 text-xs text-muted-foreground"
                role="status"
              >
                Đang tải bộ lọc tuyến xe và loại xe…
              </p>
            )}
            {(routeOptions.status === 'error' ||
              vehicleTypeOptions.status === 'error') && (
              <div className="p-4">
                <ResourceNotice kind="error">
                  <p>Không thể tải bộ lọc tuyến xe hoặc loại xe.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {routeOptions.status === 'error' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={retryRouteOptions}
                      >
                        Thử tải lại tuyến xe
                      </Button>
                    )}
                    {vehicleTypeOptions.status === 'error' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={retryVehicleTypeOptions}
                      >
                        Thử tải lại loại xe
                      </Button>
                    )}
                  </div>
                </ResourceNotice>
              </div>
            )}
            <div className="border-b p-4 md:hidden">
              <div className="flex items-end gap-3">
                <SelectFilter
                  label="Sắp xếp theo"
                  allLabel="Giá niêm yết"
                  value={sortBy === 'listedPrice' ? '' : sortBy}
                  options={[
                    { value: 'validFrom', label: 'Hiệu lực từ' },
                    { value: 'validTo', label: 'Hiệu lực đến' },
                    { value: 'status', label: 'Trạng thái' },
                  ]}
                  onChange={(value) => {
                    const field = (value || 'listedPrice') as FarePriceSortKey;
                    if (field !== sortBy) sortFarePrices(field);
                  }}
                />
                <Button
                  variant="outline"
                  aria-label={`Đổi thứ tự sắp xếp, hiện tại ${sortDirection === 'asc' ? 'tăng dần' : 'giảm dần'}`}
                  onClick={() => sortFarePrices(sortBy)}
                >
                  {sortDirection === 'asc' ? (
                    <ArrowUp aria-hidden />
                  ) : (
                    <ArrowDown aria-hidden />
                  )}
                  {sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần'}
                </Button>
              </div>
            </div>
            {loading && !farePricePage && (
              <ResourceTableSkeleton resourceLabel="bảng giá" />
            )}
            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button variant="outline" onClick={refresh}>
                  Thử lại
                </Button>
              </ResourceState>
            )}
            {!loading && !error && farePricePage && items.length === 0 && (
              <ResourceState>
                <p>
                  {hasFilters
                    ? 'Không tìm thấy bảng giá phù hợp với bộ lọc.'
                    : 'Chưa có bảng giá nào.'}
                </p>
                {hasFilters && (
                  <Button variant="outline" onClick={resetFilters}>
                    Xóa bộ lọc
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
                          Danh sách bảng giá vé
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            {(
                              [
                                { key: null, label: 'Tuyến' },
                                { key: null, label: 'Loại xe' },
                                { key: 'listedPrice', label: 'Giá niêm yết' },
                                { key: 'validFrom', label: 'Hiệu lực từ' },
                                { key: 'validTo', label: 'Hiệu lực đến' },
                                { key: 'status', label: 'Trạng thái' },
                                { key: null, label: 'Hiệu lực hiện tại' },
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
                              <span className="sr-only">Thao tác</span>
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
                                {formatDateOnly(item.validFrom)}
                              </TableCell>
                              <TableCell>
                                {formatDateOnly(item.validTo)}
                              </TableCell>
                              <TableCell>{fareStatus(item)}</TableCell>
                              <TableCell>{effectiveStateBadge(item)}</TableCell>
                              <TableCell>
                                <ResourceDetailAction
                                  resourceName={item.route.code}
                                  onClick={() => openDetails(item)}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div
                      className="grid gap-4 p-4 md:hidden"
                      aria-label="Danh sách bảng giá dạng thẻ"
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
                              <dt>Loại xe</dt>
                              <dd>{item.vehicleType.name}</dd>
                            </div>
                            <div>
                              <dt>Hiệu lực từ</dt>
                              <dd>{formatDateOnly(item.validFrom)}</dd>
                            </div>
                            <div>
                              <dt>Hiệu lực đến</dt>
                              <dd>{formatDateOnly(item.validTo)}</dd>
                            </div>
                            <div>
                              <dt>Trạng thái</dt>
                              <dd>{fareStatus(item)}</dd>
                            </div>
                            <div>
                              <dt>Hiệu lực hiện tại</dt>
                              <dd>{effectiveStateBadge(item)}</dd>
                            </div>
                          </dl>
                          <div className="flex justify-end border-t pt-3">
                            <ResourceDetailAction
                              resourceName={item.route.code}
                              onClick={() => openDetails(item)}
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
                  summaryLabel="bảng giá"
                  totalItems={farePricePage.meta.totalItems}
                  totalPages={farePricePage.meta.totalPages}
                />
              </>
            )}
          </Card>
        </section>
      </div>
      {selectedFarePriceId !== null && (
        <FarePriceDetailSheet
          farePriceId={selectedFarePriceId}
          onNotFound={handleFarePriceNotFound}
          onClose={() => setSelectedFarePriceId(null)}
          onRetryRouteOptions={retryRouteOptions}
          onRetryVehicleTypeOptions={retryVehicleTypeOptions}
          onUpdated={handleFarePriceUpdated}
          routeOptions={routeOptions}
          vehicleTypeOptions={vehicleTypeOptions}
        />
      )}
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
