'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import {
  FilterToolbar,
  SearchInput,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
import { useCustomerTickets } from '../hooks/use-customer-tickets';

function formatDeparture(dateStr: string, timeStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  const formattedDate =
    parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  const formattedTime = timeStr ? timeStr.slice(0, 5) : '';
  return formattedTime ? `${formattedTime} - ${formattedDate}` : formattedDate;
}

function ticketStatusTone(status: string): 'active' | 'muted' {
  if (
    status === 'DA_XUAT' ||
    status === 'HOAN_TAT' ||
    status === 'DA_SU_DUNG' ||
    status === 'DA_DAT'
  ) {
    return 'active';
  }
  return 'muted';
}

function formatTicketStatus(status: string): string {
  switch (status) {
    case 'DA_XUAT':
      return 'Đã xuất vé';
    case 'HOAN_TAT':
      return 'Hoàn tất';
    case 'DA_DAT':
      return 'Đã đặt';
    case 'DA_SU_DUNG':
      return 'Đã sử dụng';
    case 'DA_HUY':
      return 'Đã hủy';
    case 'CHO_THANH_TOAN':
      return 'Chờ thanh toán';
    case 'GIU_CHO':
      return 'Đang giữ chỗ';
    default:
      return status;
  }
}

export function CustomerTicketsTab({ customerId }: { customerId: number }) {
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
    <div className="panel admin-resource-panel">
      <FilterToolbar
        totalItems={
          error
            ? null
            : loading && tickets.length === 0
              ? null
              : meta.totalItems
        }
      >
        <SearchInput
          label="Tìm kiếm vé"
          onChange={setSearchInput}
          placeholder="Tìm theo mã vé, mã đặt vé, mã chuyến..."
          value={searchInput}
        />
      </FilterToolbar>

      {error && (
        <div className="customers-state-panel" role="alert">
          <p>{error}</p>
          <Button onClick={refresh} type="button" variant="secondary">
            Thử lại
          </Button>
        </div>
      )}

      {loading && tickets.length === 0 ? (
        <AdminTableSkeleton resourceLabel="vé" />
      ) : tickets.length === 0 ? (
        <div className="customers-state-panel">
          <p>Khách hàng chưa có vé tại nhà xe này.</p>
        </div>
      ) : (
        <>
          <div
            className="admin-resource-table-wrap"
            aria-busy={loading || refreshing}
          >
            <table className="admin-resource-table">
              <caption className="sr-only">Lịch sử vé của khách hàng</caption>
              <thead>
                <tr>
                  <th scope="col">Mã vé</th>
                  <th scope="col">Mã đặt vé</th>
                  <th scope="col">Tuyến đường</th>
                  <th scope="col">Chuyến xe</th>
                  <th
                    aria-sort={
                      sortDirection === 'asc' ? 'ascending' : 'descending'
                    }
                    scope="col"
                  >
                    <button
                      className="admin-resource-sort-button"
                      onClick={() =>
                        setSortDirection(
                          sortDirection === 'asc' ? 'desc' : 'asc',
                        )
                      }
                      type="button"
                    >
                      <span>Khởi hành</span>
                      <span aria-hidden="true">
                        {sortDirection === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )}
                      </span>
                    </button>
                  </th>
                  <th scope="col">Ghế</th>
                  <th scope="col">Giá thực tế</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.ticketId}>
                    <td>
                      <span className="customer-code">{ticket.ticketCode}</span>
                    </td>
                    <td>
                      <strong>{ticket.booking.code}</strong>
                    </td>
                    <td>
                      <span className="ticket-route-text">
                        {ticket.trip.route.origin} → {ticket.trip.route.destination}
                      </span>
                    </td>
                    <td>
                      <span className="customer-code">{ticket.trip.code}</span>
                    </td>
                    <td>
                      {formatDeparture(
                        ticket.trip.departureDate,
                        ticket.trip.departureTime,
                      )}
                    </td>
                    <td>
                      <strong>{ticket.seat.code}</strong>
                      {ticket.seat.position && (
                        <span className="ticket-seat-pos">
                          {' '}
                          ({ticket.seat.position})
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>
                        {ticket.actualPrice.toLocaleString('vi-VN')} đ
                      </strong>
                    </td>
                    <td>
                      <AdminStatusBadge tone={ticketStatusTone(ticket.status)}>
                        {formatTicketStatus(ticket.status)}
                      </AdminStatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="customers-mobile-list"
            aria-label="Danh sách vé dạng thẻ"
            aria-busy={loading || refreshing}
          >
            {tickets.map((ticket) => (
              <article key={ticket.ticketId} className="customers-mobile-card">
                <div className="customers-mobile-card-header">
                  <div>
                    <span className="customer-code">{ticket.ticketCode}</span>
                    <h3 className="customers-mobile-card-title">
                      {ticket.actualPrice.toLocaleString('vi-VN')} đ
                    </h3>
                  </div>
                  <AdminStatusBadge tone={ticketStatusTone(ticket.status)}>
                    {formatTicketStatus(ticket.status)}
                  </AdminStatusBadge>
                </div>
                <dl className="customers-mobile-fields">
                  <div>
                    <dt>Tuyến đường</dt>
                    <dd>
                      {ticket.trip.route.origin} → {ticket.trip.route.destination}
                    </dd>
                  </div>
                  <div>
                    <dt>Chuyến / Xe</dt>
                    <dd>
                      {ticket.trip.code} ({ticket.trip.vehicle.licensePlate})
                    </dd>
                  </div>
                  <div>
                    <dt>Khởi hành</dt>
                    <dd>
                      {formatDeparture(
                        ticket.trip.departureDate,
                        ticket.trip.departureTime,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Ghế ngồi</dt>
                    <dd>
                      {ticket.seat.code}
                      {ticket.seat.position ? ` (${ticket.seat.position})` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Mã đặt vé</dt>
                    <dd>{ticket.booking.code}</dd>
                  </div>
                  <div>
                    <dt>Giá niêm yết</dt>
                    <dd>{ticket.listedPrice.toLocaleString('vi-VN')} đ</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          {meta.totalPages > 1 && (
            <AdminPagination
              currentPage={page}
              disabled={loading}
              onPageChange={setPage}
              pageSize={meta.pageSize}
              summaryLabel="vé"
              totalItems={meta.totalItems}
              totalPages={meta.totalPages}
            />
          )}
        </>
      )}
    </div>
  );
}
