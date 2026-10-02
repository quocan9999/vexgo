'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import {
  FilterToolbar,
  SearchInput,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
import { useCustomerTransactions } from '../hooks/use-customer-transactions';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function renderLinkedDoc(tx: {
  booking: { code: string } | null;
  shipment: { code: string } | null;
}) {
  if (tx.booking) {
    return (
      <span>
        Đặt vé: <strong>{tx.booking.code}</strong>
      </span>
    );
  }
  if (tx.shipment) {
    return (
      <span>
        Gửi hàng: <strong>{tx.shipment.code}</strong>
      </span>
    );
  }
  return '—';
}

function statusTone(status: string): 'active' | 'muted' {
  if (status === 'THANH_CONG' || status === 'HOAN_TAT') return 'active';
  return 'muted';
}

function formatStatus(status: string): string {
  switch (status) {
    case 'THANH_CONG':
      return 'Thành công';
    case 'CHO_THANH_TOAN':
      return 'Chờ thanh toán';
    case 'THAT_BAI':
      return 'Thất bại';
    case 'DA_HUY':
      return 'Đã hủy';
    default:
      return status;
  }
}

export function CustomerTransactionsTab({
  customerId,
}: {
  customerId: number;
}) {
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
    <div className="panel admin-resource-panel">
      <FilterToolbar
        totalItems={
          error
            ? null
            : loading && transactions.length === 0
              ? null
              : meta.totalItems
        }
      >
        <SearchInput
          label="Tìm kiếm giao dịch"
          onChange={setSearchInput}
          placeholder="Tìm theo mã đơn giao dịch..."
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

      {loading && transactions.length === 0 ? (
        <AdminTableSkeleton resourceLabel="giao dịch" />
      ) : transactions.length === 0 ? (
        <div className="customers-state-panel">
          <p>Chưa có giao dịch với nhà xe này.</p>
        </div>
      ) : (
        <>
          <div
            className="admin-resource-table-wrap"
            aria-busy={loading || refreshing}
          >
            <table className="admin-resource-table">
              <caption className="sr-only">Lịch sử giao dịch</caption>
              <thead>
                <tr>
                  <th scope="col">Mã giao dịch</th>
                  <th
                    aria-sort={
                      sortBy === 'createdDate'
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    scope="col"
                  >
                    <button
                      className="admin-resource-sort-button"
                      onClick={() => handleSort('createdDate')}
                      type="button"
                    >
                      <span>Ngày tạo</span>
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
                    </button>
                  </th>
                  <th
                    aria-sort={
                      sortBy === 'totalAmount'
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    scope="col"
                  >
                    <button
                      className="admin-resource-sort-button"
                      onClick={() => handleSort('totalAmount')}
                      type="button"
                    >
                      <span>Tổng tiền</span>
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
                    </button>
                  </th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Chứng từ liên kết</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.transactionId}>
                    <td>
                      <span className="customer-code">{tx.code}</span>
                    </td>
                    <td>{formatDateTime(tx.createdDate)}</td>
                    <td>
                      <strong>
                        {tx.totalAmount.toLocaleString('vi-VN')} đ
                      </strong>
                    </td>
                    <td>
                      <AdminStatusBadge tone={statusTone(tx.status)}>
                        {formatStatus(tx.status)}
                      </AdminStatusBadge>
                    </td>
                    <td>{renderLinkedDoc(tx)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="customers-mobile-list"
            aria-label="Danh sách giao dịch dạng thẻ"
            aria-busy={loading || refreshing}
          >
            {transactions.map((tx) => (
              <article key={tx.transactionId} className="customers-mobile-card">
                <div className="customers-mobile-card-header">
                  <div>
                    <span className="customer-code">{tx.code}</span>
                    <h3 className="customers-mobile-card-title">
                      {tx.totalAmount.toLocaleString('vi-VN')} đ
                    </h3>
                  </div>
                  <AdminStatusBadge tone={statusTone(tx.status)}>
                    {formatStatus(tx.status)}
                  </AdminStatusBadge>
                </div>
                <dl className="customers-mobile-fields">
                  <div>
                    <dt>Ngày tạo</dt>
                    <dd>{formatDateTime(tx.createdDate)}</dd>
                  </div>
                  <div>
                    <dt>Chứng từ liên kết</dt>
                    <dd>{renderLinkedDoc(tx)}</dd>
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
              summaryLabel="giao dịch"
              totalItems={meta.totalItems}
              totalPages={meta.totalPages}
            />
          )}
        </>
      )}
    </div>
  );
}
