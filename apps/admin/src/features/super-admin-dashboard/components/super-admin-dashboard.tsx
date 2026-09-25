'use client';

import {
  Building2,
  Database,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getDashboardOverview } from '../services/dashboard-service';
import type { DashboardOverview } from '../types/dashboard';

function numberFormat(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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

export function SuperAdminDashboard() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
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
  return (
    <SuperAdminLayout activeSection="overview">
      <div className="admin-page-content">
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
              disabled={overviewLoading}
              onClick={() => {
                setOverviewLoading(true);
                setOverviewError(null);
                setRefreshCount((count) => count + 1);
              }}
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                className={overviewLoading ? 'spin' : ''}
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
                    Một tài khoản có thể được tính ở nhiều vai trò nếu được gán
                    nhiều quyền.
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
                              <td>{numberFormat(role.assignedAccountCount)}</td>
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

        <footer className="admin-page-footer">
          <span>© 2026 VexGo Platform</span>
          <span>
            <span className="footer-status-dot" />
            Trạng thái nền tảng: ổn định
          </span>
        </footer>
      </div>
    </SuperAdminLayout>
  );
}
