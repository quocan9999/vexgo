'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Search } from 'lucide-react';
import {
  AdminDetailAction,
} from '@/components/admin/admin-detail-action';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminCreateAction, AdminRefreshAction } from '@/components/admin/admin-page-actions';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
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
import styles from '../fare-prices.module.css';

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

type FarePriceNotice = { tone: 'success' | 'error'; message: string };

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
  }).format(new Date(`${value}T00:00:00.000Z`));
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
  const [selectedFarePriceId, setSelectedFarePriceId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [notice, setNotice] = useState<FarePriceNotice | null>(null);
  const [routeOptions, setRouteOptions] = useState<FarePriceOptionsState>({ status: 'loading' });
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<FarePriceOptionsState>({ status: 'loading' });
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
    setNotice(null);
    setCreateDialogOpen(true);
  }

  function handleFarePriceCreated(farePrice: FarePrice) {
    setCreateDialogOpen(false);
    setNotice({ tone: 'success', message: `Đã tạo bảng giá vé ${farePrice.route.code}.` });
    refresh();
  }

  function handleFarePriceUpdated(farePrice: FarePrice) {
    setNotice({ tone: 'success', message: `Đã cập nhật bảng giá vé ${farePrice.route.code}.` });
    refresh();
  }

  function handleFarePriceNotFound() {
    setSelectedFarePriceId(null);
    setNotice({ tone: 'error', message: 'Bảng giá không còn tồn tại. Danh sách đã được làm mới.' });
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
    const selected = sortBy === field;
    return (
      <button
        aria-label={`Sắp xếp theo ${label}`}
        className="admin-resource-sort-button"
        onClick={() => sortFarePrices(field)}
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

  function tableHeader(label: string, field?: FarePriceSortKey) {
    const selected = field !== undefined && sortBy === field;
    return (
      <th
        aria-sort={
          selected
            ? sortDirection === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
        scope="col"
      >
        {field ? sortButton(label, field) : label}
      </th>
    );
  }

  function fareStatus(farePrice: FarePrice) {
    return (
      <AdminStatusBadge tone={statusTone(farePrice.status)}>
        {statusLabel(farePrice.status)}
      </AdminStatusBadge>
    );
  }

  function effectiveStateBadge(farePrice: FarePrice) {
    return (
      <AdminStatusBadge tone={stateTone(farePrice.effectiveState)}>
        {EFFECTIVE_STATE_LABELS[farePrice.effectiveState]}
      </AdminStatusBadge>
    );
  }

  return (
    <SuperAdminLayout activeSection="fare-prices">
      <div className="admin-page-content">
        <AdminPageHeader
          actions={
            <div className={`page-intro-actions ${styles.pageActions}`}>
              <AdminCreateAction label="Thêm bảng giá" onClick={openCreateDialog} />
              <AdminRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title="Quản lý bảng giá vé"
          titleId="fare-prices-title"
        />
        <p className={styles.description}>
          Theo dõi giá vé theo tuyến, loại xe và thời gian hiệu lực.
        </p>
        <section
          aria-busy={loading}
          aria-labelledby="fare-prices-title"
          className="panel admin-resource-panel"
        >
          {notice && (
            <p
              className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice}
              role={notice.tone === 'success' ? 'status' : 'alert'}
            >
              {notice.tone === 'success' && <CheckCircle2 aria-hidden="true" size={16} />}
              <span>{notice.message}</span>
            </p>
          )}
          <FilterToolbar totalItems={error ? null : farePricePage?.meta.totalItems ?? null}>
            <SearchInput
              label="Tìm bảng giá"
              onChange={updateSearch}
              placeholder="Tìm theo tuyến hoặc loại xe..."
              value={searchInput}
            />
            {routeOptions.status === 'success' && (
              <SelectFilter
                allLabel="Tất cả tuyến xe"
                label="Lọc theo tuyến xe"
                onChange={updateRoute}
                options={optionFilters(routeOptions.options)}
                value={routeId}
              />
            )}
            {vehicleTypeOptions.status === 'success' && (
              <SelectFilter
                allLabel="Tất cả loại xe"
                label="Lọc theo loại xe"
                onChange={updateVehicleType}
                options={optionFilters(vehicleTypeOptions.options)}
                value={vehicleTypeId}
              />
            )}
            <SelectFilter
              allLabel="Tất cả trạng thái"
              label="Lọc theo trạng thái"
              onChange={updateStatus}
              options={STATUS_OPTIONS}
              value={status}
            />
            <SelectFilter
              allLabel="Tất cả hiệu lực"
              label="Lọc theo hiệu lực"
              onChange={updateEffectiveState}
              options={EFFECTIVE_STATE_OPTIONS}
              value={effectiveState}
            />
          </FilterToolbar>

          {(routeOptions.status === 'loading' || vehicleTypeOptions.status === 'loading') && (
            <p className={styles.optionState} role="status">
              Đang tải bộ lọc tuyến xe và loại xe…
            </p>
          )}
          {(routeOptions.status === 'error' || vehicleTypeOptions.status === 'error') && (
            <div className={styles.optionError} role="alert">
              <span>Không thể tải bộ lọc tuyến xe hoặc loại xe.</span>
              {routeOptions.status === 'error' && (
                <Button
                  onClick={retryRouteOptions}
                  type="button"
                  variant="secondary"
                >
                  Thử tải lại tuyến xe
                </Button>
              )}
              {vehicleTypeOptions.status === 'error' && (
                <Button
                  onClick={retryVehicleTypeOptions}
                  type="button"
                  variant="secondary"
                >
                  Thử tải lại loại xe
                </Button>
              )}
            </div>
          )}

          {loading && !farePricePage && (
            <AdminTableSkeleton resourceLabel="bảng giá" />
          )}
          {error && (
            <div className={styles.listError} role="alert">
              <p>{error}</p>
              <Button onClick={refresh} type="button" variant="secondary">
                Thử lại
              </Button>
            </div>
          )}
          {!loading && !error && farePricePage && items.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <Search aria-hidden="true" size={21} />
              </span>
              <h2>{hasFilters ? 'Không tìm thấy bảng giá phù hợp với bộ lọc.' : 'Chưa có bảng giá nào.'}</h2>
              {hasFilters && (
                <Button onClick={resetFilters} type="button" variant="secondary">
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          )}
          {farePricePage && items.length > 0 && (
            <>
              <div
                aria-busy={loading}
                className={`admin-resource-table-wrap${loading ? ' is-loading' : ''}`}
              >
                <table className="admin-resource-table">
                  <thead>
                    <tr>
                      {tableHeader('Tuyến')}
                      {tableHeader('Loại xe')}
                      {tableHeader('Giá niêm yết', 'listedPrice')}
                      {tableHeader('Hiệu lực từ', 'validFrom')}
                      {tableHeader('Hiệu lực đến', 'validTo')}
                      {tableHeader('Trạng thái', 'status')}
                      {tableHeader('Hiệu lực hiện tại')}
                      {tableHeader('Thao tác')}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((farePrice) => (
                      <tr key={farePrice.farePriceId}>
                        <th scope="row">
                          <span className={styles.routeEndpoints}>
                            {farePrice.route.origin} → {farePrice.route.destination}
                          </span>
                          <small className={styles.routeCode}>{farePrice.route.code}</small>
                        </th>
                        <td>{farePrice.vehicleType.name}</td>
                        <td>{formatPrice(farePrice.listedPrice)}</td>
                        <td>{formatDateOnly(farePrice.validFrom)}</td>
                        <td>{formatDateOnly(farePrice.validTo)}</td>
                        <td>{fareStatus(farePrice)}</td>
                        <td>{effectiveStateBadge(farePrice)}</td>
                        <td>
                          <AdminDetailAction
                            onClick={() => openDetails(farePrice)}
                            resourceName={farePrice.route.code}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul aria-label="Danh sách bảng giá dạng thẻ" className={styles.mobileCards}>
                {items.map((farePrice) => (
                  <li className={styles.mobileCard} key={farePrice.farePriceId}>
                    <div className={styles.mobileCardHeader}>
                      <div>
                        <h2>{farePrice.route.origin} → {farePrice.route.destination}</h2>
                        <span className={styles.routeCode}>{farePrice.route.code}</span>
                      </div>
                      <strong>{formatPrice(farePrice.listedPrice)}</strong>
                    </div>
                    <dl className={styles.mobileCardDetails}>
                      <div><dt>Loại xe</dt><dd>{farePrice.vehicleType.name}</dd></div>
                      <div><dt>Hiệu lực</dt><dd>{formatDateOnly(farePrice.validFrom)} – {formatDateOnly(farePrice.validTo)}</dd></div>
                      <div><dt>Trạng thái</dt><dd>{fareStatus(farePrice)}</dd></div>
                      <div><dt>Hiệu lực hiện tại</dt><dd>{effectiveStateBadge(farePrice)}</dd></div>
                    </dl>
                    <AdminDetailAction
                      onClick={() => openDetails(farePrice)}
                      resourceName={farePrice.route.code}
                    />
                  </li>
                ))}
              </ul>
              <AdminPagination
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
      {createDialogOpen && (
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
