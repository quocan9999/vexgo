'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Compass,
  LoaderCircle,
  Pencil,
  Ticket,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceConfirmation,
  ResourceRefreshAction,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  FarePriceApiError,
  getFarePriceById,
  getFarePriceRouteOptions,
  getFarePriceVehicleTypeOptions,
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

export interface FarePriceWorkspaceProps {
  farePriceId: number;
  initialFarePrice?: FarePrice;
  routeOptions?: FarePriceOptionsState;
  vehicleTypeOptions?: FarePriceOptionsState;
  onRetryRouteOptions?: () => void;
  onRetryVehicleTypeOptions?: () => void;
  onClose?: () => void;
  onUpdated?: (farePrice: FarePrice) => void;
  onNotFound?: () => void;
}

export function FarePriceWorkspace({
  farePriceId,
  initialFarePrice,
  routeOptions: propRouteOptions,
  vehicleTypeOptions: propVehicleTypeOptions,
  onRetryRouteOptions,
  onRetryVehicleTypeOptions,
  onClose,
  onUpdated,
  onNotFound,
}: FarePriceWorkspaceProps) {
  const { can } = useAdminPermissions();
  const canUpdate = can('fare-price:update');

  const [request, setRequest] = useState<{
    key: string;
    status: 'loading' | 'success' | 'error';
    farePrice?: FarePrice;
  }>({
    key: '',
    status: initialFarePrice ? 'success' : 'loading',
    farePrice: initialFarePrice,
  });

  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const statusSubmittingRef = useRef(false);
  const onNotFoundRef = useRef(onNotFound);

  const [internalRouteOptions, setInternalRouteOptions] =
    useState<FarePriceOptionsState>({ status: 'loading' });
  const [internalVehicleTypeOptions, setInternalVehicleTypeOptions] =
    useState<FarePriceOptionsState>({ status: 'loading' });

  useEffect(() => {
    onNotFoundRef.current = onNotFound;
  }, [onNotFound]);

  useEffect(() => {
    if (!propRouteOptions) {
      getFarePriceRouteOptions()
        .then((options) => setInternalRouteOptions({ status: 'success', options }))
        .catch(() => setInternalRouteOptions({ status: 'error' }));
    }
    if (!propVehicleTypeOptions) {
      getFarePriceVehicleTypeOptions()
        .then((options) =>
          setInternalVehicleTypeOptions({ status: 'success', options }),
        )
        .catch(() => setInternalVehicleTypeOptions({ status: 'error' }));
    }
  }, [propRouteOptions, propVehicleTypeOptions]);

  const routeOptions = propRouteOptions ?? internalRouteOptions;
  const vehicleTypeOptions = propVehicleTypeOptions ?? internalVehicleTypeOptions;

  const requestKey = `${farePriceId}:${retryCount}`;
  const requestMatches = request.key === requestKey;
  const loading =
    !initialFarePrice && (!requestMatches || request.status === 'loading');
  const error =
    requestMatches && request.status === 'error'
      ? 'Không thể tải thông tin bảng giá.'
      : null;
  const farePrice =
    request.farePrice ??
    (requestMatches && request.status === 'success'
      ? (request.farePrice ?? null)
      : null);

  function handleFarePriceUpdated(updated: FarePrice) {
    setRequest({ key: requestKey, status: 'success', farePrice: updated });
    setEditDialogOpen(false);
    onUpdated?.(updated);
    toast.success('Đã cập nhật bảng giá vé.');
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
      onUpdated?.(updated);
      toast.success('Đã cập nhật bảng giá vé.');
    } catch (requestError: unknown) {
      if (
        requestError instanceof FarePriceApiError &&
        requestError.code === 'FARE_PRICE_NOT_FOUND'
      ) {
        toast.error('Bảng giá không còn tồn tại.');
        onNotFoundRef.current?.();
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
          toast.error('Bảng giá không còn tồn tại.');
          onNotFoundRef.current?.();
          setRequest({ key, status: 'error' });
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
    <SuperAdminLayout
      activeSection="fare-prices"
      breadcrumbs={[
        { label: 'Vận hành', href: '/fare-prices' },
        { label: 'Bảng giá vé', href: '/fare-prices' },
        {
          label: farePrice
            ? `${farePrice.route.code} (${farePrice.vehicleType.name})`
            : `Bảng giá #${farePriceId}`,
        },
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
                    href="/fare-prices"
                    onClick={onClose ? (e) => { e.preventDefault(); onClose(); } : undefined}
                  />
                }
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                Danh sách bảng giá
              </Button>

              {canUpdate && farePrice && (
                <>
                  <Button onClick={openStatusDialog} variant="outline">
                    {farePrice.status === 'HOAT_DONG' ? 'Tạm ngưng' : 'Kích hoạt'}
                  </Button>
                  <Button onClick={() => setEditDialogOpen(true)}>
                    <Pencil aria-hidden="true" />
                    Chỉnh sửa
                  </Button>
                </>
              )}

              <ResourceRefreshAction
                loading={loading}
                onClick={() => setRetryCount((c) => c + 1)}
              />
            </div>
          }
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title="Chi tiết bảng giá"
          titleId="fare-price-workspace-title"
        />

        {loading && (
          <ResourceState loading>Đang tải thông tin bảng giá…</ResourceState>
        )}

        {error && (
          <ResourceState error>
            <p>{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => setRetryCount((count) => count + 1)}
                variant="outline"
              >
                Thử lại
              </Button>
              <Button nativeButton={false} render={<Link href="/fare-prices" />}>
                Về danh sách bảng giá
              </Button>
            </div>
          </ResourceState>
        )}

        {farePrice && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary"
                  >
                    <Ticket size={28} />
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {farePrice.route.origin} → {farePrice.route.destination}
                    </h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="admin-data-mono font-semibold text-foreground">
                        {farePrice.route.code}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-foreground">
                        {farePrice.vehicleType.name}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ResourceStatusBadge
                    tone={farePrice.status === 'HOAT_DONG' ? 'active' : 'muted'}
                  >
                    {statusLabel(farePrice.status)}
                  </ResourceStatusBadge>
                  <ResourceStatusBadge
                    tone={
                      farePrice.effectiveState === 'DANG_HIEU_LUC'
                        ? 'active'
                        : 'muted'
                    }
                  >
                    {effectiveStateLabel(farePrice.effectiveState)}
                  </ResourceStatusBadge>
                </div>
              </div>
            </Card>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Giá niêm yết */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm border-primary/20 bg-primary/5">
                <CardHeader className="p-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Giá niêm yết chính thức
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-3xl font-bold tracking-tight text-primary tabular-nums">
                    {formatPrice(farePrice.listedPrice)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Đơn vị tiền tệ: <strong className="text-foreground">{farePrice.currency}</strong>
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Thông tin hành trình & Loại xe */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Compass className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Tuyến & Loại xe
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>Điểm đi</dt>
                      <dd>{farePrice.route.origin}</dd>
                    </div>
                    <div>
                      <dt>Điểm đến</dt>
                      <dd>{farePrice.route.destination}</dd>
                    </div>
                    <div>
                      <dt>Loại xe áp dụng</dt>
                      <dd>{farePrice.vehicleType.name}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 3: Thời gian hiệu lực */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Khoảng hiệu lực
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>Hiệu lực từ</dt>
                      <dd className="admin-data-mono">
                        {formatDateOnly(farePrice.validFrom)}
                      </dd>
                    </div>
                    <div>
                      <dt>Hiệu lực đến</dt>
                      <dd className="admin-data-mono">
                        {formatDateOnly(farePrice.validTo)}
                      </dd>
                    </div>
                    <div>
                      <dt>Tình trạng áp dụng</dt>
                      <dd>{effectiveStateLabel(farePrice.effectiveState)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>

            {/* Thông tin hệ thống */}
            <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  Thông tin hệ thống
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Trạng thái cấu hình</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {statusLabel(farePrice.status)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ngày tạo</dt>
                    <dd className="mt-1 font-medium text-foreground tabular-nums">
                      {formatTimestamp(farePrice.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Cập nhật lần cuối</dt>
                    <dd className="mt-1 font-medium text-foreground tabular-nums">
                      {formatTimestamp(farePrice.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dialogs */}
        {editDialogOpen && canUpdate && farePrice && (
          <FarePriceFormDialog
            farePrice={farePrice}
            onClose={() => setEditDialogOpen(false)}
            onNotFound={() => {
              setEditDialogOpen(false);
              toast.error('Bảng giá không còn tồn tại.');
              onNotFound?.();
            }}
            onRetryRouteOptions={onRetryRouteOptions ?? (() => {})}
            onRetryVehicleTypeOptions={onRetryVehicleTypeOptions ?? (() => {})}
            onSaved={handleFarePriceUpdated}
            routeOptions={routeOptions}
            vehicleTypeOptions={vehicleTypeOptions}
          />
        )}

        {statusDialogOpen && canUpdate && targetStatus && (
          <ResourceConfirmation
            busy={statusSubmitting}
            description={
              targetStatus === 'TAM_NGUNG'
                ? 'Bảng giá này sẽ không còn được dùng để xác định giá áp dụng cho các vé mới. Lịch sử vé hiện có được giữ nguyên.'
                : 'Bảng giá sẽ được kích hoạt nếu khoảng hiệu lực không trùng với bảng giá đang hoạt động khác.'
            }
            onClose={() => {
              if (!statusSubmittingRef.current) setStatusDialogOpen(false);
            }}
            title={
              targetStatus === 'TAM_NGUNG'
                ? 'Tạm ngưng bảng giá?'
                : 'Kích hoạt bảng giá?'
            }
          >
            <Button
              aria-busy={statusSubmitting}
              disabled={statusSubmitting}
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
      </div>
    </SuperAdminLayout>
  );
}

export { FarePriceWorkspace as FarePriceDetailSheet };
