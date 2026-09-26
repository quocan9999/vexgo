'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminDetailAction } from '@/components/admin/admin-detail-action';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminRefreshAction } from '@/components/admin/admin-page-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import { FilterToolbar, SearchInput, SelectFilter, type FilterOption } from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getBusCompanyFilterOptions } from '@/features/vehicles/services/vehicle-service';
import { useRoutes } from '../hooks/use-routes';
import { getRouteById } from '../services/route-service';
import type { Route, RouteSortKey, RouteStatus } from '../types/route';
import '../routes.css';

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
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function RouteBadge({ status }: { status: RouteStatus }) {
  return <AdminStatusBadge tone={status === 'HOAT_DONG' ? 'active' : 'muted'}>{statusLabel(status)}</AdminStatusBadge>;
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; route: Route };

function RouteDetails({ routeId, onClose }: { routeId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getRouteById(routeId, controller.signal)
      .then((route) => { if (!controller.signal.aborted) setDetail({ status: 'success', route }); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setDetail({
          status: 'error',
          message: error instanceof Error ? error.message : 'Không thể tải thông tin tuyến xe.',
        });
      });
    return () => controller.abort();
  }, [routeId, retryCount]);

  return (
    <AdminDetailSheet ariaLabelledBy="route-detail-title" onClose={onClose}>
      <>
        <div className="admin-dialog-header">
          <div className="admin-dialog-header__copy">
            <p className="eyebrow">HỒ SƠ TUYẾN XE</p>
            <h2 id="route-detail-title">Thông tin tuyến xe</h2>
          </div>
          <form method="dialog">
            <button aria-label="Đóng thông tin tuyến xe" className="icon-button" type="submit"><X aria-hidden="true" size={19} /></button>
          </form>
        </div>
        {detail.status === 'loading' && <p className="routes-detail-state" role="status">Đang tải thông tin tuyến xe…</p>}
        {detail.status === 'error' && (
          <div className="routes-detail-state" role="alert">
            <p>{detail.message}</p>
            <Button onClick={() => { setDetail({ status: 'loading' }); setRetryCount((count) => count + 1); }} type="button" variant="secondary">Thử lại</Button>
          </div>
        )}
        {detail.status === 'success' && (
          <div className="routes-detail-content">
            <h3>{detail.route.code}</h3>
            <p>{detail.route.origin} → {detail.route.destination}</p>
            <dl className="routes-detail-fields">
              <div><dt>Mã tuyến</dt><dd>{detail.route.code}</dd></div>
              <div><dt>Điểm đi</dt><dd>{detail.route.origin}</dd></div>
              <div><dt>Điểm đến</dt><dd>{detail.route.destination}</dd></div>
              <div><dt>Nhà xe</dt><dd>{detail.route.busCompany.name} ({detail.route.busCompany.code})</dd></div>
              <div><dt>Trạng thái</dt><dd><RouteBadge status={detail.route.status} /></dd></div>
              <div><dt>Ngày tạo</dt><dd>{timestampFormat(detail.route.createdAt)}</dd></div>
              <div><dt>Cập nhật lần cuối</dt><dd>{timestampFormat(detail.route.updatedAt)}</dd></div>
            </dl>
          </div>
        )}
      </>
    </AdminDetailSheet>
  );
}

type CompanyOptions =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; options: FilterOption[] };

export function RoutesManagement() {
  const {
    routePage, error, loading, searchInput, status, busCompanyId, sortBy, sortDirection,
    changePage, updateSearch, updateStatus, updateBusCompany, sortRoutes, refresh,
  } = useRoutes();
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [companyOptions, setCompanyOptions] = useState<CompanyOptions>({ status: 'loading' });
  const [optionsRetry, setOptionsRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getBusCompanyFilterOptions(controller.signal)
      .then((options) => {
        if (!controller.signal.aborted) setCompanyOptions({
          status: 'success',
          options: options.map((option) => ({ value: String(option.id), label: option.label })),
        });
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setCompanyOptions({
          status: 'error',
          message: requestError instanceof Error ? requestError.message : 'Không thể tải bộ lọc nhà xe.',
        });
      });
    return () => controller.abort();
  }, [optionsRetry]);

  function sortButton(label: string, field: RouteSortKey) {
    const selected = sortBy === field;
    return (
      <button aria-label={`Sắp xếp theo ${label}`} className="admin-resource-sort-button" onClick={() => sortRoutes(field)} type="button">
        {label}
        {selected ? sortDirection === 'asc' ? <ArrowUp aria-hidden="true" size={14} /> : <ArrowDown aria-hidden="true" size={14} /> : <ArrowUpDown aria-hidden="true" size={14} />}
      </button>
    );
  }

  const hasFilters = Boolean(searchInput.trim() || status || busCompanyId);
  const items = routePage?.data ?? [];
  return (
    <SuperAdminLayout activeSection="routes">
      <div className="admin-page-content">
        <AdminPageHeader
          actions={<div className="page-intro-actions"><AdminRefreshAction loading={loading} onClick={refresh} /></div>}
          eyebrow="QUẢN LÝ VẬN HÀNH" title="Quản lý tuyến xe" titleId="routes-title"
        />
        <section aria-busy={loading} aria-labelledby="routes-title" className="routes-section">
          <div className="panel admin-resource-panel">
            <FilterToolbar totalItems={error ? null : routePage?.meta.totalItems ?? null}>
              <SearchInput label="Tìm tuyến xe" onChange={updateSearch} placeholder="Tìm mã tuyến, điểm đi, điểm đến, nhà xe..." value={searchInput} />
              {companyOptions.status === 'success' && (
                <SelectFilter allLabel="Tất cả nhà xe" label="Lọc theo nhà xe" onChange={updateBusCompany} options={companyOptions.options} value={busCompanyId} />
              )}
              <SelectFilter allLabel="Tất cả trạng thái" label="Lọc theo trạng thái" onChange={updateStatus} options={STATUS_OPTIONS} value={status} />
            </FilterToolbar>
            {companyOptions.status === 'loading' && <p className="routes-option-state" role="status">Đang tải bộ lọc nhà xe…</p>}
            {companyOptions.status === 'error' && (
              <div className="routes-option-state" role="alert">
                <span>{companyOptions.message}</span>
                <Button onClick={() => { setCompanyOptions({ status: 'loading' }); setOptionsRetry((count) => count + 1); }} type="button" variant="secondary">Thử tải lại bộ lọc</Button>
              </div>
            )}
            <div className="routes-mobile-sort">
              <SelectFilter allLabel="Mã tuyến (mặc định)" label="Sắp xếp tuyến theo" onChange={(value) => sortRoutes((value || 'code') as RouteSortKey)} options={SORT_OPTIONS} value={sortBy === 'code' ? '' : sortBy} />
              <Button aria-label={`Đổi thứ tự sắp xếp, hiện tại ${sortDirection === 'asc' ? 'tăng dần' : 'giảm dần'}`} onClick={() => sortRoutes(sortBy)} type="button" variant="secondary">
                {sortDirection === 'asc' ? <ArrowUp aria-hidden="true" size={15} /> : <ArrowDown aria-hidden="true" size={15} />}
                {sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần'}
              </Button>
            </div>
            {loading && !routePage && <AdminTableSkeleton resourceLabel="tuyến xe" />}
            {error && (
              <div className="routes-list-state" role="alert"><p>{error}</p><Button onClick={refresh} type="button" variant="secondary">Thử lại</Button></div>
            )}
            {!error && !loading && routePage && items.length === 0 && (
              <div className="routes-list-state" role="status"><Search aria-hidden="true" size={21} /><p>{hasFilters ? 'Không tìm thấy tuyến xe phù hợp.' : 'Chưa có tuyến xe trong hệ thống.'}</p></div>
            )}
            {!error && routePage && (
              <>
                {items.length > 0 && (
                  <>
                    <div aria-busy={loading} className="admin-resource-table-wrap">
                      <table className="admin-resource-table">
                        <caption className="sr-only">Danh sách tuyến xe</caption>
                        <thead><tr>
                          {([['Mã tuyến', 'code'], ['Điểm đi', 'origin'], ['Điểm đến', 'destination']] as const).map(([label, field]) => (
                            <th aria-sort={sortBy === field ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'} key={field} scope="col">{sortButton(label, field)}</th>
                          ))}
                          <th scope="col">Nhà xe</th>
                          <th aria-sort={sortBy === 'status' ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'} scope="col">{sortButton('Trạng thái', 'status')}</th>
                          <th aria-sort={sortBy === 'createdAt' ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'} scope="col">{sortButton('Ngày tạo', 'createdAt')}</th>
                          <th scope="col">Thao tác</th>
                        </tr></thead>
                        <tbody>{items.map((route) => (
                          <tr key={route.routeId}>
                            <th scope="row">{route.code}</th>
                            <td>{route.origin}</td><td>{route.destination}</td>
                            <td>{route.busCompany.name}<span className="routes-company-code">{route.busCompany.code}</span></td>
                            <td><RouteBadge status={route.status} /></td>
                            <td>{timestampFormat(route.createdAt)}</td>
                            <td><AdminDetailAction onClick={() => setSelectedRouteId(route.routeId)} resourceName={`tuyến ${route.code}`} /></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <div className="routes-mobile-list">
                      {items.map((route) => (
                        <article className="routes-mobile-card" key={route.routeId}>
                          <div className="routes-mobile-card-header"><h2>{route.code}</h2><RouteBadge status={route.status} /></div>
                          <p className="routes-mobile-journey">{route.origin} → {route.destination}</p>
                          <dl className="routes-mobile-fields">
                            <div><dt>Nhà xe</dt><dd>{route.busCompany.name}</dd></div>
                            <div><dt>Ngày tạo</dt><dd>{timestampFormat(route.createdAt)}</dd></div>
                          </dl>
                          <div className="routes-mobile-actions"><AdminDetailAction onClick={() => setSelectedRouteId(route.routeId)} resourceName={`tuyến ${route.code}`} /></div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
                <AdminPagination currentPage={routePage.meta.page} disabled={loading} onPageChange={changePage} pageSize={routePage.meta.pageSize} summaryLabel="tuyến xe" totalItems={routePage.meta.totalItems} totalPages={routePage.meta.totalPages} />
              </>
            )}
          </div>
        </section>
        <footer className="admin-page-footer"><span>© 2026 VexGo Platform</span></footer>
      </div>
      {selectedRouteId !== null && <RouteDetails key={selectedRouteId} routeId={selectedRouteId} onClose={() => setSelectedRouteId(null)} />}
    </SuperAdminLayout>
  );
}
