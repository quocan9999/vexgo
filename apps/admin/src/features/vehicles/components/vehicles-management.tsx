'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  Plus,
  RefreshCw,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  getVehicleById,
  updateVehicleStatus,
} from '../services/vehicle-service';
import {
  VEHICLE_STATUSES,
  type VehicleDetail,
  type VehicleFilterOption,
  type VehicleListItem,
  type VehicleSortKey,
  type VehicleStatus,
} from '../types/vehicle';
import { useVehicleFilterOptions } from '../hooks/use-vehicle-filter-options';
import { useVehicles } from '../hooks/use-vehicles';
import { VehicleFormDialog } from './vehicle-form-dialog';
import '../vehicles.css';

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
  return status === 'HOAT_DONG' ? 'active' : 'muted';
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

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; vehicle: VehicleDetail };

function VehicleDetails({
  vehicleId,
  options,
  onClose,
  onUpdated,
}: {
  vehicleId: number;
  options: ReturnType<typeof useVehicleFilterOptions>;
  onClose: () => void;
  onUpdated: (action: 'edit' | 'status', vehicle: VehicleDetail) => void;
}) {
  const statusSubmittingRef = useRef(false);
  const [detailState, setDetailState] = useState<DetailState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    getVehicleById(vehicleId, controller.signal)
      .then((vehicle) => {
        if (current) setDetailState({ status: 'success', vehicle });
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setDetailState({
            status: 'error',
            message:
              error instanceof TypeError
                ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
                : error instanceof Error
                  ? error.message
                  : 'Không thể tải thông tin xe.',
          });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [retryCount, vehicleId]);

  function retry() {
    setDetailState({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  function handleVehicleSaved(vehicle: VehicleDetail) {
    setDetailState({ status: 'success', vehicle });
    setEditDialogOpen(false);
    setUpdateNotice(`Đã cập nhật xe ${vehicle.licensePlate}.`);
    onUpdated('edit', vehicle);
  }

  async function confirmStatusChange() {
    if (
      detailState.status !== 'success' ||
      !nextStatus ||
      statusSubmittingRef.current
    ) {
      return;
    }

    statusSubmittingRef.current = true;
    setStatusSubmitting(true);
    setStatusError(null);

    try {
      const updatedVehicle = await updateVehicleStatus(vehicleId, nextStatus);
      setDetailState({ status: 'success', vehicle: updatedVehicle });
      setUpdateNotice(
        `Đã chuyển xe ${updatedVehicle.licensePlate} sang trạng thái ${statusLabel(updatedVehicle.status)}.`,
      );
      setStatusDialogOpen(false);
      onUpdated('status', updatedVehicle);
    } catch (requestError: unknown) {
      setStatusError(
        requestError instanceof TypeError
          ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
          : requestError instanceof Error
            ? requestError.message
            : 'Không thể cập nhật trạng thái xe. Vui lòng thử lại.',
      );
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  const nextStatus: VehicleStatus | null =
    detailState.status === 'success'
      ? detailState.vehicle.status === 'HOAT_DONG'
        ? 'BAO_TRI'
        : 'HOAT_DONG'
      : null;

  return (
    <>
      <AdminDetailSheet
        ariaBusy={detailState.status === 'loading'}
        ariaDescribedBy="vehicle-detail-description"
        ariaLabelledBy="vehicle-detail-title"
        onClose={onClose}
      >
        <div className="admin-dialog-header">
          <div className="admin-dialog-header__copy">
            <p className="eyebrow">QUẢN LÝ PHƯƠNG TIỆN</p>
            <h2 id="vehicle-detail-title">Chi tiết xe</h2>
            <p id="vehicle-detail-description">
              Thông tin xe và các danh mục liên kết.
            </p>
          </div>
          <form method="dialog">
            <Button
              aria-label="Đóng chi tiết xe"
              className="vehicle-detail-close"
              type="submit"
              variant="secondary"
            >
              <X aria-hidden="true" size={17} />
            </Button>
          </form>
        </div>

        {detailState.status === 'loading' && (
          <p className="vehicles-state" role="status">
            <LoaderCircle
              aria-hidden="true"
              className="vehicles-spinner"
              size={17}
            />
            Đang tải thông tin xe…
          </p>
        )}

        {detailState.status === 'error' && (
          <div className="vehicles-state" role="alert">
            <p>{detailState.message}</p>
            <Button onClick={retry} type="button" variant="secondary">
              Thử lại
            </Button>
          </div>
        )}

        {detailState.status === 'success' && (
          <div className="vehicle-detail-content">
            {updateNotice && (
              <div className="vehicles-success-notice" role="status">
                <CheckCircle2 aria-hidden="true" size={16} />
                <span>{updateNotice}</span>
              </div>
            )}
            <div className="vehicle-detail-hero">
              <span className="vehicle-detail-mark" aria-hidden="true">
                <Truck size={21} />
              </span>
              <div>
                <h3>{detailState.vehicle.licensePlate}</h3>
                <p>Xe #{detailState.vehicle.vehicleId}</p>
              </div>
              <AdminStatusBadge tone={statusTone(detailState.vehicle.status)}>
                {statusLabel(detailState.vehicle.status)}
              </AdminStatusBadge>
            </div>

            <section
              aria-labelledby="vehicle-detail-company-heading"
              className="vehicle-detail-section"
            >
              <h3 id="vehicle-detail-company-heading">Đơn vị và loại xe</h3>
              <dl className="vehicle-detail-fields">
                <div>
                  <dt>Nhà xe</dt>
                  <dd>{detailState.vehicle.busCompany.name}</dd>
                </div>
                <div>
                  <dt>Mã nhà xe</dt>
                  <dd>{detailState.vehicle.busCompany.code}</dd>
                </div>
                <div>
                  <dt>Loại xe</dt>
                  <dd>{detailState.vehicle.vehicleType.name}</dd>
                </div>
                <div>
                  <dt>Mô tả loại xe</dt>
                  <dd>
                    {detailState.vehicle.vehicleType.description ||
                      'Chưa có mô tả'}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="vehicle-detail-record-heading"
              className="vehicle-detail-section"
            >
              <h3 id="vehicle-detail-record-heading">Thông tin hồ sơ</h3>
              <dl className="vehicle-detail-fields">
                <div>
                  <dt>Ngày tạo</dt>
                  <dd>{timestampFormat(detailState.vehicle.createdAt)}</dd>
                </div>
                <div>
                  <dt>Cập nhật lần cuối</dt>
                  <dd>{timestampFormat(detailState.vehicle.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            <div className="vehicle-detail-actions">
              <Button
                onClick={() => {
                  setStatusError(null);
                  setStatusDialogOpen(true);
                }}
                type="button"
                variant="secondary"
              >
                {detailState.vehicle.status === 'HOAT_DONG'
                  ? 'Chuyển sang bảo trì'
                  : 'Đưa vào hoạt động'}
              </Button>
              <Button onClick={() => setEditDialogOpen(true)} type="button">
                Chỉnh sửa
              </Button>
            </div>
          </div>
        )}
      </AdminDetailSheet>
      {editDialogOpen && detailState.status === 'success' && (
        <VehicleFormDialog
          busCompanies={options.busCompanies}
          onClose={() => setEditDialogOpen(false)}
          onRetryOptions={options.retry}
          onSaved={handleVehicleSaved}
          vehicle={detailState.vehicle}
          vehicleTypes={options.vehicleTypes}
        />
      )}
      {statusDialogOpen && detailState.status === 'success' && nextStatus && (
        <AdminConfirmDialog
          ariaBusy={statusSubmitting}
          ariaDescribedBy="vehicle-status-confirmation-description"
          ariaLabelledBy="vehicle-status-confirmation-title"
          onClose={() => setStatusDialogOpen(false)}
          preventDismiss={statusSubmitting}
        >
          <>
            <h2 id="vehicle-status-confirmation-title">
              {nextStatus === 'BAO_TRI'
                ? 'Chuyển xe sang bảo trì?'
                : 'Đưa xe vào hoạt động?'}
            </h2>
            <p id="vehicle-status-confirmation-description">
              {nextStatus === 'BAO_TRI'
                ? 'Xe sẽ được chuyển sang trạng thái Bảo trì. Thao tác này không xóa dữ liệu và có thể đưa xe hoạt động lại sau.'
                : 'Xe sẽ được chuyển sang trạng thái Đang hoạt động.'}
            </p>
            {statusError && (
              <p className="admin-confirm-dialog__error" role="alert">
                {statusError}
              </p>
            )}
            <div className="admin-confirm-dialog__actions">
              <Button
                disabled={statusSubmitting}
                onClick={() => setStatusDialogOpen(false)}
                type="button"
                variant="secondary"
              >
                Hủy
              </Button>
              <Button
                disabled={statusSubmitting}
                onClick={confirmStatusChange}
                type="button"
              >
                {statusSubmitting && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="vehicles-spinner"
                    size={15}
                  />
                )}
                {statusSubmitting
                  ? 'Đang cập nhật…'
                  : nextStatus === 'BAO_TRI'
                    ? 'Chuyển sang bảo trì'
                    : 'Đưa vào hoạt động'}
              </Button>
            </div>
          </>
        </AdminConfirmDialog>
      )}
    </>
  );
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
    <AdminStatusBadge tone={statusTone(vehicle.status)}>
      {statusLabel(vehicle.status)}
    </AdminStatusBadge>
  );
}

export function VehiclesManagement() {
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
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null,
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const items = vehiclePage?.data ?? [];
  const hasActiveFilters = Boolean(
    filters.busCompanyId || filters.vehicleTypeId || filters.status,
  );
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
      <button
        aria-label={`Sắp xếp theo ${label}`}
        className="vehicles-sort-button"
        onClick={() => sortVehicles(field)}
        type="button"
      >
        {label}
        {sortIcon(field, sortBy, sortDirection)}
      </button>
    );
  }

  function detailButton(vehicle: VehicleListItem) {
    return (
      <Button
        aria-label={`Xem chi tiết xe ${vehicle.licensePlate}`}
        onClick={() => setSelectedVehicleId(vehicle.vehicleId)}
        type="button"
        variant="secondary"
      >
        Xem chi tiết <ChevronRight aria-hidden="true" size={15} />
      </Button>
    );
  }

  return (
    <SuperAdminLayout activeSection="vehicles">
      <div className="admin-page-content vehicles-page">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              <Button onClick={() => setCreateDialogOpen(true)} type="button">
                <Plus aria-hidden="true" size={16} />
                Thêm xe
              </Button>
              <Button
                disabled={loading}
                onClick={refresh}
                type="button"
                variant="secondary"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={loading ? 'vehicles-spinner' : undefined}
                  size={15}
                />
                Làm mới
              </Button>
            </div>
          }
          eyebrow="QUẢN LÝ PHƯƠNG TIỆN"
          title="Danh sách xe"
          titleId="vehicles-title"
        />

        {successNotice && (
          <div className="vehicles-success-notice" role="status">
            <CheckCircle2 aria-hidden="true" size={16} />
            <span>{successNotice}</span>
          </div>
        )}

        <section
          aria-busy={loading}
          aria-labelledby="vehicles-title"
          className="vehicles-section"
        >
          <div className="panel vehicles-panel">
            <FilterToolbar summary="Tìm kiếm, lọc và sắp xếp xe">
              <SearchInput
                label="Tìm biển số, nhà xe hoặc loại xe"
                onChange={updateSearch}
                placeholder="Tìm biển số, nhà xe, loại xe..."
                value={searchInput}
              />
              {options.busCompanies.status === 'success' && (
                <SelectFilter
                  label="Nhà xe"
                  onChange={(value) => updateFilters({ busCompanyId: value })}
                  options={filterOptions(options.busCompanies.options)}
                  value={filters.busCompanyId}
                />
              )}
              {options.vehicleTypes.status === 'success' && (
                <SelectFilter
                  label="Loại xe"
                  onChange={(value) => updateFilters({ vehicleTypeId: value })}
                  options={filterOptions(options.vehicleTypes.options)}
                  value={filters.vehicleTypeId}
                />
              )}
              <SelectFilter
                label="Trạng thái xe"
                onChange={(value) =>
                  updateFilters({ status: value as VehicleStatus | '' })
                }
                options={VEHICLE_STATUS_OPTIONS}
                value={filters.status}
              />
            </FilterToolbar>

            <div className="vehicles-mobile-sort">
              <SelectFilter
                allLabel="Biển số xe (mặc định)"
                label="Sắp xếp xe theo"
                onChange={(value) =>
                  sortVehicles((value || 'licensePlate') as VehicleSortKey)
                }
                options={VEHICLE_MOBILE_SORT_OPTIONS}
                value={sortBy === 'licensePlate' ? '' : sortBy}
              />
              <Button
                aria-label={`Đổi thứ tự sắp xếp, hiện tại ${sortDirection === 'asc' ? 'tăng dần' : 'giảm dần'}`}
                onClick={() => sortVehicles(sortBy)}
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

            {(options.busCompanies.status === 'loading' ||
              options.vehicleTypes.status === 'loading') && (
              <p className="vehicles-option-loading" role="status">
                Đang tải tùy chọn bộ lọc…
              </p>
            )}

            {optionErrors.length > 0 && (
              <div className="vehicles-filter-notice" role="alert">
                <div>
                  <strong>Một số bộ lọc chưa khả dụng</strong>
                  <p>{optionErrors.join(' ')}</p>
                </div>
                <Button
                  onClick={options.retry}
                  type="button"
                  variant="secondary"
                >
                  Thử tải lại bộ lọc
                </Button>
              </div>
            )}

            {loading && (
              <p className="vehicles-loading" role="status">
                <LoaderCircle
                  aria-hidden="true"
                  className="vehicles-spinner"
                  size={15}
                />
                {vehiclePage
                  ? 'Đang cập nhật danh sách xe…'
                  : 'Đang tải danh sách xe…'}
              </p>
            )}

            {error && (
              <div className="vehicles-state" role="alert">
                <p>{error}</p>
                <Button onClick={retry} type="button" variant="secondary">
                  Thử lại
                </Button>
              </div>
            )}

            {!error && vehiclePage && items.length === 0 && !loading && (
              <p className="vehicles-state" role="status">
                {searchInput.trim() || hasActiveFilters
                  ? 'Không tìm thấy xe phù hợp với tìm kiếm hoặc bộ lọc.'
                  : 'Chưa có xe trong hệ thống.'}
              </p>
            )}

            {!error && vehiclePage && (
              <>
                {items.length > 0 && (
                  <>
                    <div className="vehicles-table-wrap">
                      <table className="vehicles-table">
                        <caption className="sr-only">Danh sách xe</caption>
                        <thead>
                          <tr>
                            <th
                              aria-sort={
                                sortBy === 'licensePlate'
                                  ? sortDirection === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                  : 'none'
                              }
                              scope="col"
                            >
                              {sortButton('Biển số xe', 'licensePlate')}
                            </th>
                            <th scope="col">Nhà xe</th>
                            <th scope="col">Loại xe</th>
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
                            <th
                              aria-sort={
                                sortBy === 'createdAt'
                                  ? sortDirection === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                  : 'none'
                              }
                              scope="col"
                            >
                              {sortButton('Ngày tạo', 'createdAt')}
                            </th>
                            <th
                              aria-sort={
                                sortBy === 'updatedAt'
                                  ? sortDirection === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                  : 'none'
                              }
                              scope="col"
                            >
                              {sortButton('Cập nhật', 'updatedAt')}
                            </th>
                            <th scope="col">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((vehicle) => (
                            <tr key={vehicle.vehicleId}>
                              <th scope="row">{vehicle.licensePlate}</th>
                              <td>
                                <span className="vehicle-company-name">
                                  {vehicle.busCompany.name}
                                </span>
                                <span className="vehicle-company-code">
                                  {vehicle.busCompany.code}
                                </span>
                              </td>
                              <td>{vehicle.vehicleType.name}</td>
                              <td>{vehicleStatusBadge(vehicle)}</td>
                              <td>{timestampFormat(vehicle.createdAt)}</td>
                              <td>{timestampFormat(vehicle.updatedAt)}</td>
                              <td>{detailButton(vehicle)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="vehicles-mobile-list">
                      {items.map((vehicle) => (
                        <article
                          className="vehicle-mobile-card"
                          key={vehicle.vehicleId}
                        >
                          <div className="vehicle-mobile-heading">
                            <div>
                              <h2>{vehicle.licensePlate}</h2>
                              <span>Xe #{vehicle.vehicleId}</span>
                            </div>
                            {vehicleStatusBadge(vehicle)}
                          </div>
                          <dl className="vehicle-mobile-fields">
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
                          <div className="vehicle-mobile-actions">
                            {detailButton(vehicle)}
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}

                <AdminPagination
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
          </div>
        </section>
      </div>

      {selectedVehicleId !== null && (
        <VehicleDetails
          key={selectedVehicleId}
          onUpdated={(action, vehicle) => {
            setSuccessNotice(
              action === 'edit'
                ? `Đã cập nhật xe ${vehicle.licensePlate}.`
                : `Đã chuyển xe ${vehicle.licensePlate} sang trạng thái ${statusLabel(vehicle.status)}.`,
            );
            refresh();
          }}
          onClose={() => setSelectedVehicleId(null)}
          options={options}
          vehicleId={selectedVehicleId}
        />
      )}
      {createDialogOpen && (
        <VehicleFormDialog
          busCompanies={options.busCompanies}
          onClose={() => setCreateDialogOpen(false)}
          onRetryOptions={options.retry}
          onSaved={(vehicle) => {
            setCreateDialogOpen(false);
            setSuccessNotice(`Đã thêm xe ${vehicle.licensePlate}.`);
            refresh();
          }}
          vehicleTypes={options.vehicleTypes}
        />
      )}
    </SuperAdminLayout>
  );
}
