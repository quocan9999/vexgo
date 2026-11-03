'use client';

import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ResourceConfirmation,
  ResourceNotice,
  ResourceSheet,
  ResourceStatusBadge,
  ResourceState,
} from '@/components/admin/resource-ui';
import { Button, buttonVariants } from '@/components/ui/action-button';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasAdminPermission } from '@/features/admin-auth/services/admin-access';
import { getCustomerById, updateCustomerStatus } from '../services/customer-service';
import type { CustomerDetail } from '../types/customer';

function timestampFormat(value?: string | null) {
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


function getCustomerAccountStatusBadge(status: string, lockedUntil?: string | null) {
  if (status === 'HOAT_DONG') {
    return { tone: 'active' as const, label: 'Đang hoạt động' };
  }
  if (status === 'BI_KHOA') {
    return { tone: 'danger' as const, label: 'Bị khóa' };
  }
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

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; customer: CustomerDetail };

interface CustomerDetailsProps {
  customerId: number;
  onClose: () => void;
  onCustomerUpdated?: (updated: CustomerDetail) => void;
}

export function CustomerDetails({
  customerId,
  onClose,
  onCustomerUpdated,
}: CustomerDetailsProps) {
  const authState = useAdminSession();
  const session = authState.status === 'authenticated' ? authState.session : null;
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

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
    const controller = new AbortController();
    getCustomerById(customerId, controller.signal)
      .then((customer) => {
        if (!controller.signal.aborted) {
          setDetail({ status: 'success', customer });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDetail({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Không thể tải thông tin khách hàng.',
          });
        }
      });

    return () => controller.abort();
  }, [customerId, retryCount]);

  function retry() {
    setDetail({ status: 'loading' });
    setRetryCount((c) => c + 1);
  }

  async function handleConfirmStatusChange() {
    if (detail.status !== 'success') return;
    const isLocking = detail.customer.account.status === 'HOAT_DONG';

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

      const updatedCustomer: CustomerDetail = {
        ...detail.customer,
        account: {
          ...detail.customer.account,
          status: response.accountStatus,
          lockedUntil: response.lockedUntil,
          lockReason: response.lockReason,
          updatedAt: response.updatedAt,
        },
      };
      setDetail({ status: 'success', customer: updatedCustomer });
      onCustomerUpdated?.(updatedCustomer);

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
    <>
      <ResourceSheet
        title="Chi tiết khách hàng"
        description="Thông tin liên hệ, hồ sơ cá nhân và tài khoản liên kết."
        onClose={onClose}
      >
        {detail.status === 'loading' && (
          <ResourceState loading>
            <p>Đang tải thông tin khách hàng…</p>
          </ResourceState>
        )}

        {detail.status === 'error' && (
          <ResourceState error>
            <p>{detail.message}</p>
            <Button onClick={retry} type="button" variant="outline">
              Thử lại
            </Button>
          </ResourceState>
        )}

        {detail.status === 'success' && (
          <div className="space-y-6">
            <div className="space-y-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:break-words">
              <h3>{detail.customer.fullName}</h3>
              <span className="block text-xs text-muted-foreground">
                Mã khách hàng ·{' '}
                <span className="admin-data-mono">
                  {detail.customer.customerCode}
                </span>
              </span>
            </div>

            <section
              className="space-y-4 border-t pt-5"
              aria-labelledby="customer-info-heading"
            >
              <h4 id="customer-info-heading" className="text-base font-semibold">
                Thông tin liên hệ
              </h4>
              <dl className="grid grid-cols-2 gap-4 text-[13px]">
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Số điện thoại</dt>
                  <dd>{detail.customer.phoneNumber}</dd>
                </div>
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Email</dt>
                  <dd>{detail.customer.email || '—'}</dd>
                </div>
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Điểm tích lũy</dt>
                  <dd>
                    <strong>
                      {detail.customer.loyaltyPoints.toLocaleString('vi-VN')}
                    </strong>{' '}
                    điểm
                  </dd>
                </div>
              </dl>
            </section>

            <section
              className="space-y-4 border-t pt-5"
              aria-labelledby="customer-profile-heading"
            >
              <h4
                id="customer-profile-heading"
                className="text-base font-semibold"
              >
                Hồ sơ cá nhân
              </h4>
              <dl className="grid grid-cols-2 gap-4 text-[13px]">
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Ngày sinh</dt>
                  <dd>{formatCalendarDate(detail.customer.dateOfBirth)}</dd>
                </div>
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Giới tính</dt>
                  <dd>{formatGender(detail.customer.gender)}</dd>
                </div>
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Số CCCD / Định danh</dt>
                  <dd className="admin-data-mono">
                    {detail.customer.citizenId || '—'}
                  </dd>
                </div>
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Địa chỉ</dt>
                  <dd>{detail.customer.address || '—'}</dd>
                </div>
              </dl>
            </section>

            <section
              className="space-y-4 border-t pt-5"
              aria-labelledby="customer-account-heading"
            >
              <h4
                id="customer-account-heading"
                className="text-base font-semibold"
              >
                Tài khoản liên kết
              </h4>
              <dl className="grid grid-cols-2 gap-4 text-[13px]">
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Mã tài khoản</dt>
                  <dd className="admin-data-mono">
                    #{detail.customer.account.accountId}
                  </dd>
                </div>
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Trạng thái tài khoản</dt>
                  <dd>
                    {(() => {
                      const { tone, label } = getCustomerAccountStatusBadge(
                        detail.customer.account.status,
                        detail.customer.account.lockedUntil,
                      );
                      return (
                        <ResourceStatusBadge tone={tone}>
                          {label}
                        </ResourceStatusBadge>
                      );
                    })()}
                  </dd>
                </div>
                {detail.customer.account.lockedUntil && detail.customer.account.status === 'TAM_KHOA' && (
                  <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <dt>Hạn tạm khóa</dt>
                    <dd className="admin-data-mono font-medium text-amber-600 dark:text-amber-400">
                      {detail.customer.account.lockedUntil}
                    </dd>
                  </div>
                )}
                {detail.customer.account.lockReason && detail.customer.account.status !== 'HOAT_DONG' && (
                  <div className="min-w-0 col-span-2 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <dt>Lý do khóa</dt>
                    <dd className="text-destructive font-medium">
                      {detail.customer.account.lockReason}
                    </dd>
                  </div>
                )}
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Xác thực số điện thoại</dt>
                  <dd>
                    {detail.customer.account.phoneVerified
                      ? 'Đã xác thực'
                      : 'Chưa xác thực'}
                  </dd>
                </div>
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Ngày tạo tài khoản</dt>
                  <dd>{timestampFormat(detail.customer.account.createdAt)}</dd>
                </div>
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Cập nhật tài khoản</dt>
                  <dd>{timestampFormat(detail.customer.account.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            <section
              className="space-y-4 border-t pt-5"
              aria-labelledby="customer-meta-heading"
            >
              <h4 id="customer-meta-heading" className="text-base font-semibold">
                Thông tin hệ thống
              </h4>
              <dl className="grid grid-cols-2 gap-4 text-[13px]">
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Ngày tạo hồ sơ</dt>
                  <dd>{timestampFormat(detail.customer.createdAt)}</dd>
                </div>
                <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                  <dt>Cập nhật hồ sơ</dt>
                  <dd>{timestampFormat(detail.customer.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              {canUpdateStatus ? (
                <Button
                  variant={
                    detail.customer.account.status === 'HOAT_DONG'
                      ? 'outline'
                      : 'default'
                  }
                  className={
                    detail.customer.account.status === 'HOAT_DONG'
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
                  {detail.customer.account.status === 'HOAT_DONG'
                    ? 'Khóa tài khoản'
                    : 'Mở khóa tài khoản'}
                </Button>
              ) : (
                <span />
              )}
              <Link
                className={buttonVariants()}
                href={`/customers/${detail.customer.customerId}`}
              >
                Xem lịch sử hoạt động
              </Link>
            </div>
          </div>
        )}
      </ResourceSheet>

      {canUpdateStatus && statusDialogOpen && detail.status === 'success' && (
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
            detail.customer.account.status === 'HOAT_DONG'
              ? 'Khóa tài khoản khách hàng?'
              : 'Mở khóa tài khoản khách hàng?'
          }
          description={
            detail.customer.account.status === 'HOAT_DONG'
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
                  detail.customer.account.status === 'HOAT_DONG'
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
                  : detail.customer.account.status === 'HOAT_DONG'
                    ? 'Xác nhận khóa tài khoản'
                    : 'Xác nhận mở khóa'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {detail.customer.account.status === 'HOAT_DONG' && (
              <>
                <Field>
                  <FieldLabel id="customer-lock-mode-label">
                    Hình thức khóa <span className="text-destructive">*</span>
                  </FieldLabel>
                  <RadioGroup
                    aria-labelledby="customer-lock-mode-label"
                    value={lockMode}
                    onValueChange={(val) => {
                      setLockMode(val as 'TAM_KHOA' | 'BI_KHOA');
                      if (lockedUntilError) setLockedUntilError(null);
                    }}
                    className="flex flex-wrap gap-6 pt-1"
                  >
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <RadioGroupItem value="TAM_KHOA" id="details-radio-tam-khoa" />
                      <span>Tạm khóa</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <RadioGroupItem value="BI_KHOA" id="details-radio-bi-khoa" />
                      <span>Khóa vĩnh viễn</span>
                    </label>
                  </RadioGroup>
                </Field>

                {lockMode === 'TAM_KHOA' && (
                  <Field>
                    <FieldLabel htmlFor="customer-locked-until">
                      Tạm khóa đến ngày <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="customer-locked-until"
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
                <FieldLabel htmlFor="customer-status-reason">
                  {detail.customer.account.status === 'HOAT_DONG'
                    ? 'Lý do khóa (tùy chọn)'
                    : 'Lý do mở khóa (tùy chọn)'}
                </FieldLabel>
                <span className="text-xs text-muted-foreground">
                  {statusReason.length}/255
                </span>
              </div>
              <Textarea
                id="customer-status-reason"
                maxLength={255}
                value={statusReason}
                onChange={(e) => {
                  setStatusReason(e.target.value);
                  if (statusReasonError) setStatusReasonError(null);
                }}
                placeholder={
                  detail.customer.account.status === 'HOAT_DONG'
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
    </>
  );
}
