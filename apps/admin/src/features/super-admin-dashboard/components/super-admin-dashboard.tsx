'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  getBusCompanies,
  getDashboardOverview,
} from '../services/dashboard-service';
import type {
  BusCompany,
  CompanySortKey,
  DashboardOverview,
  PaginatedBusCompanies,
  SortDirection,
} from '../types/dashboard';

const PAGE_SIZE = 10;

function numberFormat(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
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

function StatCard({
  label,
  value,
  note,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: number | null;
  note: string;
  icon: ReactNode;
  tone: 'blue' | 'amber' | 'violet' | 'slate';
  loading: boolean;
}) {
  return (
    <article className="stat-card">
      {loading ? (
        <div className="stat-skeleton" aria-hidden="true">
          <span className="skeleton skeleton-icon" />
          <span className="skeleton skeleton-line skeleton-label" />
          <span className="skeleton skeleton-line skeleton-value" />
          <span className="skeleton skeleton-line skeleton-note" />
        </div>
      ) : (
        <>
          <div className={`stat-icon tone-${tone}`} aria-hidden="true">
            {icon}
          </div>
          <div className="stat-copy">
            <p className="stat-label">{label}</p>
            <p className="stat-value">
              {value === null ? '—' : numberFormat(value)}
            </p>
            <p className="stat-note">
              {value === null ? 'Chưa có dữ liệu' : note}
            </p>
          </div>
        </>
      )}
    </article>
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

function CompanyMark({ name }: { name: string }) {
  return (
    <span className="company-mark" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function CompanyDetails({
  company,
  onClose,
}: {
  company: BusCompany;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, []);

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

        <div className="detail-company-hero">
          <CompanyMark name={company.name} />
          <div>
            <h3>{company.name}</h3>
            <span className="detail-company-id">
              Mã nhà xe · {company.busCompanyId}
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
              <span className="detail-field-value">{company.contactInfo}</span>
            </div>
          </div>
        </section>

        <section
          className="detail-section"
          aria-labelledby="detail-scale-heading"
        >
          <h3 id="detail-scale-heading">Quy mô trên nền tảng</h3>
          <dl className="detail-stats">
            <div>
              <dt>
                <ShieldCheck size={17} /> Tài khoản quản trị nhà xe
              </dt>
              <dd>{numberFormat(company.operatorAdminAccountCount)}</dd>
            </div>
            <div>
              <dt>
                <UsersRound size={17} /> Nhân viên có tài khoản
              </dt>
              <dd>{numberFormat(company.employeeAccountCount)}</dd>
            </div>
            <div>
              <dt>
                <Building2 size={17} /> Tuyến xe
              </dt>
              <dd>{numberFormat(company.routeCount)}</dd>
            </div>
          </dl>
          <p className="detail-footnote">
            Số nhân viên có tài khoản bao gồm các tài khoản quản trị nhà xe.
          </p>
        </section>

        <div className="detail-footer">
          <span className="detail-footer-check">
            <Check size={15} />
          </span>
          <p>
            Dữ liệu tổng hợp từ hồ sơ và tài khoản được liên kết với nhà xe.
          </p>
        </div>
      </div>
    </dialog>
  );
}

export function SuperAdminDashboard() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [companyPage, setCompanyPage] = useState<PaginatedBusCompanies | null>(
    null,
  );
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<CompanySortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedCompany, setSelectedCompany] = useState<BusCompany | null>(
    null,
  );
  const [refreshCount, setRefreshCount] = useState(0);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [showRoleTable, setShowRoleTable] = useState(false);
  const [showStatusTable, setShowStatusTable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    getDashboardOverview(controller.signal)
      .then((data) => {
        if (current) setOverview(data);
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setOverviewError(
            error instanceof Error
              ? error.message
              : 'Không thể tải tổng quan hệ thống.',
          );
        }
      })
      .finally(() => {
        if (current) setOverviewLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [refreshCount]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        const nextSearch = searchInput.trim();
        setSearch(nextSearch);
        setPage(1);
      },
      searchInput.trim() ? 300 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    getBusCompanies(
      {
        search,
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortDirection,
      },
      controller.signal,
    )
      .then((data) => {
        if (current) setCompanyPage(data);
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setCompanyError(
            error instanceof Error
              ? error.message
              : 'Không thể tải danh sách nhà xe.',
          );
        }
      })
      .finally(() => {
        if (current) setCompanyLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [page, refreshCount, search, sortBy, sortDirection]);

  const roleMaximum = useMemo(
    () =>
      Math.max(
        1,
        ...(overview?.accountsByRole.map((role) => role.assignedAccountCount) ??
          []),
      ),
    [overview],
  );
  const activeAccounts =
    overview?.accountsByStatus.find((item) => item.status === 'ACTIVE')
      ?.count ?? 0;
  const totalStatusAccounts =
    overview?.accountsByStatus.reduce((total, item) => total + item.count, 0) ??
    0;
  const activePercentage = totalStatusAccounts
    ? (activeAccounts / totalStatusAccounts) * 100
    : 0;
  const apiMode =
    process.env.NEXT_PUBLIC_ADMIN_DATA_SOURCE?.toLowerCase() === 'api';

  function sortCompanies(key: CompanySortKey) {
    setCompanyLoading(true);
    setCompanyError(null);
    setPage(1);
    if (sortBy === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  }

  function closeMobileNavigation() {
    setMobileNavigationOpen(false);
  }

  function openCompany(company: BusCompany) {
    setSelectedCompany(company);
  }

  function updateCompanySearch(value: string) {
    setCompanyLoading(true);
    setCompanyError(null);
    setSearchInput(value);
  }

  function changeCompanyPage(nextPage: number) {
    setCompanyLoading(true);
    setCompanyError(null);
    setPage(nextPage);
  }

  function sortButton(label: string, column: CompanySortKey) {
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
        onClick={() => openCompany(company)}
        type="button"
      >
        Xem chi tiết <ChevronRight aria-hidden="true" size={15} />
      </button>
    );
  }

  return (
    <div className="admin-shell">
      {mobileNavigationOpen && (
        <button
          aria-label="Đóng điều hướng"
          className="mobile-nav-backdrop"
          onClick={closeMobileNavigation}
          type="button"
        />
      )}
      <aside
        aria-label="Điều hướng quản trị"
        className={`admin-sidebar${mobileNavigationOpen ? ' is-open' : ''}`}
        id="admin-navigation"
      >
        <a
          aria-label="VexGo Super Admin, về đầu trang"
          className="brand-lockup"
          href="#overview"
          onClick={closeMobileNavigation}
        >
          <span className="brand-mark" aria-hidden="true">
            V
          </span>
          <span className="brand-copy">
            <strong>VexGo</strong>
            <small>SUPER ADMIN</small>
          </span>
        </a>

        <div className="sidebar-nav-group">
          <p className="sidebar-label">KHÔNG GIAN QUẢN TRỊ</p>
          <nav aria-label="Các khu vực">
            <a
              aria-current="page"
              className="sidebar-link is-active"
              href="#overview"
              onClick={closeMobileNavigation}
            >
              <span className="sidebar-link-icon">
                <Database size={18} />
              </span>
              <span>Tổng quan</span>
            </a>
            <a
              className="sidebar-link"
              href="#accounts"
              onClick={closeMobileNavigation}
            >
              <span className="sidebar-link-icon">
                <UsersRound size={18} />
              </span>
              <span>Tài khoản</span>
            </a>
            <a
              className="sidebar-link"
              href="#bus-companies"
              onClick={closeMobileNavigation}
            >
              <span className="sidebar-link-icon">
                <Building2 size={18} />
              </span>
              <span>Nhà xe</span>
            </a>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="platform-card">
            <span className="platform-pulse" aria-hidden="true" />
            <div>
              <span className="platform-label">PHẠM VI DỮ LIỆU</span>
              <strong>Toàn hệ thống</strong>
            </div>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">SA</span>
            <span className="profile-copy">
              <strong>Super Admin</strong>
              <small>Quản trị nền tảng</small>
            </span>
            <span aria-hidden="true" className="profile-menu-dots">
              •••
            </span>
          </div>
        </div>
      </aside>

      <main className="admin-main" id="overview">
        <header className="topbar">
          <div className="topbar-left">
            <button
              aria-controls="admin-navigation"
              aria-expanded={mobileNavigationOpen}
              aria-label={mobileNavigationOpen ? 'Đóng menu' : 'Mở menu'}
              className="icon-button mobile-menu-button"
              onClick={() => setMobileNavigationOpen((open) => !open)}
              type="button"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              <span>VexGo</span>
              <span className="breadcrumb-slash">/</span>
              <strong>Quản trị nền tảng</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <span className={`environment-badge${apiMode ? ' is-api' : ''}`}>
              <span className="environment-dot" />
              {apiMode ? 'Kết nối API' : 'Dữ liệu minh họa'}
            </span>
            <span aria-hidden="true" className="topbar-avatar">
              SA
            </span>
          </div>
        </header>

        <div className="dashboard-content">
          <section aria-labelledby="page-title" className="page-intro">
            <div>
              <p className="eyebrow">TRUNG TÂM ĐIỀU HÀNH</p>
              <h1 id="page-title">Tổng quan hệ thống</h1>
              <p className="page-subtitle">
                Theo dõi quy mô nhà xe và tài khoản trên toàn nền tảng VexGo.
              </p>
            </div>
            <div className="page-intro-actions">
              <div className="updated-at" aria-live="polite">
                <span className="updated-dot" />
                <span>
                  {overview
                    ? `Cập nhật lúc ${timestampFormat(overview.generatedAt)}`
                    : 'Đang đồng bộ dữ liệu'}
                </span>
              </div>
              <button
                className="button button-primary"
                disabled={overviewLoading || companyLoading}
                onClick={() => {
                  setOverviewLoading(true);
                  setOverviewError(null);
                  setCompanyLoading(true);
                  setCompanyError(null);
                  setRefreshCount((count) => count + 1);
                }}
                type="button"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={overviewLoading || companyLoading ? 'spin' : ''}
                  size={16}
                />
                Làm mới
              </button>
            </div>
          </section>

          {overviewError && (
            <div className="notice notice-error" role="alert">
              <div>
                <strong>Chưa tải được tổng quan</strong>
                <p>{overviewError}</p>
              </div>
              <button
                className="button button-secondary"
                onClick={() => {
                  setOverviewLoading(true);
                  setOverviewError(null);
                  setRefreshCount((count) => count + 1);
                }}
                type="button"
              >
                Thử lại
              </button>
            </div>
          )}

          <section
            aria-label="Chỉ số toàn hệ thống"
            aria-busy={overviewLoading}
            className="stat-grid"
          >
            <StatCard
              icon={<Building2 size={19} />}
              label="Nhà xe trên nền tảng"
              loading={overviewLoading && !overview}
              note="Đơn vị vận tải đã có hồ sơ"
              tone="blue"
              value={overview?.totals.busCompanies ?? null}
            />
            <StatCard
              icon={<ShieldCheck size={19} />}
              label="Tài khoản quản trị nhà xe"
              loading={overviewLoading && !overview}
              note="Được gán vai trò quản trị"
              tone="amber"
              value={overview?.totals.operatorAdminAccounts ?? null}
            />
            <StatCard
              icon={<UsersRound size={19} />}
              label="Tài khoản khách hàng"
              loading={overviewLoading && !overview}
              note="Khách hàng đã đăng ký"
              tone="violet"
              value={overview?.totals.customerAccounts ?? null}
            />
            <StatCard
              icon={<Database size={19} />}
              label="Tổng tài khoản"
              loading={overviewLoading && !overview}
              note="Tài khoản thuộc nền tảng"
              tone="slate"
              value={overview?.totals.accounts ?? null}
            />
          </section>

          <section
            aria-labelledby="accounts-heading"
            className="analytics-section"
            id="accounts"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">TÀI KHOẢN</p>
                <h2 id="accounts-heading">Cơ cấu tài khoản</h2>
              </div>
              <span className="section-meta">
                {overview ? numberFormat(overview.totals.accounts) : '—'} tài
                khoản
              </span>
            </div>

            <div className="analytics-grid">
              <article
                aria-busy={overviewLoading && !overview}
                className="panel role-panel"
              >
                <div className="panel-heading">
                  <div>
                    <h3>Phân bố theo vai trò</h3>
                    <p>Mỗi tài khoản được tính theo vai trò đã gán.</p>
                  </div>
                  <span className="panel-heading-icon">
                    <UsersRound size={17} />
                  </span>
                </div>
                {overviewLoading && !overview ? (
                  <div className="chart-skeleton" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : overview ? (
                  <>
                    <div
                      className="role-chart"
                      role="img"
                      aria-label="Phân bố số lượt gán tài khoản theo vai trò"
                    >
                      {overview.accountsByRole.map((role, index) => (
                        <div className="role-row" key={role.roleId}>
                          <div className="role-row-label">
                            <span
                              className={`legend-dot role-dot-${index % 3}`}
                            />
                            {role.roleName}
                          </div>
                          <div aria-hidden="true" className="role-track">
                            <span
                              className={`role-fill role-fill-${index % 3}`}
                              style={{
                                width: `${Math.max(1.5, (role.assignedAccountCount / roleMaximum) * 100)}%`,
                              }}
                            />
                          </div>
                          <strong className="role-count">
                            {numberFormat(role.assignedAccountCount)}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <p className="chart-footnote">
                      Một tài khoản có thể được tính ở nhiều vai trò nếu được
                      gán nhiều quyền.
                    </p>
                    <button
                      aria-expanded={showRoleTable}
                      className="text-toggle"
                      onClick={() => setShowRoleTable((show) => !show)}
                      type="button"
                    >
                      {showRoleTable ? 'Ẩn bảng dữ liệu' : 'Xem bảng dữ liệu'}
                    </button>
                    {showRoleTable && (
                      <div className="accessible-table-wrap">
                        <table className="compact-data-table">
                          <caption>Phân bố tài khoản theo vai trò</caption>
                          <thead>
                            <tr>
                              <th scope="col">Vai trò</th>
                              <th scope="col">Số lượt gán</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overview.accountsByRole.map((role) => (
                              <tr key={role.roleId}>
                                <th scope="row">{role.roleName}</th>
                                <td>
                                  {numberFormat(role.assignedAccountCount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="panel-empty">
                    Chưa có dữ liệu phân bố tài khoản.
                  </p>
                )}
              </article>

              <article
                aria-busy={overviewLoading && !overview}
                className="panel status-panel"
              >
                <div className="panel-heading">
                  <div>
                    <h3>Trạng thái tài khoản</h3>
                    <p>Tình trạng hiện tại của tài khoản nền tảng.</p>
                  </div>
                  <span className="panel-heading-icon">
                    <ShieldCheck size={17} />
                  </span>
                </div>
                {overviewLoading && !overview ? (
                  <div className="status-skeleton" aria-hidden="true">
                    <span />
                    <span />
                  </div>
                ) : overview ? (
                  <>
                    <div className="status-chart-row">
                      <div
                        aria-label={`${numberFormat(activeAccounts)} tài khoản đang hoạt động trên ${numberFormat(totalStatusAccounts)} tài khoản`}
                        className="status-donut"
                        role="img"
                        style={{
                          background: `conic-gradient(var(--success) 0 ${activePercentage}%, var(--status-muted) ${activePercentage}% 100%)`,
                        }}
                      >
                        <span>
                          <strong>{Math.round(activePercentage)}%</strong>
                          <small>hoạt động</small>
                        </span>
                      </div>
                      <div className="status-legend">
                        {overview.accountsByStatus.map((item) => (
                          <div className="status-legend-row" key={item.status}>
                            <span
                              className={`legend-dot ${item.status === 'ACTIVE' ? 'legend-success' : 'legend-muted'}`}
                            />
                            <span className="status-legend-name">
                              {item.label}
                            </span>
                            <strong>{numberFormat(item.count)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      aria-expanded={showStatusTable}
                      className="text-toggle status-table-toggle"
                      onClick={() => setShowStatusTable((show) => !show)}
                      type="button"
                    >
                      {showStatusTable ? 'Ẩn bảng dữ liệu' : 'Xem bảng dữ liệu'}
                    </button>
                    {showStatusTable && (
                      <div className="accessible-table-wrap">
                        <table className="compact-data-table">
                          <caption>Phân bố tài khoản theo trạng thái</caption>
                          <thead>
                            <tr>
                              <th scope="col">Trạng thái</th>
                              <th scope="col">Số tài khoản</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overview.accountsByStatus.map((item) => (
                              <tr key={item.status}>
                                <th scope="row">{item.label}</th>
                                <td>{numberFormat(item.count)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="panel-empty">
                    Chưa có dữ liệu trạng thái tài khoản.
                  </p>
                )}
              </article>
            </div>
          </section>

          <section
            aria-labelledby="companies-heading"
            className="companies-section"
            id="bus-companies"
          >
            <div className="section-heading company-section-heading">
              <div>
                <p className="eyebrow">ĐỐI TÁC NỀN TẢNG</p>
                <h2 id="companies-heading">Danh sách nhà xe</h2>
                <p className="section-description">
                  Tra cứu quy mô tài khoản và tuyến xe của từng đơn vị.
                </p>
              </div>
              <span className="company-count-badge">
                <Building2 size={15} />
                {companyPage
                  ? numberFormat(companyPage.meta.totalItems)
                  : overview
                    ? numberFormat(overview.totals.busCompanies)
                    : '—'}{' '}
                nhà xe
              </span>
            </div>

            <div className="panel companies-panel">
              <div className="table-toolbar">
                <label className="search-box">
                  <Search aria-hidden="true" size={17} />
                  <span className="sr-only">Tìm nhà xe</span>
                  <input
                    onChange={(event) =>
                      updateCompanySearch(event.target.value)
                    }
                    placeholder="Tìm theo tên hoặc thông tin liên hệ"
                    type="search"
                    value={searchInput}
                  />
                  {searchInput && (
                    <button
                      aria-label="Xóa nội dung tìm kiếm"
                      className="search-clear"
                      onClick={() => updateCompanySearch('')}
                      type="button"
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <span className="search-hint">
                  {companyPage
                    ? `${numberFormat(companyPage.meta.totalItems)} kết quả`
                    : 'Đang tải kết quả'}
                </span>
              </div>

              {companyError && (
                <div className="table-error" role="alert">
                  <div>
                    <strong>Chưa tải được danh sách nhà xe</strong>
                    <p>{companyError}</p>
                  </div>
                  <button
                    className="button button-secondary"
                    onClick={() => {
                      setCompanyLoading(true);
                      setCompanyError(null);
                      setRefreshCount((count) => count + 1);
                    }}
                    type="button"
                  >
                    Thử lại
                  </button>
                </div>
              )}

              {companyLoading && !companyPage ? <LoadingRows /> : null}
              {!companyLoading &&
                !companyError &&
                companyPage?.items.length === 0 && (
                  <div className="empty-state">
                    <span className="empty-state-icon">
                      <Search size={21} />
                    </span>
                    <h3>Không tìm thấy nhà xe</h3>
                    <p>Thử tìm bằng tên nhà xe hoặc thông tin liên hệ khác.</p>
                    <button
                      className="button button-secondary"
                      onClick={() => updateCompanySearch('')}
                      type="button"
                    >
                      Xóa tìm kiếm
                    </button>
                  </div>
                )}

              {companyPage && companyPage.items.length > 0 && (
                <>
                  <div
                    aria-busy={companyLoading}
                    className={`company-table-scroll${companyLoading ? ' is-loading' : ''}`}
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
                          <th scope="col">Thông tin liên hệ</th>
                          <th
                            aria-sort={
                              sortBy === 'operatorAdminAccountCount'
                                ? sortDirection === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                            scope="col"
                          >
                            {sortButton(
                              'Quản trị',
                              'operatorAdminAccountCount',
                            )}
                          </th>
                          <th
                            aria-sort={
                              sortBy === 'employeeAccountCount'
                                ? sortDirection === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                            scope="col"
                          >
                            {sortButton('Nhân viên', 'employeeAccountCount')}
                          </th>
                          <th
                            aria-sort={
                              sortBy === 'routeCount'
                                ? sortDirection === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                            scope="col"
                          >
                            {sortButton('Tuyến', 'routeCount')}
                          </th>
                          <th scope="col">
                            <span className="sr-only">Thao tác</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {companyPage.items.map((company) => (
                          <tr key={company.busCompanyId}>
                            <th className="company-name-cell" scope="row">
                              <CompanyMark name={company.name} />
                              <span>{company.name}</span>
                            </th>
                            <td className="company-contact-cell">
                              {company.contactInfo}
                            </td>
                            <td>
                              <span className="table-number">
                                {numberFormat(
                                  company.operatorAdminAccountCount,
                                )}
                              </span>
                            </td>
                            <td>
                              <span className="table-number">
                                {numberFormat(company.employeeAccountCount)}
                              </span>
                            </td>
                            <td>
                              <span className="table-number">
                                {numberFormat(company.routeCount)}
                              </span>
                            </td>
                            <td>{companyAction(company)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="company-mobile-list">
                    {companyPage.items.map((company) => (
                      <article
                        className="company-mobile-card"
                        key={company.busCompanyId}
                      >
                        <div className="company-mobile-head">
                          <CompanyMark name={company.name} />
                          <div>
                            <h3>{company.name}</h3>
                            <p>{company.contactInfo}</p>
                          </div>
                        </div>
                        <div className="company-mobile-stats">
                          <span>
                            Quản trị{' '}
                            <strong>
                              {numberFormat(company.operatorAdminAccountCount)}
                            </strong>
                          </span>
                          <span>
                            Nhân viên{' '}
                            <strong>
                              {numberFormat(company.employeeAccountCount)}
                            </strong>
                          </span>
                          <span>
                            Tuyến{' '}
                            <strong>{numberFormat(company.routeCount)}</strong>
                          </span>
                        </div>
                        {companyAction(company)}
                      </article>
                    ))}
                  </div>
                  <p className="table-footnote">
                    Số nhân viên có tài khoản bao gồm các tài khoản quản trị nhà
                    xe.
                  </p>
                  <div className="table-pagination">
                    <span className="pagination-summary">
                      Hiển thị{' '}
                      <strong>
                        {(companyPage.meta.page - 1) *
                          companyPage.meta.pageSize +
                          1}
                        –
                        {Math.min(
                          companyPage.meta.page * companyPage.meta.pageSize,
                          companyPage.meta.totalItems,
                        )}
                      </strong>{' '}
                      trong{' '}
                      <strong>
                        {numberFormat(companyPage.meta.totalItems)}
                      </strong>{' '}
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
                        disabled={companyLoading || companyPage.meta.page <= 1}
                        onClick={() => changeCompanyPage(Math.max(1, page - 1))}
                        type="button"
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button
                        aria-label="Trang sau"
                        className="pagination-button"
                        disabled={
                          companyLoading ||
                          companyPage.meta.page >= companyPage.meta.totalPages
                        }
                        onClick={() => changeCompanyPage(page + 1)}
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
            <span>
              <span className="footer-status-dot" />
              Trạng thái nền tảng: ổn định
            </span>
          </footer>
        </div>
      </main>

      {selectedCompany && (
        <CompanyDetails
          key={selectedCompany.busCompanyId}
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
  );
}
