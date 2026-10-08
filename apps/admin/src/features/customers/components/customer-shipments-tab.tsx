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
import { useCustomerShipments } from '../hooks/use-customer-shipments';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function shipmentStatusTone(status: string): 'active' | 'muted' {
  if (
    status === 'DA_TIEP_NHAN' ||
    status === 'DANG_VAN_CHUYEN' ||
    status === 'DA_GIAO'
  ) {
    return 'active';
  }
  return 'muted';
}

function formatShipmentStatus(status: string): string {
  switch (status) {
    case 'MOI_TAO':
      return 'Mới tạo';
    case 'DA_TIEP_NHAN':
      return 'Đã tiếp nhận';
    case 'DANG_VAN_CHUYEN':
      return 'Đang vận chuyển';
    case 'DA_GIAO':
      return 'Đã giao hàng';
    case 'DA_HUY':
      return 'Đã hủy';
    default:
      return status;
  }
}

export function CustomerShipmentsTab({ customerId }: { customerId: number }) {
  const {
    shipments,
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
  } = useCustomerShipments(customerId);

  return (
    <div className="panel admin-resource-panel">
      <FilterToolbar
        totalItems={
          error
            ? null
            : loading && shipments.length === 0
              ? null
              : meta.totalItems
        }
      >
        <SearchInput
          label="Tìm kiếm đơn gửi hàng"
          onChange={setSearchInput}
          placeholder="Tìm theo mã vận đơn, tên, số điện thoại người nhận..."
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

      {loading && shipments.length === 0 ? (
        <AdminTableSkeleton resourceLabel="đơn gửi hàng" />
      ) : shipments.length === 0 ? (
        <div className="customers-state-panel">
          <p>Khách hàng chưa có đơn gửi hàng tại nhà xe này.</p>
        </div>
      ) : (
        <>
          <div
            className="admin-resource-table-wrap"
            aria-busy={loading || refreshing}
          >
            <table className="admin-resource-table">
              <caption className="sr-only">
                Lịch sử gửi hàng của khách hàng
              </caption>
              <thead>
                <tr>
                  <th scope="col">Mã vận đơn</th>
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
                      <span>Ngày gửi</span>
                      <span aria-hidden="true">
                        {sortDirection === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )}
                      </span>
                    </button>
                  </th>
                  <th scope="col">Người nhận</th>
                  <th scope="col">Điểm gửi</th>
                  <th scope="col">Điểm nhận</th>
                  <th scope="col">Tổng phí</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.shipmentId}>
                    <td>
                      <span className="customer-code admin-data-mono">
                        {s.waybillCode}
                      </span>
                    </td>
                    <td>{formatDateTime(s.sentAt)}</td>
                    <td>
                      <strong>{s.receiver.fullName}</strong>
                      <div className="customer-code">
                        {s.receiver.phoneNumber}
                      </div>
                    </td>
                    <td>
                      <strong>{s.originPoint.name}</strong>
                      <div className="ticket-seat-pos">
                        {s.originPoint.address}
                      </div>
                    </td>
                    <td>
                      <strong>{s.destinationPoint.name}</strong>
                      <div className="ticket-seat-pos">
                        {s.destinationPoint.address}
                      </div>
                    </td>
                    <td>
                      <strong>{s.totalFee.toLocaleString('vi-VN')} đ</strong>
                    </td>
                    <td>
                      <AdminStatusBadge tone={shipmentStatusTone(s.status)}>
                        {formatShipmentStatus(s.status)}
                      </AdminStatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="customers-mobile-list"
            aria-label="Danh sách đơn gửi hàng dạng thẻ"
            aria-busy={loading || refreshing}
          >
            {shipments.map((s) => (
              <article key={s.shipmentId} className="customers-mobile-card">
                <div className="customers-mobile-card-header">
                  <div>
                    <span className="customer-code admin-data-mono">
                      {s.waybillCode}
                    </span>
                    <h3 className="customers-mobile-card-title">
                      {s.totalFee.toLocaleString('vi-VN')} đ
                    </h3>
                  </div>
                  <AdminStatusBadge tone={shipmentStatusTone(s.status)}>
                    {formatShipmentStatus(s.status)}
                  </AdminStatusBadge>
                </div>
                <dl className="customers-mobile-fields">
                  <div>
                    <dt>Người nhận</dt>
                    <dd>
                      {s.receiver.fullName} ({s.receiver.phoneNumber})
                    </dd>
                  </div>
                  <div>
                    <dt>Ngày gửi</dt>
                    <dd>{formatDateTime(s.sentAt)}</dd>
                  </div>
                  <div>
                    <dt>Điểm gửi</dt>
                    <dd>
                      <strong>{s.originPoint.name}</strong>
                      <div className="ticket-seat-pos">
                        {s.originPoint.address}
                      </div>
                    </dd>
                  </div>
                  <div>
                    <dt>Điểm nhận</dt>
                    <dd>
                      <strong>{s.destinationPoint.name}</strong>
                      <div className="ticket-seat-pos">
                        {s.destinationPoint.address}
                      </div>
                    </dd>
                  </div>
                  <div>
                    <dt>Người thanh toán</dt>
                    <dd>
                      {s.freightPayer === 'NGUOI_GUI'
                        ? 'Người gửi thanh toán'
                        : 'Người nhận thanh toán'}
                    </dd>
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
              summaryLabel="đơn gửi hàng"
              totalItems={meta.totalItems}
              totalPages={meta.totalPages}
            />
          )}
        </>
      )}
    </div>
  );
}
