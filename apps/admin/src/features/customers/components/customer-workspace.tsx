'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getCustomerById } from '../services/customer-service';
import type { CustomerDetail } from '../types/customer';
import { CustomerTransactionsTab } from './customer-transactions-tab';
import '../customers.css';

type WorkspaceTab = 'overview' | 'transactions';

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
      <AdminPageHeader
        actions={
          <div className="customer-workspace-header-actions">
            <Link className="button button-secondary" href="/customers">
              Quay lại danh sách
            </Link>
            <Button
              aria-busy={refreshing}
              disabled={loading || refreshing}
              onClick={refresh}
              type="button"
              variant="secondary"
            >
              <RefreshCw
                aria-hidden="true"
                className={refreshing ? 'animate-spin' : undefined}
                size={16}
              />
              Làm mới
            </Button>
          </div>
        }
        eyebrow="HỒ SƠ KHÁCH HÀNG"
        title={customer ? customer.fullName : 'Hồ sơ khách hàng'}
        titleId="customer-workspace-title"
      />

      {loading && !customer && (
        <div className="customers-state-panel" role="status">
          <p>Đang tải thông tin khách hàng…</p>
        </div>
      )}

      {error && !customer && (
        <div className="admin-error-panel" role="alert">
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
      )}

      {customer && (
        <div className="customer-workspace-body">
          <section
            aria-label="Tóm tắt thông tin khách hàng"
            className="customer-workspace-hero"
          >
            <div className="customer-hero-meta">
              <span className="customer-code">
                Mã khách hàng: <strong>{customer.customerCode}</strong>
              </span>
              <AdminStatusBadge
                tone={
                  customer.account.status === 'HOAT_DONG' ? 'active' : 'muted'
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
                <dd><strong>{customer.phoneNumber}</strong></dd>
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
            </dl>
          </section>

          <nav
            aria-label="Phân hệ hồ sơ hoạt động"
            className="customer-workspace-tabs"
            role="tablist"
          >
            <button
              aria-controls="panel-overview"
              aria-selected={activeTab === 'overview'}
              className={`button ${activeTab === 'overview' ? 'button-primary' : 'button-secondary'}`}
              id="tab-overview"
              onClick={() => setActiveTab('overview')}
              role="tab"
              type="button"
            >
              Tổng quan
            </button>
            <button
              aria-controls="panel-transactions"
              aria-selected={activeTab === 'transactions'}
              className={`button ${activeTab === 'transactions' ? 'button-primary' : 'button-secondary'}`}
              id="tab-transactions"
              onClick={() => setActiveTab('transactions')}
              role="tab"
              type="button"
            >
              Lịch sử giao dịch
            </button>
          </nav>

          <div className="customer-workspace-panels">
            {activeTab === 'overview' && (
              <section
                aria-labelledby="tab-overview"
                className="customer-workspace-panel"
                id="panel-overview"
                role="tabpanel"
              >
                <h3 className="sr-only">Thông tin tổng quan</h3>
                <div className="customer-overview-card">
                  <h4>Tài khoản liên kết</h4>
                  <dl className="customers-detail-dl">
                    <div className="customers-detail-row">
                      <dt>Mã tài khoản</dt>
                      <dd>#{customer.account.accountId}</dd>
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
                      <dt>Ngày tạo tài khoản</dt>
                      <dd>{formatDateTime(customer.account.createdAt)}</dd>
                    </div>
                    <div className="customers-detail-row">
                      <dt>Cập nhật tài khoản</dt>
                      <dd>{formatDateTime(customer.account.updatedAt)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="customer-overview-card">
                  <h4>Thông tin hệ thống</h4>
                  <dl className="customers-detail-dl">
                    <div className="customers-detail-row">
                      <dt>Ngày tạo hồ sơ</dt>
                      <dd>{formatDateTime(customer.createdAt)}</dd>
                    </div>
                    <div className="customers-detail-row">
                      <dt>Cập nhật hồ sơ</dt>
                      <dd>{formatDateTime(customer.updatedAt)}</dd>
                    </div>
                  </dl>
                </div>
              </section>
            )}

            {activeTab === 'transactions' && (
              <section
                aria-labelledby="tab-transactions"
                className="customer-workspace-panel"
                id="panel-transactions"
                role="tabpanel"
              >
                <h3 className="sr-only">Lịch sử giao dịch</h3>
                <CustomerTransactionsTab customerId={customerId} />
              </section>
            )}
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}
