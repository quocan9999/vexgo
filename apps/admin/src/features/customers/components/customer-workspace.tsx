'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminRefreshAction } from '@/components/admin/admin-page-actions';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getCustomerById } from '../services/customer-service';
import type { CustomerDetail } from '../types/customer';
import { CustomerTransactionsTab } from './customer-transactions-tab';
import { CustomerTicketsTab } from './customer-tickets-tab';
import { CustomerShipmentsTab } from './customer-shipments-tab';
import '../customers.css';

type WorkspaceTab = 'overview' | 'transactions' | 'tickets' | 'shipments';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function CustomerWorkspace({ customerId }: { customerId: number }) {
  const isValidId = Number.isSafeInteger(customerId) && customerId > 0;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(isValidId);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(
    isValidId ? null : 'Mã khách hàng không hợp lệ.',
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('transactions');
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (!isValidId) {
      return;
    }

    const controller = new AbortController();
    getCustomerById(customerId, controller.signal)
      .then((data) => {
        setCustomer(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể tải thông tin khách hàng.',
          );
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });

    return () => controller.abort();
  }, [customerId, isValidId, refreshCount]);

  function refresh() {
    setRefreshing(true);
    setRefreshCount((c) => c + 1);
  }

  return (
    <SuperAdminLayout activeSection="customers">
      <div className="admin-page-content">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              <Link className="button button-secondary" href="/customers">
                Quay lại danh sách
              </Link>
              <AdminRefreshAction
                loading={loading || refreshing}
                onClick={refresh}
              />
            </div>
          }
          eyebrow="HỒ SƠ KHÁCH HÀNG"
          title={customer ? customer.fullName : 'Hồ sơ khách hàng'}
          titleId="customer-workspace-title"
        />

        {loading && !customer && (
          <div className="panel customer-workspace-hero" role="status">
            <div className="customers-state-panel">
              <p>Đang tải thông tin khách hàng…</p>
            </div>
          </div>
        )}

        {error && !customer && (
          <div className="panel customer-workspace-hero" role="alert">
            <div className="customers-state-panel">
              <p>{error}</p>
              <div className="customers-error-actions">
                {isValidId && (
                  <Button onClick={refresh} type="button" variant="secondary">
                    Thử lại
                  </Button>
                )}
                <Link className="button button-primary" href="/customers">
                  Về danh sách khách hàng
                </Link>
              </div>
            </div>
          </div>
        )}

        {customer && (
          <>
            <section
              aria-label="Tóm tắt thông tin khách hàng"
              className="panel customer-workspace-hero"
            >
              <div className="customer-hero-meta">
                <div>
                  <span className="customer-code">
                    Mã khách hàng:{' '}
                    <strong className="admin-data-mono">
                      {customer.customerCode}
                    </strong>
                  </span>
                  <h2 className="customer-hero-name">{customer.fullName}</h2>
                </div>
                <AdminStatusBadge
                  tone={
                    customer.account.status === 'HOAT_DONG'
                      ? 'active'
                      : 'muted'
                  }
                >
                  {customer.account.status === 'HOAT_DONG'
                    ? 'Đang hoạt động'
                    : 'Tạm khóa'}
                </AdminStatusBadge>
              </div>

              <dl className="customer-hero-stats">
                <div>
                  <dt>Số điện thoại</dt>
                  <dd>{customer.phoneNumber}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{customer.email || '—'}</dd>
                </div>
                <div>
                  <dt>Điểm tích lũy</dt>
                  <dd>
                    <strong>
                      {customer.loyaltyPoints.toLocaleString('vi-VN')}
                    </strong>{' '}
                    điểm
                  </dd>
                </div>
                <div>
                  <dt>Ngày tham gia</dt>
                  <dd>{formatDateTime(customer.createdAt)}</dd>
                </div>
              </dl>
            </section>

            <div
              aria-label="Các phân hệ hồ sơ khách hàng"
              className="customer-workspace-nav"
              role="tablist"
            >
              <button
                aria-selected={activeTab === 'transactions'}
                className={`customer-workspace-tab-btn${activeTab === 'transactions' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('transactions')}
                role="tab"
                type="button"
              >
                Lịch sử giao dịch
              </button>
              <button
                aria-selected={activeTab === 'tickets'}
                className={`customer-workspace-tab-btn${activeTab === 'tickets' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('tickets')}
                role="tab"
                type="button"
              >
                Vé
              </button>
              <button
                aria-selected={activeTab === 'shipments'}
                className={`customer-workspace-tab-btn${activeTab === 'shipments' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('shipments')}
                role="tab"
                type="button"
              >
                Gửi hàng
              </button>
              <button
                aria-selected={activeTab === 'overview'}
                className={`customer-workspace-tab-btn${activeTab === 'overview' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('overview')}
                role="tab"
                type="button"
              >
                Tổng quan
              </button>
            </div>

            <div className="customer-workspace-tab-content">
              {activeTab === 'overview' && (
                <div className="panel customer-overview-card">
                  <h4>Chi tiết tài khoản liên kết</h4>
                  <dl className="customers-detail-dl">
                    <div className="customers-detail-row">
                      <dt>Mã tài khoản</dt>
                      <dd className="admin-data-mono">
                        #{customer.account.accountId}
                      </dd>
                    </div>
                    <div className="customers-detail-row">
                      <dt>Trạng thái tài khoản</dt>
                      <dd>
                        <AdminStatusBadge
                          tone={
                            customer.account.status === 'HOAT_DONG'
                              ? 'active'
                              : 'muted'
                          }
                        >
                          {customer.account.status === 'HOAT_DONG'
                            ? 'Đang hoạt động'
                            : 'Tạm khóa'}
                        </AdminStatusBadge>
                      </dd>
                    </div>
                    <div className="customers-detail-row">
                      <dt>Xác thực số điện thoại</dt>
                      <dd>
                        {customer.account.phoneVerified
                          ? 'Đã xác thực'
                          : 'Chưa xác thực'}
                      </dd>
                    </div>
                    <div className="customers-detail-row">
                      <dt>Thời gian đăng ký</dt>
                      <dd>{formatDateTime(customer.account.createdAt)}</dd>
                    </div>
                    <div className="customers-detail-row">
                      <dt>Cập nhật lần cuối</dt>
                      <dd>{formatDateTime(customer.account.updatedAt)}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {activeTab === 'transactions' && (
                <CustomerTransactionsTab customerId={customerId} />
              )}

              {activeTab === 'tickets' && (
                <CustomerTicketsTab customerId={customerId} />
              )}

              {activeTab === 'shipments' && (
                <CustomerShipmentsTab customerId={customerId} />
              )}
            </div>
          </>
        )}

        <footer className="admin-page-footer">
          <span>© 2026 VexGo Platform</span>
        </footer>
      </div>
    </SuperAdminLayout>
  );
}
