'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceRefreshAction,
  ResourceStatusBadge,
  ResourceState,
  ResourceNotice,
} from '@/components/admin/resource-ui';
import { Button, buttonVariants } from '@/components/ui/action-button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getCustomerById } from '../services/customer-service';
import type { CustomerDetail } from '../types/customer';
import { CustomerTransactionsTab } from './customer-transactions-tab';
import { CustomerTicketsTab } from './customer-tickets-tab';
import { CustomerShipmentsTab } from './customer-shipments-tab';

type WorkspaceTab = 'overview' | 'transactions' | 'tickets' | 'shipments';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(value))
    .replaceAll('/', '-');
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
        if (controller.signal.aborted) return;
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
        if (controller.signal.aborted) return;
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
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              <Link
                className={buttonVariants({ variant: 'outline' })}
                href="/customers"
              >
                Quay lại danh sách
              </Link>
              <ResourceRefreshAction
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
          <ResourceState loading>
            <p>Đang tải thông tin khách hàng…</p>
          </ResourceState>
        )}

        {error && !customer && (
          <ResourceState error>
            <p>{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {isValidId && (
                <Button onClick={refresh} type="button" variant="outline">
                  Thử lại
                </Button>
              )}
              <Link className={buttonVariants()} href="/customers">
                Về danh sách khách hàng
              </Link>
            </div>
          </ResourceState>
        )}

        {error && customer && (
          <ResourceNotice kind="error">{error}</ResourceNotice>
        )}

        {customer && (
          <>
            <section
              aria-label="Tóm tắt thông tin khách hàng"
              className="space-y-5 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
              aria-busy={refreshing}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div>
                  <span className="text-xs text-muted-foreground">
                    Mã khách hàng:{' '}
                    <strong className="admin-data-mono">
                      {customer.customerCode}
                    </strong>
                  </span>
                  <h2 className="mt-1 text-base font-semibold">
                    {customer.fullName}
                  </h2>
                </div>
                <ResourceStatusBadge
                  tone={
                    customer.account.status === 'HOAT_DONG' ? 'active' : 'muted'
                  }
                >
                  {customer.account.status === 'HOAT_DONG'
                    ? 'Đang hoạt động'
                    : 'Tạm khóa'}
                </ResourceStatusBadge>
              </div>

              <dl className="grid grid-cols-2 gap-5 text-[13px] lg:grid-cols-4 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
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

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
              className="min-w-0 gap-5"
            >
              <div className="max-w-full">
                <TabsList
                  aria-label="Các phân hệ hồ sơ khách hàng"
                  className="grid w-full grid-cols-2 sm:inline-flex sm:w-fit"
                >
                  <TabsTrigger value="transactions">
                    Lịch sử giao dịch
                  </TabsTrigger>
                  <TabsTrigger value="tickets">Vé</TabsTrigger>
                  <TabsTrigger value="shipments">Gửi hàng</TabsTrigger>
                  <TabsTrigger value="overview">Tổng quan</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="overview">
                {activeTab === 'overview' && (
                  <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-5 [&_h4]:text-base [&_h4]:font-semibold">
                    <h4>Chi tiết tài khoản liên kết</h4>
                    <dl className="grid gap-5 text-[13px] sm:grid-cols-2">
                      <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                        <dt>Mã tài khoản</dt>
                        <dd className="admin-data-mono">
                          #{customer.account.accountId}
                        </dd>
                      </div>
                      <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                        <dt>Trạng thái tài khoản</dt>
                        <dd>
                          <ResourceStatusBadge
                            tone={
                              customer.account.status === 'HOAT_DONG'
                                ? 'active'
                                : 'muted'
                            }
                          >
                            {customer.account.status === 'HOAT_DONG'
                              ? 'Đang hoạt động'
                              : 'Tạm khóa'}
                          </ResourceStatusBadge>
                        </dd>
                      </div>
                      <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                        <dt>Xác thực số điện thoại</dt>
                        <dd>
                          {customer.account.phoneVerified
                            ? 'Đã xác thực'
                            : 'Chưa xác thực'}
                        </dd>
                      </div>
                      <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                        <dt>Thời gian đăng ký</dt>
                        <dd>{formatDateTime(customer.account.createdAt)}</dd>
                      </div>
                      <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                        <dt>Cập nhật lần cuối</dt>
                        <dd>{formatDateTime(customer.account.updatedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="transactions">
                {activeTab === 'transactions' && (
                  <CustomerTransactionsTab customerId={customerId} />
                )}
              </TabsContent>
              <TabsContent value="tickets">
                {activeTab === 'tickets' && (
                  <CustomerTicketsTab customerId={customerId} />
                )}
              </TabsContent>
              <TabsContent value="shipments">
                {activeTab === 'shipments' && (
                  <CustomerShipmentsTab customerId={customerId} />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
