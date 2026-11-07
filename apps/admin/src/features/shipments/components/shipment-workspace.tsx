'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Boxes,
  Clock,
  LoaderCircle,
  Package,
  Receipt,
  Route,
  Tag,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceConfirmation,
  ResourceNotice,
  ResourceRefreshAction,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { canDispatchShipment } from '../services/shipment-operations';
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
import { ShipmentOperations } from './shipment-operations';

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  MOI_TAO: 'Chờ mang hàng đến gửi',
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

export function formatCurrency(amount?: number | null): string {
  if (amount == null || Number.isNaN(amount)) return '0 đ';
  return `${amount.toLocaleString('vi-VN')} đ`;
}

export type StatusActionConfig = {
  targetStatus: ShipmentStatus;
  title: string;
  description: string;
  actionLabel: string;
  confirmLabel: string;
  variant?: 'default' | 'destructive' | 'outline';
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

export interface ShipmentWorkspaceProps {
  shipmentId: number;
  initialShipment?: ShipmentDetail;
  onClose?: () => void;
  onStatusUpdated?: () => void;
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; shipment: ShipmentDetail };

export function ShipmentWorkspace({
  shipmentId,
  initialShipment,
  onClose,
  onStatusUpdated,
}: ShipmentWorkspaceProps) {
  const submittingRef = useRef(false);
  const [loadedDetail, setLoadedDetail] = useState<{
    requestKey: string;
    state: DetailState;
  }>({
    requestKey: '',
    state: initialShipment
      ? { status: 'success', shipment: initialShipment }
      : { status: 'loading' },
  });
  const [retryCount, setRetryCount] = useState(0);
  const requestKey = `${shipmentId}:${retryCount}`;
  const detail: DetailState =
    loadedDetail.requestKey === requestKey
      ? loadedDetail.state
      : loadedDetail.state.status === 'success' && retryCount === 0
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
    if (activeAction.targetStatus === 'DA_HUY' && !note.trim()) {
      toast.error('Vui lòng nhập lý do từ chối / hủy phiếu gửi hàng.');
      return;
    }
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

  const shipment = detail.status === 'success' ? detail.shipment : null;

  return (
    <SuperAdminLayout
      activeSection="shipments"
      breadcrumbs={[
        { label: 'Vận tải & Gửi hàng', href: '/shipments' },
        { label: 'Phiếu gửi hàng', href: '/shipments' },
        { label: shipment ? shipment.waybillCode : `Vận đơn #${shipmentId}` },
      ]}
    >
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                nativeButton={false}
                render={
                  <Link
                    href="/shipments"
                    onClick={onClose ? (e) => { e.preventDefault(); onClose(); } : undefined}
                  />
                }
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                Danh sách phiếu gửi
              </Button>

              {shipment && shipment.status !== 'DA_HUY' && (
                <>
                  <Button
                    className="gap-1.5"
                    onClick={() =>
                      window.open(
                        `/shipments/${shipment.shipmentId}/print?type=label`,
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                    size="sm"
                    variant="outline"
                  >
                    <Tag className="size-3.5 text-muted-foreground" />
                    In tem dán kiện
                  </Button>
                  <Button
                    className="gap-1.5"
                    onClick={() =>
                      window.open(
                        `/shipments/${shipment.shipmentId}/print?type=receipt`,
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                    size="sm"
                    variant="outline"
                  >
                    <Receipt className="size-3.5 text-muted-foreground" />
                    In biên nhận
                  </Button>
                </>
              )}

              <ResourceRefreshAction
                loading={detail.status === 'loading'}
                onClick={retry}
              />
            </div>
          }
          eyebrow="CHĂM SÓC KHÁCH HÀNG & GỬI HÀNG"
          title="Chi tiết phiếu gửi"
          titleId="shipment-workspace-title"
        />

        {detail.status === 'loading' && (
          <ResourceState loading>
            <p>Đang tải thông tin phiếu gửi hàng…</p>
          </ResourceState>
        )}

        {detail.status === 'error' && (
          <ResourceState error>
            <p>{detail.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={retry} variant="outline">
                Thử lại
              </Button>
              <Button nativeButton={false} render={<Link href="/shipments" />}>
                Về danh sách phiếu gửi
              </Button>
            </div>
          </ResourceState>
        )}

        {detail.status === 'success' && shipment && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary"
                  >
                    <Package size={28} />
                  </span>
                  <div>
                    <h2 className="admin-data-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {shipment.waybillCode}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ngày gửi: {formatDateTime(shipment.sentAt)}
                    </p>
                  </div>
                </div>
                <ResourceStatusBadge
                  tone={getShipmentStatusTone(shipment.status)}
                >
                  {SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status}
                </ResourceStatusBadge>
              </div>

              {shipment.note && (
                <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-[13px] break-words">
                  <strong>Ghi chú:</strong> {shipment.note}
                </div>
              )}
            </Card>

            {/* Thao tác trạng thái */}
            {canUpdate &&
              (() => {
                const availableActions = getAvailableStatusActions(
                  shipment.status,
                ).filter((action) => action.targetStatus !== 'DA_TIEP_NHAN');
                const canCancel =
                  shipment.status === 'MOI_TAO' ||
                  shipment.status === 'DA_TIEP_NHAN';
                if (availableActions.length === 0 && !canCancel) return null;

                const paymentConfirmed =
                  shipment.status === 'DA_TIEP_NHAN'
                    ? canDispatchShipment(shipment)
                    : shipment.paymentStatus === 'DA_THANH_TOAN';

                const cancelAction: StatusActionConfig = {
                  targetStatus: 'DA_HUY',
                  title: 'Từ chối / Hủy đơn gửi hàng?',
                  description:
                    'Phiếu gửi sẽ chuyển sang trạng thái Đã hủy. Vui lòng nhập lý do bên dưới.',
                  actionLabel: 'Từ chối / Hủy đơn',
                  confirmLabel: 'Xác nhận hủy',
                  variant: 'destructive',
                };

                return (
                  <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm border-blue-200/60 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10">
                    <CardHeader className="p-0 pb-3">
                      <CardTitle className="text-sm font-semibold text-foreground">
                        Thao tác trạng thái:
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="flex flex-wrap items-center gap-3">
                        {paymentConfirmed ? (
                          availableActions.map((action) => (
                            <Button
                              disabled={submitting}
                              key={action.targetStatus}
                              onClick={() => handleOpenAction(action)}
                              type="button"
                              variant="default"
                            >
                              {action.actionLabel}
                            </Button>
                          ))
                        ) : (
                          <p
                            className="text-xs text-muted-foreground"
                            role="status"
                          >
                            Cần phân chuyến và hoàn tất điều kiện thanh toán trước
                            khi vận chuyển / giao hàng.
                          </p>
                        )}
                        {canCancel && (
                          <Button
                            className="border-destructive/30 text-destructive hover:bg-destructive/10"
                            disabled={submitting}
                            onClick={() => handleOpenAction(cancelAction)}
                            type="button"
                            variant="outline"
                          >
                            {cancelAction.actionLabel}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

            {/* Điều phối phân chuyến & cân đo */}
            {canUpdate && (
              <ShipmentOperations
                onUpdated={() => {
                  retry();
                  onStatusUpdated?.();
                }}
                shipment={shipment}
              />
            )}

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Card 1: Thông tin người gửi & Người nhận */}
              <Card
                aria-labelledby="shipment-contacts-heading"
                className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm"
                role="region"
              >
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    <CardTitle
                      className="text-base font-semibold"
                      id="shipment-contacts-heading"
                    >
                      Thông tin giao nhận
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">
                        Người gửi
                      </h4>
                      <dl className="grid gap-2 text-xs">
                        <div>
                          <dt className="text-muted-foreground">Họ và tên</dt>
                          <dd className="font-semibold text-foreground text-sm">
                            {shipment.sender.fullName}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Số điện thoại</dt>
                          <dd className="admin-data-mono font-medium text-foreground">
                            {shipment.sender.phoneNumber}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">
                        Người nhận
                      </h4>
                      <dl className="grid gap-2 text-xs">
                        <div>
                          <dt className="text-muted-foreground">Họ và tên</dt>
                          <dd className="font-semibold text-foreground text-sm">
                            {shipment.receiver.fullName}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Số điện thoại</dt>
                          <dd className="admin-data-mono font-medium text-foreground">
                            {shipment.receiver.phoneNumber}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Chuyến xe & Lộ trình */}
              <Card
                aria-labelledby="shipment-route-heading"
                className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm"
                role="region"
              >
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Route className="size-4 text-muted-foreground" />
                    <CardTitle
                      className="text-base font-semibold"
                      id="shipment-route-heading"
                    >
                      Chuyến xe & Lộ trình
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5">
                    <div className="grid grid-cols-2 gap-3 border-b pb-2.5">
                      <div>
                        <dt>Nhà xe vận chuyển</dt>
                        <dd className="font-medium text-foreground">
                          {shipment.carrier?.name ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Tuyến đường</dt>
                        <dd className="font-medium text-foreground">
                          {shipment.route
                            ? `${shipment.route.origin} → ${shipment.route.destination}`
                            : '—'}
                        </dd>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-b pb-2.5">
                      <div>
                        <dt>Mã chuyến xe</dt>
                        <dd className="admin-data-mono font-semibold text-foreground">
                          {shipment.trip?.code ?? 'Chưa phân chuyến'}
                        </dd>
                      </div>
                      <div>
                        <dt>Thời gian khởi hành</dt>
                        <dd className="font-medium text-foreground">
                          {shipment.trip?.departureTime ?? '—'} ·{' '}
                          {shipment.trip?.departureDate.replace(
                            /^(\d{4})-(\d{2})-(\d{2})$/,
                            '$3-$2-$1',
                          )}
                        </dd>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <dt>Điểm gửi (bốc hàng)</dt>
                        <dd>
                          <strong className="text-foreground">
                            {shipment.originPoint.name}
                          </strong>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {shipment.originPoint.address}
                          </p>
                        </dd>
                      </div>
                      <div>
                        <dt>Điểm nhận (trả hàng)</dt>
                        <dd>
                          <strong className="text-foreground">
                            {shipment.destinationPoint.name}
                          </strong>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {shipment.destinationPoint.address}
                          </p>
                        </dd>
                      </div>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>

            {/* Danh sách kiện hàng */}
            <Card
              aria-labelledby="shipment-cargo-heading"
              className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm"
              role="region"
            >
              <CardHeader className="p-0 pb-4">
                <div className="flex items-center gap-2">
                  <Boxes className="size-4 text-muted-foreground" />
                  <CardTitle
                    className="text-base font-semibold"
                    id="shipment-cargo-heading"
                  >
                    Danh sách kiện hàng ({shipment.cargoItems.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shipment.cargoItems.map((item) => (
                    <div
                      className="rounded-lg border p-4 space-y-3 bg-muted/10"
                      key={item.cargoId}
                    >
                      <div className="flex flex-wrap justify-between gap-2 text-[13px]">
                        <strong className="text-foreground font-semibold">
                          {item.name}
                        </strong>
                        <span className="text-xs rounded bg-muted px-2 py-0.5 text-muted-foreground font-medium">
                          {item.typeName}
                        </span>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                        <div>
                          <dt>Số lượng</dt>
                          <dd>{item.quantity} kiện</dd>
                        </div>
                        <div>
                          <dt>Khai báo / thực tế</dt>
                          <dd>
                            {item.declaredWeightKg ?? item.weightKg} kg /{' '}
                            {item.actualWeightKg == null
                              ? 'Chưa cân'
                              : `${item.actualWeightKg} kg`}
                          </dd>
                        </div>
                        {item.dimensions && (
                          <div>
                            <dt>Kích thước (DxRxC)</dt>
                            <dd>
                              {item.dimensions.length}×{item.dimensions.width}×
                              {item.dimensions.height} cm
                            </dd>
                          </div>
                        )}
                        {item.declaredValue != null && (
                          <div>
                            <dt>Khai giá</dt>
                            <dd className="text-primary font-semibold">
                              {formatCurrency(item.declaredValue)}
                            </dd>
                          </div>
                        )}
                      </dl>
                      {item.description && (
                        <p className="text-xs text-muted-foreground border-t pt-2 break-words">
                          <em>Mô tả:</em> {item.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chi tiết cước & Thanh toán */}
            <Card
              aria-labelledby="shipment-fee-heading"
              className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm"
              role="region"
            >
              <CardHeader className="p-0 pb-4">
                <div className="flex items-center gap-2">
                  <Receipt className="size-4 text-muted-foreground" />
                  <CardTitle
                    className="text-base font-semibold"
                    id="shipment-fee-heading"
                  >
                    Chi tiết cước vận chuyển
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                {shipment.cargoFeeDetails.length > 0 && (
                  <div className="overflow-hidden rounded-lg border">
                    <Table aria-label="Chi tiết cước vận chuyển">
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col">Loại hàng</TableHead>
                          <TableHead scope="col">Khối lượng tính cước</TableHead>
                          <TableHead className="text-right" scope="col">
                            Tiền cước
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shipment.cargoFeeDetails.map((fee) => (
                          <TableRow key={fee.feeDetailId}>
                            <TableCell className="font-medium text-foreground">
                              {fee.cargoTypeName}
                            </TableCell>
                            <TableCell className="admin-data-mono">
                              {fee.chargeableWeightKg} kg
                            </TableCell>
                            <TableCell className="admin-data-mono text-right font-semibold text-foreground">
                              {formatCurrency(fee.fee)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="rounded-lg bg-muted/40 p-4">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-muted-foreground [&_dd]:font-medium [&_dd]:text-foreground">
                    <div className="flex justify-between border-b pb-2">
                      <dt>Cước chính</dt>
                      <dd>{formatCurrency(shipment.feeSummary.mainFee)}</dd>
                    </div>
                    {shipment.feeSummary.serviceFee > 0 && (
                      <div className="flex justify-between border-b pb-2">
                        <dt>Phí dịch vụ</dt>
                        <dd>{formatCurrency(shipment.feeSummary.serviceFee)}</dd>
                      </div>
                    )}
                    {shipment.feeSummary.discountAmount > 0 && (
                      <div className="flex justify-between border-b pb-2">
                        <dt>Giảm giá</dt>
                        <dd className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          -{formatCurrency(shipment.feeSummary.discountAmount)}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t pt-3">
                      <dt className="text-base font-semibold text-foreground">
                        Tổng cước
                      </dt>
                      <dd className="text-xl font-bold text-primary">
                        {formatCurrency(shipment.feeSummary.totalFee)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t pt-2.5">
                      <dt>Bên trả cước</dt>
                      <dd className="font-semibold">
                        {FREIGHT_PAYER_LABELS[shipment.feeSummary.freightPayer] ??
                          shipment.feeSummary.freightPayer}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Thanh toán</dt>
                      <dd>
                        <span className="font-semibold">
                          {getPaymentStatusLabel(shipment.paymentStatus)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </CardContent>
            </Card>

            {/* Lịch sử trạng thái */}
            <Card
              aria-labelledby="shipment-history-heading"
              className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm"
              role="region"
            >
              <CardHeader className="p-0 pb-4">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <CardTitle
                    className="text-base font-semibold"
                    id="shipment-history-heading"
                  >
                    Lịch sử trạng thái
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {shipment.history.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3">
                    Chưa có lịch sử trạng thái
                  </p>
                ) : (
                  <ol className="relative border-l border-slate-200 dark:border-slate-800 ml-3 space-y-6 py-2">
                    {shipment.history.map((item) => (
                      <li className="ml-6 relative" key={item.historyId}>
                        <span
                          aria-hidden="true"
                          className="absolute -left-9 top-1 size-3 rounded-full border-2 border-primary bg-background"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <ResourceStatusBadge
                            tone={getShipmentStatusTone(item.status)}
                          >
                            {SHIPMENT_STATUS_LABELS[item.status] ?? item.status}
                          </ResourceStatusBadge>
                          <time
                            className="admin-data-mono text-xs text-muted-foreground"
                            dateTime={item.time}
                          >
                            {formatDateTime(item.time)}
                          </time>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Người cập nhật:{' '}
                          <strong className="text-foreground">
                            {item.actor?.fullName || 'Hệ thống'}
                          </strong>
                        </p>
                        {item.note && (
                          <p className="mt-1 text-xs text-foreground bg-muted/40 rounded p-2 break-words">
                            Ghi chú: {item.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dialog xác nhận trạng thái */}
        {activeAction && (
          <ResourceConfirmation
            busy={submitting}
            description={activeAction.description}
            onClose={handleCloseDialog}
            title={activeAction.title}
          >
            <Field>
              <FieldLabel htmlFor="shipment-status-note">
                {activeAction.targetStatus === 'DA_HUY'
                  ? 'Lý do từ chối / hủy (bắt buộc)'
                  : 'Ghi chú trạng thái (tùy chọn)'}
              </FieldLabel>
              <Textarea
                aria-describedby="shipment-status-note-count"
                disabled={submitting || actionLocked}
                id="shipment-status-note"
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  activeAction.targetStatus === 'DA_HUY'
                    ? 'Ví dụ: Hàng cấm gửi, khách hàng không mang hàng ra bến...'
                    : 'Nhập ghi chú hoặc lý do nếu có...'
                }
                rows={3}
                value={note}
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
                aria-busy={submitting}
                disabled={
                  submitting ||
                  (activeAction.targetStatus === 'DA_HUY' && !note.trim())
                }
                onClick={handleConfirmStatus}
                type="button"
                variant={
                  activeAction.variant === 'destructive'
                    ? 'destructive'
                    : 'default'
                }
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
      </div>
    </SuperAdminLayout>
  );
}

export { ShipmentWorkspace as ShipmentDetails };
