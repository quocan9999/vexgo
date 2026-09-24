'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  DateRangeFilter,
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/data-filters';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useBusCompanies } from '../hooks/use-bus-companies';
import { getBusCompanyById } from '../services/bus-company-service';
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
}: {
  companyId: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detailState, setDetailState] = useState<CompanyDetailState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

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

  return (
    <dialog
      aria-labelledby="company-detail-title"
      className="company-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          (event.currentTarget as HTMLDialogElement).close();
        }
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="detail-panel">
        <div className="detail-heading">
          <div className="detail-heading-copy">
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

        {detailState.status === 'loading' && (
          <p role="status">Đang tải thông tin nhà xe…</p>
        )}

        {detailState.status === 'error' && (
          <div role="alert">
            <p>{detailState.message}</p>
            <button
              className="button button-secondary"
              onClick={retry}
              type="button"
            >
              Thử lại
            </button>
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
                    <span
                      className={`company-status-badge${detailState.company.status === 'HOAT_DONG' ? ' is-active' : ''}`}
                    >
                      {statusLabel(detailState.company.status)}
                    </span>
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
          </>
        )}
      </div>
    </dialog>
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
        onClick={() => setSelectedCompanyId(company.busCompanyId)}
        type="button"
      >
        Xem chi tiết <ChevronRight aria-hidden="true" size={15} />
      </button>
    );
  }

  return (
    <SuperAdminLayout activeSection="bus-companies" apiMode>
      <div className="dashboard-content">
        <section aria-labelledby="page-title" className="page-intro">
          <div>
            <p className="eyebrow">ĐỐI TÁC NỀN TẢNG</p>
            <h1 id="page-title">Quản lý nhà xe</h1>
          </div>
          <div className="page-intro-actions">
            <button
              className="button button-primary"
              disabled={loading}
              onClick={refresh}
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                className={loading ? 'spin' : ''}
                size={16}
              />
              Làm mới
            </button>
          </div>
        </section>

        <section
          aria-labelledby="companies-heading"
          className="companies-section"
        >
          <div className="section-heading company-section-heading">
            <div>
            </div>
            <span className="company-count-badge">
              <Building2 size={15} />
              {companyPage
                ? numberFormat(companyPage.meta.totalItems)
                : '—'}{' '}
              nhà xe
            </span>
          </div>

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
                <button
                  className="button button-secondary"
                  onClick={refresh}
                  type="button"
                >
                  Thử lại
                </button>
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
                          <td className="company-contact-cell">
                            {company.contactInfo || '—'}
                          </td>
                          <td>
                            <span
                              className={`company-status-badge${company.status === 'HOAT_DONG' ? ' is-active' : ''}`}
                            >
                              {statusLabel(company.status)}
                            </span>
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
                <div className="table-pagination">
                  <span className="pagination-summary">
                    Hiển thị{' '}
                    <strong>
                      {(companyPage.meta.page - 1) * companyPage.meta.pageSize +
                        1}
                      –
                      {Math.min(
                        companyPage.meta.page * companyPage.meta.pageSize,
                        companyPage.meta.totalItems,
                      )}
                    </strong>{' '}
                    trong{' '}
                    <strong>{numberFormat(companyPage.meta.totalItems)}</strong>{' '}
                    nhà xe
                  </span>
                  <div
                    className="pagination-controls"
                    aria-label="Phân trang nhà xe"
                  >
                    <span>
                      Trang <strong>{companyPage.meta.page}</strong> /{' '}
                      {companyPage.meta.totalPages}
                    </span>
                    <button
                      aria-label="Trang trước"
                      className="pagination-button"
                      disabled={loading || companyPage.meta.page <= 1}
                      onClick={() =>
                        changePage(Math.max(1, companyPage.meta.page - 1))
                      }
                      type="button"
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      aria-label="Trang sau"
                      className="pagination-button"
                      disabled={
                        loading ||
                        companyPage.meta.page >= companyPage.meta.totalPages
                      }
                      onClick={() => changePage(companyPage.meta.page + 1)}
                      type="button"
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <footer className="dashboard-footer">
          <span>© 2026 VexGo Platform</span>
        </footer>
      </div>
      {selectedCompanyId !== null && (
        <CompanyDetails
          key={selectedCompanyId}
          companyId={selectedCompanyId}
          onClose={() => setSelectedCompanyId(null)}
        />
      )}
    </SuperAdminLayout>
  );
}
