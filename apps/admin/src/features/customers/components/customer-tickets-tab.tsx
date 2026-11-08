'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
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
import { useCustomerTickets } from '../hooks/use-customer-tickets';

function formatDeparture(dateStr: string, timeStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  const formattedDate =
    parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
  const formattedTime = timeStr ? timeStr.slice(0, 5) : '';
  return formattedTime ? `${formattedTime} - ${formattedDate}` : formattedDate;
}

function ticketStatusTone(status: string): 'active' | 'muted' {
  if (
    status === 'DA_THANH_TOAN' ||
    status === 'DA_XUAT' ||
    status === 'HOAN_TAT' ||
    status === 'DA_SU_DUNG' ||
    status === 'DA_DAT'
  ) {
    return 'active';
  }
  return 'muted';
}

function formatTicketStatus(
  status: string,
  tBookings: (key: string) => string,
): string {
  switch (status) {
    case 'DA_THANH_TOAN':
      return tBookings('ticketStatusPaid');
    case 'DA_XUAT':
      return tBookings('statusPaid');
    case 'HOAN_TAT':
      return tBookings('completed');
    case 'DA_DAT':
      return tBookings('reserved');
    case 'DA_SU_DUNG':
      return tBookings('statusPaid');
    case 'DA_HUY':
      return tBookings('cancelled');
    case 'CHO_THANH_TOAN':
      return tBookings('unpaid');
    case 'GIU_CHO':
      return tBookings('reserved');
    default:
      return status;
  }
}

export function CustomerTicketsTab({ customerId }: { customerId: number }) {
  const tCustomers = useTranslations('customers');
  const tBookings = useTranslations('bookings');
  const tCommon = useTranslations('common');
  const {
    tickets,
    meta,
    loading,
    refreshing,
    error,
    searchInput,
    setSearchInput,
    page,
    setPage,
    sortDirection,
    setSortDirection,
    refresh,
  } = useCustomerTickets(customerId);

  return (
    <div
      className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"
      aria-busy={loading || refreshing}
    >
      <FilterToolbar>
        <SearchInput
          label={tBookings('tabTickets')}
          onChange={setSearchInput}
          placeholder={tCustomers('ticketsTabSearchPlaceholder')}
          value={searchInput}
        />
      </FilterToolbar>
      <ResourceSortControls
        label={tCustomers('sortByLabel')}
        value="departureDate"
        options={[{ value: 'departureDate', label: tBookings('departureDateLabel') }]}
        direction={sortDirection}
        onDirectionChange={() =>
          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        }
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
        (loading && tickets.length === 0 ? (
          <ResourceTableSkeleton resourceLabel={tBookings('tabTickets').toLowerCase()} />
        ) : tickets.length === 0 ? (
          <ResourceState>
            <p>
              {searchInput.trim()
                ? tCustomers('ticketsTabFilteredEmpty')
                : tCustomers('ticketsTabNoData')}
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
                  {tBookings('tabTickets')}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{tBookings('ticketCode')}</TableHead>
                    <TableHead scope="col">{tBookings('bookingCode')}</TableHead>
                    <TableHead scope="col">{tBookings('colTrip')}</TableHead>
                    <TableHead scope="col">{tBookings('tripCode')}</TableHead>
                    <TableHead
                      aria-sort={
                        sortDirection === 'asc' ? 'ascending' : 'descending'
                      }
                      scope="col"
                    >
                      <Button
                        className="-ml-3 font-semibold"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSortDirection(
                            sortDirection === 'asc' ? 'desc' : 'asc',
                          )
                        }
                        type="button"
                      >
                        <span>{tBookings('departureDateLabel')}</span>
                        <span aria-hidden="true">
                          {sortDirection === 'asc' ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          )}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead scope="col">{tBookings('seatCode')}</TableHead>
                    <TableHead scope="col">{tBookings('colActualPrice')}</TableHead>
                    <TableHead scope="col">{tBookings('ticketStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.ticketId}>
                      <TableCell>
                        <span className="admin-data-mono text-xs text-muted-foreground">
                          {ticket.ticketCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <strong className="admin-data-mono">
                          {ticket.booking.code}
                        </strong>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {ticket.trip.route.origin} →{' '}
                          {ticket.trip.route.destination}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="admin-data-mono text-xs text-muted-foreground">
                          {ticket.trip.code}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatDeparture(
                          ticket.trip.departureDate,
                          ticket.trip.departureTime,
                        )}
                      </TableCell>
                      <TableCell>
                        <strong className="admin-data-mono">
                          {ticket.seat.code}
                        </strong>
                        {ticket.seat.position && (
                          <span className="mt-1 text-xs text-muted-foreground">
                            {' '}
                            ({ticket.seat.position})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <strong>
                          {ticket.actualPrice.toLocaleString('vi-VN')} ₫
                        </strong>
                      </TableCell>
                      <TableCell>
                        <ResourceStatusBadge
                          tone={ticketStatusTone(ticket.status)}
                        >
                          {formatTicketStatus(ticket.status, tBookings)}
                        </ResourceStatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div
              className="grid gap-4 p-4 min-[901px]:hidden"
              aria-label={tBookings('tabTickets')}
              aria-busy={loading || refreshing}
            >
              {tickets.map((ticket) => (
                <Card key={ticket.ticketId} className="gap-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="admin-data-mono text-xs text-muted-foreground">
                        {ticket.ticketCode}
                      </span>
                      <h3 className="mt-1 text-base font-semibold">
                        {ticket.actualPrice.toLocaleString('vi-VN')} ₫
                      </h3>
                    </div>
                    <ResourceStatusBadge tone={ticketStatusTone(ticket.status)}>
                      {formatTicketStatus(ticket.status, tBookings)}
                    </ResourceStatusBadge>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>{tBookings('colTrip')}</dt>
                      <dd>
                        {ticket.trip.route.origin} →{' '}
                        {ticket.trip.route.destination}
                      </dd>
                    </div>
                    <div>
                      <dt>{tBookings('tripCode')}</dt>
                      <dd>
                        <span className="admin-data-mono">
                          {ticket.trip.code}
                        </span>{' '}
                        (
                        <span className="admin-data-mono">
                          {ticket.trip.vehicle.licensePlate}
                        </span>
                        )
                      </dd>
                    </div>
                    <div>
                      <dt>{tBookings('departureDateLabel')}</dt>
                      <dd>
                        {formatDeparture(
                          ticket.trip.departureDate,
                          ticket.trip.departureTime,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{tBookings('seatCode')}</dt>
                      <dd>
                        <span className="admin-data-mono">
                          {ticket.seat.code}
                        </span>
                        {ticket.seat.position
                          ? ` (${ticket.seat.position})`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>{tBookings('bookingCode')}</dt>
                      <dd className="admin-data-mono">{ticket.booking.code}</dd>
                    </div>
                    <div>
                      <dt>{tBookings('colInitialAmount')}</dt>
                      <dd>{ticket.listedPrice.toLocaleString('vi-VN')} ₫</dd>
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
                summaryLabel={tBookings('tabTickets').toLowerCase()}
                totalItems={meta.totalItems}
                totalPages={meta.totalPages}
              />
            }
          </>
        ))}
    </div>
  );
}
