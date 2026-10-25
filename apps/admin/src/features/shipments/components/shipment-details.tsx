'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  ResourceConfirmation,
  ResourceSheet,
  ResourceStatusBadge,
  ResourceState,
  ResourceNotice,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import {
  getShipmentById,
  ShipmentStatusUpdateError,
  updateShipmentStatus,
} from '../services/shipment-service';
import type {
  FreightPayer,
  ShipmentDetail,
  ShipmentStatus,
} from '../types/shipment';

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  MOI_TAO: 'Mới tạo',
  DA_TIEP_NHAN: 'Đã tiếp nhận',
  DANG_VAN_CHUYEN: 'Đang vận chuyển',
  DA_GIAO: 'Đã giao',
  DA_HUY: 'Đã hủy',
};

export const FREIGHT_PAYER_LABELS: Record<FreightPayer, string> = {
  NGUOI_GUI: 'Người gửi trả',
  NGUOI_NHAN: 'Người nhận trả',
};

export function getPaymentStatusLabel(status: string): string {
  switch (status) {
    case 'CHO_THANH_TOAN':
      return 'Chờ thanh toán';
    case 'DA_THANH_TOAN':
      return 'Đã thanh toán';
    case 'DA_HUY':
      return 'Đã hủy';
    default:
      return status;
  }
}

export function getShipmentStatusTone(
  status: ShipmentStatus,
): 'active' | 'muted' {
  switch (status) {
    case 'DA_TIEP_NHAN':
    case 'DANG_VAN_CHUYEN':
    case 'DA_GIAO':
      return 'active';
    case 'MOI_TAO':
    case 'DA_HUY':
    default:
      return 'muted';
  }
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(date)
      .replaceAll('/', '-');
  } catch {
    return '—';
  }
}

export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; shipment: ShipmentDetail };

interface ShipmentDetailsProps {
  shipmentId: number;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

export type StatusActionConfig = {
  targetStatus: Exclude<ShipmentStatus, 'DA_HUY'>;
  title: string;
  description: string;
  actionLabel: string;
  confirmLabel: string;
};

export function getAvailableStatusActions(
  status: ShipmentStatus,
): StatusActionConfig[] {
  switch (status) {
    case 'MOI_TAO':
      return [
        {
          targetStatus: 'DA_TIEP_NHAN',
          title: 'Tiếp nhận hàng gửi?',
          description:
            'Phiếu gửi hàng sẽ chuyển sang trạng thái Đã tiếp nhận tại điểm gửi.',
          actionLabel: 'Xác nhận đã tiếp nhận hàng',
          confirmLabel: 'Xác nhận tiếp nhận',
        },
      ];
    case 'DA_TIEP_NHAN':
      return [
        {
          targetStatus: 'DANG_VAN_CHUYEN',
          title: 'Bắt đầu vận chuyển hàng?',
          description:
            'Phiếu gửi hàng sẽ chuyển sang trạng thái Đang vận chuyển cùng chuyến xe.',
          actionLabel: 'Bắt đầu vận chuyển',
          confirmLabel: 'Bắt đầu vận chuyển',
        },
      ];
    case 'DANG_VAN_CHUYEN':
      return [
        {
          targetStatus: 'DA_GIAO',
          title: 'Xác nhận đã giao hàng?',
          description:
            'Phiếu gửi hàng sẽ chuyển sang trạng thái Đã giao và hoàn tất việc giao nhận.',
          actionLabel: 'Xác nhận đã giao hàng',
          confirmLabel: 'Xác nhận đã giao',
        },
      ];
    default:
      return [];
  }
}

export function ShipmentDetails({
  shipmentId,
  onClose,
  onStatusUpdated,
}: ShipmentDetailsProps) {
  const submittingRef = useRef(false);
  const [loadedDetail, setLoadedDetail] = useState<{
    requestKey: string;
    state: DetailState;
  }>({ requestKey: '', state: { status: 'loading' } });
  const [retryCount, setRetryCount] = useState(0);
  const requestKey = `${shipmentId}:${retryCount}`;
  const detail: DetailState =
    loadedDetail.requestKey === requestKey
      ? loadedDetail.state
      : { status: 'loading' };

  const { can } = useAdminPermissions();
  const canUpdate = can('shipment:update');

  const [activeAction, setActiveAction] = useState<StatusActionConfig | null>(
    null,
  );
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionLocked, setActionLocked] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const currentRequestKey = `${shipmentId}:${retryCount}`;

    getShipmentById(shipmentId, controller.signal)
      .then((shipment) => {
        if (!controller.signal.aborted) {
          setLoadedDetail({
            requestKey: currentRequestKey,
            state: { status: 'success', shipment },
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadedDetail({
            requestKey: currentRequestKey,
            state: {
              status: 'error',
              message:
                error instanceof Error
                  ? error.message
                  : 'Không thể tải thông tin phiếu gửi hàng.',
            },
          });
        }
      });

    return () => controller.abort();
  }, [shipmentId, retryCount]);

  function retry() {
    setRetryCount((c) => c + 1);
  }

  function handleOpenAction(action: StatusActionConfig) {
    setActiveAction(action);
    setNote('');
    setActionLocked(false);
  }

  function handleCloseDialog() {
    if (!submitting) {
      setActiveAction(null);
      setActionLocked(false);
    }
  }

  async function handleConfirmStatus() {
    if (!activeAction || submittingRef.current || actionLocked) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      await updateShipmentStatus(shipmentId, {
        status: activeAction.targetStatus,
        note: note.trim() || undefined,
      });
      toast.success(
        `Đã chuyển phiếu gửi sang trạng thái ${SHIPMENT_STATUS_LABELS[activeAction.targetStatus]}.`,
      );
      setActiveAction(null);
      setNote('');
      setActionLocked(false);
      setRetryCount((c) => c + 1);
      onStatusUpdated?.();
    } catch (err: unknown) {
      if (err instanceof ShipmentStatusUpdateError && err.status === 409) {
        setActionLocked(true);
        setRetryCount((c) => c + 1);
        onStatusUpdated?.();
      }
      toast.error(
        err instanceof Error
          ? err.message
          : 'Có lỗi xảy ra khi cập nhật trạng thái.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <ResourceSheet
        title="Chi tiết phiếu gửi"
        description="Thông tin giao nhận, cước vận chuyển và lịch sử trạng thái."
        busy={submitting}
        preventDismiss={submitting}
        onClose={onClose}
      >
        {detail.status === 'loading' && (
          <ResourceState loading>
            <p>Đang tải thông tin phiếu gửi hàng…</p>
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
          <div className="grid min-w-0 gap-6">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b pb-5 [&>div]:min-w-0">
              <div>
                <span className="admin-data-mono break-all text-sm font-semibold">
                  {detail.shipment.waybillCode}
                </span>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ngày gửi: {formatDateTime(detail.shipment.sentAt)}
                </p>
              </div>
              <ResourceStatusBadge
                tone={getShipmentStatusTone(detail.shipment.status)}
              >
                {SHIPMENT_STATUS_LABELS[detail.shipment.status] ??
                  detail.shipment.status}
              </ResourceStatusBadge>
            </div>

            {detail.shipment.note && (
              <div className="rounded-lg border bg-muted/40 p-3 text-[13px] break-words">
                <strong>Ghi chú:</strong> {detail.shipment.note}
              </div>
            )}

            {canUpdate &&
              (() => {
                const availableActions = getAvailableStatusActions(
                  detail.shipment.status,
                );
                if (availableActions.length === 0) return null;
                const paymentConfirmed =
                  detail.shipment.paymentStatus === 'DA_THANH_TOAN';
                return (
                  <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
                    <span className="text-[13px] font-semibold">
                      Thao tác trạng thái:
                    </span>
                    {paymentConfirmed ? (
                      <div className="flex flex-wrap gap-3">
                        {availableActions.map((action) => (
                          <Button
                            key={action.targetStatus}
                            disabled={submitting}
                            onClick={() => handleOpenAction(action)}
                            type="button"
                            variant="default"
                          >
                            {action.actionLabel}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p
                        className="text-xs text-muted-foreground"
                        role="status"
                      >
                        Chỉ có thể cập nhật trạng thái vận chuyển sau khi đơn đã
                        thanh toán.
                      </p>
                    )}
                  </div>
                );
              })()}

            {/* Người gửi & Người nhận */}
            <Card
              role="region"
              className="min-w-0 gap-4 p-4"
              aria-labelledby="shipment-contacts-heading"
            >
              <h3
                id="shipment-contacts-heading"
                className="text-base font-semibold"
              >
                Thông tin giao nhận
              </h3>
              <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                <div className="min-w-0 space-y-3">
                  <h4 className="text-[13px] font-semibold">Người gửi</h4>
                  <dl className="grid gap-3 text-[13px]">
                    <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                      <dt>Họ và tên</dt>
                      <dd>{detail.shipment.sender.fullName}</dd>
                    </div>
                    <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                      <dt>Số điện thoại</dt>
                      <dd>{detail.shipment.sender.phoneNumber}</dd>
                    </div>
                  </dl>
                </div>

                <div className="min-w-0 space-y-3">
                  <h4 className="text-[13px] font-semibold">Người nhận</h4>
                  <dl className="grid gap-3 text-[13px]">
                    <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                      <dt>Họ và tên</dt>
                      <dd>{detail.shipment.receiver.fullName}</dd>
                    </div>
                    <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                      <dt>Số điện thoại</dt>
                      <dd>{detail.shipment.receiver.phoneNumber}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </Card>

            {/* Lộ trình & Chuyến xe */}
            <Card
              role="region"
              className="min-w-0 gap-4 p-4"
              aria-labelledby="shipment-route-heading"
            >
              <h3
                id="shipment-route-heading"
                className="text-base font-semibold"
              >
                Chuyến xe & Lộ trình
              </h3>
              <dl className="grid gap-3 text-[13px]">
                <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] sm:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                  <dt>Mã chuyến xe</dt>
                  <dd className="admin-data-mono">
                    {detail.shipment.trip.code}
                  </dd>
                </div>
                <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] sm:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                  <dt>Khởi hành</dt>
                  <dd>
                    {detail.shipment.trip.departureTime} ·{' '}
                    {detail.shipment.trip.departureDate.replace(
                      /^(\d{4})-(\d{2})-(\d{2})$/,
                      '$3-$2-$1',
                    )}
                  </dd>
                </div>
                <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] sm:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                  <dt>Điểm gửi (bốc hàng)</dt>
                  <dd>
                    <strong>{detail.shipment.originPoint.name}</strong>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {detail.shipment.originPoint.address}
                    </span>
                  </dd>
                </div>
                <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] sm:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                  <dt>Điểm nhận (trả hàng)</dt>
                  <dd>
                    <strong>{detail.shipment.destinationPoint.name}</strong>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {detail.shipment.destinationPoint.address}
                    </span>
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Danh sách kiện hàng */}
            <Card
              role="region"
              className="min-w-0 gap-4 p-4"
              aria-labelledby="shipment-cargo-heading"
            >
              <h3
                id="shipment-cargo-heading"
                className="text-base font-semibold"
              >
                Danh sách kiện hàng ({detail.shipment.cargoItems.length})
              </h3>
              <div className="grid gap-4">
                {detail.shipment.cargoItems.map((item) => (
                  <div
                    key={item.cargoId}
                    className="min-w-0 rounded-lg border p-3 space-y-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-[13px] [&_strong]:break-words">
                      <strong>{item.name}</strong>
                      <span className="text-xs text-muted-foreground">
                        {item.typeName}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-[13px]">
                      <div className="min-w-0 space-y-1 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
                        <dt>Số lượng</dt>
                        <dd>{item.quantity}</dd>
                      </div>
                      <div className="min-w-0 space-y-1 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
                        <dt>Khối lượng</dt>
                        <dd>{item.weightKg} kg</dd>
                      </div>
                      {item.dimensions && (
                        <div className="min-w-0 space-y-1 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
                          <dt>Kích thước (DxRxC)</dt>
                          <dd>
                            {item.dimensions.length}×{item.dimensions.width}×
                            {item.dimensions.height} cm
                          </dd>
                        </div>
                      )}
                      {item.declaredValue != null && (
                        <div className="min-w-0 space-y-1 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
                          <dt>Khai giá</dt>
                          <dd>{formatCurrency(item.declaredValue)}</dd>
                        </div>
                      )}
                    </dl>
                    {item.description && (
                      <p className="text-xs text-muted-foreground break-words">
                        <em>Mô tả:</em> {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Chi tiết cước */}
            <Card
              role="region"
              className="min-w-0 gap-4 p-4"
              aria-labelledby="shipment-fee-heading"
            >
              <h3 id="shipment-fee-heading" className="text-base font-semibold">
                Chi tiết cước vận chuyển
              </h3>

              {detail.shipment.cargoFeeDetails.length > 0 && (
                <div className="min-w-0">
                  <Table
                    aria-label="Chi tiết cước vận chuyển"
                    className="[&_th]:px-2 [&_td]:px-2 sm:[&_th]:px-4 sm:[&_td]:px-4"
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Loại hàng</TableHead>
                        <TableHead scope="col" className="whitespace-normal">
                          Khối lượng tính cước
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          Tiền cước
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.shipment.cargoFeeDetails.map((fee) => (
                        <TableRow key={fee.feeDetailId}>
                          <TableCell>{fee.cargoTypeName}</TableCell>
                          <TableCell>{fee.chargeableWeightKg} kg</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(fee.fee)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="rounded-lg bg-muted/40 p-3">
                <dl className="grid gap-3 text-[13px]">
                  <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] sm:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                    <dt>Cước chính</dt>
                    <dd>
                      {formatCurrency(detail.shipment.feeSummary.mainFee)}
                    </dd>
                  </div>
                  {detail.shipment.feeSummary.serviceFee > 0 && (
                    <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] sm:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                      <dt>Phí dịch vụ</dt>
                      <dd>
                        {formatCurrency(detail.shipment.feeSummary.serviceFee)}
                      </dd>
                    </div>
                  )}
                  {detail.shipment.feeSummary.discountAmount > 0 && (
                    <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] sm:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                      <dt>Giảm giá</dt>
                      <dd className="text-emerald-700">
                        -
                        {formatCurrency(
                          detail.shipment.feeSummary.discountAmount,
                        )}
                      </dd>
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t pt-3 [&_dt]:font-semibold">
                    <dt>Tổng cước</dt>
                    <dd className="text-lg font-semibold">
                      {formatCurrency(detail.shipment.feeSummary.totalFee)}
                    </dd>
                  </div>
                  <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] sm:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                    <dt>Bên trả cước</dt>
                    <dd>
                      <strong>
                        {FREIGHT_PAYER_LABELS[
                          detail.shipment.feeSummary.freightPayer
                        ] ?? detail.shipment.feeSummary.freightPayer}
                      </strong>
                    </dd>
                  </div>
                  <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] sm:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                    <dt>Thanh toán</dt>
                    <dd>
                      {getPaymentStatusLabel(detail.shipment.paymentStatus)}
                    </dd>
                  </div>
                </dl>
              </div>
            </Card>

            {/* Timeline Lịch sử trạng thái */}
            <Card
              role="region"
              className="min-w-0 gap-4 p-4"
              aria-labelledby="shipment-history-heading"
            >
              <h3
                id="shipment-history-heading"
                className="text-base font-semibold"
              >
                Lịch sử trạng thái
              </h3>

              {detail.shipment.history.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Chưa có lịch sử trạng thái
                </p>
              ) : (
                <ol className="grid gap-5">
                  {detail.shipment.history.map((item, index) => (
                    <li
                      key={item.historyId}
                      className="relative flex min-w-0 gap-3"
                    >
                      <div
                        className="mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-primary bg-card"
                        aria-hidden="true"
                      />
                      {index < detail.shipment.history.length - 1 && (
                        <div
                          className="absolute left-1 top-5 bottom-[-12px] border-l"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-2 text-[13px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <ResourceStatusBadge
                            tone={getShipmentStatusTone(item.status)}
                          >
                            {SHIPMENT_STATUS_LABELS[item.status] ?? item.status}
                          </ResourceStatusBadge>
                          <time
                            dateTime={item.time}
                            className="text-xs text-muted-foreground"
                          >
                            {formatDateTime(item.time)}
                          </time>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Người cập nhật:{' '}
                          <strong>{item.actor?.fullName || 'Hệ thống'}</strong>
                        </p>
                        {item.note && (
                          <p className="text-xs text-muted-foreground break-words">
                            Ghi chú: {item.note}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        )}
      </ResourceSheet>

      {activeAction && (
        <ResourceConfirmation
          title={activeAction.title}
          description={activeAction.description}
          busy={submitting}
          onClose={handleCloseDialog}
        >
          <Field>
            <FieldLabel htmlFor="shipment-status-note">
              Ghi chú trạng thái (tùy chọn)
            </FieldLabel>
            <Textarea
              disabled={submitting || actionLocked}
              id="shipment-status-note"
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập ghi chú hoặc lý do nếu có..."
              rows={3}
              value={note}
              aria-describedby="shipment-status-note-count"
            />
            <p
              className="text-right text-xs text-muted-foreground"
              id="shipment-status-note-count"
            >
              {note.length}/500
            </p>
          </Field>
          {actionLocked && (
            <ResourceNotice kind="info">
              Dữ liệu phiếu gửi đã thay đổi. Đóng hộp xác nhận và kiểm tra trạng
              thái mới trước khi thao tác tiếp.
            </ResourceNotice>
          )}
          {!actionLocked && (
            <Button
              disabled={submitting}
              aria-busy={submitting}
              onClick={handleConfirmStatus}
              type="button"
            >
              {submitting && (
                <LoaderCircle
                  aria-hidden
                  className="motion-safe:animate-spin"
                />
              )}
              {submitting ? 'Đang cập nhật…' : activeAction.confirmLabel}
            </Button>
          )}
        </ResourceConfirmation>
      )}
    </>
  );
}
