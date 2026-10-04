'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, LoaderCircle, X } from 'lucide-react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import {
  cancelTrip,
  getTripById,
  isTripNotFoundError,
  TripApiError,
  updateTripStatus,
} from '../services/trip-service';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { TripFormDialog } from './trip-form-dialog';
import type { Trip, TripLookupOptionsState, TripStatus } from '../types/trip';
import '../trips.css';

export function tripStatusLabel(status: TripStatus) {
  switch (status) {
    case 'CHUA_KHOI_HANH':
      return 'Chưa khởi hành';
    case 'DANG_CHAY':
      return 'Đang chạy';
    case 'HOAN_THANH':
      return 'Hoàn thành';
    case 'DA_HUY':
      return 'Đã hủy';
  }
}

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <AdminStatusBadge tone={status === 'DANG_CHAY' ? 'active' : 'muted'}>
      {tripStatusLabel(status)}
    </AdminStatusBadge>
  );
}

function formatDate(dateStr: string) {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

function formatTime(timeStr: string) {
  return timeStr.slice(0, 5);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; trip: Trip };

export function TripDetailSheet({
  tripId,
  initialTrip,
  routeOptions,
  vehicleOptions,
  onRetryRouteOptions,
  onRetryVehicleOptions,
  onClose,
  onNotFound,
  onUpdated,
}: {
  tripId: number;
  initialTrip?: Trip;
  routeOptions?: TripLookupOptionsState;
  vehicleOptions?: TripLookupOptionsState;
  onRetryRouteOptions?: () => void;
  onRetryVehicleOptions?: () => void;
  onClose: () => void;
  onNotFound?: () => void;
  onUpdated?: (trip: Trip) => void;
}) {
  const { can } = useAdminPermissions();
  const canRead = can('trip:read');
  const canUpdate = can('trip:update');
  const canCancel = can('trip:cancel');
  const [detail, setDetail] = useState<DetailState>(
    initialTrip
      ? { status: 'success', trip: initialTrip }
      : { status: 'loading' },
  );
  const [retryCount, setRetryCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<
    'DANG_CHAY' | 'HOAN_THANH' | null
  >(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  function openStatusDialog(target: 'DANG_CHAY' | 'HOAN_THANH') {
    setStatusTarget(target);
    setStatusError(null);
    setStatusDialogOpen(true);
  }

  async function handleConfirmStatus() {
    if (!statusTarget || statusSubmitting) return;
    setStatusSubmitting(true);
    setStatusError(null);
    try {
      const updated = await updateTripStatus(tripId, statusTarget);
      setStatusDialogOpen(false);
      setDetail({ status: 'success', trip: updated });
      setUpdateNotice(`Đã cập nhật trạng thái chuyến ${updated.code}.`);
      onUpdated?.(updated);
    } catch (err: unknown) {
      if (
        err instanceof TripApiError &&
        err.code === 'TRIP_STATUS_TRANSITION_NOT_ALLOWED'
      ) {
        setStatusError(
          'Trạng thái chuyến đã thay đổi. Danh sách đã được làm mới.',
        );
        setRetryCount((c) => c + 1);
        getTripById(tripId)
          .then((latest) => onUpdated?.(latest))
          .catch(() => {});
      } else {
        setStatusError(
          err instanceof Error
            ? err.message
            : 'Không thể cập nhật trạng thái chuyến xe.',
        );
      }
    } finally {
      setStatusSubmitting(false);
    }
  }

  function openCancelDialog() {
    setCancelError(null);
    setCancelDialogOpen(true);
  }

  async function handleConfirmCancel() {
    if (cancelSubmitting) return;
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      const updated = await cancelTrip(tripId);
      setCancelDialogOpen(false);
      setDetail({ status: 'success', trip: updated });
      setUpdateNotice(`Đã hủy chuyến ${updated.code}.`);
      onUpdated?.(updated);
    } catch (err: unknown) {
      if (
        err instanceof TripApiError &&
        err.code === 'TRIP_STATUS_TRANSITION_NOT_ALLOWED'
      ) {
        setCancelError(
          'Trạng thái chuyến đã thay đổi. Danh sách đã được làm mới.',
        );
        setRetryCount((c) => c + 1);
        getTripById(tripId)
          .then((latest) => onUpdated?.(latest))
          .catch(() => {});
      } else {
        setCancelError(
          err instanceof Error ? err.message : 'Không thể hủy chuyến xe.',
        );
      }
    } finally {
      setCancelSubmitting(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    getTripById(tripId, controller.signal)
      .then((trip) => {
        if (!controller.signal.aborted) {
          setDetail({ status: 'success', trip });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          if (isTripNotFoundError(error)) {
            onNotFound?.();
          }
          const message =
            error instanceof Error
              ? error.message
              : 'Không thể tải thông tin chuyến xe.';
          setDetail({
            status: 'error',
            message,
          });
        }
      });

    return () => controller.abort();
  }, [tripId, retryCount, onNotFound]);

  return (
    <>
      <AdminDetailSheet ariaLabelledBy="trip-detail-title" onClose={onClose}>
        <div className="admin-dialog-header">
          <div className="admin-dialog-header__copy">
            <p className="eyebrow">HỒ SƠ CHUYẾN XE</p>
            <h2 id="trip-detail-title">Chi tiết chuyến xe</h2>
          </div>
          <form method="dialog">
            <button
              aria-label="Đóng chi tiết chuyến xe"
              className="icon-button"
              type="submit"
            >
              <X aria-hidden="true" size={19} />
            </button>
          </form>
        </div>

        {updateNotice && (
          <div
            className="trips-success-notice"
            role="status"
            style={{ margin: 'var(--admin-space-field-gap) var(--admin-space-sheet-inline) 0' }}
          >
            <CheckCircle2 aria-hidden="true" size={16} />
            <span>{updateNotice}</span>
          </div>
        )}

        {detail.status === 'loading' && (
          <p className="trips-detail-state" role="status">
            Đang tải thông tin chuyến xe…
          </p>
        )}

        {detail.status === 'error' && (
          <div className="trips-detail-state" role="alert">
            <p>{detail.message}</p>
            <Button
              onClick={() => {
                setDetail({ status: 'loading' });
                setRetryCount((c) => c + 1);
              }}
              type="button"
              variant="secondary"
            >
              Thử lại
            </Button>
          </div>
        )}

        {detail.status === 'success' && (
          <div className="trips-detail-content">
            <section className="trips-detail-section">
              <h4 className="trips-detail-section-title">Thông tin chuyến</h4>
              <dl className="trips-detail-fields">
                <div>
                  <dt>Mã chuyến</dt>
                  <dd className="admin-data-mono">{detail.trip.code}</dd>
                </div>
                <div>
                  <dt>Ngày khởi hành</dt>
                  <dd>{formatDate(detail.trip.departureDate)}</dd>
                </div>
                <div>
                  <dt>Giờ khởi hành</dt>
                  <dd>{formatTime(detail.trip.departureTime)}</dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>
                    <TripStatusBadge status={detail.trip.status} />
                  </dd>
                </div>
              </dl>
            </section>

            <section className="trips-detail-section">
              <h4 className="trips-detail-section-title">Tuyến xe</h4>
              <dl className="trips-detail-fields">
                <div>
                  <dt>Mã tuyến</dt>
                  <dd className="admin-data-mono">{detail.trip.route.code}</dd>
                </div>
                <div>
                  <dt>Điểm đi</dt>
                  <dd>{detail.trip.route.origin}</dd>
                </div>
                <div>
                  <dt>Điểm đến</dt>
                  <dd>{detail.trip.route.destination}</dd>
                </div>
              </dl>
            </section>

            <section className="trips-detail-section">
              <h4 className="trips-detail-section-title">Xe phục vụ</h4>
              <dl className="trips-detail-fields">
                <div>
                  <dt>Biển số xe</dt>
                  <dd className="admin-data-mono">
                    {detail.trip.vehicle.licensePlate}
                  </dd>
                </div>
                <div>
                  <dt>Loại xe</dt>
                  <dd>{detail.trip.vehicle.vehicleType.name}</dd>
                </div>
                <div>
                  <dt>Trạng thái xe</dt>
                  <dd>
                    <AdminStatusBadge
                      tone={
                        detail.trip.vehicle.status === 'HOAT_DONG'
                          ? 'active'
                          : 'muted'
                      }
                    >
                      {detail.trip.vehicle.status === 'HOAT_DONG'
                        ? 'Hoạt động'
                        : detail.trip.vehicle.status === 'BAO_TRI'
                          ? 'Bảo trì'
                          : 'Không xác định'}
                    </AdminStatusBadge>
                  </dd>
                </div>
              </dl>
            </section>

            {detail.trip.seatSummary && (
              <section className="trips-detail-section">
                <h4 className="trips-detail-section-title">Ghế chuyến</h4>
                <div className="trips-seat-summary-grid">
                  <div className="trips-seat-card">
                    <span className="trips-seat-card__count">
                      {detail.trip.seatSummary.total}
                    </span>
                    <span className="trips-seat-card__label">Tổng số ghế</span>
                  </div>
                  <div className="trips-seat-card trips-seat-card--available">
                    <span className="trips-seat-card__count">
                      {detail.trip.seatSummary.available}
                    </span>
                    <span className="trips-seat-card__label">Ghế trống</span>
                  </div>
                  <div className="trips-seat-card trips-seat-card--held">
                    <span className="trips-seat-card__count">
                      {detail.trip.seatSummary.held}
                    </span>
                    <span className="trips-seat-card__label">Đang giữ</span>
                  </div>
                  <div className="trips-seat-card trips-seat-card--booked">
                    <span className="trips-seat-card__count">
                      {detail.trip.seatSummary.booked}
                    </span>
                    <span className="trips-seat-card__label">Đã đặt</span>
                  </div>
                </div>
              </section>
            )}

            <section className="trips-detail-section">
              <h4 className="trips-detail-section-title">Thông tin hệ thống</h4>
              <dl className="trips-detail-fields">
                <div>
                  <dt>Ngày tạo</dt>
                  <dd>{formatTimestamp(detail.trip.createdAt)}</dd>
                </div>
                <div>
                  <dt>Cập nhật lần cuối</dt>
                  <dd>{formatTimestamp(detail.trip.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            {detail.status === 'success' && (
              <div className="trips-detail-actions admin-detail-sheet__actions">
                {canRead && (
                  <Link
                    className="button button-secondary"
                    href={`/trips/${detail.trip.tripId}/seats`}
                  >
                    Xem ghế chuyến
                  </Link>
                )}
                {canUpdate && detail.trip.status === 'CHUA_KHOI_HANH' && (
                  <Button
                    onClick={() => setEditOpen(true)}
                    type="button"
                    variant="secondary"
                  >
                    Chỉnh sửa
                  </Button>
                )}
                {canUpdate && detail.trip.status === 'CHUA_KHOI_HANH' && (
                  <Button
                    onClick={() => openStatusDialog('DANG_CHAY')}
                    type="button"
                  >
                    Bắt đầu chạy
                  </Button>
                )}
                {canUpdate && detail.trip.status === 'DANG_CHAY' && (
                  <Button
                    onClick={() => openStatusDialog('HOAN_THANH')}
                    type="button"
                  >
                    Hoàn thành chuyến
                  </Button>
                )}
                {canCancel && detail.trip.status === 'CHUA_KHOI_HANH' && (
                  <Button
                    onClick={openCancelDialog}
                    type="button"
                    variant="secondary"
                  >
                    Hủy chuyến
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </AdminDetailSheet>

      {editOpen && canUpdate && detail.status === 'success' && (
        <TripFormDialog
          onClose={() => setEditOpen(false)}
          onRetryRouteOptions={onRetryRouteOptions ?? (() => {})}
          onRetryVehicleOptions={onRetryVehicleOptions ?? (() => {})}
          onSaved={(saved) => {
            setEditOpen(false);
            setDetail({ status: 'success', trip: saved });
            setUpdateNotice(`Đã cập nhật chuyến ${saved.code}.`);
            onUpdated?.(saved);
          }}
          routeOptions={routeOptions ?? { status: 'success', options: [] }}
          trip={detail.trip}
          vehicleOptions={vehicleOptions ?? { status: 'success', options: [] }}
        />
      )}

      {statusDialogOpen && statusTarget && detail.status === 'success' && (
        <AdminConfirmDialog
          ariaBusy={statusSubmitting}
          ariaDescribedBy="trip-status-confirm-desc"
          ariaLabelledBy="trip-status-confirm-title"
          onClose={() => {
            if (!statusSubmitting) setStatusDialogOpen(false);
          }}
          preventDismiss={statusSubmitting}
        >
          <>
            <div className="admin-dialog-header">
              <div className="admin-dialog-header__copy">
                <p className="eyebrow">XÁC NHẬN TRẠNG THÁI</p>
                <h3 id="trip-status-confirm-title">
                  {statusTarget === 'DANG_CHAY'
                    ? 'Bắt đầu chuyến xe?'
                    : 'Hoàn thành chuyến xe?'}
                </h3>
              </div>
            </div>
            <p
              className="admin-confirm-dialog__description"
              id="trip-status-confirm-desc"
            >
              {statusTarget === 'DANG_CHAY'
                ? `Chuyến xe ${detail.trip.code} sẽ chuyển sang trạng thái Đang chạy.`
                : `Chuyến xe ${detail.trip.code} sẽ chuyển sang trạng thái Hoàn thành và kết thúc hành trình.`}
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
                onClick={handleConfirmStatus}
                type="button"
              >
                {statusSubmitting && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="admin-crud-form-spinner"
                    size={15}
                  />
                )}
                {statusSubmitting
                  ? 'Đang cập nhật…'
                  : statusTarget === 'DANG_CHAY'
                    ? 'Bắt đầu chạy'
                    : 'Hoàn thành chuyến'}
              </Button>
            </div>
          </>
        </AdminConfirmDialog>
      )}

      {cancelDialogOpen && detail.status === 'success' && (
        <AdminConfirmDialog
          ariaBusy={cancelSubmitting}
          ariaDescribedBy="trip-cancel-confirm-desc"
          ariaLabelledBy="trip-cancel-confirm-title"
          onClose={() => {
            if (!cancelSubmitting) setCancelDialogOpen(false);
          }}
          preventDismiss={cancelSubmitting}
        >
          <>
            <div className="admin-dialog-header">
              <div className="admin-dialog-header__copy">
                <p className="eyebrow">XÁC NHẬN HỦY CHUYẾN</p>
                <h3 id="trip-cancel-confirm-title">
                  Hủy chuyến xe{' '}
                  <span className="admin-data-mono">{detail.trip.code}</span>?
                </h3>
              </div>
            </div>
            <div
              className="admin-confirm-dialog__description"
              id="trip-cancel-confirm-desc"
            >
              <p>
                Chuyến xe{' '}
                <strong className="admin-data-mono">{detail.trip.code}</strong>{' '}
                khởi hành vào lúc{' '}
                <strong>
                  {formatTime(detail.trip.departureTime)} -{' '}
                  {formatDate(detail.trip.departureDate)}
                </strong>{' '}
                (tuyến {detail.trip.route.origin} →{' '}
                {detail.trip.route.destination}) sẽ được chuyển sang trạng thái{' '}
                <strong>Đã hủy</strong>.
              </p>
              <p>Thao tác này không xóa dữ liệu chuyến xe và ghế chuyến.</p>
            </div>
            {cancelError && (
              <p className="admin-confirm-dialog__error" role="alert">
                {cancelError}
              </p>
            )}
            <div className="admin-confirm-dialog__actions">
              <Button
                disabled={cancelSubmitting}
                onClick={() => setCancelDialogOpen(false)}
                type="button"
                variant="secondary"
              >
                Bỏ qua
              </Button>
              <Button
                disabled={cancelSubmitting}
                onClick={handleConfirmCancel}
                type="button"
              >
                {cancelSubmitting && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="admin-crud-form-spinner"
                    size={15}
                  />
                )}
                {cancelSubmitting ? 'Đang hủy…' : 'Hủy chuyến'}
              </Button>
            </div>
          </>
        </AdminConfirmDialog>
      )}
    </>
  );
}
