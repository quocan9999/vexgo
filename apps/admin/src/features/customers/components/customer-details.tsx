'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ResourceSheet,
  ResourceStatusBadge,
  ResourceState,
} from '@/components/admin/resource-ui';
import { Button, buttonVariants } from '@/components/ui/action-button';
import { getCustomerById } from '../services/customer-service';
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

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; customer: CustomerDetail };

interface CustomerDetailsProps {
  customerId: number;
  onClose: () => void;
}

export function CustomerDetails({ customerId, onClose }: CustomerDetailsProps) {
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

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

  return (
    <ResourceSheet
      title="Chi tiết khách hàng"
      description="Thông tin liên hệ, điểm tích lũy và tài khoản liên kết."
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

          <div className="flex justify-end border-t pt-4">
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
  );
}
