'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceDetailAction,
  ResourceRefreshAction,
  ResourcePagination,
  ResourceStatusBadge,
  ResourceTableSkeleton,
  ResourceState,
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
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useLocale, useTranslations } from 'next-intl';
import { useCustomers } from '../hooks/use-customers';
import type { CustomerAccountStatus, CustomerSortKey } from '../types/customer';

function getCustomerStatusBadgeConfig(
  status: string,
  tCustomers: (key: string) => string,
) {
  if (status === 'HOAT_DONG') {
    return { tone: 'active' as const, label: tCustomers('statusActive') };
  }
  if (status === 'BI_KHOA') {
    return { tone: 'danger' as const, label: tCustomers('statusLocked') };
  }
  return { tone: 'warning' as const, label: tCustomers('statusTemporaryLocked') };
}

export function CustomersManagement() {
  const tCustomers = useTranslations('customers');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const {
    customers,
    meta,
    loading,
    refreshing,
    error,
    searchInput,
    setSearchInput,
    page,
    setPage,
    accountStatus,
    setAccountStatus,
    sortBy,
    sortDirection,
    handleSort,
    refresh,
    resetFilters,
  } = useCustomers();

  const statusOptions: FilterOption[] = [
    { value: 'HOAT_DONG', label: tCustomers('statusActive') },
    { value: 'TAM_KHOA', label: tCustomers('statusTemporaryLocked') },
    { value: 'BI_KHOA', label: tCustomers('statusLocked') },
  ];

  const router = useRouter();

  function renderSortIcon(key: CustomerSortKey) {
    if (sortBy !== key) {
      return (
        <span aria-hidden="true">
          <ArrowUpDown size={14} />
        </span>
      );
    }
    return (
      <span aria-hidden="true">
        {sortDirection === 'asc' ? (
          <ArrowUp size={14} />
        ) : (
          <ArrowDown size={14} />
        )}
      </span>
    );
  }

  function getAriaSort(
    key: CustomerSortKey,
  ): 'none' | 'ascending' | 'descending' {
    if (sortBy !== key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  const isFiltered = Boolean(searchInput || accountStatus);

  return (
    <SuperAdminLayout activeSection="customers">
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <ResourceRefreshAction loading={refreshing} onClick={refresh} />
          }
          eyebrow={tCustomers('eyebrow')}
          title={tCustomers('customersTitle')}
          titleId="customers-page-title"
        />

        <section
          className="min-w-0"
          aria-busy={loading || refreshing}
          aria-labelledby="customers-table-heading"
        >
          <h2 id="customers-table-heading" className="sr-only">
            {tCustomers('customersTitle')}
          </h2>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <FilterToolbar>
              <SearchInput
                label={tCustomers('searchLabel')}
                onChange={setSearchInput}
                placeholder={tCustomers('searchPlaceholder')}
                value={searchInput}
              />
              <SelectFilter
                allLabel={tCustomers('statusAll')}
                label={tCustomers('statusFilterLabel')}
                onChange={(val) =>
                  setAccountStatus(val as CustomerAccountStatus | '')
                }
                options={statusOptions}
                value={accountStatus}
              />
            </FilterToolbar>

            <div className="flex items-end gap-3 border-b p-4 min-[901px]:hidden">
              <SelectFilter
                label={tCustomers('sortByLabel')}
                allLabel={tCustomers('colCustomerCode')}
                value={sortBy}
                options={[
                  { value: 'customerCode', label: tCustomers('colCustomerCode') },
                  { value: 'fullName', label: tCustomers('colFullName') },
                  { value: 'loyaltyPoints', label: tCustomers('colLoyaltyPoints') },
                  { value: 'createdAt', label: tCustomers('registeredAt') },
                  { value: 'updatedAt', label: tCustomers('updatedAt') },
                ]}
                onChange={(value) => {
                  const key = (value || 'customerCode') as CustomerSortKey;
                  if (key !== sortBy) handleSort(key);
                }}
              />
              <Button
                variant="outline"
                aria-label={`${tCustomers('sortByLabel')}, ${sortDirection === 'asc' ? tCustomers('sortAsc') : tCustomers('sortDesc')}`}
                onClick={() => handleSort(sortBy)}
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp aria-hidden />
                ) : (
                  <ArrowDown aria-hidden />
                )}
                {sortDirection === 'asc' ? tCustomers('sortAsc') : tCustomers('sortDesc')}
              </Button>
            </div>

            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={refresh} type="button" variant="outline">
                  {tCommon('retry')}
                </Button>
              </ResourceState>
            )}

            {!error &&
              (loading && customers.length === 0 ? (
                <ResourceTableSkeleton resourceLabel={tCustomers('customersTitle').toLowerCase()} />
              ) : customers.length === 0 ? (
                <ResourceState>
                  <p>
                    {isFiltered
                      ? tCustomers('emptyFiltered')
                      : tCustomers('emptyNoData')}
                  </p>
                  {isFiltered && (
                    <Button
                      onClick={resetFilters}
                      type="button"
                      variant="outline"
                    >
                      {tCustomers('resetFilters')}
                    </Button>
                  )}
                </ResourceState>
              ) : (
                <>
                  <div
                    className="hidden min-[901px]:block"
                    aria-busy={loading || refreshing}
                  >
                    <Table className="text-[13px]">
                      <TableCaption className="sr-only">
                        {tCustomers('customersTitle')}
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            scope="col"
                            aria-sort={getAriaSort('customerCode')}
                          >
                            <Button
                              type="button"
                              className="-ml-3 font-semibold"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('customerCode')}
                            >
                              <span>{tCustomers('colCustomerCode')}</span>
                              {renderSortIcon('customerCode')}
                            </Button>
                          </TableHead>
                          <TableHead
                            scope="col"
                            aria-sort={getAriaSort('fullName')}
                          >
                            <Button
                              type="button"
                              className="-ml-3 font-semibold"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('fullName')}
                            >
                              <span>{tCustomers('colFullName')}</span>
                              {renderSortIcon('fullName')}
                            </Button>
                          </TableHead>
                          <TableHead scope="col">{tCustomers('colPhone')}</TableHead>
                          <TableHead scope="col">{tCustomers('colEmail')}</TableHead>
                          <TableHead
                            scope="col"
                            aria-sort={getAriaSort('loyaltyPoints')}
                          >
                            <Button
                              type="button"
                              className="-ml-3 font-semibold"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('loyaltyPoints')}
                            >
                              <span>{tCustomers('colLoyaltyPoints')}</span>
                              {renderSortIcon('loyaltyPoints')}
                            </Button>
                          </TableHead>
                          <TableHead scope="col">
                            {tCustomers('colStatus')}
                          </TableHead>
                          <TableHead scope="col">
                            <span className="sr-only">{tCustomers('colActions')}</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer) => (
                          <TableRow key={customer.customerId}>
                            <TableCell>
                              <span className="admin-data-mono text-xs text-muted-foreground">
                                {customer.customerCode}
                              </span>
                            </TableCell>
                            <TableHead
                              scope="row"
                              className="bg-transparent py-3 text-[13px]"
                            >
                              <span>{customer.fullName}</span>
                            </TableHead>
                            <TableCell>{customer.phoneNumber}</TableCell>
                            <TableCell>{customer.email || '—'}</TableCell>
                            <TableCell>
                              <strong>
                                {customer.loyaltyPoints.toLocaleString(
                                  locale === 'en' ? 'en-US' : 'vi-VN',
                                )}
                              </strong>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const { tone, label } = getCustomerStatusBadgeConfig(
                                  customer.account.status,
                                  tCustomers,
                                );
                                return (
                                  <ResourceStatusBadge tone={tone}>
                                    {label}
                                  </ResourceStatusBadge>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <ResourceDetailAction
                                href={`/customers/${customer.customerId}`}
                                onClick={() =>
                                  router.push(`/customers/${customer.customerId}`)
                                }
                                resourceName={tCustomers('viewCustomer', {
                                  code: customer.customerCode,
                                })}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div
                    className="grid gap-4 p-4 min-[901px]:hidden"
                    aria-label={tCustomers('customersTitle')}
                    aria-busy={loading || refreshing}
                  >
                    {customers.map((customer) => (
                      <Card key={customer.customerId} className="gap-4 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <span className="admin-data-mono text-xs text-muted-foreground">
                              {customer.customerCode}
                            </span>
                            <h3 className="mt-1 text-base font-semibold break-words">
                              {customer.fullName}
                            </h3>
                          </div>
                          {(() => {
                            const { tone, label } = getCustomerStatusBadgeConfig(
                              customer.account.status,
                              tCustomers,
                            );
                            return (
                              <ResourceStatusBadge tone={tone}>
                                {label}
                              </ResourceStatusBadge>
                            );
                          })()}
                        </div>
                        <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                          <div>
                            <dt>{tCustomers('colPhone')}</dt>
                            <dd>{customer.phoneNumber}</dd>
                          </div>
                          <div>
                            <dt>{tCustomers('colEmail')}</dt>
                            <dd>{customer.email || '—'}</dd>
                          </div>
                          <div>
                            <dt>{tCustomers('colLoyaltyPoints')}</dt>
                            <dd>
                              {customer.loyaltyPoints.toLocaleString(
                                locale === 'en' ? 'en-US' : 'vi-VN',
                              )}{' '}
                              {tCustomers('pointsUnit')}
                            </dd>
                          </div>
                        </dl>
                        <div className="flex justify-end border-t pt-3">
                          <ResourceDetailAction
                            href={`/customers/${customer.customerId}`}
                            onClick={() =>
                              router.push(`/customers/${customer.customerId}`)
                            }
                            resourceName={tCustomers('viewCustomer', {
                              code: customer.customerCode,
                            })}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>

                  {
                    <ResourcePagination
                      currentPage={page}
                      disabled={loading}
                      onPageChange={setPage}
                      pageSize={meta.pageSize}
                      summaryLabel={tCustomers('resourceLabel')}
                      totalItems={meta.totalItems}
                      totalPages={meta.totalPages}
                    />
                  }
                </>
              ))}
          </div>
        </section>
      </div>
    </SuperAdminLayout>
  );
}
