'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceRefreshAction,
  ResourceStatusBadge,
  ResourceState,
  ResourceNotice,
  ResourceConfirmation,
} from '@/components/admin/resource-ui';
import { Button, buttonVariants } from '@/components/ui/action-button';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasAdminPermission } from '@/features/admin-auth/services/admin-access';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getCustomerById, updateCustomerStatus } from '../services/customer-service';
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

function formatCalendarDate(value?: string | null) {
  if (!value) return '—';
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  if (year && month && day) {
    return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
  }
  return value;
}

function formatGender(gender?: string | null) {
  if (!gender) return '—';
  switch (gender.toUpperCase()) {
    case 'NAM':
      return 'Nam';
    case 'NU':
      return 'Nữ';
    case 'KHAC':
      return 'Khác';
    default:
      return gender;
  }
}

function getStatusBadgeConfig(status: string, lockedUntil?: string | null) {
  if (status === 'HOAT_DONG') return { tone: 'active' as const, label: 'Đang hoạt động' };
  if (status === 'BI_KHOA') return { tone: 'danger' as const, label: 'Bị khóa' };
  return {
    tone: 'warning' as const,
    label: lockedUntil ? `Tạm khóa đến ${lockedUntil}` : 'Tạm khóa',
  };
}

function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
export function CustomerWorkspace({ customerId }: { customerId: number }) {
  const authState = useAdminSession();
  const session = authState.status === 'authenticated' ? authState.session : null;
  const isValidId = Number.isSafeInteger(customerId) && customerId > 0;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(isValidId);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(
    isValidId ? null : 'Mã khách hàng không hợp lệ.',
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('transactions');
  const [refreshCount, setRefreshCount] = useState(0);

  // Status dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [lockMode, setLockMode] = useState<'TAM_KHOA' | 'BI_KHOA'>('TAM_KHOA');
  const [lockedUntilDate, setLockedUntilDate] = useState('');
  const [lockedUntilError, setLockedUntilError] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusReasonError, setStatusReasonError] = useState<string | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const canUpdateStatus =
    hasAdminPermission(session, 'customer:update_status') ||
    session?.roles.includes('SUPER_ADMIN') ||
    session?.roles.includes('NHA_XE_ADMIN');

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

  async function handleConfirmStatusChange() {
    if (!customer) return;
    const isLocking = customer.account.status === 'HOAT_DONG';

    let hasError = false;
    if (isLocking && lockMode === 'TAM_KHOA') {
      if (!lockedUntilDate) {
        setLockedUntilError('Vui lòng chọn ngày hết hạn tạm khóa.');
        hasError = true;
      } else {
        const selected = new Date(`${lockedUntilDate}T00:00:00Z`);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (selected <= today) {
          setLockedUntilError('Ngày hết hạn tạm khóa phải là ngày trong tương lai.');
          hasError = true;
        } else {
          setLockedUntilError(null);
        }
      }
    }

    const trimmedReason = statusReason.trim();
    if (trimmedReason.length > 255) {
      setStatusReasonError('Lý do không được vượt quá 255 ký tự.');
      hasError = true;
    } else {
      setStatusReasonError(null);
    }

    if (hasError) return;

    setStatusSubmitting(true);
    setStatusError(null);

    try {
      const targetStatus = isLocking ? lockMode : 'HOAT_DONG';
      const payload: { status: 'HOAT_DONG' | 'TAM_KHOA' | 'BI_KHOA'; reason?: string; lockedUntil?: string } = {
        status: targetStatus,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      };

      if (isLocking && lockMode === 'TAM_KHOA') {
        const [y, m, d] = lockedUntilDate.split('-');
        payload.lockedUntil = `${d}-${m}-${y}`;
      }

      const response = await updateCustomerStatus(customerId, payload);

      toast.success(response.message || 'Cập nhật trạng thái tài khoản thành công.');
      setCustomer((prev) =>
        prev
          ? {
              ...prev,
              account: {
                ...prev.account,
                status: response.accountStatus,
                lockedUntil: response.lockedUntil,
                lockReason: response.lockReason,
                updatedAt: response.updatedAt,
              },
            }
          : null,
      );
      setStatusDialogOpen(false);
      setStatusReason('');
      setLockedUntilDate('');
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.',
      );
    } finally {
      setStatusSubmitting(false);
    }
  }

  return (
    <SuperAdminLayout
      activeSection="customers"
      breadcrumbs={[
        { label: 'Quản lý khách hàng', href: '/customers' },
        {
          label: customer
            ? `${customer.fullName} (${customer.customerCode})`
            : 'Chi tiết khách hàng',
        },
      ]}
    >
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              <Button
                nativeButton={false}
                render={<Link href="/customers" />}
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                Quay lại danh sách
              </Button>
              {canUpdateStatus && customer && (
                <Button
                  variant={
                    customer.account.status === 'HOAT_DONG'
                      ? 'outline'
                      : 'default'
                  }
                  className={
                    customer.account.status === 'HOAT_DONG'
                      ? 'text-destructive hover:bg-destructive/10 hover:text-destructive'
                      : ''
                  }
                  onClick={() => {
                    setStatusReason('');
                    setStatusError(null);
                    setStatusReasonError(null);
                    setLockMode('TAM_KHOA');
                    setLockedUntilDate('');
                    setLockedUntilError(null);
                    setStatusDialogOpen(true);
                  }}
                >
                  {customer.account.status === 'HOAT_DONG'
                    ? 'Khóa tài khoản'
                    : 'Mở khóa tài khoản'}
                </Button>
              )}
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
                {(() => {
                  const { tone, label } = getStatusBadgeConfig(
                    customer.account.status,
                    customer.account.lockedUntil,
                  );
                  return (
                    <ResourceStatusBadge tone={tone}>
                      {label}
                    </ResourceStatusBadge>
                  );
                })()}
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
                  <div className="space-y-6">
                    <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-5 [&_h4]:text-base [&_h4]:font-semibold">
                      <h4>Hồ sơ cá nhân</h4>
                      <dl className="grid gap-5 text-[13px] sm:grid-cols-2">
                        <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                          <dt>Ngày sinh</dt>
                          <dd>{formatCalendarDate(customer.dateOfBirth)}</dd>
                        </div>
                        <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                          <dt>Giới tính</dt>
                          <dd>{formatGender(customer.gender)}</dd>
                        </div>
                        <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                          <dt>Số CCCD / Định danh</dt>
                          <dd className="admin-data-mono">{customer.citizenId || '—'}</dd>
                        </div>
                        <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                          <dt>Địa chỉ</dt>
                          <dd>{customer.address || '—'}</dd>
                        </div>
                      </dl>
                    </div>

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
                            {(() => {
                              const { tone, label } = getStatusBadgeConfig(
                                customer.account.status,
                                customer.account.lockedUntil,
                              );
                              return (
                                <ResourceStatusBadge tone={tone}>
                                  {label}
                                </ResourceStatusBadge>
                              );
                            })()}
                          </dd>
                        </div>
                        {customer.account.lockedUntil && customer.account.status === 'TAM_KHOA' && (
                          <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                            <dt>Hạn tạm khóa</dt>
                            <dd className="admin-data-mono font-medium text-amber-600 dark:text-amber-400">
                              {customer.account.lockedUntil}
                            </dd>
                          </div>
                        )}
                        {customer.account.lockReason && customer.account.status !== 'HOAT_DONG' && (
                          <div className="min-w-0 col-span-2 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-words">
                            <dt>Lý do khóa</dt>
                            <dd className="text-destructive font-medium">
                              {customer.account.lockReason}
                            </dd>
                          </div>
                        )}
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

      {canUpdateStatus && statusDialogOpen && customer && (
        <ResourceConfirmation
          busy={statusSubmitting}
          onClose={() => {
            if (!statusSubmitting) {
              setStatusDialogOpen(false);
              setStatusError(null);
              setStatusReasonError(null);
              setLockedUntilError(null);
            }
          }}
          title={
            customer.account.status === 'HOAT_DONG'
              ? 'Khóa tài khoản khách hàng?'
              : 'Mở khóa tài khoản khách hàng?'
          }
          description={
            customer.account.status === 'HOAT_DONG'
              ? 'Tài khoản khách hàng sẽ bị vô hiệu hóa. Khách hàng sẽ không thể đăng nhập hoặc đặt vé, và các phiên đăng nhập đang hoạt động sẽ bị thu hồi ngay lập tức.'
              : 'Tài khoản khách hàng sẽ được kích hoạt trở lại và có thể đăng nhập, đặt vé bình thường.'
          }
          footer={
            <>
              <Button
                disabled={statusSubmitting}
                onClick={() => {
                  if (!statusSubmitting) {
                    setStatusDialogOpen(false);
                    setStatusError(null);
                    setStatusReasonError(null);
                    setLockedUntilError(null);
                  }
                }}
                variant="outline"
              >
                Hủy
              </Button>
              <Button
                aria-busy={statusSubmitting}
                disabled={statusSubmitting}
                variant={
                  customer.account.status === 'HOAT_DONG'
                    ? 'destructive'
                    : 'default'
                }
                onClick={() => void handleConfirmStatusChange()}
              >
                {statusSubmitting && (
                  <LoaderCircle
                    aria-hidden
                    className="motion-safe:animate-spin"
                  />
                )}
                {statusSubmitting
                  ? 'Đang cập nhật…'
                  : customer.account.status === 'HOAT_DONG'
                    ? 'Xác nhận khóa tài khoản'
                    : 'Xác nhận mở khóa'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {customer.account.status === 'HOAT_DONG' && (
              <>
                <Field>
                  <FieldLabel id="workspace-lock-mode-label">
                    Hình thức khóa <span className="text-destructive">*</span>
                  </FieldLabel>
                  <RadioGroup
                    aria-labelledby="workspace-lock-mode-label"
                    value={lockMode}
                    onValueChange={(val) => {
                      setLockMode(val as 'TAM_KHOA' | 'BI_KHOA');
                      if (lockedUntilError) setLockedUntilError(null);
                    }}
                    className="flex flex-wrap gap-6 pt-1"
                  >
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <RadioGroupItem value="TAM_KHOA" id="workspace-radio-tam-khoa" />
                      <span>Tạm khóa</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <RadioGroupItem value="BI_KHOA" id="workspace-radio-bi-khoa" />
                      <span>Khóa vĩnh viễn</span>
                    </label>
                  </RadioGroup>
                </Field>

                {lockMode === 'TAM_KHOA' && (
                  <Field>
                    <FieldLabel htmlFor="workspace-locked-until">
                      Tạm khóa đến ngày <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="workspace-locked-until"
                      type="date"
                      min={getTomorrowDateString()}
                      value={lockedUntilDate}
                      onChange={(e) => {
                        setLockedUntilDate(e.target.value);
                        if (lockedUntilError) setLockedUntilError(null);
                      }}
                      disabled={statusSubmitting}
                    />
                    {lockedUntilError && <FieldError>{lockedUntilError}</FieldError>}
                  </Field>
                )}
              </>
            )}

            <Field>
              <div className="flex justify-between items-center">
                <FieldLabel htmlFor="workspace-status-reason">
                  {customer.account.status === 'HOAT_DONG'
                    ? 'Lý do khóa (tùy chọn)'
                    : 'Lý do mở khóa (tùy chọn)'}
                </FieldLabel>
                <span className="text-xs text-muted-foreground">
                  {statusReason.length}/255
                </span>
              </div>
              <Textarea
                id="workspace-status-reason"
                maxLength={255}
                value={statusReason}
                onChange={(e) => {
                  setStatusReason(e.target.value);
                  if (statusReasonError) setStatusReasonError(null);
                }}
                placeholder={
                  customer.account.status === 'HOAT_DONG'
                    ? 'Nhập lý do khóa nếu có (tối đa 255 ký tự)...'
                    : 'Nhập lý do mở khóa nếu có (tối đa 255 ký tự)...'
                }
                rows={3}
                disabled={statusSubmitting}
              />
              {statusReasonError && <FieldError>{statusReasonError}</FieldError>}
            </Field>

            {statusError && (
              <ResourceNotice kind="error">{statusError}</ResourceNotice>
            )}
          </div>
        </ResourceConfirmation>
      )}
    </SuperAdminLayout>
  );
}
