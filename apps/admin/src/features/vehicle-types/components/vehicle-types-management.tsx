'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import {
  FilterToolbar,
  SearchInput,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getVehicleTypeById } from '../services/vehicle-type-service';
import type { VehicleType, VehicleTypeSortKey } from '../types/vehicle-type';
import { useVehicleTypes } from '../hooks/use-vehicle-types';
import { VehicleTypeFormDialog } from './vehicle-type-form-dialog';
import '../vehicle-types.css';

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

type DetailState =
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
  onUpdated: (vehicleType: VehicleType) => void;
}) {
  const [detailState, setDetailState] = useState<DetailState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    getVehicleTypeById(vehicleTypeId, controller.signal)
      .then((vehicleType) => {
        if (current) setDetailState({ status: 'success', vehicleType });
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setDetailState({
            status: 'error',
            message:
              requestError instanceof TypeError
                ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
                : requestError instanceof Error
                  ? requestError.message
                  : 'Không thể tải thông tin loại xe.',
          });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [retryCount, vehicleTypeId]);

  function handleVehicleTypeUpdated(vehicleType: VehicleType) {
    setDetailState({ status: 'success', vehicleType });
    setUpdateNotice(`Đã cập nhật loại xe ${vehicleType.name}.`);
    setEditDialogOpen(false);
    onUpdated(vehicleType);
  }

  return (
    <>
      <AdminDetailSheet
        ariaBusy={detailState.status === 'loading'}
        ariaDescribedBy="vehicle-type-detail-description"
        ariaLabelledBy="vehicle-type-detail-title"
        onClose={onClose}
      >
        <div className="admin-dialog-header">
          <div className="admin-dialog-header__copy">
            <p className="eyebrow">DANH MỤC PHƯƠNG TIỆN</p>
            <h2 id="vehicle-type-detail-title">Chi tiết loại xe</h2>
            <p id="vehicle-type-detail-description">
              Thông tin loại xe dùng chung trong hệ thống.
            </p>
          </div>
          <form method="dialog">
            <Button
              aria-label="Đóng chi tiết loại xe"
              className="vehicle-type-detail-close"
              type="submit"
              variant="secondary"
            >
              <X aria-hidden="true" size={17} />
            </Button>
          </form>
        </div>

        {updateNotice && (
          <div
            className="vehicle-types-success vehicle-type-detail-success"
            role="status"
          >
            <CheckCircle2 aria-hidden="true" size={16} />
            <span>{updateNotice}</span>
          </div>
        )}

        {detailState.status === 'loading' && (
          <p className="vehicle-types-state" role="status">
            <LoaderCircle
              aria-hidden="true"
              className="vehicle-types-spinner"
              size={17}
            />
            Đang tải thông tin loại xe…
          </p>
        )}

        {detailState.status === 'error' && (
          <div className="vehicle-types-state" role="alert">
            <p>{detailState.message}</p>
            <Button
              onClick={() => {
                setDetailState({ status: 'loading' });
                setRetryCount((count) => count + 1);
              }}
              type="button"
              variant="secondary"
            >
              Thử lại
            </Button>
          </div>
        )}

        {detailState.status === 'success' && (
          <div className="vehicle-type-detail-content">
            <div className="vehicle-type-detail-hero">
              <span className="vehicle-type-detail-mark" aria-hidden="true">
                {detailState.vehicleType.name
                  .slice(0, 1)
                  .toLocaleUpperCase('vi')}
              </span>
              <div>
                <h3>{detailState.vehicleType.name}</h3>
                <p>Loại xe #{detailState.vehicleType.vehicleTypeId}</p>
              </div>
            </div>
            <dl className="vehicle-type-detail-fields">
              <div>
                <dt>Mô tả</dt>
                <dd>
                  {detailState.vehicleType.description || 'Chưa có mô tả'}
                </dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>{timestampFormat(detailState.vehicleType.createdAt)}</dd>
              </div>
              <div>
                <dt>Cập nhật lần cuối</dt>
                <dd>{timestampFormat(detailState.vehicleType.updatedAt)}</dd>
              </div>
            </dl>
            <div className="vehicle-type-detail-actions">
              <Button
                onClick={() => {
                  setUpdateNotice(null);
                  setEditDialogOpen(true);
                }}
                type="button"
              >
                <Pencil aria-hidden="true" size={15} />
                Chỉnh sửa
              </Button>
            </div>
          </div>
        )}
      </AdminDetailSheet>
      {editDialogOpen && detailState.status === 'success' && (
        <VehicleTypeFormDialog
          key={vehicleTypeId}
          onClose={() => setEditDialogOpen(false)}
          onSaved={handleVehicleTypeUpdated}
          vehicleType={detailState.vehicleType}
        />
      )}
    </>
  );
}

function sortLabel(
  field: VehicleTypeSortKey,
  currentField: VehicleTypeSortKey,
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

export function VehicleTypesManagement() {
  const {
    vehicleTypePage,
    error,
    loading,
    page,
    searchInput,
    sortBy,
    sortDirection,
    changePage,
    refresh,
    retry,
    sortVehicleTypes,
    updateSearch,
  } = useVehicleTypes();
  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState<
    number | null
  >(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const items = vehicleTypePage?.data ?? [];

  function openCreateDialog() {
    setSuccessMessage(null);
    setCreateDialogOpen(true);
  }

  function handleVehicleTypeCreated(vehicleType: VehicleType) {
    setCreateDialogOpen(false);
    setSuccessMessage(`Đã tạo loại xe ${vehicleType.name}.`);
    refresh();
  }

  function handleVehicleTypeUpdated(vehicleType: VehicleType) {
    setSuccessMessage(`Đã cập nhật loại xe ${vehicleType.name}.`);
    refresh();
  }

  function detailButton(vehicleType: VehicleType) {
    return (
      <Button
        aria-label={`Xem chi tiết loại xe ${vehicleType.name}`}
        onClick={() => {
          setSuccessMessage(null);
          setSelectedVehicleTypeId(vehicleType.vehicleTypeId);
        }}
        type="button"
        variant="secondary"
      >
        <Eye aria-hidden="true" size={15} />
        Xem chi tiết
      </Button>
    );
  }

  function sortButton(label: string, field: VehicleTypeSortKey) {
    return (
      <button
        aria-label={`Sắp xếp theo ${label}`}
        className="vehicle-type-sort"
        onClick={() => sortVehicleTypes(field)}
        type="button"
      >
        {label}
        {sortLabel(field, sortBy, sortDirection)}
      </button>
    );
  }

  return (
    <SuperAdminLayout activeSection="vehicle-types">
      <div className="admin-page-content vehicle-types-page">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              <Button onClick={openCreateDialog} type="button">
                <Plus aria-hidden="true" size={16} />
                Thêm loại xe
              </Button>
              <Button
                disabled={loading}
                onClick={refresh}
                type="button"
                variant="secondary"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={loading ? 'vehicle-types-spinner' : undefined}
                  size={15}
                />
                Làm mới
              </Button>
            </div>
          }
          eyebrow="DANH MỤC PHƯƠNG TIỆN"
          title="Quản lý loại xe"
          titleId="vehicle-types-title"
        />

        <section
          aria-labelledby="vehicle-types-title"
          aria-busy={loading}
          className="vehicle-types-section"
        >
          {successMessage && (
            <p className="vehicle-types-success" role="status">
              <CheckCircle2 aria-hidden="true" size={16} />
              <span>{successMessage}</span>
            </p>
          )}
          <div className="panel vehicle-types-panel">
            <FilterToolbar summary="Danh mục dùng chung">
              <SearchInput
                label="Tìm theo tên loại xe hoặc mô tả"
                onChange={updateSearch}
                placeholder="Tìm tên loại xe, mô tả…"
                value={searchInput}
              />
            </FilterToolbar>

            {loading && (
              <p className="vehicle-types-loading" role="status">
                <LoaderCircle
                  aria-hidden="true"
                  className="vehicle-types-spinner"
                  size={15}
                />
                {vehicleTypePage
                  ? 'Đang cập nhật danh sách…'
                  : 'Đang tải danh sách loại xe…'}
              </p>
            )}

            {error && (
              <div className="vehicle-types-state" role="alert">
                <p>{error}</p>
                <Button onClick={retry} type="button" variant="secondary">
                  Thử lại
                </Button>
              </div>
            )}

            {!error && vehicleTypePage && items.length === 0 && !loading && (
              <p className="vehicle-types-state" role="status">
                {searchInput.trim()
                  ? 'Không tìm thấy loại xe phù hợp.'
                  : 'Chưa có loại xe trong danh mục.'}
              </p>
            )}

            {!error && vehicleTypePage && (
              <>
                {items.length > 0 && (
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
                              {sortButton('Tên loại xe', 'name')}
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
                              {sortButton('Ngày tạo', 'createdAt')}
                            </th>
                            <th scope="col">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((vehicleType) => (
                            <tr key={vehicleType.vehicleTypeId}>
                              <th scope="row">{vehicleType.name}</th>
                              <td>
                                {vehicleType.description || 'Chưa có mô tả'}
                              </td>
                              <td>{timestampFormat(vehicleType.createdAt)}</td>
                              <td>{detailButton(vehicleType)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="vehicle-types-mobile-list">
                      {items.map((vehicleType) => (
                        <article
                          className="vehicle-type-mobile-card"
                          key={vehicleType.vehicleTypeId}
                        >
                          <div className="vehicle-type-mobile-heading">
                            <h2>{vehicleType.name}</h2>
                            <span>#{vehicleType.vehicleTypeId}</span>
                          </div>
                          <p>{vehicleType.description || 'Chưa có mô tả'}</p>
                          <div className="vehicle-type-mobile-footer">
                            <span>
                              {timestampFormat(vehicleType.createdAt)}
                            </span>
                            {detailButton(vehicleType)}
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
                  pageSize={vehicleTypePage.meta.pageSize}
                  summaryLabel="loại xe"
                  totalItems={vehicleTypePage.meta.totalItems}
                  totalPages={vehicleTypePage.meta.totalPages}
                />
              </>
            )}
          </div>
        </section>
      </div>

      {selectedVehicleTypeId !== null && (
        <VehicleTypeDetails
          key={selectedVehicleTypeId}
          onClose={() => setSelectedVehicleTypeId(null)}
          onUpdated={handleVehicleTypeUpdated}
          vehicleTypeId={selectedVehicleTypeId}
        />
      )}
      {createDialogOpen && (
        <VehicleTypeFormDialog
          onClose={() => setCreateDialogOpen(false)}
          onSaved={handleVehicleTypeCreated}
        />
      )}
    </SuperAdminLayout>
  );
}
