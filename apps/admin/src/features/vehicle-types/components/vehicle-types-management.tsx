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
  Pencil,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  FilterToolbar,
  SearchInput,
} from '@/components/data-filters/data-filters';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useVehicleTypes } from '../hooks/use-vehicle-types';
import { getVehicleTypeById } from '../services/vehicle-type-service';
import { VehicleTypeFormDialog } from './vehicle-type-form-dialog';
import type {
  SortDirection,
  VehicleType,
  VehicleTypeSortKey,
} from '../types/vehicle-type';
import '../vehicle-types.css';

const PAGE_SIZE = 10;

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

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.';
  }
  return error instanceof Error ? error.message : fallback;
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
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      aria-label={`Sắp xếp theo ${label}`}
      className="vehicle-types-sort-button"
      onClick={onClick}
      type="button"
    >
      {label}
      <Icon aria-hidden="true" size={14} />
    </button>
  );
}

type VehicleTypeDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; vehicleType: VehicleType };

function VehicleTypeDetails({
  vehicleTypeId,
  onClose,
  onUpdated,
}: {
  vehicleTypeId: number;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detailState, setDetailState] = useState<VehicleTypeDetailState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getVehicleTypeById(vehicleTypeId, controller.signal)
      .then((vehicleType) => {
        if (!controller.signal.aborted) {
          setDetailState({ status: 'success', vehicleType });
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setDetailState({
            status: 'error',
            message: getRequestErrorMessage(
              requestError,
              'Không thể tải thông tin loại xe.',
            ),
          });
        }
      });

    return () => controller.abort();
  }, [vehicleTypeId, retryCount]);

  function retry() {
    setDetailState({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  function handleUpdated(vehicleType: VehicleType) {
    setDetailState({ status: 'success', vehicleType });
    setIsEditing(false);
    setSuccessMessage(`Đã cập nhật loại xe “${vehicleType.name}”.`);
    onUpdated();
  }

  return (
    <>
      <dialog
        aria-describedby="vehicle-type-detail-description"
        aria-labelledby="vehicle-type-detail-title"
        aria-modal="true"
        className="vehicle-type-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            (event.currentTarget as HTMLDialogElement).close();
          }
        }}
        onClose={onClose}
        ref={dialogRef}
      >
        <div className="vehicle-type-dialog-content">
          <div className="vehicle-type-dialog-heading">
            <div>
              <p className="vehicle-types-eyebrow">DANH MỤC PHƯƠNG TIỆN</p>
              <h2 id="vehicle-type-detail-title">Chi tiết loại xe</h2>
            </div>
            <form method="dialog">
              <button
                aria-label="Đóng chi tiết loại xe"
                className="vehicle-types-icon-button"
                type="submit"
              >
                <X aria-hidden="true" size={19} />
              </button>
            </form>
          </div>
          <p
            className="vehicle-type-dialog-description"
            id="vehicle-type-detail-description"
          >
            Thông tin loại xe được tải từ dữ liệu hiện tại của hệ thống.
          </p>

          {detailState.status === 'loading' && (
            <div className="vehicle-type-detail-state" role="status">
              <LoaderCircle
                aria-hidden="true"
                className="vehicle-types-spinner"
                size={20}
              />
              Đang tải thông tin loại xe…
            </div>
          )}

          {detailState.status === 'error' && (
            <div className="vehicle-type-detail-error" role="alert">
              <p>{detailState.message}</p>
              <button
                className="vehicle-types-button"
                onClick={retry}
                type="button"
              >
                Thử lại
              </button>
            </div>
          )}

          {detailState.status === 'success' && (
            <div className="vehicle-type-detail-body">
              {successMessage && (
                <div className="vehicle-type-detail-success" role="status">
                  {successMessage}
                </div>
              )}
              <div className="vehicle-type-detail-title-row">
                <span aria-hidden="true" className="vehicle-type-detail-icon">
                  <Bus size={19} />
                </span>
                <h3>{detailState.vehicleType.name}</h3>
              </div>
              <button
                className="vehicle-types-button vehicle-type-edit-button"
                onClick={() => {
                  setSuccessMessage(null);
                  setIsEditing(true);
                }}
                type="button"
              >
                <Pencil aria-hidden="true" size={15} />
                Chỉnh sửa
              </button>
              <section aria-labelledby="vehicle-type-description-heading">
                <h4 id="vehicle-type-description-heading">Mô tả</h4>
                <p className="vehicle-type-description-value">
                  {detailState.vehicleType.description || 'Chưa có mô tả'}
                </p>
              </section>
              <dl className="vehicle-type-timestamps">
                <div>
                  <dt>Ngày tạo</dt>
                  <dd>{timestampFormat(detailState.vehicleType.createdAt)}</dd>
                </div>
                <div>
                  <dt>Cập nhật lần cuối</dt>
                  <dd>{timestampFormat(detailState.vehicleType.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </dialog>
      {isEditing && detailState.status === 'success' && (
        <VehicleTypeFormDialog
          mode="edit"
          onClose={() => setIsEditing(false)}
          onSaved={handleUpdated}
          vehicleType={detailState.vehicleType}
        />
      )}
    </>
  );
}

export function VehicleTypesManagement() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<VehicleTypeSortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const query = {
    page,
    pageSize: PAGE_SIZE,
    search,
    sortBy,
    sortDirection,
  };
  const { state, refresh } = useVehicleTypes(query);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  function changeSort(nextSort: VehicleTypeSortKey) {
    if (sortBy === nextSort) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(nextSort);
      setSortDirection('asc');
    }
    setPage(1);
  }

  function reload() {
    setPage(1);
    refresh();
  }

  function handleCreated(vehicleType: VehicleType) {
    setIsCreating(false);
    setPage(1);
    setSuccessMessage(`Đã thêm loại xe “${vehicleType.name}”.`);
    refresh();
  }

  function handleUpdated() {
    refresh();
  }

  const resultCount =
    state.status === 'success' ? state.result.meta.totalItems : null;

  return (
    <SuperAdminLayout activeSection="vehicle-types" apiMode>
      <div className="vehicle-types-page">
        <header className="vehicle-types-intro">
          <div>
            <p className="vehicle-types-eyebrow">QUẢN LÝ DANH MỤC</p>
            <h1 id="vehicle-types-heading">Loại xe</h1>
            <p>Tra cứu các loại xe đang được sử dụng trong hệ thống.</p>
          </div>
          <div className="vehicle-types-intro-actions">
            <button
              aria-label="Làm mới danh sách loại xe"
              className="vehicle-types-button vehicle-types-refresh-button"
              disabled={state.status === 'loading'}
              onClick={reload}
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                className={state.status === 'loading' ? 'vehicle-types-spinner' : ''}
                size={16}
              />
              Làm mới
            </button>
            <button
              className="vehicle-types-button vehicle-types-create-button"
              onClick={() => {
                setSuccessMessage(null);
                setIsCreating(true);
              }}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              Thêm loại xe
            </button>
          </div>
        </header>

        {successMessage && (
          <div className="vehicle-types-success" role="status">
            {successMessage} Danh sách đã được cập nhật.
          </div>
        )}

        <section aria-labelledby="vehicle-types-list-heading">
          <h2 className="vehicle-types-visually-hidden" id="vehicle-types-list-heading">
            Danh sách loại xe
          </h2>
          <div
            aria-busy={state.status === 'loading'}
            className="vehicle-types-panel"
          >
            <FilterToolbar
              summary={
                resultCount === null
                  ? state.status === 'loading'
                    ? 'Đang tải kết quả'
                    : 'Chưa có kết quả'
                  : `${numberFormat(resultCount)} kết quả`
              }
            >
              <SearchInput
                label="Tìm loại xe"
                onChange={setSearchInput}
                placeholder="Tìm theo tên loại xe hoặc mô tả"
                value={searchInput}
              />
            </FilterToolbar>

            {state.status === 'loading' && (
              <div className="vehicle-types-loading" role="status">
                <LoaderCircle
                  aria-hidden="true"
                  className="vehicle-types-spinner"
                  size={20}
                />
                Đang tải danh sách loại xe…
              </div>
            )}

            {state.status === 'error' && (
              <div className="vehicle-types-error" role="alert">
                <div>
                  <strong>Chưa tải được danh sách loại xe</strong>
                  <p>{state.message}</p>
                </div>
                <button
                  className="vehicle-types-button"
                  onClick={reload}
                  type="button"
                >
                  Thử lại
                </button>
              </div>
            )}

            {state.status === 'success' && state.result.data.length === 0 && (
              <div className="vehicle-types-empty">
                <span aria-hidden="true" className="vehicle-types-empty-icon">
                  <Bus size={21} />
                </span>
                <h3>
                  {state.result.meta.totalItems > 0
                    ? 'Trang hiện tại không có dữ liệu'
                    : search.trim()
                      ? 'Không tìm thấy loại xe'
                      : 'Chưa có loại xe'}
                </h3>
                <p>
                  {state.result.meta.totalItems > 0
                    ? 'Danh sách có thể đã thay đổi. Tải lại để xem trang đầu tiên.'
                    : search.trim()
                      ? 'Thử tìm bằng tên loại xe hoặc mô tả khác.'
                      : 'Danh mục loại xe hiện chưa có dữ liệu.'}
                </p>
                {state.result.meta.totalItems > 0 && (
                  <button
                    className="vehicle-types-button"
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
                <div className="vehicle-types-table-wrap">
                  <table className="vehicle-types-table">
                    <thead>
                      <tr>
                        <th
                          aria-sort={
                            sortBy === 'name'
                              ? sortDirection === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                          }
                          scope="col"
                        >
                          <SortButton
                            active={sortBy === 'name'}
                            direction={sortDirection}
                            label="Tên loại xe"
                            onClick={() => changeSort('name')}
                          />
                        </th>
                        <th scope="col">Mô tả</th>
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
                          <span className="vehicle-types-visually-hidden">Thao tác</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.result.data.map((vehicleType) => (
                        <tr key={vehicleType.vehicleTypeId}>
                          <th scope="row">{vehicleType.name}</th>
                          <td className="vehicle-types-description-cell">
                            {vehicleType.description || 'Chưa có mô tả'}
                          </td>
                          <td>{timestampFormat(vehicleType.createdAt)}</td>
                          <td>{timestampFormat(vehicleType.updatedAt)}</td>
                          <td>
                            <button
                              className="vehicle-types-detail-button"
                              onClick={() =>
                                setSelectedVehicleTypeId(vehicleType.vehicleTypeId)
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

                <div className="vehicle-types-mobile-list">
                  {state.result.data.map((vehicleType) => (
                    <article
                      className="vehicle-types-mobile-card"
                      key={vehicleType.vehicleTypeId}
                    >
                      <h3>{vehicleType.name}</h3>
                      <p>{vehicleType.description || 'Chưa có mô tả'}</p>
                      <span>
                        Ngày tạo <strong>{timestampFormat(vehicleType.createdAt)}</strong>
                      </span>
                      <span>
                        Cập nhật <strong>{timestampFormat(vehicleType.updatedAt)}</strong>
                      </span>
                      <button
                        className="vehicle-types-detail-button"
                        onClick={() =>
                          setSelectedVehicleTypeId(vehicleType.vehicleTypeId)
                        }
                        type="button"
                      >
                        <Eye aria-hidden="true" size={15} />
                        Xem chi tiết
                      </button>
                    </article>
                  ))}
                </div>

                {state.result.meta.totalPages > 0 && (
                  <div className="vehicle-types-pagination">
                    <span>
                      Hiển thị{' '}
                      <strong>
                        {(state.result.meta.page - 1) * state.result.meta.pageSize + 1}
                        –
                        {Math.min(
                          state.result.meta.page * state.result.meta.pageSize,
                          state.result.meta.totalItems,
                        )}
                      </strong>{' '}
                      trong <strong>{numberFormat(state.result.meta.totalItems)}</strong>{' '}
                      loại xe
                    </span>
                    <div aria-label="Phân trang loại xe" className="vehicle-types-pagination-controls">
                      <span>
                        Trang <strong>{state.result.meta.page}</strong> /{' '}
                        {state.result.meta.totalPages}
                      </span>
                      <button
                        aria-label="Trang trước"
                        className="vehicle-types-icon-button"
                        disabled={page <= 1}
                        onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                        type="button"
                      >
                        <ChevronLeft aria-hidden="true" size={17} />
                      </button>
                      <button
                        aria-label="Trang sau"
                        className="vehicle-types-icon-button"
                        disabled={page >= state.result.meta.totalPages}
                        onClick={() => setPage((currentPage) => currentPage + 1)}
                        type="button"
                      >
                        <ChevronRight aria-hidden="true" size={17} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
      {isCreating && (
        <VehicleTypeFormDialog
          mode="create"
          onClose={() => setIsCreating(false)}
          onSaved={handleCreated}
        />
      )}
      {selectedVehicleTypeId !== null && (
        <VehicleTypeDetails
          key={selectedVehicleTypeId}
          onClose={() => setSelectedVehicleTypeId(null)}
          onUpdated={handleUpdated}
          vehicleTypeId={selectedVehicleTypeId}
        />
      )}
    </SuperAdminLayout>
  );
}
