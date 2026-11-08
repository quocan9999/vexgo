'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ResourcePagination,
  ResourceStatusBadge,
  ResourceTableSkeleton,
  ResourceState,
} from '@/components/admin/resource-ui';
import {
  FilterToolbar,
  SearchInput,
} from '@/components/data-filters/resource-filters';
import { ResourceSortControls } from '@/components/data-filters/resource-sort';
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
import { useCustomerTransactions } from '../hooks/use-customer-transactions';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
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

function renderLinkedDoc(
  tx: {
    booking: { code: string } | null;
    shipment: { code: string } | null;
  },
  tBookings: (key: string) => string,
  tCustomers: (key: string) => string,
) {
  if (tx.booking) {
    return (
      <span>
        {tBookings('tabBookings')}:{' '}
        <strong className="admin-data-mono">{tx.booking.code}</strong>
      </span>
    );
  }
  if (tx.shipment) {
    return (
      <span>
        {tCustomers('tabShipments')}:{' '}
        <strong className="admin-data-mono">{tx.shipment.code}</strong>
      </span>
    );
  }
  return '—';
}

function statusTone(status: string): 'active' | 'muted' {
  if (
    status === 'DA_THANH_TOAN' ||
    status === 'THANH_CONG' ||
    status === 'HOAN_TAT'
  )
    return 'active';
  return 'muted';
}

function formatStatus(status: string, tBookings: (key: string) => string): string {
  switch (status) {
    case 'DA_THANH_TOAN':
      return tBookings('statusPaid');
    case 'THANH_CONG':
      return tBookings('statusCompleted');
    case 'CHO_THANH_TOAN':
      return tBookings('statusPendingPayment');
    case 'THAT_BAI':
      return tBookings('statusFailed');
    case 'DA_HUY':
      return tBookings('statusCancelled');
    default:
      return status;
  }
}

export function CustomerTransactionsTab({
  customerId,
}: {
  customerId: number;
}) {
  const tCustomers = useTranslations('customers');
  const tBookings = useTranslations('bookings');
  const tCommon = useTranslations('common');
  const {
    transactions,
    meta,
    loading,
    refreshing,
    error,
    searchInput,
    setSearchInput,
    page,
    setPage,
    sortBy,
    sortDirection,
    handleSort,
    refresh,
  } = useCustomerTransactions(customerId);

  return (
    <div
      className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"
      aria-busy={loading || refreshing}
    >
      <FilterToolbar>
        <SearchInput
          label={tCustomers('tabTransactions')}
          onChange={setSearchInput}
          placeholder={tBookings('searchPlaceholder')}
          value={searchInput}
        />
      </FilterToolbar>
      <ResourceSortControls
        label={tCustomers('sortByLabel')}
        value={sortBy}
        options={[
          { value: 'createdDate', label: tCustomers('registeredAt') },
          { value: 'totalAmount', label: tBookings('totalAmount') },
        ]}
        direction={sortDirection}
        onFieldChange={(value) =>
          handleSort(value as 'createdDate' | 'totalAmount')
        }
        onDirectionChange={() => handleSort(sortBy)}
      />

      {error && (
        <ResourceState error>
          <p>{error}</p>
          <Button onClick={refresh} type="button" variant="outline">
            {tCommon('retry')}
          </Button>
        </ResourceState>
      )}

      {!error &&
        (loading && transactions.length === 0 ? (
          <ResourceTableSkeleton resourceLabel={tCustomers('tabTransactions').toLowerCase()} />
        ) : transactions.length === 0 ? (
          <ResourceState>
            <p>
              {searchInput.trim()
                ? tCustomers('transactionsTabFilteredEmpty')
                : tCustomers('transactionsTabNoData')}
            </p>
            {searchInput && (
              <Button variant="outline" onClick={() => setSearchInput('')}>
                {tCustomers('clearSearch')}
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
                  {tCustomers('tabTransactions')}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{tBookings('colBooking')}</TableHead>
                    <TableHead
                      aria-sort={
                        sortBy === 'createdDate'
                          ? sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      scope="col"
                    >
                      <Button
                        className="-ml-3 font-semibold"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('createdDate')}
                        type="button"
                      >
                        <span>{tCustomers('registeredAt')}</span>
                        <span aria-hidden="true">
                          {sortBy === 'createdDate' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp size={14} />
                            ) : (
                              <ArrowDown size={14} />
                            )
                          ) : (
                            <ArrowUpDown size={14} />
                          )}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead
                      aria-sort={
                        sortBy === 'totalAmount'
                          ? sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      scope="col"
                    >
                      <Button
                        className="-ml-3 font-semibold"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('totalAmount')}
                        type="button"
                      >
                        <span>{tBookings('totalAmount')}</span>
                        <span aria-hidden="true">
                          {sortBy === 'totalAmount' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp size={14} />
                            ) : (
                              <ArrowDown size={14} />
                            )
                          ) : (
                            <ArrowUpDown size={14} />
                          )}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead scope="col">{tCustomers('colStatus')}</TableHead>
                    <TableHead scope="col">{tBookings('paymentTransactions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.transactionId}>
                      <TableCell>
                        <span className="admin-data-mono text-xs text-muted-foreground">
                          {tx.code}
                        </span>
                      </TableCell>
                      <TableCell>{formatDateTime(tx.createdDate)}</TableCell>
                      <TableCell>
                        <strong>
                          {tx.totalAmount.toLocaleString('vi-VN')} ₫
                        </strong>
                      </TableCell>
                      <TableCell>
                        <ResourceStatusBadge tone={statusTone(tx.status)}>
                          {formatStatus(tx.status, tBookings)}
                        </ResourceStatusBadge>
                      </TableCell>
                      <TableCell>{renderLinkedDoc(tx, tBookings, tCustomers)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div
              className="grid gap-4 p-4 min-[901px]:hidden"
              aria-label={tCustomers('tabTransactions')}
              aria-busy={loading || refreshing}
            >
              {transactions.map((tx) => (
                <Card key={tx.transactionId} className="gap-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="admin-data-mono text-xs text-muted-foreground">
                        {tx.code}
                      </span>
                      <h3 className="mt-1 text-base font-semibold">
                        {tx.totalAmount.toLocaleString('vi-VN')} ₫
                      </h3>
                    </div>
                    <ResourceStatusBadge tone={statusTone(tx.status)}>
                      {formatStatus(tx.status, tBookings)}
                    </ResourceStatusBadge>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>{tCustomers('registeredAt')}</dt>
                      <dd>{formatDateTime(tx.createdDate)}</dd>
                    </div>
                    <div>
                      <dt>{tBookings('paymentTransactions')}</dt>
                      <dd>{renderLinkedDoc(tx, tBookings, tCustomers)}</dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>

            {
              <ResourcePagination
                currentPage={page}
                disabled={loading}
                onPageChange={setPage}
                pageSize={meta.pageSize}
                summaryLabel={tCustomers('tabTransactions').toLowerCase()}
                totalItems={meta.totalItems}
                totalPages={meta.totalPages}
              />
            }
          </>
        ))}
    </div>
  );
}
