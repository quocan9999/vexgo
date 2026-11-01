'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle, Trash2, Users, Route as RouteIcon, AlertCircle } from 'lucide-react';
import {
  ResourceSheet,
  ResourceConfirmation,
  ResourceStatusBadge,
  ResourceState,
} from '@/components/admin/resource-ui';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  cancelTrip,
  deleteTrip,
  getTripById,
  isTripNotFoundError,
  TripApiError,
  updateTripStatus,
} from '../services/trip-service';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { TripFormDialog } from './trip-form-dialog';
import { StopListEditor } from '@/features/stops/components/stop-list-editor';
import { getTripStops, applyRouteTemplate } from '@/features/stops/services/stop-service';
import type { TripPassengerPointItem } from '@/features/stops/types/stop';
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
    <ResourceStatusBadge tone={status === 'DANG_CHAY' ? 'active' : 'muted'}>
      {tripStatusLabel(status)}
    </ResourceStatusBadge>
  );
}

function formatDate(dateStr: string) {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
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
  onDeleted,
}: {
  tripId: number;
  initialTrip?: Trip;
  routeOptions?: TripLookupOptionsState;
  vehicleOptions?: TripLookupOptionsState;
  onRetryRouteOptions?: () => void;
  onRetryVehicleOptions?: () => void;
  onClose: () => void;
  onNotFound?: () => void;
  onUpdated?: (trip: Trip, options?: { silent?: boolean }) => void;
  onDeleted: () => void;
}) {
  const { can } = useAdminPermissions();
  const canRead = can('trip:read');
  const canUpdate = can('trip:update');
  const canCancel = can('trip:cancel');
  const canDelete = can('trip:delete');
  const [detail, setDetail] = useState<DetailState>(
    initialTrip
      ? { status: 'success', trip: initialTrip }
      : { status: 'loading' },
  );
  const [retryCount, setRetryCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const statusPending = useRef(false);
  const cancelPending = useRef(false);
  const deletePending = useRef(false);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<'HOAN_THANH' | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [stopsEditorOpen, setStopsEditorOpen] = useState(false);
  const [tripStops, setTripStops] = useState<TripPassengerPointItem[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  function openStatusDialog(target: 'HOAN_THANH') {
    setStatusTarget(target);
    setStatusDialogOpen(true);
  }

  async function handleConfirmStatus() {
    if (!statusTarget || statusPending.current) return;
    statusPending.current = true;
    setStatusSubmitting(true);
    try {
      const updated = await updateTripStatus(tripId, statusTarget);
      setStatusDialogOpen(false);
      setDetail({ status: 'success', trip: updated });
      onUpdated?.(updated);
    } catch (err: unknown) {
      if (
        err instanceof TripApiError &&
        err.code === 'TRIP_STATUS_TRANSITION_NOT_ALLOWED'
      ) {
        toast.error(
          'Trạng thái chuyến đã thay đổi. Danh sách đã được làm mới.',
        );
        setRetryCount((c) => c + 1);
        getTripById(tripId)
          .then((latest) => onUpdated?.(latest, { silent: true }))
          .catch(() => {});
      } else {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Không thể cập nhật trạng thái chuyến xe.',
        );
      }
    } finally {
      statusPending.current = false;
      setStatusSubmitting(false);
    }
  }

  function openCancelDialog() {
    setCancelDialogOpen(true);
  }

  async function handleConfirmCancel() {
    if (cancelPending.current) return;
    cancelPending.current = true;
    setCancelSubmitting(true);
    try {
      const updated = await cancelTrip(tripId);
      setCancelDialogOpen(false);
      setDetail({ status: 'success', trip: updated });
      toast.success(`Đã hủy chuyến ${updated.code}.`);
      onUpdated?.(updated, { silent: true });
    } catch (err: unknown) {
      if (
        err instanceof TripApiError &&
        err.code === 'TRIP_STATUS_TRANSITION_NOT_ALLOWED'
      ) {
        toast.error(
          'Trạng thái chuyến đã thay đổi. Danh sách đã được làm mới.',
        );
        setRetryCount((c) => c + 1);
        getTripById(tripId)
          .then((latest) => onUpdated?.(latest, { silent: true }))
          .catch(() => {});
      } else {
        toast.error(
          err instanceof Error ? err.message : 'Không thể hủy chuyến xe.',
        );
      }
    } finally {
      cancelPending.current = false;
      setCancelSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (deletePending.current) return;
    deletePending.current = true;
    setDeleteSubmitting(true);
    try {
      const deleted = await deleteTrip(tripId);
      setDeleteDialogOpen(false);
      toast.success(`Đã xóa chuyến ${deleted.code}.`);
      onDeleted();
    } catch (err: unknown) {
      if (isTripNotFoundError(err)) {
        onNotFound?.();
      } else {
        toast.error(
          err instanceof Error ? err.message : 'Không thể xóa chuyến xe.',
        );
      }
    } finally {
      deletePending.current = false;
      setDeleteSubmitting(false);
    }
  }

  const loadTripStops = () => {
    setLoadingStops(true);
    getTripStops(tripId)
      .then(setTripStops)
      .catch(() => {})
      .finally(() => setLoadingStops(false));
  };

  async function handleConfirmApplyTemplate() {
    setApplyingTemplate(true);
    try {
      const res = await applyRouteTemplate(tripId);
      toast.success(res.message);
      setApplyTemplateOpen(false);
      loadTripStops();
      setRetryCount((c) => c + 1);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Không thể áp dụng khuôn lộ trình.',
      );
    } finally {
      setApplyingTemplate(false);
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

    setLoadingStops(true);
    getTripStops(tripId)
      .then((stops) => {
        if (!controller.signal.aborted) setTripStops(stops);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStops(false);
      });

    return () => controller.abort();
  }, [tripId, retryCount, onNotFound]);

  useEffect(() => {
    if (editOpen || statusDialogOpen || cancelDialogOpen) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible')
        setRetryCount((count) => count + 1);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [editOpen, statusDialogOpen, cancelDialogOpen]);

  return (
    <ResourceSheet
      title="Chi tiết chuyến xe"
      description="Thông tin tuyến, xe phục vụ, giờ khởi hành và tồn ghế của chuyến."
      onClose={onClose}
    >
      {detail.status === 'loading' && (
        <ResourceState loading>Đang tải thông tin chuyến xe…</ResourceState>
      )}

      {detail.status === 'error' && (
        <ResourceState error>
          <p>{detail.message}</p>
          <Button
            onClick={() => {
              setDetail({ status: 'loading' });
              setRetryCount((c) => c + 1);
            }}
            type="button"
            variant="outline"
          >
            Thử lại
          </Button>
        </ResourceState>
      )}

      {detail.status === 'success' && (
        <div className="space-y-6">
          <section className="space-y-4">
            <h4 className="text-base font-semibold">Thông tin chuyến</h4>
            <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
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
                  <ResourceStatusBadge
                    tone={
                      detail.trip.status === 'DANG_CHAY' ? 'active' : 'muted'
                    }
                  >
                    {tripStatusLabel(detail.trip.status)}
                  </ResourceStatusBadge>
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4">
            <h4 className="text-base font-semibold">Tuyến xe</h4>
            <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
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

          <section className="space-y-4">
            <h4 className="text-base font-semibold">Xe phục vụ</h4>
            <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
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
                  <ResourceStatusBadge
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
                  </ResourceStatusBadge>
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4">
            <h4 className="text-base font-semibold">Thông tin gửi hàng</h4>
            <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
              <div>
                <dt>Nhận gửi hàng</dt>
                <dd>{detail.trip.acceptsShipments ? 'Có' : 'Không'}</dd>
              </div>
            </dl>
            <h5 className="pt-2 text-sm font-semibold">Sức chứa hàng</h5>
            <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
              <div>
                <dt>Xe máy</dt>
                <dd>{detail.trip.cargoCapacity.motorbikes}</dd>
              </div>
              <div>
                <dt>Hàng cồng kềnh</dt>
                <dd>{detail.trip.cargoCapacity.bulkyCargo}</dd>
              </div>
              <div>
                <dt>Hàng nhẹ</dt>
                <dd>{detail.trip.cargoCapacity.lightCargo}</dd>
              </div>
            </dl>
          </section>

          {detail.trip.seatSummary && (
            <section className="space-y-4">
              <h4 className="text-base font-semibold">Ghế chuyến</h4>
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

          {/* Section Lộ trình đón / trả */}
          <section className="space-y-3 rounded-lg border p-4 bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-base font-semibold flex items-center gap-2">
                  <RouteIcon className="size-4 text-primary" />
                  Điểm đón / trả theo giờ ({tripStops.length})
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lộ trình đón, trả và trạm nghỉ của chuyến xe
                </p>
              </div>

              {canUpdate && detail.trip.status === 'CHUA_KHOI_HANH' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setApplyTemplateOpen(true)}
                  >
                    Áp dụng khuôn mẫu
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setStopsEditorOpen(true)}
                  >
                    Chỉnh sửa lộ trình
                  </Button>
                </div>
              )}
            </div>

            {detail.trip.thieuDiem && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Thiếu điểm đón / trả</AlertTitle>
                <AlertDescription className="text-xs">
                  Chuyến xe đang thiếu điểm đón hoặc điểm trả! Vui lòng cấu hình lộ trình.
                </AlertDescription>
              </Alert>
            )}

            {loadingStops ? (
              <p className="text-xs text-muted-foreground">Đang tải điểm đón trả…</p>
            ) : tripStops.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Chưa có điểm đón/trả nào được gán cho chuyến này.
              </p>
            ) : (
              <div className="space-y-2 pt-1 max-h-60 overflow-y-auto pr-1">
                {tripStops.map((stop, idx) => (
                  <div
                    key={stop.diemDonTraChuyenXeId ?? idx}
                    className="flex items-center justify-between text-xs p-2 rounded-[var(--admin-radius-panel)] border border-border bg-card"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant={
                          stop.loaiDiem === 'DON'
                            ? 'secondary'
                            : stop.loaiDiem === 'TRA'
                              ? 'outline'
                              : 'warning'
                        }
                        className="text-[10px] font-semibold"
                      >
                        {stop.loaiDiem === 'DON'
                          ? 'ĐÓN'
                          : stop.loaiDiem === 'TRA'
                            ? 'TRẢ'
                            : 'NGHỈ'}
                      </Badge>
                      <span className="font-medium truncate">
                        {stop.diemDonTra?.tenDiem ?? `Điểm #${stop.diemDonTraId}`}
                      </span>
                      {stop.phuPhi > 0 && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          (+{Number(stop.phuPhi).toLocaleString('vi-VN')}đ)
                        </span>
                      )}
                      {(stop.veCount ?? 0) > 0 && (
                        <Badge variant="warning" className="text-[10px] font-semibold">
                          {stop.veCount} vé
                        </Badge>
                      )}
                    </div>
                    <div className="font-mono text-primary font-semibold shrink-0">
                      {stop.gioThucTe ?? `${stop.phutLech >= 0 ? '+' : ''}${stop.phutLech}p`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h4 className="text-base font-semibold">Thông tin hệ thống</h4>
            <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
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
            <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
              {canRead && (
                <Link
                  className={buttonVariants({ variant: 'outline' })}
                  href={`/trips/${detail.trip.tripId}/seats`}
                >
                  Xem ghế chuyến
                </Link>
              )}
              {canRead && (
                <Link
                  className={buttonVariants({ variant: 'outline' })}
                  href={`/trips/${detail.trip.tripId}/manifest`}
                >
                  <Users className="size-3.5 mr-1" />
                  Hành khách (Manifest)
                </Link>
              )}
              {canUpdate && detail.trip.status === 'CHUA_KHOI_HANH' && (
                <Button
                  onClick={() => setEditOpen(true)}
                  type="button"
                  variant="outline"
                >
                  Chỉnh sửa
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
                  variant="outline"
                >
                  Hủy chuyến
                </Button>
              )}
              {canDelete &&
                (detail.trip.status === 'CHUA_KHOI_HANH' ||
                  detail.trip.status === 'DA_HUY') && (
                  <Button
                    onClick={() => setDeleteDialogOpen(true)}
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                    Xóa chuyến
                  </Button>
                )}
            </div>
          )}
        </div>
      )}

      {editOpen && canUpdate && detail.status === 'success' && (
        <TripFormDialog
          onClose={() => setEditOpen(false)}
          onRetryRouteOptions={onRetryRouteOptions ?? (() => {})}
          onRetryVehicleOptions={onRetryVehicleOptions ?? (() => {})}
          onSaved={(saved) => {
            setEditOpen(false);
            setDetail({ status: 'success', trip: saved });
            onUpdated?.(saved);
          }}
          routeOptions={routeOptions ?? { status: 'success', options: [] }}
          trip={detail.trip}
          vehicleOptions={vehicleOptions ?? { status: 'success', options: [] }}
        />
      )}

      {stopsEditorOpen && canUpdate && detail.status === 'success' && (
        <StopListEditor
          mode="trip"
          targetId={tripId}
          departureTime={detail.trip.departureTime}
          title={`Điểm đón / trả chuyến: ${detail.trip.code}`}
          onClose={() => setStopsEditorOpen(false)}
          onSaved={() => {
            loadTripStops();
            setRetryCount((c) => c + 1);
          }}
        />
      )}

      {applyTemplateOpen && detail.status === 'success' && (
        <ResourceConfirmation
          title={`Áp dụng khuôn lộ trình cho chuyến ${detail.trip.code}?`}
          description="Hệ thống sẽ sao chép toàn bộ điểm đón, trả và trạm nghỉ từ khuôn mẫu tuyến xe tương ứng và tính toán giờ dự kiến theo giờ khởi hành chuyến. Các điểm hiện tại chưa có vé đặt sẽ được thay thế."
          busy={applyingTemplate}
          onClose={() => setApplyTemplateOpen(false)}
        >
          <Button disabled={applyingTemplate} onClick={handleConfirmApplyTemplate}>
            {applyingTemplate && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {applyingTemplate ? 'Đang áp dụng…' : 'Áp dụng khuôn mẫu'}
          </Button>
        </ResourceConfirmation>
      )}

      {statusDialogOpen && statusTarget && detail.status === 'success' && (
        <ResourceConfirmation
          title="Hoàn thành chuyến xe?"
          description={`Chuyến xe ${detail.trip.code} sẽ chuyển sang trạng thái Hoàn thành và kết thúc hành trình.`}
          busy={statusSubmitting}
          onClose={() => setStatusDialogOpen(false)}
        >
          <Button disabled={statusSubmitting} onClick={handleConfirmStatus}>
            {statusSubmitting && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {statusSubmitting ? 'Đang cập nhật…' : 'Hoàn thành chuyến'}
          </Button>
        </ResourceConfirmation>
      )}
      {cancelDialogOpen && detail.status === 'success' && (
        <ResourceConfirmation
          title={`Hủy chuyến ${detail.trip.code}?`}
          description={`Chuyến ${detail.trip.route.origin} → ${detail.trip.route.destination}, khởi hành ${formatTime(detail.trip.departureTime)} ngày ${formatDate(detail.trip.departureDate)}, sẽ chuyển sang Đã hủy. Thao tác này không xóa dữ liệu chuyến xe và ghế chuyến.`}
          busy={cancelSubmitting}
          onClose={() => setCancelDialogOpen(false)}
        >
          <Button
            variant="destructive"
            disabled={cancelSubmitting}
            onClick={handleConfirmCancel}
          >
            {cancelSubmitting && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {cancelSubmitting ? 'Đang hủy…' : 'Hủy chuyến'}
          </Button>
        </ResourceConfirmation>
      )}
      {deleteDialogOpen && detail.status === 'success' && (
        <ResourceConfirmation
          title={`Xóa chuyến ${detail.trip.code}?`}
          description="Chỉ chuyến chưa khởi hành hoặc đã hủy và chưa từng phát sinh vé, vận đơn hay đánh giá mới xóa được; giữ chỗ còn hiệu lực cũng sẽ chặn thao tác. Ghế chuyến và giữ chỗ đã hết hạn sẽ bị xóa cùng chuyến. Thao tác này không thể hoàn tác."
          busy={deleteSubmitting}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <Button
            variant="destructive"
            disabled={deleteSubmitting}
            onClick={handleConfirmDelete}
          >
            {deleteSubmitting && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {deleteSubmitting ? 'Đang xóa…' : 'Xóa chuyến'}
          </Button>
        </ResourceConfirmation>
      )}
    </ResourceSheet>
  );
}
