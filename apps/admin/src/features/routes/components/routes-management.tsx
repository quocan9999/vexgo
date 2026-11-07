'use client';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceCreateAction,
  ResourceRefreshAction,
  ResourceDetailAction,
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
import { Badge } from '@/components/ui/status-badge';
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
import type { Route, RouteSortKey, RouteStatus } from '../types/route';
import { RouteFormDialog } from './route-form-dialog';
import { RouteWorkspace, RouteDetails } from './route-workspace';

export { RouteWorkspace, RouteDetails };
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
                                  href={`/routes/${route.routeId}`}
                                  resourceName={`tuyến ${route.code}`}
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
                              href={`/routes/${route.routeId}`}
                              resourceName={`tuyến ${route.code}`}
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
