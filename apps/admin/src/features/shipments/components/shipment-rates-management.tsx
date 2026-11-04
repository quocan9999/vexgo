'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Info,
  Package,
  Ticket,
} from 'lucide-react';
import { toast } from 'sonner';
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
import {
  formatWeightBand,
  ShipmentRateDetailSheet,
} from './shipment-rate-detail-sheet';
import { ShipmentRateFormDialog } from './shipment-rate-form-dialog';

const STATUS_LABELS: Record<ShipmentRateStatus, string> = {
  HOAT_DONG: 'Đang hoạt động',
  TAM_NGUNG: 'Tạm ngưng',
};

const EFFECTIVE_LABELS: Record<ShipmentRateEffectiveState, string> = {
  CHUA_DEN_NGAY: 'Chưa đến ngày',
  DANG_HIEU_LUC: 'Đang hiệu lực',
  HET_HIEU_LUC: 'Hết hiệu lực',
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
  const [selectedRate, setSelectedRate] = useState<ShipmentRate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShipmentRate | null>(null);

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
            : 'Không thể tải danh mục tuyến xe và loại hàng hóa.';
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

  const handleOpenDetail = useCallback((item: ShipmentRate) => {
    setSelectedRate(item);
    setDetailOpen(true);
  }, []);

  const handleOpenEdit = useCallback(
    (item: ShipmentRate) => {
      if (!canUpdate) return;
      setDetailOpen(false);
      setEditingRate(item);
      setFormMode('edit');
      setFormOpen(true);
    },
    [canUpdate],
  );

  const handleRateSaved = useCallback(
    (saved: ShipmentRate, message: string) => {
      setFormOpen(false);
      setEditingRate(null);
      setSelectedRate((current) =>
        current?.rateId === saved.rateId ? saved : current,
      );
      toast.success(message);
      refresh();
    },
    [refresh],
  );

  const handleRateChanged = useCallback(
    (updated: ShipmentRate, message?: string) => {
      setSelectedRate(updated);
      if (message) {
        toast.success(message);
        refresh();
      }
    },
    [refresh],
  );

  const handleDetailMissing = useCallback(
    (message: string) => {
      setDetailOpen(false);
      setSelectedRate(null);
      toast.error(message);
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
    <SuperAdminLayout activeSection="shipments">
      <div className="admin-page-content admin-ui space-y-6">
        <nav
          aria-label="Chuyển đổi loại bảng giá"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3"
        >
          <div className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/50 p-1">
            <Link
              href="/fare-prices"
              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Ticket className="size-4" />
              Bảng giá vé hành khách
            </Link>
            <Link
              href="/shipments/rates"
              aria-current="page"
              className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-semibold text-foreground shadow-xs"
            >
              <Package className="size-4 text-primary" />
              Bảng giá cước gửi hàng
            </Link>
          </div>

          <Link
            href="/shipments"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Về danh sách vận đơn
          </Link>
        </nav>

        <div>
          <AdminPageHeader
            eyebrow="CẤU HÌNH CƯỚC VẬN CHUYỂN"
            title="Quản lý bảng giá cước gửi hàng"
            titleId="shipment-rates-title"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <ResourceRefreshAction loading={loading} onClick={refresh} />
                {canCreate && (
                  <ResourceCreateAction
                    label="Thêm mức cước"
                    onClick={handleOpenCreate}
                  />
                )}
              </div>
            }
          />
          <p className="mt-2 text-[13px] text-muted-foreground">
            Thiết lập đơn giá gửi hàng theo tuyến xe, loại hàng hóa, nấc khối
            lượng và thời gian hiệu lực.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <Info className="size-4 shrink-0 text-primary" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium">
              Quy tắc cộng phụ phí cố định khi tạo đơn:
            </span>
            <span>
              Hàng dễ vỡ:{' '}
              <strong className="font-semibold text-primary">+20.000 ₫</strong>
            </span>
            <span>
              Hàng có giá trị cao:{' '}
              <strong className="font-semibold text-primary">+50.000 ₫</strong>
            </span>
          </div>
        </div>

        <section
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
          aria-labelledby="shipment-rates-table-heading"
        >
          <h2 id="shipment-rates-table-heading" className="sr-only">
            Danh sách mức cước gửi hàng
          </h2>

          <FilterToolbar>
            <SearchInput
              label="Tìm mức cước gửi hàng"
              value={searchInput}
              onChange={updateSearch}
              placeholder="Mã tuyến, điểm đi, điểm đến, loại hàng..."
            />

            <SelectFilter
              label="Lọc theo tuyến xe"
              value={routeId}
              allLabel="Tất cả tuyến"
              options={toFilterOptions(filterOptions.routes)}
              onChange={updateRoute}
            />

            <SelectFilter
              label="Lọc theo loại hàng"
              value={cargoTypeId}
              allLabel="Tất cả loại hàng"
              options={toFilterOptions(filterOptions.cargoTypes)}
              onChange={updateCargoType}
            />

            <SelectFilter
              label="Lọc theo trạng thái"
              value={status}
              allLabel="Tất cả trạng thái"
              options={STATUS_OPTIONS}
              onChange={(value) =>
                updateStatus(value as ShipmentRateStatus | '')
              }
            />

            <SelectFilter
              label="Lọc theo tình trạng hiệu lực"
              value={effectiveState}
              allLabel="Tất cả hiệu lực"
              options={EFFECTIVE_OPTIONS}
              onChange={(value) =>
                updateEffectiveState(value as ShipmentRateEffectiveState | '')
              }
            />
          </FilterToolbar>

          {error && (
            <ResourceState error>
              <p>{error}</p>
              <Button type="button" variant="outline" onClick={refresh}>
                Thử lại
              </Button>
            </ResourceState>
          )}

          {loading && !ratePage ? (
            <ResourceTableSkeleton resourceLabel="bảng giá cước gửi hàng" />
          ) : rates.length === 0 ? (
            error ? null : (
              <ResourceState>
                <p>
                  {isFiltered
                    ? 'Không tìm thấy mức cước gửi hàng phù hợp.'
                    : 'Chưa có mức cước gửi hàng nào được cấu hình.'}
                </p>
                {isFiltered ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetFilters}
                  >
                    Đặt lại bộ lọc
                  </Button>
                ) : (
                  canCreate && (
                    <ResourceCreateAction
                      label="Thêm mức cước đầu tiên"
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
                    Danh sách mức cước gửi hàng theo tuyến và loại hàng
                  </caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Mã tuyến</TableHead>
                      <TableHead scope="col">Hành trình</TableHead>
                      <TableHead scope="col">Loại hàng</TableHead>
                      <TableHead
                        scope="col"
                        aria-sort={getAriaSort(
                          sortBy,
                          sortDirection,
                          'weightFrom',
                        )}
                      >
                        {renderSortButton('weightFrom', 'Nấc khối lượng')}
                      </TableHead>
                      <TableHead
                        scope="col"
                        aria-sort={getAriaSort(sortBy, sortDirection, 'fee')}
                      >
                        {renderSortButton('fee', 'Mức cước')}
                      </TableHead>
                      <TableHead
                        scope="col"
                        aria-sort={getAriaSort(
                          sortBy,
                          sortDirection,
                          'validFrom',
                        )}
                      >
                        {renderSortButton('validFrom', 'Từ ngày')}
                      </TableHead>
                      <TableHead
                        scope="col"
                        aria-sort={getAriaSort(
                          sortBy,
                          sortDirection,
                          'validTo',
                        )}
                      >
                        {renderSortButton('validTo', 'Đến ngày')}
                      </TableHead>
                      <TableHead
                        scope="col"
                        aria-sort={getAriaSort(sortBy, sortDirection, 'status')}
                      >
                        {renderSortButton('status', 'Trạng thái')}
                      </TableHead>
                      <TableHead scope="col">Hiệu lực</TableHead>
                      <TableHead scope="col">
                        <span className="sr-only">Thao tác</span>
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
                            : 'Không giới hạn'}
                        </TableCell>
                        <TableCell>
                          <ResourceStatusBadge
                            tone={
                              item.status === 'HOAT_DONG' ? 'active' : 'muted'
                            }
                          >
                            {STATUS_LABELS[item.status]}
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
                            {EFFECTIVE_LABELS[item.effectiveState]}
                          </ResourceStatusBadge>
                        </TableCell>
                        <TableCell>
                          <ResourceDetailAction
                            resourceName={item.route.code}
                            onClick={() => handleOpenDetail(item)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div
                className="grid gap-3 p-3 md:hidden"
                aria-label="Danh sách mức cước gửi hàng dạng thẻ"
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
                        resourceName={item.route.code}
                        onClick={() => handleOpenDetail(item)}
                      />
                    </div>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatVnd(item.fee)}
                    </p>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Loại hàng</dt>
                        <dd className="font-medium">{item.cargoType.name}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          Nấc khối lượng
                        </dt>
                        <dd className="font-medium">
                          {formatWeightBand(item.weightFrom, item.weightTo)}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Hiệu lực</dt>
                        <dd>
                          {formatDateOnly(item.validFrom)} →{' '}
                          {item.validTo
                            ? formatDateOnly(item.validTo)
                            : 'Không giới hạn'}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      <ResourceStatusBadge
                        tone={item.status === 'HOAT_DONG' ? 'active' : 'muted'}
                      >
                        {STATUS_LABELS[item.status]}
                      </ResourceStatusBadge>
                      <ResourceStatusBadge
                        tone={
                          item.effectiveState === 'DANG_HIEU_LUC'
                            ? 'active'
                            : 'muted'
                        }
                      >
                        {EFFECTIVE_LABELS[item.effectiveState]}
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
            summaryLabel="mức cước"
            onPageChange={changePage}
          />
        </section>

        <ShipmentRateDetailSheet
          open={detailOpen}
          rate={selectedRate}
          canEdit={canUpdate}
          onClose={() => setDetailOpen(false)}
          onEdit={handleOpenEdit}
          onChanged={handleRateChanged}
          onMissing={handleDetailMissing}
        />

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
