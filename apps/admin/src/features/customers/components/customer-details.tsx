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
    if (!statusReason.trim() || statusReason.trim().length < 5) {
      setStatusReasonError('Lý do phải có tối thiểu 5 ký tự.');
      return;
    }
    setStatusReasonError(null);
    setStatusSubmitting(true);
    setStatusError(null);

    try {
      const isLocking =
        detail.status === 'success' &&
        detail.customer.account.status === 'HOAT_DONG';
      const targetStatus = isLocking ? 'TAM_KHOA' : 'HOAT_DONG';

      const response = await updateCustomerStatus(customerId, {
        status: targetStatus,
        reason: statusReason.trim(),
      });

      toast.success(response.message || 'Cập nhật trạng thái tài khoản thành công.');

      if (detail.status === 'success') {
        const updatedCustomer: CustomerDetail = {
          ...detail.customer,
          account: {
            ...detail.customer.account,
            status: response.accountStatus,
            updatedAt: response.updatedAt,
          },
        };
        setDetail({ status: 'success', customer: updatedCustomer });
        onCustomerUpdated?.(updatedCustomer);
      }

      setStatusDialogOpen(false);
      setStatusReason('');
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
                    <ResourceStatusBadge
                      tone={
                        detail.customer.account.status === 'HOAT_DONG'
                          ? 'active'
                          : 'muted'
                      }
                    >
                      {detail.customer.account.status === 'HOAT_DONG'
                        ? 'Đang hoạt động'
                        : 'Tạm khóa'}
                    </ResourceStatusBadge>
                  </dd>
                </div>
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
            }
          }}
          title={
            detail.customer.account.status === 'HOAT_DONG'
              ? 'Khóa tài khoản khách hàng?'
              : 'Mở khóa tài khoản khách hàng?'
          }
          description={
            detail.customer.account.status === 'HOAT_DONG'
              ? 'Tài khoản khách hàng sẽ chuyển sang trạng thái tạm khóa. Khách hàng sẽ không thể đăng nhập hoặc đặt vé, và các phiên đăng nhập đang hoạt động sẽ bị thu hồi.'
              : 'Tài khoản khách hàng sẽ được kích hoạt trở lại và có thể đăng nhập, đặt vé bình thường.'
          }
        >
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="customer-status-reason">
                Lý do thay đổi trạng thái <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="customer-status-reason"
                value={statusReason}
                onChange={(e) => {
                  setStatusReason(e.target.value);
                  if (statusReasonError) setStatusReasonError(null);
                }}
                placeholder="Nhập lý do khóa hoặc mở khóa tài khoản (tối thiểu 5 ký tự)..."
                rows={3}
                disabled={statusSubmitting}
              />
              {statusReasonError && <FieldError>{statusReasonError}</FieldError>}
            </Field>

            {statusError && (
              <ResourceNotice kind="error">{statusError}</ResourceNotice>
            )}

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
          </div>
        </ResourceConfirmation>
      )}
    </>
  );
}
