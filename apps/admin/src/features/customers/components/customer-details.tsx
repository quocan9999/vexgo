'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import { getCustomerById } from '../services/customer-service';
import type { CustomerDetail } from '../types/customer';

function timestampFormat(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    <AdminDetailSheet
      ariaLabelledBy="customer-detail-title"
      dialogRef={dialogRef}
      onClose={onClose}
    >
      <div className="admin-dialog-header">
        <div className="admin-dialog-header__copy">
          <p className="eyebrow">HỒ SƠ KHÁCH HÀNG</p>
          <h2 id="customer-detail-title">Chi tiết khách hàng</h2>
        </div>
        <button
          aria-label="Đóng thông tin khách hàng"
          className="icon-button"
          onClick={() => dialogRef.current?.close()}
          type="button"
        >
          <X aria-hidden="true" size={19} />
        </button>
      </div>

      {detail.status === 'loading' && (
        <div className="customers-state-panel" role="status">
          <p>Đang tải thông tin khách hàng…</p>
        </div>
      )}

      {detail.status === 'error' && (
        <div className="customers-state-panel" role="alert">
          <p>{detail.message}</p>
          <Button onClick={retry} type="button" variant="secondary">
            Thử lại
          </Button>
        </div>
      )}

      {detail.status === 'success' && (
        <div className="customers-detail-content">
          <div className="customers-detail-hero">
            <h3>{detail.customer.fullName}</h3>
            <span className="customer-code">
              Mã khách hàng ·{' '}
              <span className="admin-data-mono">
                {detail.customer.customerCode}
              </span>
            </span>
          </div>

          <section
            className="customers-detail-section"
            aria-labelledby="customer-info-heading"
          >
            <h4
              id="customer-info-heading"
              className="customers-detail-section-title"
            >
              Thông tin liên hệ
            </h4>
            <dl className="customers-detail-dl">
              <div className="customers-detail-row">
                <dt>Số điện thoại</dt>
                <dd>{detail.customer.phoneNumber}</dd>
              </div>
              <div className="customers-detail-row">
                <dt>Email</dt>
                <dd>{detail.customer.email || '—'}</dd>
              </div>
              <div className="customers-detail-row">
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
            className="customers-detail-section"
            aria-labelledby="customer-account-heading"
          >
            <h4
              id="customer-account-heading"
              className="customers-detail-section-title"
            >
              Tài khoản liên kết
            </h4>
            <dl className="customers-detail-dl">
              <div className="customers-detail-row">
                <dt>Mã tài khoản</dt>
                <dd className="admin-data-mono">
                  #{detail.customer.account.accountId}
                </dd>
              </div>
              <div className="customers-detail-row">
                <dt>Trạng thái tài khoản</dt>
                <dd>
                  <AdminStatusBadge
                    tone={
                      detail.customer.account.status === 'HOAT_DONG'
                        ? 'active'
                        : 'muted'
                    }
                  >
                    {detail.customer.account.status === 'HOAT_DONG'
                      ? 'Đang hoạt động'
                      : 'Tạm khóa'}
                  </AdminStatusBadge>
                </dd>
              </div>
              <div className="customers-detail-row">
                <dt>Xác thực số điện thoại</dt>
                <dd>
                  {detail.customer.account.phoneVerified
                    ? 'Đã xác thực'
                    : 'Chưa xác thực'}
                </dd>
              </div>
              <div className="customers-detail-row">
                <dt>Ngày tạo tài khoản</dt>
                <dd>{timestampFormat(detail.customer.account.createdAt)}</dd>
              </div>
              <div className="customers-detail-row">
                <dt>Cập nhật tài khoản</dt>
                <dd>{timestampFormat(detail.customer.account.updatedAt)}</dd>
              </div>
            </dl>
          </section>

          <section
            className="customers-detail-section"
            aria-labelledby="customer-meta-heading"
          >
            <h4
              id="customer-meta-heading"
              className="customers-detail-section-title"
            >
              Thông tin hệ thống
            </h4>
            <dl className="customers-detail-dl">
              <div className="customers-detail-row">
                <dt>Ngày tạo hồ sơ</dt>
                <dd>{timestampFormat(detail.customer.createdAt)}</dd>
              </div>
              <div className="customers-detail-row">
                <dt>Cập nhật hồ sơ</dt>
                <dd>{timestampFormat(detail.customer.updatedAt)}</dd>
              </div>
            </dl>
          </section>

          <div className="customers-detail-footer">
            <Link
              className="button button-primary"
              href={`/customers/${detail.customer.customerId}`}
            >
              Xem lịch sử hoạt động
            </Link>
          </div>
        </div>
      )}
    </AdminDetailSheet>
  );
}
