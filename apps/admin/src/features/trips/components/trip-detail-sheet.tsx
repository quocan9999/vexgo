'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import { getTripById } from '../services/trip-service';
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
  routeOptions,
  vehicleOptions,
  onRetryRouteOptions,
  onRetryVehicleOptions,
  onClose,
  onNotFound,
  onUpdated,
}: {
  tripId: number;
  routeOptions?: TripLookupOptionsState;
  vehicleOptions?: TripLookupOptionsState;
  onRetryRouteOptions?: () => void;
  onRetryVehicleOptions?: () => void;
  onClose: () => void;
  onNotFound?: () => void;
  onUpdated?: (trip: Trip) => void;
}) {
  const { can } = useAdminPermissions();
  const canUpdate = can('trip:update');
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

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
          const message =
            error instanceof Error
              ? error.message
              : 'Không thể tải thông tin chuyến xe.';
          if (
            message.includes('404') ||
            message.toLowerCase().includes('không tìm thấy')
          ) {
            onNotFound?.();
          }
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
            <div className="trips-detail-title-row">
              <h3>{detail.trip.code}</h3>
              <TripStatusBadge status={detail.trip.status} />
            </div>

            <section className="trips-detail-section">
              <h4 className="trips-detail-section-title">Thông tin chuyến</h4>
              <dl className="trips-detail-fields">
                <div>
                  <dt>Mã chuyến</dt>
                  <dd>{detail.trip.code}</dd>
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
                  <dd>{detail.trip.route.code}</dd>
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
                  <dd>{detail.trip.vehicle.licensePlate}</dd>
                </div>
                <div>
                  <dt>Loại xe</dt>
                  <dd>{detail.trip.vehicle.vehicleType.name}</dd>
                </div>
                <div>
                  <dt>Trạng thái xe</dt>
                  <dd>{detail.trip.vehicle.status}</dd>
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

            {canUpdate && (
              <div className="routes-detail-actions">
                <Button onClick={() => setEditOpen(true)} type="button">
                  Chỉnh sửa
                </Button>
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
    </>
  );
}
