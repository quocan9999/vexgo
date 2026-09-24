'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bus,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/data-filters';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useVehicleFilterOptions } from '../hooks/use-vehicle-filter-options';
import { useVehicles } from '../hooks/use-vehicles';
import {
  VEHICLE_STATUS_OPTIONS,
  type SortDirection,
  type VehicleListItem,
  type VehicleSortKey,
  type VehicleStatus,
} from '../types/vehicle';
import { VehicleDetailDialog } from './vehicle-detail-dialog';
import { CreateVehicleDialog } from './create-vehicle-dialog';
import '../vehicles.css';

const PAGE_SIZE = 10;
const VEHICLE_STATUS_FILTERS: FilterOption[] = VEHICLE_STATUS_OPTIONS;
const VEHICLE_SORT_OPTIONS: FilterOption[] = [
  { value: 'licensePlate', label: 'Biển số xe' },
  { value: 'status', label: 'Trạng thái' },
  { value: 'createdAt', label: 'Ngày tạo' },
  { value: 'updatedAt', label: 'Cập nhật lần cuối' },
];
const SORT_DIRECTION_OPTIONS: FilterOption[] = [
  { value: 'asc', label: 'Tăng dần' },
  { value: 'desc', label: 'Giảm dần' },
];

function numberFormat(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function timestampFormat(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(status: VehicleStatus) {
  return (
    VEHICLE_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    'Không xác định'
  );
}

function optionalId(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647
    ? parsed
    : undefined;
}

function SortButton({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: SortDirection;
  label: string;
  onClick: () => void;
}) {
  const Icon = active
    ? direction === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <button
      aria-label={`Sắp xếp theo ${label}`}
      className="vehicles-sort-button"
      onClick={onClick}
      type="button"
    >
      {label}
      <Icon aria-hidden="true" size={14} />
    </button>
  );
}

function VehicleCard({
  vehicle,
  onView,
}: {
  vehicle: VehicleListItem;
  onView: (vehicleId: number) => void;
}) {
  return (
    <article className="vehicles-mobile-card">
      <div className="vehicles-mobile-card-heading">
        <h3>{vehicle.licensePlate}</h3>
        <span
          className={`vehicle-status-badge${vehicle.status === 'HOAT_DONG' ? ' is-active' : ' is-maintenance'}`}
        >
          {statusLabel(vehicle.status)}
        </span>
      </div>
      <p>
        <strong>Nhà xe:</strong> {vehicle.busCompany.name} (
        {vehicle.busCompany.code})
      </p>
      <p>
        <strong>Loại xe:</strong> {vehicle.vehicleType.name}
      </p>
      <p>
        <strong>Ngày tạo:</strong> {timestampFormat(vehicle.createdAt)}
      </p>
      <p>
        <strong>Cập nhật:</strong> {timestampFormat(vehicle.updatedAt)}
      </p>
      <button
        className="vehicles-detail-button"
        onClick={() => onView(vehicle.vehicleId)}
        type="button"
      >
        <Eye aria-hidden="true" size={15} />
        Xem chi tiết
      </button>
    </article>
  );
}

export function VehiclesManagement() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VehicleStatus | ''>('');
  const [busCompanyId, setBusCompanyId] = useState<number | undefined>();
  const [vehicleTypeId, setVehicleTypeId] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState<VehicleSortKey>('licensePlate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null,
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const query = {
    page,
    pageSize: PAGE_SIZE,
    search,
    sortBy,
    sortDirection,
    ...(status ? { status } : {}),
    ...(busCompanyId !== undefined ? { busCompanyId } : {}),
    ...(vehicleTypeId !== undefined ? { vehicleTypeId } : {}),
  };
  const { state, refresh } = useVehicles(query);
  const { state: filterOptions, retry: retryFilterOptions } =
    useVehicleFilterOptions();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  function changeSort(nextSort: VehicleSortKey) {
    if (sortBy === nextSort) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(nextSort);
      setSortDirection('asc');
    }
    setPage(1);
  }

  function changeSortField(nextSort: string) {
    if (VEHICLE_SORT_OPTIONS.some((option) => option.value === nextSort)) {
      setSortBy(nextSort as VehicleSortKey);
      setSortDirection('asc');
      setPage(1);
    }
  }

  function reload() {
    setPage(1);
    refresh();
  }

  function changeStatus(nextValue: string) {
    setStatus(
      VEHICLE_STATUS_OPTIONS.some((option) => option.value === nextValue)
        ? (nextValue as VehicleStatus)
        : '',
    );
    setPage(1);
  }

  function changeBusCompany(nextValue: string) {
    setBusCompanyId(optionalId(nextValue));
    setPage(1);
  }

  function changeVehicleType(nextValue: string) {
    setVehicleTypeId(optionalId(nextValue));
    setPage(1);
  }

  const resultCount =
    state.status === 'success' ? state.result.meta.totalItems : null;
  const pageCount =
    state.status === 'success' ? Math.max(1, state.result.meta.totalPages) : 1;
  const isFilterLookupLoading =
    filterOptions.busCompanies.status === 'loading' ||
    filterOptions.vehicleTypes.status === 'loading';
  const filterLookupErrors = [
    filterOptions.busCompanies.status === 'error'
      ? `Nhà xe: ${filterOptions.busCompanies.message}`
      : null,
    filterOptions.vehicleTypes.status === 'error'
      ? `Loại xe: ${filterOptions.vehicleTypes.message}`
      : null,
  ].filter((message): message is string => Boolean(message));
  const busCompanyOptions: FilterOption[] =
    filterOptions.busCompanies.status === 'success'
      ? filterOptions.busCompanies.data.map((company) => ({
          value: String(company.busCompanyId),
          label: `${company.code} · ${company.name}`,
        }))
      : [];
  const vehicleTypeOptions: FilterOption[] =
    filterOptions.vehicleTypes.status === 'success'
      ? filterOptions.vehicleTypes.data.map((vehicleType) => ({
          value: String(vehicleType.vehicleTypeId),
          label: vehicleType.name,
        }))
      : [];
  const busCompanies =
    filterOptions.busCompanies.status === 'success'
      ? filterOptions.busCompanies.data
      : [];
  const vehicleTypes =
    filterOptions.vehicleTypes.status === 'success'
      ? filterOptions.vehicleTypes.data
      : [];
  const filterOptionsError =
    filterLookupErrors.length > 0 ? filterLookupErrors.join(' ') : null;
  const isFiltered = Boolean(
    search.trim() ||
    status ||
    busCompanyId !== undefined ||
    vehicleTypeId !== undefined,
  );

  return (
    <SuperAdminLayout activeSection="vehicles" apiMode>
      <div className="vehicles-page">
        <header className="vehicles-intro">
          <div>
            <p className="vehicles-eyebrow">QUẢN LÝ PHƯƠNG TIỆN</p>
            <h1 id="vehicles-heading">Xe</h1>
            <p>Tra cứu xe và thông tin nhà xe, loại xe đang sử dụng.</p>
          </div>
          <div className="vehicles-intro-actions">
            <button
              className="vehicles-button vehicle-form-primary"
              onClick={() => {
                setSuccessMessage(null);
                setCreateDialogOpen(true);
              }}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              Thêm xe
            </button>
            <button
              aria-label="Làm mới danh sách xe"
              className="vehicles-button vehicles-refresh-button"
              disabled={state.status === 'loading'}
              onClick={reload}
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                className={state.status === 'loading' ? 'vehicles-spinner' : ''}
                size={16}
              />
              Làm mới
            </button>
          </div>
        </header>

        {successMessage && (
          <p className="vehicles-success-message" role="status">
            {successMessage}
          </p>
        )}

        <section aria-labelledby="vehicles-list-heading">
          <h2 className="vehicles-visually-hidden" id="vehicles-list-heading">
            Danh sách xe
          </h2>
          <div
            aria-busy={state.status === 'loading'}
            className="vehicles-panel"
          >
            <FilterToolbar
              summary={
                resultCount === null
                  ? state.status === 'loading'
                    ? 'Đang tải kết quả'
                    : 'Chưa có kết quả'
                  : `${numberFormat(resultCount)} xe`
              }
            >
              <SearchInput
                label="Tìm xe"
                onChange={setSearchInput}
                placeholder="Tìm biển số, nhà xe, loại xe..."
                value={searchInput}
              />
              <SelectFilter
                allLabel="Tất cả nhà xe"
                label="Lọc theo nhà xe"
                onChange={changeBusCompany}
                options={busCompanyOptions}
                value={busCompanyId === undefined ? '' : String(busCompanyId)}
              />
              <SelectFilter
                allLabel="Tất cả loại xe"
                label="Lọc theo loại xe"
                onChange={changeVehicleType}
                options={vehicleTypeOptions}
                value={vehicleTypeId === undefined ? '' : String(vehicleTypeId)}
              />
              <SelectFilter
                allLabel="Tất cả trạng thái"
                label="Lọc theo trạng thái xe"
                onChange={changeStatus}
                options={VEHICLE_STATUS_FILTERS}
                value={status}
              />
              <div className="vehicles-mobile-sort-fields">
                <SelectFilter
                  allLabel="Biển số xe"
                  label="Sắp xếp theo"
                  onChange={changeSortField}
                  options={VEHICLE_SORT_OPTIONS}
                  value={sortBy}
                />
                <SelectFilter
                  allLabel="Tăng dần"
                  label="Chiều sắp xếp"
                  onChange={(value) => {
                    setSortDirection(value === 'desc' ? 'desc' : 'asc');
                    setPage(1);
                  }}
                  options={SORT_DIRECTION_OPTIONS}
                  value={sortDirection}
                />
              </div>
            </FilterToolbar>

            {isFilterLookupLoading && (
              <p className="vehicles-filter-status" role="status">
                Đang tải lựa chọn bộ lọc…
              </p>
            )}
            {filterLookupErrors.length > 0 && (
              <div className="vehicles-filter-error" role="alert">
                <div>
                  <strong>Một số bộ lọc chưa tải được</strong>
                  <p>{filterLookupErrors.join(' ')}</p>
                  <p>
                    Danh sách xe vẫn sử dụng được; thử tải lại bộ lọc để chọn
                    thêm.
                  </p>
                </div>
                <button
                  className="vehicles-button"
                  onClick={retryFilterOptions}
                  type="button"
                >
                  Tải lại bộ lọc
                </button>
              </div>
            )}

            {state.status === 'loading' && (
              <div className="vehicles-loading" role="status">
                <LoaderCircle
                  aria-hidden="true"
                  className="vehicles-spinner"
                  size={20}
                />
                Đang tải danh sách xe…
              </div>
            )}

            {state.status === 'error' && (
              <div className="vehicles-error" role="alert">
                <div>
                  <strong>Chưa tải được danh sách xe</strong>
                  <p>{state.message}</p>
                </div>
                <button
                  className="vehicles-button"
                  onClick={reload}
                  type="button"
                >
                  Thử lại
                </button>
              </div>
            )}

            {state.status === 'success' && state.result.data.length === 0 && (
              <div className="vehicles-empty">
                <span aria-hidden="true" className="vehicles-empty-icon">
                  <Bus size={21} />
                </span>
                <h3>
                  {state.result.meta.totalItems > 0
                    ? 'Trang hiện tại không có xe'
                    : isFiltered
                      ? 'Không tìm thấy xe phù hợp'
                      : 'Chưa có xe'}
                </h3>
                <p>
                  {state.result.meta.totalItems > 0
                    ? 'Dữ liệu có thể đã thay đổi. Tải lại để xem danh sách mới nhất.'
                    : isFiltered
                      ? 'Thử thay đổi từ khóa hoặc bộ lọc.'
                      : 'Hệ thống hiện chưa có xe để hiển thị.'}
                </p>
                {state.result.meta.totalItems > 0 && (
                  <button
                    className="vehicles-button"
                    onClick={reload}
                    type="button"
                  >
                    Tải lại danh sách
                  </button>
                )}
              </div>
            )}

            {state.status === 'success' && state.result.data.length > 0 && (
              <>
                <div className="vehicles-table-wrap">
                  <table className="vehicles-table">
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
                          <SortButton
                            active={sortBy === 'licensePlate'}
                            direction={sortDirection}
                            label="Biển số xe"
                            onClick={() => changeSort('licensePlate')}
                          />
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
                          <SortButton
                            active={sortBy === 'status'}
                            direction={sortDirection}
                            label="Trạng thái"
                            onClick={() => changeSort('status')}
                          />
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
                          <SortButton
                            active={sortBy === 'createdAt'}
                            direction={sortDirection}
                            label="Ngày tạo"
                            onClick={() => changeSort('createdAt')}
                          />
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
                          <SortButton
                            active={sortBy === 'updatedAt'}
                            direction={sortDirection}
                            label="Cập nhật lần cuối"
                            onClick={() => changeSort('updatedAt')}
                          />
                        </th>
                        <th scope="col">
                          <span className="vehicles-visually-hidden">
                            Thao tác
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.result.data.map((vehicle) => (
                        <tr key={vehicle.vehicleId}>
                          <th scope="row">{vehicle.licensePlate}</th>
                          <td>
                            <strong>{vehicle.busCompany.name}</strong>
                            <span className="vehicles-secondary-line">
                              {vehicle.busCompany.code}
                            </span>
                          </td>
                          <td>{vehicle.vehicleType.name}</td>
                          <td>
                            <span
                              className={`vehicle-status-badge${vehicle.status === 'HOAT_DONG' ? ' is-active' : ' is-maintenance'}`}
                            >
                              {statusLabel(vehicle.status)}
                            </span>
                          </td>
                          <td>{timestampFormat(vehicle.createdAt)}</td>
                          <td>{timestampFormat(vehicle.updatedAt)}</td>
                          <td>
                            <button
                              className="vehicles-detail-button"
                              onClick={() =>
                                setSelectedVehicleId(vehicle.vehicleId)
                              }
                              type="button"
                            >
                              <Eye aria-hidden="true" size={15} />
                              Xem chi tiết
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="vehicles-mobile-list">
                  {state.result.data.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.vehicleId}
                      onView={setSelectedVehicleId}
                      vehicle={vehicle}
                    />
                  ))}
                </div>
              </>
            )}

            {state.status === 'success' && (
              <footer className="vehicles-pagination">
                <span>
                  Hiển thị{' '}
                  <strong>
                    {state.result.meta.totalItems === 0
                      ? '0'
                      : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                          page * PAGE_SIZE,
                          state.result.meta.totalItems,
                        )}`}
                  </strong>{' '}
                  trong {numberFormat(state.result.meta.totalItems)} xe
                </span>
                <div className="vehicles-pagination-controls">
                  <span>
                    Trang {page} / {pageCount}
                  </span>
                  <button
                    aria-label="Trang trước"
                    className="vehicles-icon-button"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    type="button"
                  >
                    <ChevronLeft aria-hidden="true" size={17} />
                  </button>
                  <button
                    aria-label="Trang sau"
                    className="vehicles-icon-button"
                    disabled={page >= pageCount}
                    onClick={() => setPage((current) => current + 1)}
                    type="button"
                  >
                    <ChevronRight aria-hidden="true" size={17} />
                  </button>
                </div>
              </footer>
            )}
          </div>
        </section>

        {selectedVehicleId !== null && (
          <VehicleDetailDialog
            busCompanies={busCompanies}
            onClose={() => setSelectedVehicleId(null)}
            onMutationSuccess={setSuccessMessage}
            onRefresh={refresh}
            onRetryOptions={retryFilterOptions}
            optionsError={filterOptionsError}
            optionsLoading={isFilterLookupLoading}
            vehicleId={selectedVehicleId}
            vehicleTypes={vehicleTypes}
          />
        )}
        {createDialogOpen && (
          <CreateVehicleDialog
            busCompanies={busCompanies}
            onClose={() => setCreateDialogOpen(false)}
            onCreated={() => {
              setCreateDialogOpen(false);
              setSuccessMessage('Xe đã được tạo thành công.');
              setPage(1);
              refresh();
            }}
            onRetryOptions={retryFilterOptions}
            optionsError={filterOptionsError}
            optionsLoading={isFilterLookupLoading}
            vehicleTypes={vehicleTypes}
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}
