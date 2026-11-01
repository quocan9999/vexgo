'use client';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LoaderCircle,
  MapPinned,
  Pencil,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceConfirmation,
  ResourceCreateAction,
  ResourceRefreshAction,
  ResourceDetailAction,
  ResourceSheet,
  ResourceState,
  ResourceStatusBadge,
  ResourceTableSkeleton,
  ResourcePagination,
} from '@/components/admin/resource-ui';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/resource-filters';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useRoutes } from '../hooks/use-routes';
import { getRouteById, updateRouteStatus } from '../services/route-service';
import type { Route, RouteSortKey, RouteStatus } from '../types/route';
import { RouteFormDialog } from './route-form-dialog';
import { StopListEditor } from '@/features/stops/components/stop-list-editor';
import { getRouteStops } from '@/features/stops/services/stop-service';
import type { RouteStopItem } from '@/features/stops/types/stop';

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'HOAT_DONG', label: 'Đang hoạt động' },
  { value: 'TAM_NGUNG', label: 'Tạm ngưng' },
];
const SORT_OPTIONS: FilterOption[] = [
  { value: 'code', label: 'Mã tuyến' },
  { value: 'origin', label: 'Điểm đi' },
  { value: 'destination', label: 'Điểm đến' },
  { value: 'status', label: 'Trạng thái' },
  { value: 'createdAt', label: 'Ngày tạo' },
  { value: 'updatedAt', label: 'Cập nhật' },
];

function statusLabel(status: RouteStatus) {
  return status === 'HOAT_DONG' ? 'Đang hoạt động' : 'Tạm ngưng';
}

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

function RouteBadge({ status }: { status: RouteStatus }) {
  return (
    <ResourceStatusBadge tone={status === 'HOAT_DONG' ? 'active' : 'muted'}>
      {statusLabel(status)}
    </ResourceStatusBadge>
  );
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; route: Route };

export function RouteDetails({
  routeId,
  onClose,
  onUpdated,
}: {
  routeId: number;
  onClose: () => void;
  onUpdated: (route: Route) => void;
}) {
  const { can } = useAdminPermissions();
  const canUpdate = can('route:update');
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [stopsEditorOpen, setStopsEditorOpen] = useState(false);
  const [routeStops, setRouteStops] = useState<RouteStopItem[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const statusSubmittingRef = useRef(false);

  const nextStatus =
    detail.status === 'success'
      ? detail.route.status === 'HOAT_DONG'
        ? 'TAM_NGUNG'
        : 'HOAT_DONG'
      : null;

  async function confirmStatusChange() {
    if (!canUpdate || statusSubmittingRef.current || nextStatus === null)
      return;
    statusSubmittingRef.current = true;
    setStatusSubmitting(true);
    try {
      const saved = await updateRouteStatus(routeId, { status: nextStatus });
      setStatusOpen(false);
      setDetail({ status: 'success', route: saved });
      onUpdated(saved);
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
        if (!controller.signal.aborted)
          setDetail({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Không thể tải thông tin tuyến xe.',
          });
      });

    setLoadingStops(true);
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

  return (
    <ResourceSheet
      busy={detail.status === 'loading'}
      title="Thông tin tuyến xe"
      description="Thông tin hành trình, thời gian chạy và trạng thái tuyến."
      onClose={onClose}
    >
      {detail.status === 'loading' && (
        <ResourceState loading>Đang tải thông tin tuyến xe…</ResourceState>
      )}
      {detail.status === 'error' && (
        <ResourceState error>
          <p>{detail.message}</p>
          <Button
            variant="outline"
            onClick={() => {
              setDetail({ status: 'loading' });
              setRetryCount((count) => count + 1);
            }}
          >
            Thử lại
          </Button>
        </ResourceState>
      )}
      {detail.status === 'success' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b pb-6">
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-[var(--admin-radius-panel)] bg-accent text-primary"
            >
              <MapPinned size={24} />
            </span>
            <div className="min-w-0">
              <h3 className="admin-data-mono break-words text-base font-semibold">
                {detail.route.code}
              </h3>
              <p className="mt-1 break-words text-[13px] text-muted-foreground">
                {detail.route.origin} → {detail.route.destination}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
            <div>
              <dt>Điểm đi</dt>
              <dd>{detail.route.origin}</dd>
            </div>
            <div>
              <dt>Điểm đến</dt>
              <dd>{detail.route.destination}</dd>
            </div>
            <div>
              <dt>Thời gian chạy</dt>
              <dd>
                {detail.route.durationMinutes === null
                  ? 'Chưa thiết lập'
                  : `${detail.route.durationMinutes} phút`}
              </dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>
                <RouteBadge status={detail.route.status} />
              </dd>
            </div>
            <div className="col-span-2">
              <dt>Nhà xe</dt>
              <dd>
                {detail.route.busCompany.name} (
                <span className="admin-data-mono">
                  {detail.route.busCompany.code}
                </span>
                )
              </dd>
            </div>
            <div>
              <dt>Ngày tạo</dt>
              <dd>{timestampFormat(detail.route.createdAt)}</dd>
            </div>
            <div>
              <dt>Cập nhật lần cuối</dt>
              <dd>{timestampFormat(detail.route.updatedAt)}</dd>
            </div>
          </dl>

          {/* Section Lộ trình mẫu */}
          <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Lộ trình mẫu (Khuôn điểm dừng)</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Điểm đón, trả và trạm nghỉ được áp dụng cho chuyến xe mới
                </p>
              </div>
              {canUpdate && (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setStopsEditorOpen(true)}
                >
                  Cấu hình ({routeStops.length} điểm)
                </Button>
              )}
            </div>

            {loadingStops ? (
              <p className="text-xs text-muted-foreground">Đang tải điểm dừng…</p>
            ) : routeStops.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Chưa thiết lập khuôn lộ trình. Nhấn "Cấu hình" để thêm điểm đón/trả.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center px-2 py-1 rounded bg-blue-500/10 text-blue-600 font-medium">
                  {routeStops.filter((s) => s.loaiDiem === 'DON').length} điểm đón
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-green-500/10 text-green-600 font-medium">
                  {routeStops.filter((s) => s.loaiDiem === 'TRA').length} điểm trả
                </span>
                {routeStops.some((s) => s.loaiDiem === 'NGHI') && (
                  <span className="inline-flex items-center px-2 py-1 rounded bg-amber-500/10 text-amber-600 font-medium">
                    {routeStops.filter((s) => s.loaiDiem === 'NGHI').length} trạm nghỉ
                  </span>
                )}
              </div>
            )}
          </div>

          {canUpdate && (
            <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setStatusOpen(true)}>
                {detail.route.status === 'HOAT_DONG'
                  ? 'Tạm ngưng tuyến'
                  : 'Kích hoạt tuyến'}
              </Button>
              <Button onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden />
                Chỉnh sửa
              </Button>
            </div>
          )}
        </div>
      )}
      {editOpen && canUpdate && detail.status === 'success' && (
        <RouteFormDialog
          route={detail.route}
          onClose={() => setEditOpen(false)}
          onSaved={(saved) => {
            setEditOpen(false);
            setDetail({ status: 'success', route: saved });
            onUpdated(saved);
          }}
        />
      )}
      {stopsEditorOpen && canUpdate && detail.status === 'success' && (
        <StopListEditor
          mode="route"
          targetId={routeId}
          title={`Khuôn lộ trình: ${detail.route.code} (${detail.route.origin} - ${detail.route.destination})`}
          onClose={() => setStopsEditorOpen(false)}
          onSaved={() => {
            getRouteStops(routeId).then(setRouteStops).catch(() => {});
          }}
        />
      )}
      {statusOpen && canUpdate && detail.status === 'success' && nextStatus && (
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
    </ResourceSheet>
  );
}

export function RoutesManagement() {
  const { can } = useAdminPermissions();
  const authState = useAdminSession();
  const tenantBusCompanyId =
    authState.status === 'authenticated'
      ? authState.session.busCompanyId
      : null;
  const canCreate = can('route:create') && tenantBusCompanyId !== null;
  const {
    routePage,
    error,
    loading,
    searchInput,
    status,
    sortBy,
    sortDirection,
    changePage,
    updateSearch,
    updateStatus,
    sortRoutes,
    refresh,
  } = useRoutes();
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const items = routePage?.data ?? [];
  const hasFilters = Boolean(searchInput.trim() || status);
  function sortButton(label: string, field: RouteSortKey) {
    return (
      <Button
        aria-label={`Sắp xếp theo ${label}`}
        className="-ml-3"
        size="sm"
        variant="ghost"
        onClick={() => sortRoutes(field)}
      >
        {label}
        {sortBy === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp aria-hidden />
          ) : (
            <ArrowDown aria-hidden />
          )
        ) : (
          <ArrowUpDown aria-hidden />
        )}
      </Button>
    );
  }
  return (
    <SuperAdminLayout activeSection="routes">
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <AdminPageHeader
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title="Quản lý tuyến xe"
          titleId="routes-title"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && (
                <ResourceCreateAction
                  label="Thêm tuyến"
                  onClick={() => setCreateOpen(true)}
                />
              )}
              <ResourceRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
        />
        <section aria-busy={loading} aria-labelledby="routes-title">
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label="Tìm tuyến xe"
                value={searchInput}
                onChange={updateSearch}
                placeholder="Tìm mã tuyến, điểm đi, điểm đến…"
              />
              <SelectFilter
                label="Trạng thái tuyến"
                allLabel="Tất cả trạng thái"
                value={status}
                options={STATUS_OPTIONS}
                onChange={updateStatus}
              />
            </FilterToolbar>
            <div className="border-b p-4 md:hidden">
              <div className="flex items-end gap-3">
                <SelectFilter
                  label="Sắp xếp theo"
                  allLabel="Mã tuyến"
                  value={sortBy === 'code' ? '' : sortBy}
                  options={SORT_OPTIONS.filter(
                    (option) => option.value !== 'code',
                  )}
                  onChange={(value) => {
                    const field = (value || 'code') as RouteSortKey;
                    if (field !== sortBy) sortRoutes(field);
                  }}
                />
                <Button
                  variant="outline"
                  aria-label={`Đổi thứ tự sắp xếp, hiện tại ${sortDirection === 'asc' ? 'tăng dần' : 'giảm dần'}`}
                  onClick={() => sortRoutes(sortBy)}
                >
                  {sortDirection === 'asc' ? (
                    <ArrowUp aria-hidden />
                  ) : (
                    <ArrowDown aria-hidden />
                  )}
                  {sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần'}
                </Button>
              </div>
            </div>
            {loading && !routePage && (
              <ResourceTableSkeleton resourceLabel="tuyến xe" />
            )}
            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button variant="outline" onClick={refresh}>
                  Thử lại
                </Button>
              </ResourceState>
            )}
            {!error && !loading && routePage && items.length === 0 && (
              <ResourceState>
                <p>
                  {hasFilters
                    ? 'Không tìm thấy tuyến xe phù hợp.'
                    : 'Chưa có tuyến xe trong hệ thống.'}
                </p>
                {hasFilters && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      updateSearch('');
                      updateStatus('');
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </ResourceState>
            )}
            {!error && routePage && (
              <>
                {items.length > 0 && (
                  <>
                    <div className="hidden md:block">
                      <Table className="min-w-[1080px]">
                        <TableCaption className="sr-only">
                          Danh sách tuyến xe
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            {(
                              [
                                { key: 'code', label: 'Mã tuyến' },
                                { key: 'origin', label: 'Điểm đi' },
                                { key: 'destination', label: 'Điểm đến' },
                                { key: null, label: 'Nhà xe' },
                                { key: 'status', label: 'Trạng thái' },
                                { key: 'createdAt', label: 'Ngày tạo' },
                                { key: 'updatedAt', label: 'Cập nhật' },
                              ] as const
                            ).map((column) => (
                              <TableHead
                                key={column.label}
                                scope="col"
                                aria-sort={
                                  column.key
                                    ? sortBy === column.key
                                      ? sortDirection === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                    : undefined
                                }
                              >
                                {column.key
                                  ? sortButton(column.label, column.key)
                                  : column.label}
                              </TableHead>
                            ))}
                            <TableHead scope="col">
                              <span className="sr-only">Thao tác</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((route) => (
                            <TableRow key={route.routeId}>
                              <TableHead
                                scope="row"
                                className="admin-data-mono bg-transparent text-[13px]"
                              >
                                {route.code}
                              </TableHead>
                              <TableCell className="max-w-44 whitespace-normal break-words">
                                {route.origin}
                              </TableCell>
                              <TableCell className="max-w-44 whitespace-normal break-words">
                                {route.destination}
                              </TableCell>
                              <TableCell>
                                {route.busCompany.name}
                                <span className="admin-data-mono mt-1 block text-xs text-muted-foreground">
                                  {route.busCompany.code}
                                </span>
                              </TableCell>
                              <TableCell>
                                <RouteBadge status={route.status} />
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {timestampFormat(route.createdAt)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {timestampFormat(route.updatedAt)}
                              </TableCell>
                              <TableCell>
                                <ResourceDetailAction
                                  resourceName={`tuyến ${route.code}`}
                                  onClick={() =>
                                    setSelectedRouteId(route.routeId)
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="grid gap-4 p-4 md:hidden">
                      {items.map((route) => (
                        <Card key={route.routeId} className="gap-4 p-4 ring-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h2 className="admin-data-mono break-all text-[13px] font-semibold">
                              {route.code}
                            </h2>
                            <RouteBadge status={route.status} />
                          </div>
                          <p className="break-words text-sm font-semibold">
                            {route.origin} → {route.destination}
                          </p>
                          <dl className="grid grid-cols-2 gap-3 text-[13px] [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-muted-foreground">
                            <div>
                              <dt>Nhà xe</dt>
                              <dd>{route.busCompany.name}</dd>
                            </div>
                            <div>
                              <dt>Thời gian chạy</dt>
                              <dd>
                                {route.durationMinutes === null
                                  ? 'Chưa thiết lập'
                                  : `${route.durationMinutes} phút`}
                              </dd>
                            </div>
                            <div>
                              <dt>Ngày tạo</dt>
                              <dd>{timestampFormat(route.createdAt)}</dd>
                            </div>
                            <div>
                              <dt>Cập nhật</dt>
                              <dd>{timestampFormat(route.updatedAt)}</dd>
                            </div>
                          </dl>
                          <div className="flex justify-end border-t pt-3">
                            <ResourceDetailAction
                              resourceName={`tuyến ${route.code}`}
                              onClick={() => setSelectedRouteId(route.routeId)}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
                <ResourcePagination
                  currentPage={routePage.meta.page}
                  disabled={loading}
                  onPageChange={changePage}
                  pageSize={routePage.meta.pageSize}
                  summaryLabel="tuyến xe"
                  totalItems={routePage.meta.totalItems}
                  totalPages={routePage.meta.totalPages}
                />
              </>
            )}
          </Card>
        </section>
      </div>
      {selectedRouteId !== null && (
        <RouteDetails
          key={selectedRouteId}
          routeId={selectedRouteId}
          onClose={() => setSelectedRouteId(null)}
          onUpdated={(route) => {
            toast.success(`Đã cập nhật tuyến ${route.code}.`);
            refresh();
          }}
        />
      )}
      {createOpen && canCreate && tenantBusCompanyId !== null && (
        <RouteFormDialog
          tenantBusCompanyId={tenantBusCompanyId}
          onClose={() => setCreateOpen(false)}
          onSaved={(route) => {
            setCreateOpen(false);
            toast.success(`Đã thêm tuyến ${route.code}.`);
            refresh();
          }}
        />
      )}
    </SuperAdminLayout>
  );
}
