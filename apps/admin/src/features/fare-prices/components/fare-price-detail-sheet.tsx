'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, Pencil, X } from 'lucide-react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import {
  FarePriceApiError,
  getFarePriceById,
  updateFarePriceStatus,
} from '../services/fare-price-service';
import type {
  FarePrice,
  FarePriceOptionsState,
  FarePriceStatus,
} from '../types/fare-price';
import { FarePriceFormDialog } from './fare-price-form-dialog';
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
  onUpdated,
  onNotFound,
  routeOptions,
  vehicleTypeOptions,
  onRetryRouteOptions,
  onRetryVehicleTypeOptions,
}: {
  farePriceId: number;
  onClose: () => void;
  onUpdated: (farePrice: FarePrice) => void;
  onNotFound: () => void;
  routeOptions: FarePriceOptionsState;
  vehicleTypeOptions: FarePriceOptionsState;
  onRetryRouteOptions: () => void;
  onRetryVehicleTypeOptions: () => void;
}) {
  const [request, setRequest] = useState<{
    key: string;
    status: 'loading' | 'success' | 'error';
    farePrice?: FarePrice;
  }>({ key: '', status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const statusSubmittingRef = useRef(false);
  const onNotFoundRef = useRef(onNotFound);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestKey = `${farePriceId}:${retryCount}`;
  const requestMatches = request.key === requestKey;
  const loading = !requestMatches || request.status === 'loading';
  const error =
    requestMatches && request.status === 'error'
      ? 'Không thể tải thông tin bảng giá.'
      : null;
  const farePrice =
    requestMatches && request.status === 'success'
      ? (request.farePrice ?? null)
      : null;

  useEffect(() => {
    onNotFoundRef.current = onNotFound;
  }, [onNotFound]);

  function handleFarePriceUpdated(updated: FarePrice) {
    setRequest({ key: requestKey, status: 'success', farePrice: updated });
    setEditDialogOpen(false);
    setUpdateNotice('Đã cập nhật bảng giá vé.');
    onUpdated(updated);
  }

  const targetStatus: FarePriceStatus | null = farePrice
    ? farePrice.status === 'HOAT_DONG'
      ? 'TAM_NGUNG'
      : 'HOAT_DONG'
    : null;

  function openStatusDialog() {
    setUpdateNotice(null);
    setStatusError(null);
    setStatusDialogOpen(true);
  }

  async function confirmStatusChange() {
    if (!targetStatus || statusSubmittingRef.current) return;

    statusSubmittingRef.current = true;
    setStatusSubmitting(true);
    setStatusError(null);

    try {
      const updated = await updateFarePriceStatus(farePriceId, targetStatus);
      setRequest({ key: requestKey, status: 'success', farePrice: updated });
      setStatusDialogOpen(false);
      setUpdateNotice(
        targetStatus === 'HOAT_DONG'
          ? 'Đã kích hoạt bảng giá vé.'
          : 'Đã tạm ngưng bảng giá vé.',
      );
      onUpdated(updated);
    } catch (requestError: unknown) {
      if (
        requestError instanceof FarePriceApiError &&
        requestError.code === 'FARE_PRICE_NOT_FOUND'
      ) {
        onNotFound();
      } else if (
        requestError instanceof FarePriceApiError &&
        requestError.code === 'FARE_PRICE_OVERLAP' &&
        targetStatus === 'HOAT_DONG'
      ) {
        setStatusError(
          'Không thể kích hoạt vì khoảng hiệu lực bị trùng với một bảng giá đang hoạt động của cùng tuyến và loại xe.',
        );
      } else if (
        requestError instanceof FarePriceApiError &&
        requestError.code === 'FARE_PRICE_CONCURRENT_MODIFICATION'
      ) {
        setStatusError(
          'Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng tải lại và thử lại.',
        );
      } else {
        setStatusError(
          requestError instanceof TypeError
            ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
            : requestError instanceof Error
              ? requestError.message
              : 'Không thể cập nhật trạng thái bảng giá.',
        );
      }
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const key = `${farePriceId}:${retryCount}`;

    getFarePriceById(farePriceId, controller.signal)
      .then((data) => {
        if (current) setRequest({ key, status: 'success', farePrice: data });
      })
      .catch((requestError: unknown) => {
        if (!current || controller.signal.aborted) return;
        if (
          requestError instanceof FarePriceApiError &&
          requestError.code === 'FARE_PRICE_NOT_FOUND'
        ) {
          onNotFoundRef.current();
          return;
        }
        setRequest({ key, status: 'error' });
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [farePriceId, retryCount]);

  return (
    <>
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
        <p
          className={styles.detailDescription}
          id="fare-price-detail-description"
        >
          Thông tin giá vé theo tuyến, loại xe và thời gian hiệu lực.
        </p>
        {updateNotice && (
          <p className={styles.successNotice} role="status">
            <CheckCircle2 aria-hidden="true" size={16} />
            <span>{updateNotice}</span>
          </p>
        )}
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
          <>
            <dl className={styles.detailList}>
              <div className={styles.detailItem}>
                <dt>Tuyến xe</dt>
                <dd>
                  {farePrice.route.origin} → {farePrice.route.destination}
                </dd>
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
                  <AdminStatusBadge
                    tone={farePrice.status === 'HOAT_DONG' ? 'active' : 'muted'}
                  >
                    {statusLabel(farePrice.status)}
                  </AdminStatusBadge>
                </dd>
              </div>
              <div className={styles.detailItem}>
                <dt>Hiệu lực hiện tại</dt>
                <dd>
                  <AdminStatusBadge
                    tone={
                      farePrice.effectiveState === 'DANG_HIEU_LUC'
                        ? 'active'
                        : 'muted'
                    }
                  >
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
            <div className={styles.detailActions}>
              <Button
                onClick={() => {
                  setUpdateNotice(null);
                  setEditDialogOpen(true);
                }}
                type="button"
              >
                <Pencil aria-hidden="true" size={15} />
                Chỉnh sửa
              </Button>
              <Button onClick={openStatusDialog} type="button" variant="secondary">
                {farePrice.status === 'HOAT_DONG' ? 'Tạm ngưng' : 'Kích hoạt'}
              </Button>
            </div>
          </>
        )}
      </AdminDetailSheet>
      {editDialogOpen && farePrice && (
        <FarePriceFormDialog
          farePrice={farePrice}
          onClose={() => setEditDialogOpen(false)}
          onNotFound={onNotFound}
          onRetryRouteOptions={onRetryRouteOptions}
          onRetryVehicleTypeOptions={onRetryVehicleTypeOptions}
          onSaved={handleFarePriceUpdated}
          routeOptions={routeOptions}
          vehicleTypeOptions={vehicleTypeOptions}
        />
      )}
      {statusDialogOpen && targetStatus && (
        <AdminConfirmDialog
          ariaBusy={statusSubmitting}
          ariaDescribedBy="fare-price-status-confirmation-description"
          ariaLabelledBy="fare-price-status-confirmation-title"
          onClose={() => {
            if (!statusSubmittingRef.current) setStatusDialogOpen(false);
          }}
          preventDismiss={statusSubmitting}
        >
          <>
            <h2 id="fare-price-status-confirmation-title">
              {targetStatus === 'TAM_NGUNG'
                ? 'Tạm ngưng bảng giá?'
                : 'Kích hoạt bảng giá?'}
            </h2>
            <p id="fare-price-status-confirmation-description">
              {targetStatus === 'TAM_NGUNG'
                ? 'Bảng giá này sẽ không còn được dùng để xác định giá áp dụng cho các vé mới. Lịch sử vé hiện có được giữ nguyên.'
                : 'Bảng giá sẽ được kích hoạt nếu khoảng hiệu lực không trùng với bảng giá đang hoạt động khác.'}
            </p>
            {statusError && (
              <p className="admin-confirm-dialog__error" role="alert">
                {statusError}
              </p>
            )}
            <div className="admin-confirm-dialog__actions">
              <Button
                disabled={statusSubmitting}
                onClick={() => setStatusDialogOpen(false)}
                type="button"
                variant="secondary"
              >
                Hủy
              </Button>
              <Button
                disabled={statusSubmitting}
                onClick={confirmStatusChange}
                type="button"
              >
                {statusSubmitting && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="status-confirmation-spinner"
                    size={15}
                  />
                )}
                {statusSubmitting
                  ? 'Đang cập nhật…'
                  : targetStatus === 'TAM_NGUNG'
                    ? 'Tạm ngưng bảng giá'
                    : 'Kích hoạt bảng giá'}
              </Button>
            </div>
          </>
        </AdminConfirmDialog>
      )}
    </>
  );
}
