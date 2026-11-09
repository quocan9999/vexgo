'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ResourceCreateAction,
  ResourceDetailAction,
  ResourcePagination,
  ResourceRefreshAction,
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
import { useTranslations } from 'next-intl';
import { useBusCompanies } from '../hooks/use-bus-companies';
import { CreateBusCompanyDialog } from './create-bus-company-dialog';
import type {
  BusCompany,
  BusCompanySortKey,
  BusCompanyStatus,
} from '../types/bus-company';

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function initials(value: string) {
  return value
    .replace(/^(Nh\u00E0 xe|Bus)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('vi');
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

export function BusCompaniesManagement() {
  const tCompanies = useTranslations('busCompanies');
  const tCommon = useTranslations('common');
  const authState = useAdminSession();
  const session = authState.status === 'authenticated' ? authState.session : null;
  const canCreateCompany = hasPlatformAdminPermission(
    session,
    'bus-company:create',
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const statusFilters: FilterOption[] = [
    { value: 'HOAT_DONG', label: tCompanies('statusActive') },
    { value: 'TAM_NGUNG', label: tCompanies('statusSuspended') },
  ];

  function openCreateDialog() {
    if (!canCreateCompany) return;
    setCreateDialogOpen(true);
  }

  function handleCompanyCreated(company: BusCompany) {
    setCreateDialogOpen(false);
    toast.success(tCompanies('createdSuccessMessage', { name: company.name }));
    refresh();
  }

  function sortButton(label: string, column: BusCompanySortKey) {
    const selected = sortBy === column;
    return (
      <Button
        aria-label={`${label}, ${
          selected
            ? sortDirection === 'asc'
              ? tCommon('ascending')
              : tCommon('descending')
            : 'none'
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
                  label={tCompanies('createBusCompany')}
                  onClick={openCreateDialog}
                />
              )}
              <ResourceRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
          eyebrow={tCompanies('eyebrowPartners')}
          title={tCompanies('busCompaniesTitle')}
          titleId="page-title"
        />
        <section aria-label={tCompanies('busCompaniesTitle')} aria-busy={loading}>
          <Card className="gap-0 py-0 ring-0">
            <FilterToolbar>
              <SearchInput
                label={tCompanies('searchBusCompanyLabel')}
                onChange={updateSearch}
                placeholder={tCompanies('searchBusCompanyPlaceholder')}
                value={searchInput}
              />
              <SelectFilter
                allLabel={tCompanies('allStatuses')}
                label={tCompanies('filterStatus')}
                onChange={updateFilters}
                options={statusFilters}
                value={status}
              />
              <DateRangeFilter
                appearance="resource"
                emptyValueLabel={tCommon('all')}
                label={tCommon('createdAt')}
                onApply={updateCreatedDateRange}
                value={createdDateRange}
              />
            </FilterToolbar>

            {!error && companyPage && companyPage.data.length > 0 && (
              <div className="flex items-end gap-3 border-b p-4 md:hidden">
                <SelectFilter
                  allLabel={tCompanies('colName')}
                  label={tCommon('sortBy')}
                  onChange={(value) => {
                    const field = (value || 'name') as BusCompanySortKey;
                    if (field !== sortBy) sortCompanies(field);
                  }}
                  options={[
                    { value: 'code', label: tCompanies('colCode') },
                    { value: 'status', label: tCommon('status') },
                    { value: 'createdAt', label: tCommon('createdAt') },
                  ]}
                  value={sortBy === 'name' ? '' : sortBy}
                />
                <Button
                  aria-label={`${tCommon('toggleSortOrder', { order: sortDirection === 'asc' ? tCommon('ascending') : tCommon('descending') })}`}
                  onClick={() => sortCompanies(sortBy)}
                  variant="outline"
                >
                  {sortDirection === 'asc' ? (
                    <ArrowUp aria-hidden className="size-4" />
                  ) : (
                    <ArrowDown aria-hidden className="size-4" />
                  )}
                  {sortDirection === 'asc' ? tCommon('sortAscending') : tCommon('sortDescending')}
                </Button>
              </div>
            )}

            {loading && !companyPage && (
              <ResourceTableSkeleton resourceLabel={tCompanies('unit')} />
            )}
            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={refresh} variant="outline">
                  {tCommon('retry')}
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
                      ? tCompanies('emptyFiltered')
                      : tCompanies('emptyNoData')}
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
                      {tCommon('clearFilters')}
                    </Button>
                  )}
                </ResourceState>
              )}

            {!error && companyPage && companyPage.data.length > 0 && (
              <>
                <div className="hidden md:block" aria-busy={loading}>
                  <Table className="min-w-[920px]">
                    <TableCaption className="sr-only">
                      {tCompanies('busCompaniesTitle')}
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        {(
                          [
                            { key: 'name', label: tCompanies('colCompany') },
                            { key: 'code', label: tCompanies('colCode') },
                            { key: null, label: tCompanies('contactInfo') },
                            { key: 'status', label: tCommon('status') },
                            { key: 'createdAt', label: tCommon('createdAt') },
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
                          <span className="sr-only">{tCommon('actions')}</span>
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
                            {company.contactInfo || tCompanies('noContactInfo')}
                          </TableCell>
                          <TableCell>
                            <ResourceStatusBadge
                              tone={
                                company.status === 'HOAT_DONG'
                                  ? 'active'
                                  : 'muted'
                              }
                            >
                              {company.status === 'HOAT_DONG' ? tCompanies('statusActive') : tCompanies('statusSuspended')}
                            </ResourceStatusBadge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {timestampFormat(company.createdAt)}
                          </TableCell>
                          <TableCell>
                            <ResourceDetailAction
                              href={`/bus-companies/${company.busCompanyId}`}
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
                          {company.status === 'HOAT_DONG' ? tCompanies('statusActive') : tCompanies('statusSuspended')}
                        </ResourceStatusBadge>
                      </div>
                      <p className="break-words text-[13px] text-muted-foreground">
                        {company.contactInfo || tCompanies('noContactInfo')}
                      </p>
                      <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-[13px]">
                        <div className="space-y-1">
                          <dt className="text-xs text-muted-foreground">
                            {tCommon('createdAt')}
                          </dt>
                          <dd>{timestampFormat(company.createdAt)}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs text-muted-foreground">
                            {tCommon('updatedAt')}
                          </dt>
                          <dd>{timestampFormat(company.updatedAt)}</dd>
                        </div>
                      </dl>
                      <div className="flex justify-end border-t pt-3">
                        <ResourceDetailAction
                          href={`/bus-companies/${company.busCompanyId}`}
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
                  summaryLabel={tCompanies('unit')}
                  totalItems={companyPage.meta.totalItems}
                  totalPages={companyPage.meta.totalPages}
                />
              </>
            )}
          </Card>
        </section>
      </div>
      {canCreateCompany && createDialogOpen && (
        <CreateBusCompanyDialog
          onClose={() => setCreateDialogOpen(false)}
          onCreated={handleCompanyCreated}
        />
      )}
    </SuperAdminLayout>
  );
}
