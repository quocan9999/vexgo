'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  LoaderCircle,
  Pencil,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ResourceConfirmation,
  ResourceCreateAction,
  ResourceDetailAction,
  ResourceNotice,
  ResourcePagination,
  ResourceRefreshAction,
  ResourceSheet,
  ResourceState,
  ResourceStatusBadge,
  ResourceTableSkeleton,
} from '@/components/admin/resource-ui';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/resource-filters';
import { ResourceSortControls } from '@/components/data-filters/resource-sort';
import { DateRangeFilter } from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasPlatformAdminPermission } from '@/features/admin-auth/services/admin-access';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getBusCompanyFilterOptions } from '@/features/bus-companies/services/bus-company-service';
import { getDefaultRolePermissions } from '@/features/platform-rbac/services/platform-rbac-service';
import {
  TENANT_RBAC_ROLE_NAMES,
  type TenantRbacRoleName,
} from '@/features/tenant-rbac/types/tenant-rbac';
import { useAdminAccounts } from '../hooks/use-admin-accounts';
import {
  getAdminAccountById,
  updateAdminAccountStatus,
} from '../services/admin-account-service';
import type {
  AdminAccount,
  AdminAccountSortKey,
  AdminAccountStatus,
} from '../types/admin-account';
import { AdminAccountFormDialog } from './admin-account-form-dialog';
import { AdminAccountRolesDialog } from './admin-account-roles-dialog';

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'HOAT_DONG', label: 'Đang hoạt động' },
  { value: 'TAM_KHOA', label: 'Đang khóa' },
];

const SORT_OPTIONS: FilterOption[] = [
  { value: 'createdAt', label: 'Ngày tạo' },
  { value: 'fullName', label: 'Họ và tên' },
  { value: 'phoneNumber', label: 'Số điện thoại' },
  { value: 'status', label: 'Trạng thái' },
  { value: 'updatedAt', label: 'Cập nhật' },
];

type FilterOptionsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; companies: FilterOption[]; roles: FilterOption[] };

const ROLE_LABELS: Record<string, string> = {
  NHA_XE_ADMIN: 'Quản trị nhà xe',
  NHAN_VIEN_DIEU_HANH: 'Nhân viên điều hành',
  NHAN_VIEN_BAN_VE: 'Nhân viên bán vé',
  NHAN_VIEN_CSKH: 'Nhân viên CSKH',
  NHAN_VIEN_PHU_XE: 'Nhân viên phụ xe',
  NHAN_VIEN_KINH_DOANH: 'Nhân viên kinh doanh',
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role.replaceAll('_', ' ');
}

function statusLabel(status: AdminAccountStatus) {
  return status === 'HOAT_DONG' ? 'Đang hoạt động' : 'Đang khóa';
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Chưa có thông tin';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(timestamp)
    .replaceAll('/', '-');
}

function formatDate(value: string | null) {
  if (!value) return 'Chưa cập nhật';
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : 'Chưa cập nhật';
}

function RoleBadges({ roles }: { roles: readonly string[] }) {
  if (roles.length === 0) {
    return <span className="text-muted-foreground">Chưa được gán vai trò</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <ResourceStatusBadge key={role} tone="muted">
          {roleLabel(role)}
        </ResourceStatusBadge>
      ))}
    </div>
  );
}

function AccountStatusBadge({ status }: { status: AdminAccountStatus }) {
  return (
    <ResourceStatusBadge tone={status === 'HOAT_DONG' ? 'active' : 'muted'}>
      {statusLabel(status)}
    </ResourceStatusBadge>
  );
}

type AccountDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; account: AdminAccount };

function AccountDetailSheet({
  accountId,
  canUpdate,
  onClose,
  onAccountUpdated,
}: {
  accountId: number;
  canUpdate: boolean;
  onClose: () => void;
  onAccountUpdated: (account: AdminAccount) => void;
}) {
  const [detail, setDetail] = useState<AccountDetailState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const statusSubmittingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    getAdminAccountById(accountId, controller.signal)
      .then((account) => {
        if (!controller.signal.aborted) setDetail({ status: 'success', account });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDetail({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Không thể tải thông tin tài khoản.',
        });
      });
    return () => controller.abort();
  }, [accountId, retryCount]);

  async function confirmStatusChange() {
    if (statusSubmittingRef.current || detail.status !== 'success') return;
    const nextStatus =
      detail.account.status === 'HOAT_DONG' ? 'TAM_KHOA' : 'HOAT_DONG';
    statusSubmittingRef.current = true;
    setStatusSubmitting(true);
    setStatusError(null);
    try {
      const updatedAccount = await updateAdminAccountStatus(
        detail.account.accountId,
        nextStatus,
      );
      setDetail({ status: 'success', account: updatedAccount });
      setStatusDialogOpen(false);
      toast.success(
        nextStatus === 'TAM_KHOA'
          ? 'Đã khóa tài khoản Admin.'
          : 'Đã mở khóa tài khoản Admin.',
      );
      onAccountUpdated(updatedAccount);
    } catch (requestError: unknown) {
      setStatusError(
        requestError instanceof TypeError
          ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
          : requestError instanceof Error
            ? requestError.message
            : 'Không thể cập nhật trạng thái tài khoản.',
      );
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  return (
    <>
      <ResourceSheet
        busy={detail.status === 'loading'}
        description="Thông tin định danh, nhà xe, vai trò và trạng thái tài khoản."
        onClose={onClose}
        title="Thông tin tài khoản"
      >
        {detail.status === 'loading' && (
          <ResourceState loading>Đang tải thông tin tài khoản…</ResourceState>
        )}
        {detail.status === 'error' && (
          <ResourceState error>
            <p>{detail.message}</p>
            <Button
              onClick={() => {
                setDetail({ status: 'loading' });
                setRetryCount((count) => count + 1);
              }}
              variant="outline"
            >
              Thử lại
            </Button>
          </ResourceState>
        )}
        {detail.status === 'success' && (
          <div className="space-y-5">
            <div className="flex min-w-0 items-center gap-4 border-b pb-5">
              <span
                aria-hidden
                className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-primary"
              >
                <UserRound aria-hidden size={23} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-base font-semibold text-foreground">
                  {detail.account.fullName}
                </h3>
                <p className="mt-1 break-all text-[13px] text-muted-foreground">
                  {detail.account.email ?? detail.account.phoneNumber}
                </p>
              </div>
              <AccountStatusBadge status={detail.account.status} />
            </div>

            <section aria-labelledby="account-identity-heading" className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold" id="account-identity-heading">Thông tin định danh</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-[13px] [&_dd]:mt-1 [&_dd]:break-words [&_dt]:text-xs [&_dt]:text-muted-foreground">
                <div><dt>Số điện thoại</dt><dd>{detail.account.phoneNumber}</dd></div>
                <div><dt>Email</dt><dd>{detail.account.email ?? 'Chưa cập nhật'}</dd></div>
                <div><dt>Ngày sinh</dt><dd>{formatDate(detail.account.dateOfBirth)}</dd></div>
                <div><dt>CCCD</dt><dd className="admin-data-mono">{detail.account.citizenId ?? 'Chưa cập nhật'}</dd></div>
                <div><dt>Mã nhân viên</dt><dd className="admin-data-mono">{detail.account.employee.employeeCode}</dd></div>
                <div><dt>Trạng thái nhân viên</dt><dd>{detail.account.employee.employmentStatus}</dd></div>
              </dl>
            </section>

            <section aria-labelledby="account-scope-heading" className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold" id="account-scope-heading">Phạm vi và vai trò</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-[13px] [&_dd]:mt-1 [&_dd]:break-words [&_dt]:text-xs [&_dt]:text-muted-foreground">
                <div className="col-span-2">
                  <dt>Nhà xe</dt>
                  <dd className="flex items-center gap-2"><Building2 aria-hidden className="size-4 text-muted-foreground" />{detail.account.busCompany.name} · <span className="admin-data-mono">{detail.account.busCompany.code}</span></dd>
                </div>
                <div className="col-span-2">
                  <dt>Vai trò</dt>
                  <dd><RoleBadges roles={detail.account.roles} /></dd>
                </div>
                <div><dt>Số điện thoại</dt><dd>{detail.account.phoneVerified ? 'Đã xác minh' : 'Chưa xác minh'}</dd></div>
                <div><dt>Ngày tạo</dt><dd>{formatTimestamp(detail.account.createdAt)}</dd></div>
                <div className="col-span-2"><dt>Cập nhật lần cuối</dt><dd>{formatTimestamp(detail.account.updatedAt)}</dd></div>
              </dl>
            </section>

            {canUpdate && (
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button onClick={() => setRoleDialogOpen(true)} variant="outline">
                  <ShieldCheck aria-hidden />
                  Gán vai trò
                </Button>
                <Button
                  onClick={() => {
                    setStatusError(null);
                    setStatusDialogOpen(true);
                  }}
                  variant="outline"
                >
                  {detail.account.status === 'HOAT_DONG' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                </Button>
                <Button onClick={() => setEditOpen(true)}>
                  <Pencil aria-hidden />
                  Chỉnh sửa
                </Button>
              </div>
            )}
          </div>
        )}
      </ResourceSheet>

      {editOpen && detail.status === 'success' && (
        <AdminAccountFormDialog
          account={detail.account}
          onClose={() => setEditOpen(false)}
          onSaved={(updatedAccount) => {
            setDetail({ status: 'success', account: updatedAccount });
            setEditOpen(false);
            onAccountUpdated(updatedAccount);
          }}
        />
      )}
      {canUpdate && roleDialogOpen && detail.status === 'success' && (
        <AdminAccountRolesDialog
          account={detail.account}
          onClose={() => setRoleDialogOpen(false)}
          onSaved={(updatedAccount) => {
            setDetail({ status: 'success', account: updatedAccount });
            setRoleDialogOpen(false);
            onAccountUpdated(updatedAccount);
          }}
        />
      )}
      {canUpdate && statusDialogOpen && detail.status === 'success' && (
        <ResourceConfirmation
          busy={statusSubmitting}
          onClose={() => {
            if (!statusSubmittingRef.current) setStatusDialogOpen(false);
          }}
          title={detail.account.status === 'HOAT_DONG' ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản này?'}
          description={
            detail.account.status === 'HOAT_DONG'
              ? 'Tài khoản sẽ chuyển sang trạng thái Đang khóa và các phiên đăng nhập đang hoạt động sẽ bị thu hồi.'
              : 'Tài khoản sẽ được mở khóa. Thao tác này không tạo phiên đăng nhập mới.'
          }
        >
          <div className="space-y-3">
            {statusError && <ResourceNotice kind="error">{statusError}</ResourceNotice>}
            <Button
              aria-busy={statusSubmitting}
              disabled={statusSubmitting}
              onClick={() => void confirmStatusChange()}
            >
              {statusSubmitting && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
              {statusSubmitting ? 'Đang cập nhật…' : detail.account.status === 'HOAT_DONG' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
            </Button>
          </div>
        </ResourceConfirmation>
      )}
    </>
  );
}

export function AdminAccountsManagement() {
  const {
    accountPage,
    busCompanyId,
    createdDateRange,
    error,
    loading,
    page,
    roleName,
    searchInput,
    sortBy,
    sortDirection,
    status,
    changePage,
    refresh,
    sortAccounts,
    updateBusCompany,
    updateCreatedDateRange,
    updateRole,
    updateSearch,
    updateStatus,
  } = useAdminAccounts();
  const authState = useAdminSession();
  const session = authState.status === 'authenticated' ? authState.session : null;
  const canCreate = hasPlatformAdminPermission(session, 'admin-account:create');
  const canUpdate = hasPlatformAdminPermission(session, 'admin-account:update');
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptionsState>({ status: 'loading' });
  const [filterOptionsRetry, setFilterOptionsRetry] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const accounts = accountPage?.data ?? [];
  const hasFilters = Boolean(
    searchInput.trim() || status || busCompanyId !== undefined || roleName || createdDateRange,
  );

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getBusCompanyFilterOptions(controller.signal),
      getDefaultRolePermissions(controller.signal),
    ])
      .then(([companies, catalog]) => {
        if (controller.signal.aborted) return;
        setFilterOptions({
          status: 'success',
          companies: companies.map((company) => ({ value: String(company.id), label: company.label })),
          roles: catalog.roles.flatMap((role) =>
            role.scope === 'tenant' && TENANT_RBAC_ROLE_NAMES.includes(role.roleName as TenantRbacRoleName)
              ? [{ value: role.roleName, label: roleLabel(role.roleName) }]
              : [],
          ),
        });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setFilterOptions({
          status: 'error',
          message: requestError instanceof Error ? requestError.message : 'Không thể tải bộ lọc nhà xe và vai trò.',
        });
      });
    return () => controller.abort();
  }, [filterOptionsRetry]);

  function sortableHeader(label: string, key: AdminAccountSortKey) {
    const selected = sortBy === key;
    return (
      <TableHead
        aria-sort={selected ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        scope="col"
      >
        <Button className="-ml-3" onClick={() => sortAccounts(key)} size="sm" variant="ghost">
          {label}
          {selected ? sortDirection === 'asc' ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden /> : <ArrowUpDown aria-hidden />}
        </Button>
      </TableHead>
    );
  }

  return (
    <SuperAdminLayout activeSection="admin-accounts">
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && <ResourceCreateAction label="Thêm tài khoản" onClick={() => setCreateOpen(true)} />}
              <ResourceRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
          eyebrow="QUẢN TRỊ NỀN TẢNG"
          title="Quản lý tài khoản Admin"
          titleId="admin-accounts-title"
        />

        <section aria-busy={loading} aria-labelledby="admin-accounts-title">
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label="Tìm tài khoản Admin"
                onChange={updateSearch}
                placeholder="Tìm theo tên, số điện thoại, email hoặc nhà xe"
                value={searchInput}
              />
              <SelectFilter allLabel="Tất cả trạng thái" label="Lọc theo trạng thái tài khoản" onChange={updateStatus} options={STATUS_OPTIONS} value={status} />
              <SelectFilter
                allLabel="Tất cả nhà xe"
                label="Lọc theo nhà xe"
                onChange={updateBusCompany}
                options={filterOptions.status === 'success' ? filterOptions.companies : []}
                value={busCompanyId === undefined ? '' : String(busCompanyId)}
              />
              <SelectFilter
                allLabel="Tất cả vai trò"
                label="Lọc theo vai trò"
                onChange={updateRole}
                options={filterOptions.status === 'success' ? filterOptions.roles : []}
                value={roleName}
              />
              <DateRangeFilter
                appearance="resource"
                label="Ngày tạo"
                onApply={updateCreatedDateRange}
                value={createdDateRange}
              />
            </FilterToolbar>

            {filterOptions.status === 'loading' && (
              <p className="border-b px-5 py-3 text-xs text-muted-foreground" role="status">Đang tải tùy chọn bộ lọc…</p>
            )}
            {filterOptions.status === 'error' && (
              <div className="border-b p-4">
                <ResourceNotice kind="error">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>Không tải được danh sách nhà xe và vai trò lọc: {filterOptions.message}</span>
                    <Button
                      onClick={() => {
                        setFilterOptions({ status: 'loading' });
                        setFilterOptionsRetry((count) => count + 1);
                      }}
                      variant="outline"
                    >
                      Tải lại bộ lọc
                    </Button>
                  </div>
                </ResourceNotice>
              </div>
            )}

            {error && (
              <div className="border-b p-4">
                <ResourceNotice kind="error">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><strong>Chưa tải được danh sách tài khoản Admin</strong><p className="mt-1">{error}</p></div>
                    <Button onClick={refresh} variant="outline">Thử lại</Button>
                  </div>
                </ResourceNotice>
              </div>
            )}

            {loading && !accountPage && !error && <ResourceTableSkeleton resourceLabel="tài khoản Admin" />}

            <ResourceSortControls
              direction={sortDirection}
              label="Sắp xếp theo"
              onDirectionChange={() => sortAccounts(sortBy)}
              onFieldChange={(value) => sortAccounts(value as AdminAccountSortKey)}
              options={SORT_OPTIONS}
              value={sortBy}
            />

            {!loading && !error && accountPage && accounts.length === 0 && (
              <ResourceState>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">
                    {hasFilters ? 'Không tìm thấy tài khoản Admin phù hợp' : 'Chưa có tài khoản Admin'}
                  </h3>
                  <p>{hasFilters ? 'Thử đổi từ khóa hoặc điều chỉnh bộ lọc.' : 'Tài khoản nhân viên sẽ xuất hiện ở đây sau khi được tạo.'}</p>
                </div>
              </ResourceState>
            )}

            {accountPage && accounts.length > 0 && (
              <>
                <div
                  aria-busy={loading}
                  className={`hidden transition-opacity min-[901px]:block ${loading ? 'opacity-60' : ''}`}
                >
                  <Table className="min-w-[1120px]">
                    <TableHeader>
                      <TableRow>
                        {sortableHeader('Họ và tên', 'fullName')}
                        {sortableHeader('Số điện thoại', 'phoneNumber')}
                        <TableHead scope="col">Nhà xe</TableHead>
                        <TableHead scope="col">Vai trò</TableHead>
                        {sortableHeader('Trạng thái', 'status')}
                        {sortableHeader('Ngày tạo', 'createdAt')}
                        <TableHead scope="col"><span className="sr-only">Thao tác</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((account) => (
                        <TableRow key={account.accountId}>
                          <TableHead className="min-w-52" scope="row">
                            <div className="flex items-center gap-3">
                              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-semibold text-primary">
                                {account.fullName.trim().charAt(0).toLocaleUpperCase('vi-VN') || 'A'}
                              </span>
                              <span className="grid min-w-0">
                                <span className="truncate font-medium">{account.fullName}</span>
                                <small className="admin-data-mono mt-0.5 text-xs font-normal text-muted-foreground">{account.employee.employeeCode}</small>
                              </span>
                            </div>
                          </TableHead>
                          <TableCell className="min-w-44">
                            <span className="block">{account.phoneNumber}</span>
                            {account.email && <small className="mt-0.5 block text-xs text-muted-foreground">{account.email}</small>}
                          </TableCell>
                          <TableCell>{account.busCompany.name}</TableCell>
                          <TableCell className="min-w-52"><RoleBadges roles={account.roles} /></TableCell>
                          <TableCell><AccountStatusBadge status={account.status} /></TableCell>
                          <TableCell>{formatTimestamp(account.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <ResourceDetailAction onClick={() => setSelectedAccountId(account.accountId)} resourceName={`tài khoản ${account.fullName}`} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div
                  aria-busy={loading}
                  className={`grid gap-3 p-4 transition-opacity min-[901px]:hidden ${loading ? 'opacity-60' : ''}`}
                >
                  {accounts.map((account) => (
                    <Card className="gap-4 p-4" key={account.accountId}>
                      <div className="flex min-w-0 items-start gap-3">
                        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-semibold text-primary">
                          {account.fullName.trim().charAt(0).toLocaleUpperCase('vi-VN') || 'A'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-sm font-semibold">{account.fullName}</h3>
                          <p className="mt-1 break-all text-[13px] text-muted-foreground">{account.phoneNumber}</p>
                          {account.email && <p className="mt-0.5 break-all text-xs text-muted-foreground">{account.email}</p>}
                          <p className="admin-data-mono mt-1 text-xs text-muted-foreground">{account.employee.employeeCode}</p>
                        </div>
                        <AccountStatusBadge status={account.status} />
                      </div>
                      <dl className="grid min-w-0 grid-cols-2 gap-4 border-t pt-3 text-[13px] [&_dd]:mt-1 [&_dd]:break-words [&_dt]:text-xs [&_dt]:text-muted-foreground">
                        <div><dt>Nhà xe</dt><dd>{account.busCompany.name}</dd></div>
                        <div><dt>Ngày tạo</dt><dd>{formatTimestamp(account.createdAt)}</dd></div>
                        <div className="col-span-2"><dt>Vai trò</dt><dd className="mt-2"><RoleBadges roles={account.roles} /></dd></div>
                      </dl>
                      <div className="border-t pt-3">
                        <ResourceDetailAction onClick={() => setSelectedAccountId(account.accountId)} resourceName={`tài khoản ${account.fullName}`} />
                      </div>
                    </Card>
                  ))}
                </div>

                <ResourcePagination
                  currentPage={page}
                  disabled={loading}
                  onPageChange={changePage}
                  pageSize={accountPage.meta.pageSize}
                  summaryLabel="tài khoản"
                  totalItems={accountPage.meta.totalItems}
                  totalPages={accountPage.meta.totalPages}
                />
              </>
            )}
          </Card>
        </section>
      </div>

      {selectedAccountId !== null && (
        <AccountDetailSheet
          accountId={selectedAccountId}
          canUpdate={canUpdate}
          key={selectedAccountId}
          onClose={() => setSelectedAccountId(null)}
          onAccountUpdated={() => refresh()}
        />
      )}
      {createOpen && (
        <AdminAccountFormDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            refresh();
          }}
        />
      )}
    </SuperAdminLayout>
  );
}
