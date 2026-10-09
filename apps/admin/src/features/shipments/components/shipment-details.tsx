'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
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
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
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
  targetStatus: ShipmentStatus;
  title: string;
  description: string;
  actionLabel: string;
  confirmLabel: string;
  variant?: 'primary' | 'destructive';
};

export function getAvailableStatusActions(status: ShipmentStatus): StatusActionConfig[] {
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
          variant: 'primary',
        },
        {
          targetStatus: 'DA_HUY',
          title: 'Hủy phiếu gửi hàng?',
          description:
            'Phiếu gửi hàng sẽ chuyển sang trạng thái Đã hủy. Thao tác này chỉ áp dụng cho phiếu chưa thanh toán trong MVP.',
          actionLabel: 'Hủy phiếu gửi',
          confirmLabel: 'Xác nhận hủy',
          variant: 'destructive',
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
          variant: 'primary',
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
          variant: 'primary',
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
  const dialogRef = useRef<HTMLDialogElement>(null);
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

  const [activeAction, setActiveAction] = useState<StatusActionConfig | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionLocked, setActionLocked] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

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
    setStatusError(null);
  }

  function handleCloseDialog() {
    if (!submitting) {
      setActiveAction(null);
      setActionLocked(false);
      setStatusError(null);
    }
  }

  async function handleConfirmStatus() {
    if (!activeAction || submitting) return;
    setSubmitting(true);
    setStatusError(null);

    try {
      await updateShipmentStatus(shipmentId, {
        status: activeAction.targetStatus,
        note: note.trim() || undefined,
      });
      setActiveAction(null);
      setNote('');
      setActionLocked(false);
      setRetryCount((c) => c + 1);
      onStatusUpdated?.();
    } catch (err: unknown) {
      if (err instanceof ShipmentStatusUpdateError && err.status === 409) {
        setActionLocked(true);

        if (err.code !== 'SHIPMENT_REFUND_REQUIRED') {
          setRetryCount((c) => c + 1);
          onStatusUpdated?.();
        }
      }
      setStatusError(
        err instanceof Error
          ? err.message
          : 'Có lỗi xảy ra khi cập nhật trạng thái.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminDetailSheet
      ariaLabelledBy="shipment-detail-title"
      dialogRef={dialogRef}
      onClose={onClose}
    >
      <div className="admin-dialog-header">
        <div className="admin-dialog-header__copy">
          <p className="eyebrow">PHIẾU GỬI HÀNG</p>
          <h2 id="shipment-detail-title">Chi tiết phiếu gửi</h2>
        </div>
        <button
          aria-label="Đóng chi tiết phiếu gửi"
          className="icon-button"
          onClick={() => dialogRef.current?.close()}
          type="button"
        >
          <X aria-hidden="true" size={19} />
        </button>
      </div>

      {detail.status === 'loading' && (
        <div className="shipments-state-panel" role="status">
          <p>Đang tải thông tin phiếu gửi hàng…</p>
        </div>
      )}

      {detail.status === 'error' && (
        <div className="shipments-state-panel" role="alert">
          <p>{detail.message}</p>
          <Button onClick={retry} type="button" variant="secondary">
            Thử lại
          </Button>
        </div>
      )}

      {detail.status === 'success' && (
        <div className="shipments-detail-content">
          <div className="shipments-detail-hero">
            <div>
              <span className="shipments-waybill-code admin-data-mono">
                {detail.shipment.waybillCode}
              </span>
              <p className="shipments-detail-sent-at">
                Ngày gửi: {formatDateTime(detail.shipment.sentAt)}
              </p>
            </div>
            <AdminStatusBadge
              tone={getShipmentStatusTone(detail.shipment.status)}
            >
              {SHIPMENT_STATUS_LABELS[detail.shipment.status] ??
                detail.shipment.status}
            </AdminStatusBadge>
          </div>

          {detail.shipment.note && (
            <div className="shipments-detail-note">
              <strong>Ghi chú:</strong> {detail.shipment.note}
            </div>
          )}

          {canUpdate && (
            (() => {
              const availableActions = getAvailableStatusActions(
                detail.shipment.status,
              );
              if (availableActions.length === 0) return null;
              return (
                <div className="shipments-detail-actions-panel">
                  <span className="shipments-detail-actions-label">
                    Thao tác trạng thái:
                  </span>
                  <div className="admin-detail-sheet__actions">
                    {availableActions.map((action) => (
                      <Button
                        key={action.targetStatus}
                        className={
                          action.variant === 'destructive'
                            ? 'shipments-btn-danger'
                            : undefined
                        }
                        disabled={submitting}
                        onClick={() => handleOpenAction(action)}
                        type="button"
                        variant={
                          action.variant === 'destructive'
                            ? 'secondary'
                            : 'primary'
                        }
                      >
                        {action.actionLabel}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })()
          )}

          {/* Người gửi & Người nhận */}
          <section
            className="shipments-detail-section"
            aria-labelledby="shipment-contacts-heading"
          >
            <h3
              id="shipment-contacts-heading"
              className="shipments-detail-section-title"
            >
              Thông tin giao nhận
            </h3>
            <div className="shipments-detail-grid-2">
              <div className="shipments-detail-card-sub">
                <h4 className="shipments-detail-sub-title">Người gửi</h4>
                <dl className="shipments-detail-dl">
                  <div className="shipments-detail-row">
                    <dt>Họ và tên</dt>
                    <dd>{detail.shipment.sender.fullName}</dd>
                  </div>
                  <div className="shipments-detail-row">
                    <dt>Số điện thoại</dt>
                    <dd className="admin-data-mono">
                      {detail.shipment.sender.phoneNumber}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="shipments-detail-card-sub">
                <h4 className="shipments-detail-sub-title">Người nhận</h4>
                <dl className="shipments-detail-dl">
                  <div className="shipments-detail-row">
                    <dt>Họ và tên</dt>
                    <dd>{detail.shipment.receiver.fullName}</dd>
                  </div>
                  <div className="shipments-detail-row">
                    <dt>Số điện thoại</dt>
                    <dd className="admin-data-mono">
                      {detail.shipment.receiver.phoneNumber}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {/* Lộ trình & Chuyến xe */}
          <section
            className="shipments-detail-section"
            aria-labelledby="shipment-route-heading"
          >
            <h3
              id="shipment-route-heading"
              className="shipments-detail-section-title"
            >
              Chuyến xe & Lộ trình
            </h3>
            <dl className="shipments-detail-dl">
              <div className="shipments-detail-row">
                <dt>Mã chuyến xe</dt>
                <dd className="admin-data-mono">
                  {detail.shipment.trip.code}
                </dd>
              </div>
              <div className="shipments-detail-row">
                <dt>Khởi hành</dt>
                <dd>
                  {detail.shipment.trip.departureTime} ·{' '}
                  {detail.shipment.trip.departureDate}
                </dd>
              </div>
              <div className="shipments-detail-row">
                <dt>Điểm gửi (bốc hàng)</dt>
                <dd>
                  <strong>{detail.shipment.originPoint.name}</strong>
                  <br />
                  <span className="shipments-address-text">
                    {detail.shipment.originPoint.address}
                  </span>
                </dd>
              </div>
              <div className="shipments-detail-row">
                <dt>Điểm nhận (trả hàng)</dt>
                <dd>
                  <strong>{detail.shipment.destinationPoint.name}</strong>
                  <br />
                  <span className="shipments-address-text">
                    {detail.shipment.destinationPoint.address}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          {/* Danh sách kiện hàng */}
          <section
            className="shipments-detail-section"
            aria-labelledby="shipment-cargo-heading"
          >
            <h3
              id="shipment-cargo-heading"
              className="shipments-detail-section-title"
            >
              Danh sách kiện hàng ({detail.shipment.cargoItems.length})
            </h3>
            <div className="shipments-cargo-list">
              {detail.shipment.cargoItems.map((item) => (
                <div key={item.cargoId} className="shipments-cargo-card">
                  <div className="shipments-cargo-card-header">
                    <strong>{item.name}</strong>
                    <span className="shipments-cargo-type">
                      {item.typeName}
                    </span>
                  </div>
                  <dl className="shipments-cargo-dl">
                    <div className="shipments-cargo-field">
                      <dt>Số lượng</dt>
                      <dd>{item.quantity}</dd>
                    </div>
                    <div className="shipments-cargo-field">
                      <dt>Khối lượng</dt>
                      <dd>{item.weightKg} kg</dd>
                    </div>
                    {item.dimensions && (
                      <div className="shipments-cargo-field">
                        <dt>Kích thước (DxRxC)</dt>
                        <dd>
                          {item.dimensions.length}×{item.dimensions.width}×
                          {item.dimensions.height} cm
                        </dd>
                      </div>
                    )}
                    {item.declaredValue != null && (
                      <div className="shipments-cargo-field">
                        <dt>Khai giá</dt>
                        <dd>{formatCurrency(item.declaredValue)}</dd>
                      </div>
                    )}
                  </dl>
                  {item.description && (
                    <p className="shipments-cargo-desc">
                      <em>Mô tả:</em> {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Chi tiết cước */}
          <section
            className="shipments-detail-section"
            aria-labelledby="shipment-fee-heading"
          >
            <h3
              id="shipment-fee-heading"
              className="shipments-detail-section-title"
            >
              Chi tiết cước vận chuyển
            </h3>

            {detail.shipment.cargoFeeDetails.length > 0 && (
              <div className="shipments-fee-table-wrap">
                <table className="shipments-fee-table">
                  <thead>
                    <tr>
                      <th scope="col">Loại hàng</th>
                      <th scope="col">Khối lượng tính cước</th>
                      <th scope="col" className="text-right">
                        Tiền cước
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.shipment.cargoFeeDetails.map((fee) => (
                      <tr key={fee.feeDetailId}>
                        <td>{fee.cargoTypeName}</td>
                        <td>{fee.chargeableWeightKg} kg</td>
                        <td className="text-right">
                          {formatCurrency(fee.fee)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="shipments-fee-summary-card">
              <dl className="shipments-detail-dl">
                <div className="shipments-detail-row">
                  <dt>Cước chính</dt>
                  <dd>{formatCurrency(detail.shipment.feeSummary.mainFee)}</dd>
                </div>
                {detail.shipment.feeSummary.serviceFee > 0 && (
                  <div className="shipments-detail-row">
                    <dt>Phí dịch vụ</dt>
                    <dd>
                      {formatCurrency(detail.shipment.feeSummary.serviceFee)}
                    </dd>
                  </div>
                )}
                {detail.shipment.feeSummary.discountAmount > 0 && (
                  <div className="shipments-detail-row">
                    <dt>Giảm giá</dt>
                    <dd className="shipments-discount-text">
                      -
                      {formatCurrency(
                        detail.shipment.feeSummary.discountAmount,
                      )}
                    </dd>
                  </div>
                )}
                <div className="shipments-detail-row shipments-total-fee-row">
                  <dt>Tổng cước</dt>
                  <dd className="shipments-total-fee-value">
                    {formatCurrency(detail.shipment.feeSummary.totalFee)}
                  </dd>
                </div>
                <div className="shipments-detail-row">
                  <dt>Bên trả cước</dt>
                  <dd>
                    <strong>
                      {FREIGHT_PAYER_LABELS[
                        detail.shipment.feeSummary.freightPayer
                      ] ?? detail.shipment.feeSummary.freightPayer}
                    </strong>
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Timeline Lịch sử trạng thái */}
          <section
            className="shipments-detail-section"
            aria-labelledby="shipment-history-heading"
          >
            <h3
              id="shipment-history-heading"
              className="shipments-detail-section-title"
            >
              Lịch sử trạng thái
            </h3>

            {detail.shipment.history.length === 0 ? (
              <p className="shipments-empty-history">
                Chưa có lịch sử trạng thái
              </p>
            ) : (
              <ol className="shipments-timeline">
                {detail.shipment.history.map((item, index) => (
                  <li key={item.historyId} className="shipments-timeline-item">
                    <div
                      className="shipments-timeline-dot"
                      aria-hidden="true"
                    />
                    {index < detail.shipment.history.length - 1 && (
                      <div
                        className="shipments-timeline-line"
                        aria-hidden="true"
                      />
                    )}
                    <div className="shipments-timeline-body">
                      <div className="shipments-timeline-header">
                        <AdminStatusBadge
                          tone={getShipmentStatusTone(item.status)}
                        >
                          {SHIPMENT_STATUS_LABELS[item.status] ?? item.status}
                        </AdminStatusBadge>
                        <time className="shipments-timeline-time">
                          {formatDateTime(item.time)}
                        </time>
                      </div>
                      <p className="shipments-timeline-actor">
                        Người cập nhật:{' '}
                        <strong>
                          {item.actor?.fullName || 'Hệ thống'}
                        </strong>
                      </p>
                      {item.note && (
                        <p className="shipments-timeline-note">
                          Ghi chú: {item.note}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {activeAction && (
        <AdminConfirmDialog
          ariaBusy={submitting}
          ariaDescribedBy="shipment-status-confirm-desc"
          ariaLabelledBy="shipment-status-confirm-title"
          onClose={handleCloseDialog}
          preventDismiss={submitting}
        >
          <div className="admin-dialog-header">
            <div className="admin-dialog-header__copy">
              <p className="eyebrow">XÁC NHẬN TRẠNG THÁI</p>
              <h3 id="shipment-status-confirm-title">{activeAction.title}</h3>
            </div>
          </div>
          <p
            className="admin-confirm-dialog__description"
            id="shipment-status-confirm-desc"
          >
            {activeAction.description}
          </p>

          <div className="shipments-confirm-form">
            <div className="shipments-confirm-field">
              <label htmlFor="shipment-status-note">
                Ghi chú trạng thái (tùy chọn)
              </label>
              <textarea
                className="shipments-confirm-textarea"
                disabled={submitting || actionLocked}
                id="shipment-status-note"
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú hoặc lý do nếu có..."
                rows={3}
                value={note}
              />
              <div className="shipments-confirm-field-footer">
                <span className="shipments-char-count">{note.length}/500</span>
              </div>
            </div>
          </div>

          {statusError && (
            <p className="admin-confirm-dialog__error" role="alert">
              {statusError}
            </p>
          )}

          <div className="admin-confirm-dialog__actions">
            <Button
              disabled={submitting}
              onClick={handleCloseDialog}
              type="button"
              variant="secondary"
            >
              {actionLocked ? 'Đóng' : 'Hủy'}
            </Button>
            {!actionLocked && (
              <Button
                className={
                  activeAction.variant === 'destructive'
                    ? 'shipments-btn-danger'
                    : undefined
                }
                disabled={submitting}
                onClick={handleConfirmStatus}
                type="button"
                variant={
                  activeAction.variant === 'destructive'
                    ? 'secondary'
                    : 'primary'
                }
              >
                {submitting && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="admin-crud-form-spinner"
                    size={15}
                  />
                )}
                {submitting ? 'Đang cập nhật…' : activeAction.confirmLabel}
              </Button>
            )}
          </div>
        </AdminConfirmDialog>
      )}
    </AdminDetailSheet>
  );
}
