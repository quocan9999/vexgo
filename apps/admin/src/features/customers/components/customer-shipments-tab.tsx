'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
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
import { useCustomerShipments } from '../hooks/use-customer-shipments';

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
    <div
      className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"
      aria-busy={loading || refreshing}
    >
      <FilterToolbar>
        <SearchInput
          label="Tìm kiếm đơn gửi hàng"
          onChange={setSearchInput}
          placeholder="Tìm theo mã vận đơn, tên, số điện thoại người nhận..."
          value={searchInput}
        />
      </FilterToolbar>
      <ResourceSortControls
        label="Sắp xếp đơn gửi hàng"
        value="sentAt"
        options={[{ value: 'sentAt', label: 'Ngày gửi' }]}
        direction={sortDirection}
        onDirectionChange={() =>
          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        }
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
        (loading && shipments.length === 0 ? (
          <ResourceTableSkeleton resourceLabel="đơn gửi hàng" />
        ) : shipments.length === 0 ? (
          <ResourceState>
            <p>
              {searchInput.trim()
                ? 'Không tìm thấy đơn gửi hàng phù hợp.'
                : 'Khách hàng chưa có đơn gửi hàng tại nhà xe này.'}
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
                  Lịch sử gửi hàng của khách hàng
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Mã vận đơn</TableHead>
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
                        <span>Ngày gửi</span>
                        <span aria-hidden="true">
                          {sortDirection === 'asc' ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          )}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead scope="col">Người nhận</TableHead>
                    <TableHead scope="col">Điểm gửi</TableHead>
                    <TableHead scope="col">Điểm nhận</TableHead>
                    <TableHead scope="col">Tổng phí</TableHead>
                    <TableHead scope="col">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((s) => (
                    <TableRow key={s.shipmentId}>
                      <TableCell>
                        <span className="admin-data-mono text-xs text-muted-foreground">
                          {s.waybillCode}
                        </span>
                      </TableCell>
                      <TableCell>{formatDateTime(s.sentAt)}</TableCell>
                      <TableCell>
                        <strong>{s.receiver.fullName}</strong>
                        <div className="text-xs text-muted-foreground">
                          {s.receiver.phoneNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        <strong>{s.originPoint.name}</strong>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {s.originPoint.address}
                        </div>
                      </TableCell>
                      <TableCell>
                        <strong>{s.destinationPoint.name}</strong>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {s.destinationPoint.address}
                        </div>
                      </TableCell>
                      <TableCell>
                        <strong>{s.totalFee.toLocaleString('vi-VN')} đ</strong>
                      </TableCell>
                      <TableCell>
                        <ResourceStatusBadge
                          tone={shipmentStatusTone(s.status)}
                        >
                          {formatShipmentStatus(s.status)}
                        </ResourceStatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div
              className="grid gap-4 p-4 min-[901px]:hidden"
              aria-label="Danh sách đơn gửi hàng dạng thẻ"
              aria-busy={loading || refreshing}
            >
              {shipments.map((s) => (
                <Card key={s.shipmentId} className="gap-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="admin-data-mono text-xs text-muted-foreground">
                        {s.waybillCode}
                      </span>
                      <h3 className="mt-1 text-base font-semibold">
                        {s.totalFee.toLocaleString('vi-VN')} đ
                      </h3>
                    </div>
                    <ResourceStatusBadge tone={shipmentStatusTone(s.status)}>
                      {formatShipmentStatus(s.status)}
                    </ResourceStatusBadge>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
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
                        <div className="mt-1 text-xs text-muted-foreground">
                          {s.originPoint.address}
                        </div>
                      </dd>
                    </div>
                    <div>
                      <dt>Điểm nhận</dt>
                      <dd>
                        <strong>{s.destinationPoint.name}</strong>
                        <div className="mt-1 text-xs text-muted-foreground">
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
                </Card>
              ))}
            </div>

            {
              <ResourcePagination
                currentPage={page}
                disabled={loading}
                onPageChange={setPage}
                pageSize={meta.pageSize}
                summaryLabel="đơn gửi hàng"
                totalItems={meta.totalItems}
                totalPages={meta.totalPages}
              />
            }
          </>
        ))}
    </div>
  );
}
