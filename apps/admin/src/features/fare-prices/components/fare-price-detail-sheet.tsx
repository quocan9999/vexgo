'use client';

import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Pencil, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import {
  ResourceConfirmation,
  ResourceSheet,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
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
  })
    .format(new Date(`${value}T00:00:00.000Z`))
    .replaceAll('/', '-');
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
  const { can } = useAdminPermissions();
  const canUpdate = can('fare-price:update');
  const [request, setRequest] = useState<{
    key: string;
    status: 'loading' | 'success' | 'error';
    farePrice?: FarePrice;
  }>({ key: '', status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const statusSubmittingRef = useRef(false);
  const onNotFoundRef = useRef(onNotFound);
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
    onUpdated(updated);
  }

  const targetStatus: FarePriceStatus | null = farePrice
    ? farePrice.status === 'HOAT_DONG'
      ? 'TAM_NGUNG'
      : 'HOAT_DONG'
    : null;

  function openStatusDialog() {
    setStatusDialogOpen(true);
  }

  async function confirmStatusChange() {
    if (!canUpdate || !targetStatus || statusSubmittingRef.current) return;

    statusSubmittingRef.current = true;
    setStatusSubmitting(true);

    try {
      const updated = await updateFarePriceStatus(farePriceId, targetStatus);
      setRequest({ key: requestKey, status: 'success', farePrice: updated });
      setStatusDialogOpen(false);
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
        toast.error(
          'Không thể kích hoạt vì khoảng hiệu lực bị trùng với một bảng giá đang hoạt động của cùng tuyến và loại xe.',
        );
      } else if (
        requestError instanceof FarePriceApiError &&
        requestError.code === 'FARE_PRICE_CONCURRENT_MODIFICATION'
      ) {
        toast.error(
          'Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng tải lại và thử lại.',
        );
      } else {
        toast.error(
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
    <ResourceSheet
      busy={loading}
      title="Chi tiết bảng giá"
      description="Thông tin giá vé theo tuyến, loại xe và thời gian hiệu lực."
      onClose={onClose}
    >
      {loading && (
        <ResourceState loading>Đang tải thông tin bảng giá…</ResourceState>
      )}
      {error && (
        <ResourceState error>
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={() => setRetryCount((count) => count + 1)}
          >
            Thử lại
          </Button>
        </ResourceState>
      )}
      {farePrice && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b pb-6">
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-[var(--admin-radius-panel)] bg-accent text-primary"
            >
              <Ticket size={24} />
            </span>
            <div className="min-w-0">
              <h3 className="break-words text-base font-semibold">
                {farePrice.route.origin} → {farePrice.route.destination}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="admin-data-mono">{farePrice.route.code}</span>{' '}
                · {farePrice.vehicleType.name}
              </p>
            </div>
          </div>
          <div className="rounded-[var(--admin-radius-panel)] border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Giá niêm yết</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatPrice(farePrice.listedPrice)}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
            <div>
              <dt>Điểm đi</dt>
              <dd>{farePrice.route.origin}</dd>
            </div>
            <div>
              <dt>Điểm đến</dt>
              <dd>{farePrice.route.destination}</dd>
            </div>
            <div>
              <dt>Loại xe</dt>
              <dd>{farePrice.vehicleType.name}</dd>
            </div>
            <div>
              <dt>Đơn vị tiền</dt>
              <dd>{farePrice.currency}</dd>
            </div>
            <div>
              <dt>Hiệu lực từ</dt>
              <dd>{formatDateOnly(farePrice.validFrom)}</dd>
            </div>
            <div>
              <dt>Hiệu lực đến</dt>
              <dd>{formatDateOnly(farePrice.validTo)}</dd>
            </div>
            <div>
              <dt>Trạng thái cấu hình</dt>
              <dd>
                <ResourceStatusBadge
                  tone={farePrice.status === 'HOAT_DONG' ? 'active' : 'muted'}
                >
                  {statusLabel(farePrice.status)}
                </ResourceStatusBadge>
              </dd>
            </div>
            <div>
              <dt>Hiệu lực hiện tại</dt>
              <dd>
                <ResourceStatusBadge
                  tone={
                    farePrice.effectiveState === 'DANG_HIEU_LUC'
                      ? 'active'
                      : 'muted'
                  }
                >
                  {effectiveStateLabel(farePrice.effectiveState)}
                </ResourceStatusBadge>
              </dd>
            </div>
            <div>
              <dt>Ngày tạo</dt>
              <dd>{formatTimestamp(farePrice.createdAt)}</dd>
            </div>
            <div>
              <dt>Cập nhật lần cuối</dt>
              <dd>{formatTimestamp(farePrice.updatedAt)}</dd>
            </div>
          </dl>
          {canUpdate && (
            <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={openStatusDialog}>
                {farePrice.status === 'HOAT_DONG' ? 'Tạm ngưng' : 'Kích hoạt'}
              </Button>
              <Button onClick={() => setEditDialogOpen(true)}>
                <Pencil aria-hidden />
                Chỉnh sửa
              </Button>
            </div>
          )}
        </div>
      )}
      {editDialogOpen && canUpdate && farePrice && (
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
      {statusDialogOpen && canUpdate && targetStatus && (
        <ResourceConfirmation
          busy={statusSubmitting}
          onClose={() => {
            if (!statusSubmittingRef.current) setStatusDialogOpen(false);
          }}
          title={
            targetStatus === 'TAM_NGUNG'
              ? 'Tạm ngưng bảng giá?'
              : 'Kích hoạt bảng giá?'
          }
          description={
            targetStatus === 'TAM_NGUNG'
              ? 'Bảng giá này sẽ không còn được dùng để xác định giá áp dụng cho các vé mới. Lịch sử vé hiện có được giữ nguyên.'
              : 'Bảng giá sẽ được kích hoạt nếu khoảng hiệu lực không trùng với bảng giá đang hoạt động khác.'
          }
        >
          <Button
            disabled={statusSubmitting}
            aria-busy={statusSubmitting}
            onClick={confirmStatusChange}
          >
            {statusSubmitting && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {statusSubmitting
              ? 'Đang cập nhật…'
              : targetStatus === 'TAM_NGUNG'
                ? 'Tạm ngưng bảng giá'
                : 'Kích hoạt bảng giá'}
          </Button>
        </ResourceConfirmation>
      )}
    </ResourceSheet>
  );
}
