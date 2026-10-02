'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getTripById, getTripSeats, TripApiError } from '../services/trip-service';
import { TripStatusBadge } from './trip-detail-sheet';
import type {
  Trip,
  TripSeat,
  TripSeatsResponse,
  TripSeatStatus,
} from '../types/trip';
import '../trips.css';

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

export function TripSeatStatusBadge({ status }: { status: TripSeatStatus }) {
  let label = 'Trống';
  let statusClass = 'trip-seat-badge--available';
  if (status === 'DANG_GIU') {
    label = 'Đang giữ';
    statusClass = 'trip-seat-badge--held';
  } else if (status === 'DA_DAT') {
    label = 'Đã đặt';
    statusClass = 'trip-seat-badge--booked';
  }
  return (
    <Badge className={`trip-seat-badge ${statusClass}`} data-status={status}>
      {label}
    </Badge>
  );
}

type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error'; message: string; isNotFound?: boolean }
  | { status: 'success'; trip: Trip; seatsData: TripSeatsResponse };

export function TripSeatsManagement({
  tripId,
  initialTrip,
  initialSeats,
}: {
  tripId: number;
  initialTrip?: Trip;
  initialSeats?: TripSeatsResponse;
}) {
  const { can } = useAdminPermissions();
  const canRead = can('trip:read');
  const validTripId = Number.isSafeInteger(tripId) && tripId > 0;

  const [workspace, setWorkspace] = useState<WorkspaceState>(
    initialTrip && initialSeats
      ? { status: 'success', trip: initialTrip, seatsData: initialSeats }
      : { status: 'loading' },
  );
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [refreshCount, setRefreshCount] = useState(0);

  function refresh() {
    setWorkspace({ status: 'loading' });
    setRefreshCount((count) => count + 1);
  }

  useEffect(() => {
    if (!validTripId || !canRead) {
      if (!validTripId) {
        setWorkspace({ status: 'error', message: 'Mã chuyến xe không hợp lệ.' });
      }
      return;
    }

    const controller = new AbortController();
    Promise.all([
      getTripById(tripId, controller.signal),
      getTripSeats(
        tripId,
        statusFilter ? { status: statusFilter } : undefined,
        controller.signal,
      ),
    ])
      .then(([trip, seatsData]) => {
        if (!controller.signal.aborted) {
          setWorkspace({ status: 'success', trip, seatsData });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          const isNotFound =
            error instanceof TripApiError && error.code === 'TRIP_NOT_FOUND';
          const message =
            error instanceof Error
              ? error.message
              : 'Không thể tải dữ liệu ghế chuyến.';
          setWorkspace({ status: 'error', message, isNotFound });
        }
      });

    return () => controller.abort();
  }, [tripId, validTripId, canRead, statusFilter, refreshCount]);

  if (!canRead) {
    return (
      <SuperAdminLayout activeSection="trips">
        <div className="admin-page-content trip-seats-page">
          <AdminPageHeader
            actions={
              <Link className="button button-secondary" href="/trips">
                Quay lại danh sách chuyến
              </Link>
            }
            eyebrow="QUẢN LÝ VẬN HÀNH"
            title="Ghế chuyến xe"
            titleId="trip-seats-title"
          />
          <section className="trips-list-state" role="alert">
            <p>Bạn không có quyền xem thông tin ghế chuyến xe.</p>
          </section>
        </div>
      </SuperAdminLayout>
    );
  }

  const seatGroups =
    workspace.status === 'success'
      ? workspace.seatsData.data.reduce<Map<string, TripSeat[]>>(
          (groups, seat) => {
            const groupName =
              seat.seat.position?.trim() || 'Chưa xác định vị trí';
            const group = groups.get(groupName) ?? [];
            group.push(seat);
            groups.set(groupName, group);
            return groups;
          },
          new Map(),
        )
      : new Map<string, TripSeat[]>();

  return (
    <SuperAdminLayout activeSection="trips">
      <div className="admin-page-content trip-seats-page">
        <AdminPageHeader
          actions={
            <div className="trip-seats-header-actions">
              <Link className="button button-secondary" href="/trips">
                Quay lại danh sách chuyến
              </Link>
              <Button
                disabled={workspace.status === 'loading'}
                onClick={refresh}
                type="button"
                variant="secondary"
              >
                <RefreshCw aria-hidden="true" size={15} />
                Làm mới
              </Button>
            </div>
          }
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title={
            workspace.status === 'success'
              ? `Ghế chuyến ${workspace.trip.code}`
              : 'Ghế chuyến xe'
          }
          titleId="trip-seats-title"
        />

        {workspace.status === 'loading' && (
          <section
            aria-busy="true"
            className="trips-list-state"
            role="status"
          >
            <LoaderCircle
              aria-hidden="true"
              className="admin-crud-form-spinner"
              size={24}
            />
            <p>Đang tải dữ liệu ghế chuyến…</p>
          </section>
        )}

        {workspace.status === 'error' && (
          <section className="trips-list-state" role="alert">
            <p>
              {workspace.isNotFound
                ? 'Không tìm thấy chuyến xe hoặc bạn không có quyền truy cập.'
                : workspace.message}
            </p>
            {workspace.isNotFound ? (
              <Link className="button button-secondary" href="/trips">
                Quay lại danh sách chuyến
              </Link>
            ) : (
              <Button onClick={refresh} type="button" variant="secondary">
                <RefreshCw aria-hidden="true" size={15} />
                Thử lại
              </Button>
            )}
          </section>
        )}

        {workspace.status === 'success' && (
          <>
            <section
              aria-label="Thông tin chuyến xe"
              className="trip-seats-context"
            >
              <div className="trip-seats-context__item">
                <span className="trip-seats-context__label">Tuyến xe</span>
                <strong className="trip-seats-context__value">
                  {workspace.trip.route.code} ({workspace.trip.route.origin} →{' '}
                  {workspace.trip.route.destination})
                </strong>
              </div>
              <div className="trip-seats-context__item">
                <span className="trip-seats-context__label">Thời gian</span>
                <strong className="trip-seats-context__value">
                  {formatTime(workspace.trip.departureTime)} -{' '}
                  {formatDate(workspace.trip.departureDate)}
                </strong>
              </div>
              <div className="trip-seats-context__item">
                <span className="trip-seats-context__label">Xe phục vụ</span>
                <strong className="trip-seats-context__value">
                  {workspace.trip.vehicle.licensePlate} (
                  {workspace.trip.vehicle.vehicleType.name})
                </strong>
              </div>
              <div className="trip-seats-context__item">
                <span className="trip-seats-context__label">Trạng thái chuyến</span>
                <div className="trip-seats-context__value">
                  <TripStatusBadge status={workspace.trip.status} />
                </div>
              </div>
            </section>

            <section
              aria-label="Tổng quan số lượng ghế"
              className="trips-seat-summary-grid"
            >
              <div className="trips-seat-card">
                <span className="trips-seat-card__count">
                  {workspace.seatsData.meta.total}
                </span>
                <span className="trips-seat-card__label">Tổng số ghế</span>
              </div>
              <div className="trips-seat-card trips-seat-card--available">
                <span className="trips-seat-card__count">
                  {workspace.seatsData.meta.available}
                </span>
                <span className="trips-seat-card__label">Ghế trống</span>
              </div>
              <div className="trips-seat-card trips-seat-card--held">
                <span className="trips-seat-card__count">
                  {workspace.seatsData.meta.held}
                </span>
                <span className="trips-seat-card__label">Đang giữ</span>
              </div>
              <div className="trips-seat-card trips-seat-card--booked">
                <span className="trips-seat-card__count">
                  {workspace.seatsData.meta.booked}
                </span>
                <span className="trips-seat-card__label">Đã đặt</span>
              </div>
            </section>

            <section
              aria-labelledby="trip-seat-inventory-heading"
              className="trip-seats-panel"
            >
              <div className="trip-seats-panel-header">
                <div>
                  <h2 id="trip-seat-inventory-heading">Sơ đồ danh sách ghế</h2>
                  <p className="trip-seats-panel-desc">
                    Danh sách ghế chuyến được tạo tự động từ cấu hình xe và hiển thị theo nhóm vị trí (read-only).
                  </p>
                </div>
                <div className="trip-seats-legend" aria-label="Chú thích trạng thái">
                  <div className="trip-seats-legend__item">
                    <TripSeatStatusBadge status="TRONG" />
                    <span>Có thể đặt</span>
                  </div>
                  <div className="trip-seats-legend__item">
                    <TripSeatStatusBadge status="DANG_GIU" />
                    <span>Tạm thời giữ</span>
                  </div>
                  <div className="trip-seats-legend__item">
                    <TripSeatStatusBadge status="DA_DAT" />
                    <span>Đã đặt</span>
                  </div>
                </div>
              </div>

              <div
                aria-label="Lọc theo trạng thái ghế"
                className="trip-seats-filter-group"
                role="group"
              >
                <Button
                  aria-pressed={statusFilter === ''}
                  onClick={() => setStatusFilter('')}
                  type="button"
                  variant={statusFilter === '' ? 'primary' : 'secondary'}
                >
                  Tất cả ({workspace.seatsData.meta.total})
                </Button>
                <Button
                  aria-pressed={statusFilter === 'TRONG'}
                  onClick={() => setStatusFilter('TRONG')}
                  type="button"
                  variant={statusFilter === 'TRONG' ? 'primary' : 'secondary'}
                >
                  Trống ({workspace.seatsData.meta.available})
                </Button>
                <Button
                  aria-pressed={statusFilter === 'DANG_GIU'}
                  onClick={() => setStatusFilter('DANG_GIU')}
                  type="button"
                  variant={statusFilter === 'DANG_GIU' ? 'primary' : 'secondary'}
                >
                  Đang giữ ({workspace.seatsData.meta.held})
                </Button>
                <Button
                  aria-pressed={statusFilter === 'DA_DAT'}
                  onClick={() => setStatusFilter('DA_DAT')}
                  type="button"
                  variant={statusFilter === 'DA_DAT' ? 'primary' : 'secondary'}
                >
                  Đã đặt ({workspace.seatsData.meta.booked})
                </Button>
              </div>

              {workspace.seatsData.data.length === 0 ? (
                <div className="trip-seats-empty" role="status">
                  <p>
                    {statusFilter
                      ? 'Không có ghế nào ở trạng thái này.'
                      : 'Không có dữ liệu ghế chuyến.'}
                  </p>
                </div>
              ) : (
                <div className="trip-seat-groups">
                  {[...seatGroups.entries()].map(([groupName, seats]) => (
                    <section
                      aria-labelledby={`group-${groupName}`}
                      className="trip-seat-group"
                      key={groupName}
                    >
                      <h3
                        className="trip-seat-group__title"
                        id={`group-${groupName}`}
                      >
                        {groupName} ({seats.length})
                      </h3>
                      <div className="trip-seat-grid">
                        {seats.map((seat) => (
                          <div
                            className="trip-seat-token"
                            data-seat-code={seat.seat.code}
                            data-status={seat.status}
                            key={seat.tripSeatId}
                          >
                            <span className="trip-seat-token__code">
                              {seat.seat.code}
                            </span>
                            <TripSeatStatusBadge status={seat.status} />
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
