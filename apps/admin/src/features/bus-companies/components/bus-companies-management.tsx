'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import {
  DateRangeFilter,
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useBusCompanies } from '../hooks/use-bus-companies';
import { CreateBusCompanyDialog } from './create-bus-company-dialog';
import { EditBusCompanyDialog } from './edit-bus-company-dialog';
import {
  getBusCompanyById,
  updateBusCompanyStatus,
} from '../services/bus-company-service';
import type {
  BusCompany,
  BusCompanySortKey,
  BusCompanyStatus,
} from '../types/bus-company';

const BUS_COMPANY_STATUS_FILTERS: FilterOption[] = [
  { value: 'HOAT_DONG', label: 'Đang hoạt động' },
  { value: 'TAM_NGUNG', label: 'Tạm ngưng' },
];

function numberFormat(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function initials(value: string) {
  return value
    .replace(/^Nhà xe\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('vi');
}

function statusLabel(status: BusCompanyStatus) {
  switch (status) {
    case 'HOAT_DONG':
      return 'Đang hoạt động';
    case 'TAM_NGUNG':
      return 'Tạm ngưng';
  }
}

function CompanyMark({ name }: { name: string }) {
  return (
    <span className="company-mark" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

type CompanyDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; company: BusCompany };

function CompanyDetails({
  companyId,
  onClose,
  onUpdated,
  onStatusUpdated,
}: {
  companyId: number;
  onClose: () => void;
  onUpdated: (company: BusCompany) => void;
  onStatusUpdated: (company: BusCompany) => void;
}) {
  const statusSubmittingRef = useRef(false);
  const [detailState, setDetailState] = useState<CompanyDetailState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getBusCompanyById(companyId, controller.signal)
      .then((company) => {
        if (!controller.signal.aborted) {
          setDetailState({ status: 'success', company });
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setDetailState({
            status: 'error',
            message:
              requestError instanceof Error
                ? requestError.message
                : 'Không thể tải thông tin nhà xe.',
          });
        }
      });

    return () => controller.abort();
  }, [companyId, retryCount]);

  function retry() {
    setDetailState({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  function handleCompanyUpdated(company: BusCompany) {
    setDetailState({ status: 'success', company });
    setUpdateNotice(`Đã cập nhật nhà xe ${company.name}.`);
    setEditDialogOpen(false);
    onUpdated(company);
  }

  async function confirmStatusChange() {
    if (detailState.status !== 'success' || statusSubmittingRef.current) return;

    const targetStatus: BusCompanyStatus =
      detailState.company.status === 'HOAT_DONG' ? 'TAM_NGUNG' : 'HOAT_DONG';
    statusSubmittingRef.current = true;
    setStatusSubmitting(true);
    setStatusError(null);

    try {
      const updatedCompany = await updateBusCompanyStatus(
        companyId,
        targetStatus,
      );
      setDetailState({ status: 'success', company: updatedCompany });
      setUpdateNotice(
        `Đã chuyển nhà xe ${updatedCompany.name} sang trạng thái ${statusLabel(updatedCompany.status)}.`,
      );
      setStatusDialogOpen(false);
      onStatusUpdated(updatedCompany);
    } catch (requestError: unknown) {
      setStatusError(
        requestError instanceof TypeError
          ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
          : requestError instanceof Error
            ? requestError.message
            : 'Không thể cập nhật trạng thái nhà xe.',
      );
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  const nextStatus: BusCompanyStatus | null =
    detailState.status === 'success'
      ? detailState.company.status === 'HOAT_DONG'
        ? 'TAM_NGUNG'
        : 'HOAT_DONG'
      : null;

  return (
    <>
      <AdminDetailSheet
        ariaLabelledBy="company-detail-title"
        onClose={onClose}
      >
        <>
          <div className="admin-dialog-header">
            <div className="admin-dialog-header__copy">
              <p className="eyebrow">HỒ SƠ NHÀ XE</p>
              <h2 id="company-detail-title">Thông tin nhà xe</h2>
            </div>
            <form method="dialog">
              <button
                aria-label="Đóng thông tin nhà xe"
                className="icon-button"
                type="submit"
              >
                <X size={19} />
              </button>
            </form>
          </div>

          {updateNotice && (
            <div
              className="company-success-notice detail-success-notice"
              role="status"
            >
              <CheckCircle2 aria-hidden="true" size={17} />
              <span>{updateNotice}</span>
            </div>
          )}

          {detailState.status === 'loading' && (
            <p role="status">Đang tải thông tin nhà xe…</p>
          )}

          {detailState.status === 'error' && (
            <div role="alert">
              <p>{detailState.message}</p>
              <Button
                onClick={retry}
                type="button"
                variant="secondary"
              >
                Thử lại
              </Button>
            </div>
          )}

          {detailState.status === 'success' && (
            <>
              <div className="detail-company-hero">
                <CompanyMark name={detailState.company.name} />
                <div>
                  <h3>{detailState.company.name}</h3>
                  <span className="detail-company-id">
                    Mã nhà xe · {detailState.company.code}
                  </span>
                </div>
              </div>

              <section
                className="detail-section"
                aria-labelledby="detail-contact-heading"
              >
                <h3 id="detail-contact-heading">Thông tin liên hệ</h3>
                <div className="detail-field">
                  <span className="detail-field-icon" aria-hidden="true">
                    <Building2 size={17} />
                  </span>
                  <div>
                    <span className="detail-field-label">Đầu mối liên hệ</span>
                    <span className="detail-field-value">
                      {detailState.company.contactInfo || 'Chưa cập nhật'}
                    </span>
                  </div>
                </div>
              </section>

              <section
                className="detail-section"
                aria-labelledby="detail-record-heading"
              >
                <h3 id="detail-record-heading">Thông tin hồ sơ</h3>
                <dl className="detail-stats">
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>
                      <AdminStatusBadge
                        tone={
                          detailState.company.status === 'HOAT_DONG'
                            ? 'active'
                            : 'muted'
                        }
                      >
                        {statusLabel(detailState.company.status)}
                      </AdminStatusBadge>
                    </dd>
                  </div>
                  <div>
                    <dt>Ngày tạo</dt>
                    <dd>{timestampFormat(detailState.company.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Cập nhật lần cuối</dt>
                    <dd>{timestampFormat(detailState.company.updatedAt)}</dd>
                  </div>
                </dl>
              </section>
              <div className="detail-edit-actions">
                <Button
                  onClick={() => {
                    setStatusError(null);
                    setStatusDialogOpen(true);
                  }}
                  type="button"
                  variant="secondary"
                >
                  {detailState.company.status === 'HOAT_DONG'
                    ? 'Tạm ngưng nhà xe'
                    : 'Kích hoạt lại'}
                </Button>
                <Button
                  onClick={() => setEditDialogOpen(true)}
                  type="button"
                >
                  Chỉnh sửa
                </Button>
              </div>
            </>
          )}
        </>
      </AdminDetailSheet>
      {editDialogOpen && detailState.status === 'success' && (
        <EditBusCompanyDialog
          company={detailState.company}
          onClose={() => setEditDialogOpen(false)}
          onUpdated={handleCompanyUpdated}
        />
      )}
      {statusDialogOpen && detailState.status === 'success' && nextStatus && (
        <AdminConfirmDialog
          ariaBusy={statusSubmitting}
          ariaDescribedBy="status-confirmation-description"
          ariaLabelledBy="status-confirmation-title"
          onClose={() => setStatusDialogOpen(false)}
          preventDismiss={statusSubmitting}
        >
          <>
            <h2 id="status-confirmation-title">
              {nextStatus === 'TAM_NGUNG'
                ? 'Tạm ngưng nhà xe này?'
                : 'Kích hoạt lại nhà xe này?'}
            </h2>
            <p id="status-confirmation-description">
              {nextStatus === 'TAM_NGUNG'
                ? 'Nhà xe sẽ được chuyển sang trạng thái Tạm ngưng. Thao tác này không xóa dữ liệu và có thể kích hoạt lại sau.'
                : 'Nhà xe sẽ được chuyển sang trạng thái Đang hoạt động.'}
            </p>
            {statusError && <p className="admin-confirm-dialog__error" role="alert">{statusError}</p>}
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
                    className="status-confirmation-spinner"
                    size={15}
                  />
                )}
                {statusSubmitting
                  ? 'Đang cập nhật…'
                  : nextStatus === 'TAM_NGUNG'
                    ? 'Tạm ngưng nhà xe'
                    : 'Kích hoạt lại'}
              </Button>
            </div>
          </>
        </AdminConfirmDialog>
      )}
    </>
  );
}

function LoadingRows() {
  return (
    <div
      className="table-skeleton"
      aria-label="Đang tải danh sách nhà xe"
      role="status"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div className="table-skeleton-row" key={index} aria-hidden="true">
          <span className="skeleton skeleton-company" />
          <span className="skeleton skeleton-contact" />
          <span className="skeleton skeleton-number" />
          <span className="skeleton skeleton-number" />
          <span className="skeleton skeleton-number" />
        </div>
      ))}
      <span className="sr-only">Đang tải dữ liệu nhà xe…</span>
    </div>
  );
}

export function BusCompaniesManagement() {
  const {
    companyPage,
    error,
    loading,
    searchInput,
    status,
    createdDateRange,
    sortBy,
    sortDirection,
    changePage,
    refresh,
    sortCompanies,
    updateSearch,
    updateFilters,
    updateCreatedDateRange,
  } = useBusCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null,
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function openCreateDialog() {
    setSuccessMessage(null);
    setCreateDialogOpen(true);
  }

  function handleCompanyCreated(company: BusCompany) {
    setCreateDialogOpen(false);
    setSuccessMessage(`Đã thêm nhà xe ${company.name}.`);
    refresh();
  }

  function handleCompanyUpdated(company: BusCompany) {
    setSuccessMessage(`Đã cập nhật nhà xe ${company.name}.`);
    refresh();
  }

  function handleCompanyStatusUpdated(company: BusCompany) {
    setSuccessMessage(
      `Đã chuyển nhà xe ${company.name} sang trạng thái ${statusLabel(company.status)}.`,
    );
    refresh();
  }

  function sortButton(label: string, column: BusCompanySortKey) {
    const selected = sortBy === column;
    return (
      <button
        className="sort-button"
        onClick={() => sortCompanies(column)}
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

  function companyAction(company: BusCompany) {
    return (
      <button
        aria-label={`Xem thông tin ${company.name}`}
        className="company-open-button"
        onClick={() => {
          setSuccessMessage(null);
          setSelectedCompanyId(company.busCompanyId);
        }}
        type="button"
      >
        Xem chi tiết <ChevronRight aria-hidden="true" size={15} />
      </button>
    );
  }

  return (
    <SuperAdminLayout activeSection="bus-companies">
      <div className="admin-page-content">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions bus-company-page-actions">
              <Button
              onClick={openCreateDialog}
              type="button"
              >
                <Plus aria-hidden="true" size={16} />
                Thêm nhà xe
              </Button>
              <Button
              disabled={loading}
              onClick={refresh}
              type="button"
                variant="secondary"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={loading ? 'bus-company-refresh-spinner' : ''}
                  size={16}
                />
                Làm mới
              </Button>
            </div>
          }
          eyebrow="ĐỐI TÁC NỀN TẢNG"
          title="Quản lý nhà xe"
          titleId="page-title"
        />

        {successMessage && (
          <div className="company-success-notice" role="status">
            <CheckCircle2 aria-hidden="true" size={17} />
            <span>{successMessage}</span>
          </div>
        )}

        <section
          aria-labelledby="companies-heading"
          className="companies-section"
        >
          <h2 className="sr-only" id="companies-heading">
            Danh sách nhà xe
          </h2>

          <div className="panel companies-panel">
            <FilterToolbar
              summary={
                companyPage
                  ? `${numberFormat(companyPage.meta.totalItems)} kết quả`
                  : 'Đang tải kết quả'
              }
            >
              <SearchInput
                label="Tìm nhà xe"
                onChange={updateSearch}
                placeholder="Tìm theo mã, tên hoặc thông tin liên hệ"
                value={searchInput}
              />
              <SelectFilter
                allLabel="Tất cả trạng thái"
                label="Lọc theo trạng thái"
                onChange={updateFilters}
                options={BUS_COMPANY_STATUS_FILTERS}
                value={status}
              />
              <DateRangeFilter
                label="Ngày tạo"
                onApply={updateCreatedDateRange}
                value={createdDateRange}
              />
            </FilterToolbar>

            {error && (
              <div className="table-error" role="alert">
                <div>
                  <strong>Chưa tải được danh sách nhà xe</strong>
                  <p>{error}</p>
                </div>
                <Button
                  onClick={refresh}
                  type="button"
                  variant="secondary"
                >
                  Thử lại
                </Button>
              </div>
            )}

            {loading && !companyPage ? <LoadingRows /> : null}
            {!loading && !error && companyPage?.data.length === 0 && (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <Search size={21} />
                </span>
                <h3>Không tìm thấy nhà xe</h3>
                <p>Thử tìm bằng mã, tên hoặc thông tin liên hệ khác.</p>
              </div>
            )}

            {companyPage && companyPage.data.length > 0 && (
              <>
                <div
                  aria-busy={loading}
                  className={`company-table-scroll${loading ? ' is-loading' : ''}`}
                >
                  <table className="company-table">
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
                          {sortButton('Nhà xe', 'name')}
                        </th>
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
                          {sortButton('Mã nhà xe', 'code')}
                        </th>
                        <th scope="col">Thông tin liên hệ</th>
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
                        <th scope="col">
                          <span className="sr-only">Thao tác</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyPage.data.map((company) => (
                        <tr key={company.busCompanyId}>
                          <th className="company-name-cell" scope="row">
                            <span className="company-name-content">
                              <CompanyMark name={company.name} />
                              <span>{company.name}</span>
                            </span>
                          </th>
                          <td className="table-number">{company.code}</td>
                          <td
                            className="company-contact-cell"
                            tabIndex={company.contactInfo ? 0 : undefined}
                            title={company.contactInfo || undefined}
                          >
                            {company.contactInfo || '—'}
                          </td>
                          <td>
                            <AdminStatusBadge
                              tone={
                                company.status === 'HOAT_DONG'
                                  ? 'active'
                                  : 'muted'
                              }
                            >
                              {statusLabel(company.status)}
                            </AdminStatusBadge>
                          </td>
                          <td>{timestampFormat(company.createdAt)}</td>
                          <td>{companyAction(company)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="company-mobile-list">
                  {companyPage.data.map((company) => (
                    <article
                      className="company-mobile-card"
                      key={company.busCompanyId}
                    >
                      <div className="company-mobile-head">
                        <CompanyMark name={company.name} />
                        <div>
                          <h3>{company.name}</h3>
                          <p>
                            {company.contactInfo || 'Chưa cập nhật liên hệ'}
                          </p>
                        </div>
                      </div>
                      <div className="company-mobile-stats">
                        <span>
                          Mã <strong>{company.code}</strong>
                        </span>
                        <span>
                          Trạng thái{' '}
                          <strong>{statusLabel(company.status)}</strong>
                        </span>
                        <span>
                          Ngày tạo{' '}
                          <strong>{timestampFormat(company.createdAt)}</strong>
                        </span>
                      </div>
                      {companyAction(company)}
                    </article>
                  ))}
                </div>
                <AdminPagination
                  currentPage={companyPage.meta.page}
                  disabled={loading}
                  onPageChange={changePage}
                  pageSize={companyPage.meta.pageSize}
                  summaryLabel="nhà xe"
                  totalItems={companyPage.meta.totalItems}
                  totalPages={companyPage.meta.totalPages}
                />
              </>
            )}
          </div>
        </section>

        <footer className="admin-page-footer">
          <span>© 2026 VexGo Platform</span>
        </footer>
      </div>
      {selectedCompanyId !== null && (
        <CompanyDetails
          key={selectedCompanyId}
          companyId={selectedCompanyId}
          onClose={() => setSelectedCompanyId(null)}
          onStatusUpdated={handleCompanyStatusUpdated}
          onUpdated={handleCompanyUpdated}
        />
      )}
      {createDialogOpen && (
        <CreateBusCompanyDialog
          onClose={() => setCreateDialogOpen(false)}
          onCreated={handleCompanyCreated}
        />
      )}
    </SuperAdminLayout>
  );
}
