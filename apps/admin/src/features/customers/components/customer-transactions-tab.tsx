'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
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

function renderLinkedDoc(tx: {
  booking: { code: string } | null;
  shipment: { code: string } | null;
}) {
  if (tx.booking) {
    return (
      <span>
        Đặt vé: <strong className="admin-data-mono">{tx.booking.code}</strong>
      </span>
    );
  }
  if (tx.shipment) {
    return (
      <span>
        Gửi hàng:{' '}
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

function formatStatus(status: string): string {
  switch (status) {
    case 'DA_THANH_TOAN':
      return 'Đã thanh toán';
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
    <div
      className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"
      aria-busy={loading || refreshing}
    >
      <FilterToolbar>
        <SearchInput
          label="Tìm kiếm giao dịch"
          onChange={setSearchInput}
          placeholder="Tìm theo mã đơn giao dịch..."
          value={searchInput}
        />
      </FilterToolbar>
      <ResourceSortControls
        label="Sắp xếp giao dịch"
        value={sortBy}
        options={[
          { value: 'createdDate', label: 'Ngày tạo' },
          { value: 'totalAmount', label: 'Tổng tiền' },
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
            Thử lại
          </Button>
        </ResourceState>
      )}

      {!error &&
        (loading && transactions.length === 0 ? (
          <ResourceTableSkeleton resourceLabel="giao dịch" />
        ) : transactions.length === 0 ? (
          <ResourceState>
            <p>
              {searchInput.trim()
                ? 'Không tìm thấy giao dịch phù hợp.'
                : 'Chưa có giao dịch với nhà xe này.'}
            </p>
            {searchInput && (
              <Button variant="outline" onClick={() => setSearchInput('')}>
                Xóa tìm kiếm
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
                  Lịch sử giao dịch
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Mã giao dịch</TableHead>
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
                      </Button>
                    </TableHead>
                    <TableHead scope="col">Trạng thái</TableHead>
                    <TableHead scope="col">Chứng từ liên kết</TableHead>
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
                          {tx.totalAmount.toLocaleString('vi-VN')} đ
                        </strong>
                      </TableCell>
                      <TableCell>
                        <ResourceStatusBadge tone={statusTone(tx.status)}>
                          {formatStatus(tx.status)}
                        </ResourceStatusBadge>
                      </TableCell>
                      <TableCell>{renderLinkedDoc(tx)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div
              className="grid gap-4 p-4 min-[901px]:hidden"
              aria-label="Danh sách giao dịch dạng thẻ"
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
                        {tx.totalAmount.toLocaleString('vi-VN')} đ
                      </h3>
                    </div>
                    <ResourceStatusBadge tone={statusTone(tx.status)}>
                      {formatStatus(tx.status)}
                    </ResourceStatusBadge>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>Ngày tạo</dt>
                      <dd>{formatDateTime(tx.createdDate)}</dd>
                    </div>
                    <div>
                      <dt>Chứng từ liên kết</dt>
                      <dd>{renderLinkedDoc(tx)}</dd>
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
                summaryLabel="giao dịch"
                totalItems={meta.totalItems}
                totalPages={meta.totalPages}
              />
            }
          </>
        ))}
    </div>
  );
}
