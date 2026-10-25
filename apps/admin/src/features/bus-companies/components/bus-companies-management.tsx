'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  LoaderCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ResourceCreateAction,
  ResourceDetailAction,
  ResourcePagination,
  ResourceRefreshAction,
  ResourceSheet,
  ResourceState,
  ResourceStatusBadge,
  ResourceTableSkeleton,
} from '@/components/admin/resource-ui';
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
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DateRangeFilter } from '@/components/data-filters/data-filters';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/resource-filters';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasPlatformAdminPermission } from '@/features/admin-auth/services/admin-access';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useBusCompanies } from '../hooks/use-bus-companies';
import { CreateBusCompanyDialog } from './create-bus-company-dialog';
import { EditBusCompanyDialog } from './edit-bus-company-dialog';
import {
  getBusCompanyById,
  updateBusCompanyStatus,
} from '../services/bus-company-service';
import type {
  BusCompany,
  BusCompanySortKey,
  BusCompanyStatus,
} from '../types/bus-company';

const BUS_COMPANY_STATUS_FILTERS: FilterOption[] = [
  { value: 'HOAT_DONG', label: 'Đang hoạt động' },
  { value: 'TAM_NGUNG', label: 'Tạm ngưng' },
];

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function initials(value: string) {
  return value
    .replace(/^Nhà xe\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('vi');
}

function statusLabel(status: BusCompanyStatus) {
  switch (status) {
    case 'HOAT_DONG':
      return 'Đang hoạt động';
    case 'TAM_NGUNG':
      return 'Tạm ngưng';
  }
}

function CompanyMark({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-lg border bg-muted text-xs font-semibold text-foreground"
    >
      {initials(name)}
    </span>
  );
}

type CompanyDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; company: BusCompany };

function CompanyDetails({
  companyId,
  onClose,
  onUpdated,
  onStatusUpdated,
  canUpdate,
}: {
  companyId: number;
  onClose: () => void;
  onUpdated: (company: BusCompany) => void;
  onStatusUpdated: (company: BusCompany) => void;
  canUpdate: boolean;
}) {
  const statusSubmittingRef = useRef(false);
  const [detailState, setDetailState] = useState<CompanyDetailState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getBusCompanyById(companyId, controller.signal)
      .then((company) => {
        if (!controller.signal.aborted) {
          setDetailState({ status: 'success', company });
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setDetailState({
            status: 'error',
            message:
              requestError instanceof Error
                ? requestError.message
                : 'Không thể tải thông tin nhà xe.',
          });
        }
      });

    return () => controller.abort();
  }, [companyId, retryCount]);

  function retry() {
    setDetailState({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  function handleCompanyUpdated(company: BusCompany) {
    setDetailState({ status: 'success', company });
    setEditDialogOpen(false);
    onUpdated(company);
  }

  async function confirmStatusChange() {
    if (
      !canUpdate ||
      detailState.status !== 'success' ||
      statusSubmittingRef.current
    ) {
      return;
    }

    const targetStatus: BusCompanyStatus =
      detailState.company.status === 'HOAT_DONG' ? 'TAM_NGUNG' : 'HOAT_DONG';
    statusSubmittingRef.current = true;
    setStatusSubmitting(true);
    setStatusError(null);

    try {
      const updatedCompany = await updateBusCompanyStatus(
        companyId,
        targetStatus,
      );
      setDetailState({ status: 'success', company: updatedCompany });
      setStatusDialogOpen(false);
      onStatusUpdated(updatedCompany);
    } catch (requestError: unknown) {
      setStatusError(
        requestError instanceof TypeError
          ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
          : requestError instanceof Error
            ? requestError.message
            : 'Không thể cập nhật trạng thái nhà xe.',
      );
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  const nextStatus: BusCompanyStatus | null =
    detailState.status === 'success'
      ? detailState.company.status === 'HOAT_DONG'
        ? 'TAM_NGUNG'
        : 'HOAT_DONG'
      : null;

  return (
    <>
      <ResourceSheet
        title="Thông tin nhà xe"
        description="Thông tin liên hệ, hồ sơ và trạng thái hoạt động."
        onClose={onClose}
      >
        <div className="space-y-4">
          {detailState.status === 'loading' && (
            <ResourceState loading>Đang tải thông tin nhà xe…</ResourceState>
          )}

          {detailState.status === 'error' && (
            <ResourceState error>
              <p>{detailState.message}</p>
              <Button onClick={retry} type="button" variant="outline">
                Thử lại
              </Button>
            </ResourceState>
          )}

          {detailState.status === 'success' && (
            <>
              <Card className="gap-3 p-4 ring-0">
                <div className="flex items-start gap-3">
                  <CompanyMark name={detailState.company.name} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="break-words text-base font-semibold">
                      {detailState.company.name}
                    </h3>
                    <p className="admin-data-mono text-xs text-muted-foreground">
                      {detailState.company.code}
                    </p>
                  </div>
                  <ResourceStatusBadge
                    tone={
                      detailState.company.status === 'HOAT_DONG'
                        ? 'active'
                        : 'muted'
                    }
                  >
                    {statusLabel(detailState.company.status)}
                  </ResourceStatusBadge>
                </div>
              </Card>

              <Card className="gap-3 p-4 ring-0">
                <h3 className="text-sm font-semibold">Thông tin liên hệ</h3>
                <div className="flex items-start gap-3">
                  <Building2
                    aria-hidden
                    className="mt-0.5 size-4 text-muted-foreground"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground">Đầu mối liên hệ</p>
                    <p className="break-words text-sm">
                      {detailState.company.contactInfo || 'Chưa cập nhật'}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="gap-3 p-4 ring-0">
                <h3 className="text-sm font-semibold">Thông tin hồ sơ</h3>
                <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-xs text-muted-foreground">Ngày tạo</dt>
                    <dd>{timestampFormat(detailState.company.createdAt)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs text-muted-foreground">
                      Cập nhật lần cuối
                    </dt>
                    <dd>{timestampFormat(detailState.company.updatedAt)}</dd>
                  </div>
                </dl>
              </Card>
              {canUpdate && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button
                    onClick={() => {
                      setStatusError(null);
                      setStatusDialogOpen(true);
                    }}
                    type="button"
                    variant="outline"
                  >
                    {detailState.company.status === 'HOAT_DONG'
                      ? 'Tạm ngưng nhà xe'
                      : 'Kích hoạt lại'}
                  </Button>
                  <Button
                    onClick={() => setEditDialogOpen(true)}
                    type="button"
                  >
                    Chỉnh sửa
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ResourceSheet>
      {canUpdate && editDialogOpen && detailState.status === 'success' && (
        <EditBusCompanyDialog
          company={detailState.company}
          onClose={() => setEditDialogOpen(false)}
          onUpdated={handleCompanyUpdated}
        />
      )}
      {canUpdate &&
        statusDialogOpen &&
        detailState.status === 'success' &&
        nextStatus && (
          <AlertDialog
            open
            onOpenChange={(open, event) => {
              if (!open && statusSubmitting) event.cancel();
              else if (!open) setStatusDialogOpen(false);
            }}
          >
            <AlertDialogContent aria-busy={statusSubmitting}>
              <AlertDialogTitle>
                {nextStatus === 'TAM_NGUNG'
                  ? 'Tạm ngưng nhà xe này?'
                  : 'Kích hoạt lại nhà xe này?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {nextStatus === 'TAM_NGUNG'
                  ? 'Nhà xe sẽ được chuyển sang trạng thái Tạm ngưng. Thao tác này không xóa dữ liệu và có thể kích hoạt lại sau.'
                  : 'Nhà xe sẽ được chuyển sang trạng thái Đang hoạt động.'}
              </AlertDialogDescription>
              {statusError && (
                <p className="text-sm text-destructive" role="alert">
                  {statusError}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={statusSubmitting}>
                  Hủy
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={statusSubmitting}
                  onClick={confirmStatusChange}
                >
                  {statusSubmitting && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 motion-safe:animate-spin"
                    />
                  )}
                  {statusSubmitting
                    ? 'Đang cập nhật…'
                    : nextStatus === 'TAM_NGUNG'
                      ? 'Tạm ngưng nhà xe'
                      : 'Kích hoạt lại'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
    </>
  );
}

export function BusCompaniesManagement() {
  const authState = useAdminSession();
  const session = authState.status === 'authenticated' ? authState.session : null;
  const canCreateCompany = hasPlatformAdminPermission(
    session,
    'bus-company:create',
  );
  const canUpdateCompanies = hasPlatformAdminPermission(
    session,
    'bus-company:update',
  );
  const {
    companyPage,
    error,
    loading,
    searchInput,
    status,
    createdDateRange,
    sortBy,
    sortDirection,
    changePage,
    refresh,
    sortCompanies,
    updateSearch,
    updateFilters,
    updateCreatedDateRange,
  } = useBusCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null,
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  function openCreateDialog() {
    if (!canCreateCompany) return;
    setCreateDialogOpen(true);
  }

  function handleCompanyCreated(company: BusCompany) {
    setCreateDialogOpen(false);
    toast.success(`Đã thêm nhà xe ${company.name}.`);
    refresh();
  }

  function handleCompanyUpdated(company: BusCompany) {
    toast.success(`Đã cập nhật nhà xe ${company.name}.`);
    refresh();
  }

  function handleCompanyStatusUpdated(company: BusCompany) {
    toast.success(
      `Đã chuyển nhà xe ${company.name} sang trạng thái ${statusLabel(company.status)}.`,
    );
    refresh();
  }

  function sortButton(label: string, column: BusCompanySortKey) {
    const selected = sortBy === column;
    return (
      <Button
        aria-label={`${label}, ${
          selected
            ? sortDirection === 'asc'
              ? 'tăng dần'
              : 'giảm dần'
            : 'chưa sắp xếp'
        }`}
        className="-ml-3 h-8 px-2"
        onClick={() => sortCompanies(column)}
        size="sm"
        variant="ghost"
      >
        {label}
        {selected ? (
          sortDirection === 'asc' ? (
            <ArrowUp aria-hidden className="size-4" />
          ) : (
            <ArrowDown aria-hidden className="size-4" />
          )
        ) : (
          <ArrowUpDown aria-hidden className="size-4" />
        )}
      </Button>
    );
  }

  function openCompanyDetails(company: BusCompany) {
    setSelectedCompanyId(company.busCompanyId);
  }

  const hasFilters = Boolean(
    searchInput.trim() ||
      status ||
      createdDateRange?.from ||
      createdDateRange?.to,
  );

  return (
    <SuperAdminLayout activeSection="bus-companies">
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canCreateCompany && (
                <ResourceCreateAction
                  label="Thêm nhà xe"
                  onClick={openCreateDialog}
                />
              )}
              <ResourceRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
          eyebrow="ĐỐI TÁC NỀN TẢNG"
          title="Quản lý nhà xe"
          titleId="page-title"
        />
        <section aria-label="Danh sách nhà xe" aria-busy={loading}>
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label="Tìm nhà xe"
                onChange={updateSearch}
                placeholder="Tìm theo mã, tên hoặc thông tin liên hệ"
                value={searchInput}
              />
              <SelectFilter
                allLabel="Tất cả trạng thái"
                label="Lọc theo trạng thái"
                onChange={updateFilters}
                options={BUS_COMPANY_STATUS_FILTERS}
                value={status}
              />
              <DateRangeFilter
                appearance="resource"
                emptyValueLabel="Tất cả ngày"
                label="Ngày tạo"
                onApply={updateCreatedDateRange}
                value={createdDateRange}
              />
            </FilterToolbar>

            {!error && companyPage && companyPage.data.length > 0 && (
              <div className="flex items-end gap-3 border-b p-4 md:hidden">
                <SelectFilter
                  allLabel="Tên nhà xe"
                  label="Sắp xếp theo"
                  onChange={(value) => {
                    const field = (value || 'name') as BusCompanySortKey;
                    if (field !== sortBy) sortCompanies(field);
                  }}
                  options={[
                    { value: 'code', label: 'Mã nhà xe' },
                    { value: 'status', label: 'Trạng thái' },
                    { value: 'createdAt', label: 'Ngày tạo' },
                  ]}
                  value={sortBy === 'name' ? '' : sortBy}
                />
                <Button
                  aria-label={`Đổi thứ tự sắp xếp, hiện tại ${sortDirection === 'asc' ? 'tăng dần' : 'giảm dần'}`}
                  onClick={() => sortCompanies(sortBy)}
                  variant="outline"
                >
                  {sortDirection === 'asc' ? (
                    <ArrowUp aria-hidden className="size-4" />
                  ) : (
                    <ArrowDown aria-hidden className="size-4" />
                  )}
                  {sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần'}
                </Button>
              </div>
            )}

            {loading && !companyPage && (
              <ResourceTableSkeleton resourceLabel="nhà xe" />
            )}
            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={refresh} variant="outline">
                  Thử lại
                </Button>
              </ResourceState>
            )}
            {!error &&
              companyPage &&
              companyPage.data.length === 0 &&
              !loading && (
                <ResourceState>
                  <p>
                    {hasFilters
                      ? 'Không tìm thấy nhà xe phù hợp.'
                      : 'Chưa có nhà xe trong hệ thống.'}
                  </p>
                  {hasFilters && (
                    <Button
                      onClick={() => {
                        updateSearch('');
                        updateFilters('');
                        updateCreatedDateRange(null);
                      }}
                      variant="outline"
                    >
                      Xóa bộ lọc
                    </Button>
                  )}
                </ResourceState>
              )}

            {!error && companyPage && companyPage.data.length > 0 && (
              <>
                <div className="hidden md:block" aria-busy={loading}>
                  <Table className="min-w-[920px]">
                    <TableCaption className="sr-only">
                      Danh sách nhà xe
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        {(
                          [
                            { key: 'name', label: 'Nhà xe' },
                            { key: 'code', label: 'Mã nhà xe' },
                            { key: null, label: 'Thông tin liên hệ' },
                            { key: 'status', label: 'Trạng thái' },
                            { key: 'createdAt', label: 'Ngày tạo' },
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
                      {companyPage.data.map((company) => (
                        <TableRow key={company.busCompanyId}>
                          <TableHead
                            scope="row"
                            className="max-w-64 whitespace-normal break-words bg-transparent text-[13px]"
                          >
                            <span className="flex items-center gap-3">
                              <CompanyMark name={company.name} />
                              <span className="font-semibold">
                                {company.name}
                              </span>
                            </span>
                          </TableHead>
                          <TableCell className="admin-data-mono">
                            {company.code}
                          </TableCell>
                          <TableCell className="max-w-64 whitespace-normal break-words text-muted-foreground">
                            {company.contactInfo || 'Chưa cập nhật'}
                          </TableCell>
                          <TableCell>
                            <ResourceStatusBadge
                              tone={
                                company.status === 'HOAT_DONG'
                                  ? 'active'
                                  : 'muted'
                              }
                            >
                              {statusLabel(company.status)}
                            </ResourceStatusBadge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {timestampFormat(company.createdAt)}
                          </TableCell>
                          <TableCell>
                            <ResourceDetailAction
                              onClick={() => openCompanyDetails(company)}
                              resourceName={company.name}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-3 p-4 md:hidden">
                  {companyPage.data.map((company) => (
                    <Card
                      className="gap-4 p-4 ring-0"
                      key={company.busCompanyId}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <CompanyMark name={company.name} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <h2 className="break-words text-sm font-semibold">
                            {company.name}
                          </h2>
                          <p className="admin-data-mono text-xs text-muted-foreground">
                            {company.code}
                          </p>
                        </div>
                        <ResourceStatusBadge
                          tone={
                            company.status === 'HOAT_DONG'
                              ? 'active'
                              : 'muted'
                          }
                        >
                          {statusLabel(company.status)}
                        </ResourceStatusBadge>
                      </div>
                      <p className="break-words text-[13px] text-muted-foreground">
                        {company.contactInfo || 'Chưa cập nhật liên hệ'}
                      </p>
                      <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-[13px]">
                        <div className="space-y-1">
                          <dt className="text-xs text-muted-foreground">
                            Ngày tạo
                          </dt>
                          <dd>{timestampFormat(company.createdAt)}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs text-muted-foreground">
                            Cập nhật
                          </dt>
                          <dd>{timestampFormat(company.updatedAt)}</dd>
                        </div>
                      </dl>
                      <div className="flex justify-end border-t pt-3">
                        <ResourceDetailAction
                          onClick={() => openCompanyDetails(company)}
                          resourceName={company.name}
                        />
                      </div>
                    </Card>
                  ))}
                </div>

                <ResourcePagination
                  currentPage={companyPage.meta.page}
                  disabled={loading}
                  onPageChange={changePage}
                  pageSize={companyPage.meta.pageSize}
                  summaryLabel="nhà xe"
                  totalItems={companyPage.meta.totalItems}
                  totalPages={companyPage.meta.totalPages}
                />
              </>
            )}
          </Card>
        </section>
      </div>
      {selectedCompanyId !== null && (
        <CompanyDetails
          key={selectedCompanyId}
          companyId={selectedCompanyId}
          canUpdate={canUpdateCompanies}
          onClose={() => setSelectedCompanyId(null)}
          onStatusUpdated={handleCompanyStatusUpdated}
          onUpdated={handleCompanyUpdated}
        />
      )}
      {canCreateCompany && createDialogOpen && (
        <CreateBusCompanyDialog
          onClose={() => setCreateDialogOpen(false)}
          onCreated={handleCompanyCreated}
        />
      )}
    </SuperAdminLayout>
  );
}
