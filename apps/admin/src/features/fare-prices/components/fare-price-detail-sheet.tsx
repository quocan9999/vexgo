'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import { getFarePriceById } from '../services/fare-price-service';
import type { FarePrice } from '../types/fare-price';
import styles from '../fare-prices.module.css';

function formatPrice(listedPrice: number) {
  return `${new Intl.NumberFormat('vi-VN').format(listedPrice)} ₫`;
}

function formatDateOnly(value: string | null) {
  if (value === null) return 'Không giới hạn';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: FarePrice['status']) {
  return status === 'HOAT_DONG' ? 'Hoạt động' : 'Tạm ngưng';
}

function effectiveStateLabel(state: FarePrice['effectiveState']) {
  switch (state) {
    case 'CHUA_HIEU_LUC':
      return 'Chưa hiệu lực';
    case 'DANG_HIEU_LUC':
      return 'Đang hiệu lực';
    case 'HET_HIEU_LUC':
      return 'Hết hiệu lực';
    case 'TAM_NGUNG':
      return 'Tạm ngưng';
  }
}

export function FarePriceDetailSheet({
  farePriceId,
  onClose,
}: {
  farePriceId: number;
  onClose: () => void;
}) {
  const [request, setRequest] = useState<{
    key: string;
    status: 'loading' | 'success' | 'error';
    farePrice?: FarePrice;
  }>({ key: '', status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestKey = `${farePriceId}:${retryCount}`;
  const requestMatches = request.key === requestKey;
  const loading = !requestMatches || request.status === 'loading';
  const error = requestMatches && request.status === 'error'
    ? 'Không thể tải thông tin bảng giá.'
    : null;
  const farePrice = requestMatches && request.status === 'success'
    ? request.farePrice ?? null
    : null;

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const key = `${farePriceId}:${retryCount}`;

    getFarePriceById(farePriceId, controller.signal)
      .then((data) => {
        if (current) setRequest({ key, status: 'success', farePrice: data });
      })
      .catch(() => {
        if (current && !controller.signal.aborted) {
          setRequest({ key, status: 'error' });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [farePriceId, retryCount]);

  return (
    <AdminDetailSheet
      ariaBusy={loading}
      ariaDescribedBy="fare-price-detail-description"
      ariaLabelledBy="fare-price-detail-title"
      dialogRef={dialogRef}
      onClose={onClose}
    >
      <div className="admin-dialog-header">
        <div>
          <p className="eyebrow">BẢNG GIÁ VÉ</p>
          <h2 id="fare-price-detail-title">Chi tiết bảng giá</h2>
        </div>
        <button
          aria-label="Đóng chi tiết bảng giá"
          className="icon-button"
          onClick={() => dialogRef.current?.close()}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <p className={styles.detailDescription} id="fare-price-detail-description">
        Thông tin giá vé theo tuyến, loại xe và thời gian hiệu lực.
      </p>
      {loading && (
        <p className={styles.detailState} role="status">
          Đang tải thông tin bảng giá…
        </p>
      )}
      {error && (
        <div className={styles.detailError} role="alert">
          <p>{error}</p>
          <Button
            onClick={() => setRetryCount((count) => count + 1)}
            type="button"
            variant="secondary"
          >
            Thử lại
          </Button>
        </div>
      )}
      {farePrice && (
        <dl className={styles.detailList}>
          <div className={styles.detailItem}>
            <dt>Tuyến xe</dt>
            <dd>{farePrice.route.origin} → {farePrice.route.destination}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Mã tuyến</dt>
            <dd>{farePrice.route.code}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Điểm đi</dt>
            <dd>{farePrice.route.origin}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Điểm đến</dt>
            <dd>{farePrice.route.destination}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Loại xe</dt>
            <dd>{farePrice.vehicleType.name}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Giá niêm yết</dt>
            <dd>{formatPrice(farePrice.listedPrice)}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Đơn vị tiền</dt>
            <dd>{farePrice.currency}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Hiệu lực từ</dt>
            <dd>{formatDateOnly(farePrice.validFrom)}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Hiệu lực đến</dt>
            <dd>{formatDateOnly(farePrice.validTo)}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Trạng thái cấu hình</dt>
            <dd>
              <AdminStatusBadge tone={farePrice.status === 'HOAT_DONG' ? 'active' : 'muted'}>
                {statusLabel(farePrice.status)}
              </AdminStatusBadge>
            </dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Hiệu lực hiện tại</dt>
            <dd>
              <AdminStatusBadge tone={farePrice.effectiveState === 'DANG_HIEU_LUC' ? 'active' : 'muted'}>
                {effectiveStateLabel(farePrice.effectiveState)}
              </AdminStatusBadge>
            </dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Ngày tạo</dt>
            <dd>{formatTimestamp(farePrice.createdAt)}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Cập nhật lần cuối</dt>
            <dd>{formatTimestamp(farePrice.updatedAt)}</dd>
          </div>
        </dl>
      )}
    </AdminDetailSheet>
  );
}
