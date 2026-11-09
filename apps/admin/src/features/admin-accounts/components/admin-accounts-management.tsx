'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ResourceCreateAction,
  ResourceDetailAction,
  ResourceNotice,
  ResourcePagination,
  ResourceRefreshAction,
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
import { useTranslations } from 'next-intl';
import { getBusCompanyFilterOptions } from '@/features/bus-companies/services/bus-company-service';
import { getDefaultRolePermissions } from '@/features/platform-rbac/services/platform-rbac-service';
import {
  TENANT_RBAC_ROLE_NAMES,
  type TenantRbacRoleName,
} from '@/features/tenant-rbac/types/tenant-rbac';
import { useAdminAccounts } from '../hooks/use-admin-accounts';
import type {
  AdminAccount,
  AdminAccountSortKey,
  AdminAccountStatus,
} from '../types/admin-account';
import { AdminAccountFormDialog } from './admin-account-form-dialog';

type FilterOptionsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; companies: FilterOption[]; roles: FilterOption[] };

function getRoleLabel(role: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    NHA_XE_ADMIN: t('roleOperatorAdmin'),
    NHAN_VIEN_DIEU_HANH: t('roleDispatcher'),
    NHAN_VIEN_BAN_VE: t('roleTicketClerk'),
    NHAN_VIEN_CSKH: t('roleSupportAgent'),
    NHAN_VIEN_PHU_XE: t('roleDriverAssistant'),
    NHAN_VIEN_KINH_DOANH: t('roleSales'),
  };
  return map[role] ?? role.replaceAll('_', ' ');
}

function RoleBadges({ roles, t }: { roles: readonly string[]; t: (key: string) => string }) {
  if (roles.length === 0) {
    return <span className="text-muted-foreground">{t('noRolesAssigned')}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <ResourceStatusBadge key={role} tone="muted">
          {getRoleLabel(role, t)}
        </ResourceStatusBadge>
      ))}
    </div>
  );
}

function AccountStatusBadge({ status, t }: { status: AdminAccountStatus; t: (key: string) => string }) {
  return (
    <ResourceStatusBadge tone={status === 'HOAT_DONG' ? 'active' : 'muted'}>
      {status === 'HOAT_DONG' ? t('statusActive') : t('statusLocked')}
    </ResourceStatusBadge>
  );
}

export function AdminAccountsManagement() {
  const tAccounts = useTranslations('adminAccounts');
  const tCommon = useTranslations('common');
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
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptionsState>({ status: 'loading' });
  const [filterOptionsRetry, setFilterOptionsRetry] = useState(0);
  const accounts = accountPage?.data ?? [];
  const hasFilters = Boolean(
    searchInput.trim() || status || busCompanyId !== undefined || roleName || createdDateRange,
  );

  const statusOptions: FilterOption[] = [
    { value: 'HOAT_DONG', label: tAccounts('statusActive') },
    { value: 'TAM_KHOA', label: tAccounts('statusLocked') },
  ];

  const sortOptions: FilterOption[] = [
    { value: 'createdAt', label: tCommon('createdAt') },
    { value: 'fullName', label: tAccounts('accountName') },
    { value: 'phoneNumber', label: tAccounts('accountPhone') },
    { value: 'status', label: tCommon('status') },
    { value: 'updatedAt', label: tCommon('updatedAt') },
  ];

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
              ? [{ value: role.roleName, label: getRoleLabel(role.roleName, tAccounts) }]
              : [],
          ),
        });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setFilterOptions({
          status: 'error',
          message: requestError instanceof Error ? requestError.message : tAccounts('filterError'),
        });
      });
    return () => controller.abort();
  }, [filterOptionsRetry, tAccounts]);

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
              {canCreate && <ResourceCreateAction label={tAccounts('createAccount')} onClick={() => setCreateOpen(true)} />}
              <ResourceRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
          eyebrow={tAccounts('eyebrowPlatform')}
          title={tAccounts('adminAccountsTitle')}
          titleId="admin-accounts-title"
        />

        <section aria-busy={loading} aria-labelledby="admin-accounts-title">
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label={tAccounts('searchAdminAccounts')}
                onChange={updateSearch}
                placeholder={tAccounts('searchPlaceholder')}
                value={searchInput}
              />
              <SelectFilter allLabel={tAccounts('allStatuses')} label={tAccounts('filterStatusLabel')} onChange={updateStatus} options={statusOptions} value={status} />
              <SelectFilter
                allLabel={tAccounts('allCompanies')}
                label={tAccounts('filterCompanyLabel')}
                onChange={updateBusCompany}
                options={filterOptions.status === 'success' ? filterOptions.companies : []}
                value={busCompanyId === undefined ? '' : String(busCompanyId)}
              />
              <SelectFilter
                allLabel={tAccounts('allRoles')}
                label={tAccounts('filterRoleLabel')}
                onChange={updateRole}
                options={filterOptions.status === 'success' ? filterOptions.roles : []}
                value={roleName}
              />
              <DateRangeFilter
                appearance="resource"
                label={tAccounts('colCreatedAt')}
                onApply={updateCreatedDateRange}
                value={createdDateRange}
              />
            </FilterToolbar>

            {filterOptions.status === 'loading' && (
              <p className="border-b px-5 py-3 text-xs text-muted-foreground" role="status">{tAccounts('filterLoading')}</p>
            )}
            {filterOptions.status === 'error' && (
              <div className="border-b p-4">
                <ResourceNotice kind="error">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>{tAccounts('filterError')}: {filterOptions.message}</span>
                    <Button
                      onClick={() => {
                        setFilterOptions({ status: 'loading' });
                        setFilterOptionsRetry((count) => count + 1);
                      }}
                      variant="outline"
                    >
                      {tAccounts('retryFilters')}
                    </Button>
                  </div>
                </ResourceNotice>
              </div>
            )}

            {error && (
              <div className="border-b p-4">
                <ResourceNotice kind="error">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><strong>{tAccounts('loadErrorTitle')}</strong><p className="mt-1">{error}</p></div>
                    <Button onClick={refresh} variant="outline">{tCommon('retry')}</Button>
                  </div>
                </ResourceNotice>
              </div>
            )}

            {loading && !accountPage && !error && <ResourceTableSkeleton resourceLabel={tAccounts('colAccount')} />}

            <ResourceSortControls
              direction={sortDirection}
              label={tCommon('sortBy')}
              onDirectionChange={() => sortAccounts(sortBy)}
              onFieldChange={(value) => sortAccounts(value as AdminAccountSortKey)}
              options={sortOptions}
              value={sortBy}
            />

            {!loading && !error && accountPage && accounts.length === 0 && (
              <ResourceState>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">
                    {hasFilters ? tAccounts('emptyFiltered') : tAccounts('emptyNoData')}
                  </h3>
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
                        {sortableHeader(tAccounts('accountName'), 'fullName')}
                        {sortableHeader(tAccounts('accountPhone'), 'phoneNumber')}
                        <TableHead scope="col">{tAccounts('colCompany')}</TableHead>
                        <TableHead scope="col">{tAccounts('colRole')}</TableHead>
                        {sortableHeader(tAccounts('colStatus'), 'status')}
                        {sortableHeader(tAccounts('colCreatedAt'), 'createdAt')}
                        <TableHead scope="col"><span className="sr-only">{tCommon('actions')}</span></TableHead>
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
                                <small className="admin-data-mono mt-0.5 text-xs font-normal text-muted-foreground">
                                  {account.employee.position ? `${account.employee.position} · ` : ''}{account.employee.employeeCode}
                                </small>
                              </span>
                            </div>
                          </TableHead>
                          <TableCell className="min-w-44">
                            <span className="block">{account.phoneNumber}</span>
                            {account.email && <small className="mt-0.5 block text-xs text-muted-foreground">{account.email}</small>}
                          </TableCell>
                          <TableCell>{account.busCompany.name}</TableCell>
                          <TableCell className="min-w-52"><RoleBadges roles={account.roles} t={tAccounts} /></TableCell>
                          <TableCell><AccountStatusBadge status={account.status} t={tAccounts} /></TableCell>
                          <TableCell>{account.createdAt}</TableCell>
                          <TableCell className="text-right">
                            <ResourceDetailAction href={`/admin-accounts/${account.accountId}`} resourceName={`${tAccounts('colAccount')} ${account.fullName}`} />
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
                          <p className="admin-data-mono mt-1 text-xs text-muted-foreground">
                            {account.employee.position ? `${account.employee.position} · ` : ''}{account.employee.employeeCode}
                          </p>
                        </div>
                        <AccountStatusBadge status={account.status} t={tAccounts} />
                      </div>
                      <dl className="grid min-w-0 grid-cols-2 gap-4 border-t pt-3 text-[13px] [&_dd]:mt-1 [&_dd]:break-words [&_dt]:text-xs [&_dt]:text-muted-foreground">
                        <div><dt>{tAccounts('colCompany')}</dt><dd>{account.busCompany.name}</dd></div>
                        <div><dt>{tAccounts('colCreatedAt')}</dt><dd>{account.createdAt}</dd></div>
                        <div className="col-span-2"><dt>{tAccounts('colRole')}</dt><dd className="mt-2"><RoleBadges roles={account.roles} t={tAccounts} /></dd></div>
                      </dl>
                      <div className="border-t pt-3">
                        <ResourceDetailAction href={`/admin-accounts/${account.accountId}`} resourceName={`${tAccounts('colAccount')} ${account.fullName}`} />
                      </div>
                    </Card>
                  ))}
                </div>

                <ResourcePagination
                  currentPage={page}
                  disabled={loading}
                  onPageChange={changePage}
                  pageSize={accountPage.meta.pageSize}
                  summaryLabel={tAccounts('colAccount')}
                  totalItems={accountPage.meta.totalItems}
                  totalPages={accountPage.meta.totalPages}
                />
              </>
            )}
          </Card>
        </section>
      </div>

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
