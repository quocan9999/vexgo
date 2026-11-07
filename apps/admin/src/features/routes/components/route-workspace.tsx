'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Compass,
  LoaderCircle,
  MapPinned,
  Pencil,
  Route as RouteIcon,
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
import { Badge } from '@/components/ui/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasAdminPermission } from '@/features/admin-auth/services/admin-access';
import { StopListEditor } from '@/features/stops/components/stop-list-editor';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  getRouteById,
  updateRouteStatus,
} from '../services/route-service';
import { getRouteStops } from '@/features/stops/services/stop-service';
import type { RouteStopItem } from '@/features/stops/types/stop';
import type { Route, RouteStatus } from '../types/route';
import { RouteFormDialog } from './route-form-dialog';

interface RouteWorkspaceProps {
  routeId: number;
  onClose?: () => void;
  onUpdated?: (route: Route) => void;
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; route: Route };

function timestampFormat(value: string) {
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

export function RouteWorkspace({
  routeId,
  onUpdated,
}: RouteWorkspaceProps) {
  const authState = useAdminSession();
  const session = authState.status === 'authenticated' ? authState.session : null;
  const canUpdate = hasAdminPermission(session, 'route:update');

  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [stopsEditorOpen, setStopsEditorOpen] = useState(false);
  const [routeStops, setRouteStops] = useState<RouteStopItem[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const statusSubmittingRef = useRef(false);

  const nextStatus: RouteStatus | null =
    detail.status === 'success'
      ? detail.route.status === 'HOAT_DONG'
        ? 'TAM_NGUNG'
        : 'HOAT_DONG'
      : null;

  async function confirmStatusChange() {
    if (!canUpdate || statusSubmittingRef.current || nextStatus === null) {
      return;
    }
    statusSubmittingRef.current = true;
    setStatusSubmitting(true);
    try {
      const saved = await updateRouteStatus(routeId, { status: nextStatus });
      setStatusOpen(false);
      setDetail({ status: 'success', route: saved });
      onUpdated?.(saved);
      toast.success(
        nextStatus === 'TAM_NGUNG'
          ? 'Đã tạm ngưng khai thác tuyến xe.'
          : 'Đã kích hoạt tuyến xe hoạt động trở lại.',
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof TypeError
          ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
          : error instanceof Error
            ? error.message
            : 'Không thể cập nhật trạng thái tuyến xe.',
      );
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    getRouteById(routeId, controller.signal)
      .then((route) => {
        if (!controller.signal.aborted) setDetail({ status: 'success', route });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDetail({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Không thể tải thông tin tuyến xe.',
          });
        }
      });

    void Promise.resolve().then(() => setLoadingStops(true));
    getRouteStops(routeId)
      .then((stops) => {
        if (!controller.signal.aborted) setRouteStops(stops);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStops(false);
      });

    return () => controller.abort();
  }, [routeId, retryCount]);

  function retry() {
    setDetail({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  const route = detail.status === 'success' ? detail.route : null;

  return (
    <SuperAdminLayout
      activeSection="routes"
      breadcrumbs={[
        { label: 'Quản lý tuyến xe', href: '/routes' },
        { label: route ? `${route.code} (${route.origin} - ${route.destination})` : 'Chi tiết tuyến xe' },
      ]}
    >
      <div className="admin-page-content space-y-6">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                nativeButton={false}
                render={<Link href="/routes" />}
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                Quay lại danh sách
              </Button>
              {canUpdate && route && nextStatus && (
                <Button variant="outline" onClick={() => setStatusOpen(true)}>
                  {route.status === 'HOAT_DONG'
                    ? 'Tạm ngưng tuyến'
                    : 'Kích hoạt tuyến'}
                </Button>
              )}
              {canUpdate && route && (
                <Button onClick={() => setEditOpen(true)}>
                  <Pencil aria-hidden="true" />
                  Chỉnh sửa
                </Button>
              )}
              <ResourceRefreshAction
                loading={detail.status === 'loading'}
                onClick={retry}
              />
            </div>
          }
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title={route ? `Chi tiết tuyến ${route.code}` : 'Chi tiết tuyến xe'}
          titleId="route-workspace-title"
        />

        {detail.status === 'loading' && (
          <ResourceState loading>Đang tải thông tin tuyến xe…</ResourceState>
        )}

        {detail.status === 'error' && (
          <ResourceState error>
            <p>{detail.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={retry} variant="outline">
                Thử lại
              </Button>
              <Button nativeButton={false} render={<Link href="/routes" />}>
                Về danh sách tuyến
              </Button>
            </div>
          </ResourceState>
        )}

        {detail.status === 'success' && route && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary"
                  >
                    <MapPinned size={28} />
                  </span>
                  <div>
                    <h2 className="admin-data-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {route.code}
                    </h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{route.origin}</span>
                      <span aria-hidden="true">→</span>
                      <span className="font-medium text-foreground">{route.destination}</span>
                    </p>
                  </div>
                </div>
                <ResourceStatusBadge
                  tone={route.status === 'HOAT_DONG' ? 'active' : 'muted'}
                >
                  {route.status === 'HOAT_DONG' ? 'Đang hoạt động' : 'Tạm ngưng'}
                </ResourceStatusBadge>
              </div>
            </Card>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Thông tin hành trình */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Compass className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Thông tin hành trình
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>Điểm khởi hành</dt>
                      <dd className="font-medium text-foreground">{route.origin}</dd>
                    </div>
                    <div>
                      <dt>Điểm kết thúc</dt>
                      <dd className="font-medium text-foreground">{route.destination}</dd>
                    </div>
                    <div>
                      <dt>Thời gian chạy dự kiến</dt>
                      <dd className="font-medium text-foreground">
                        {route.durationMinutes === null
                          ? 'Chưa thiết lập'
                          : `${route.durationMinutes} phút (${Math.floor(route.durationMinutes / 60)}h${route.durationMinutes % 60}p)`}
                      </dd>
                    </div>
                    <div>
                      <dt>Nhà xe vận hành</dt>
                      <dd className="flex items-center gap-1.5 font-medium">
                        <Building2 className="size-3.5 text-muted-foreground" />
                        {route.busCompany.name} (
                        <span className="admin-data-mono">{route.busCompany.code}</span>
                        )
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Lộ trình mẫu */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RouteIcon className="size-4 text-muted-foreground" />
                      <CardTitle className="text-base font-semibold">
                        Lộ trình mẫu
                      </CardTitle>
                    </div>
                    {canUpdate && (
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setStopsEditorOpen(true)}
                      >
                        Cấu hình ({routeStops.length})
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  <CardDescription className="text-xs">
                    Khuôn điểm đón, điểm trả và trạm dừng chân mặc định được tự động áp dụng khi khởi tạo chuyến xe mới.
                  </CardDescription>

                  {loadingStops ? (
                    <p className="text-xs text-muted-foreground">Đang tải điểm dừng…</p>
                  ) : routeStops.length === 0 ? (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      Chưa thiết lập khuôn lộ trình. Nhấn &quot;Cấu hình&quot; để thêm điểm đón/trả.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">
                        {routeStops.filter((s) => s.loaiDiem === 'DON').length} điểm đón
                      </Badge>
                      <Badge variant="outline">
                        {routeStops.filter((s) => s.loaiDiem === 'TRA').length} điểm trả
                      </Badge>
                      {routeStops.some((s) => s.loaiDiem === 'NGHI') && (
                        <Badge variant="warning">
                          {routeStops.filter((s) => s.loaiDiem === 'NGHI').length} trạm nghỉ
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card 3: Hồ sơ & Thời gian */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Hồ sơ & Thời gian
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Ngày tạo tuyến
                      </dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {timestampFormat(route.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Cập nhật lần cuối
                      </dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {timestampFormat(route.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Dialogs */}
        {editOpen && canUpdate && route && (
          <RouteFormDialog
            route={route}
            onClose={() => setEditOpen(false)}
            onSaved={(saved) => {
              setEditOpen(false);
              setDetail({ status: 'success', route: saved });
              onUpdated?.(saved);
              toast.success('Cập nhật tuyến xe thành công.');
            }}
          />
        )}

        {stopsEditorOpen && canUpdate && route && (
          <StopListEditor
            mode="route"
            targetId={routeId}
            title={`Khuôn lộ trình: ${route.code} (${route.origin} - ${route.destination})`}
            onClose={() => setStopsEditorOpen(false)}
            onSaved={() => {
              getRouteStops(routeId).then(setRouteStops).catch(() => {});
            }}
          />
        )}

        {statusOpen && canUpdate && route && nextStatus && (
          <ResourceConfirmation
            busy={statusSubmitting}
            onClose={() => setStatusOpen(false)}
            title={
              nextStatus === 'TAM_NGUNG'
                ? 'Tạm ngưng tuyến xe?'
                : 'Kích hoạt tuyến xe?'
            }
            description={
              nextStatus === 'TAM_NGUNG'
                ? 'Tuyến sẽ được chuyển sang trạng thái Tạm ngưng. Thao tác này không xóa dữ liệu tuyến và có thể kích hoạt lại sau.'
                : 'Tuyến sẽ được chuyển sang trạng thái Đang hoạt động.'
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
                : nextStatus === 'TAM_NGUNG'
                  ? 'Tạm ngưng tuyến'
                  : 'Kích hoạt tuyến'}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}

export { RouteWorkspace as RouteDetails };
