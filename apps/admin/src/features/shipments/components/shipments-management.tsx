'use client';

import { useState } from 'react';
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
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useShipments } from '../hooks/use-shipments';
import type { ShipmentStatus } from '../types/shipment';
import {
  formatDateTime,
  getShipmentStatusTone,
  SHIPMENT_STATUS_LABELS,
  ShipmentDetails,
} from './shipment-details';

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { value: 'MOI_TAO', label: 'Mới tạo' },
  { value: 'DA_TIEP_NHAN', label: 'Đã tiếp nhận' },
  { value: 'DANG_VAN_CHUYEN', label: 'Đang vận chuyển' },
  { value: 'DA_GIAO', label: 'Đã giao' },
  { value: 'DA_HUY', label: 'Đã hủy' },
];

export function ShipmentsManagement() {
  const {
    shipments,
    meta,
    loading,
    refreshing,
    error,
    searchInput,
    setSearchInput,
    setPage,
    status,
    setStatus,
    refresh,
    resetFilters,
  } = useShipments();

  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(
    null,
  );

  const isFiltered = Boolean(searchInput || status);

  return (
    <SuperAdminLayout activeSection="shipments">
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <ResourceRefreshAction loading={refreshing} onClick={refresh} />
          }
          eyebrow="QUẢN LÝ GỬI HÀNG"
          title="Danh sách phiếu gửi hàng"
          titleId="shipments-page-title"
        />

        <section className="min-w-0" aria-labelledby="shipments-table-heading">
          <h2 id="shipments-table-heading" className="sr-only">
            Bảng danh sách phiếu gửi hàng
          </h2>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <FilterToolbar>
              <SearchInput
                label="Tìm kiếm phiếu gửi hàng"
                onChange={setSearchInput}
                placeholder="Tìm mã vận đơn, người gửi, người nhận..."
                value={searchInput}
              />
              <SelectFilter
                allLabel="Tất cả trạng thái"
                label="Trạng thái phiếu gửi"
                onChange={(val) => setStatus(val as ShipmentStatus | '')}
                options={STATUS_FILTER_OPTIONS}
                value={status}
              />
            </FilterToolbar>

            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={refresh} type="button" variant="outline">
                  Thử lại
                </Button>
              </ResourceState>
            )}

            {loading && shipments.length === 0 ? (
              <ResourceTableSkeleton resourceLabel="phiếu gửi hàng" />
            ) : shipments.length === 0 ? (
              error ? null : (
                <ResourceState>
                  <p>
                    {isFiltered
                      ? 'Không tìm thấy phiếu gửi hàng phù hợp với bộ lọc.'
                      : 'Chưa có phiếu gửi hàng nào trong hệ thống nhà xe.'}
                  </p>
                  {isFiltered && (
                    <Button
                      onClick={resetFilters}
                      type="button"
                      variant="outline"
                    >
                      Đặt lại bộ lọc
                    </Button>
                  )}
                </ResourceState>
              )
            ) : (
              <>
                <div
                  className="hidden min-[901px]:block"
                  aria-busy={loading || refreshing}
                >
                  <Table>
                    <caption className="sr-only">
                      Danh sách phiếu gửi hàng
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Mã vận đơn</TableHead>
                        <TableHead scope="col">Người gửi</TableHead>
                        <TableHead scope="col">Điểm gửi</TableHead>
                        <TableHead scope="col">Điểm nhận</TableHead>
                        <TableHead scope="col">Trạng thái</TableHead>
                        <TableHead scope="col">Ngày gửi</TableHead>
                        <TableHead scope="col">
                          <span className="sr-only">Thao tác</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shipments.map((shipment) => (
                        <TableRow key={shipment.shipmentId}>
                          <TableCell>
                            <span className="admin-data-mono break-all text-[13px] font-semibold">
                              {shipment.waybillCode}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <strong>{shipment.sender.fullName}</strong>
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {shipment.sender.phoneNumber}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="block max-w-40 whitespace-normal">
                              {shipment.originPoint.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="block max-w-40 whitespace-normal">
                              {shipment.destinationPoint.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <ResourceStatusBadge
                              tone={getShipmentStatusTone(shipment.status)}
                            >
                              {SHIPMENT_STATUS_LABELS[shipment.status] ??
                                shipment.status}
                            </ResourceStatusBadge>
                          </TableCell>
                          <TableCell>
                            {formatDateTime(shipment.sentAt)}
                          </TableCell>
                          <TableCell>
                            <ResourceDetailAction
                              resourceName={`phiếu gửi ${shipment.waybillCode}`}
                              onClick={() =>
                                setSelectedShipmentId(shipment.shipmentId)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card Fallback */}
                <div
                  className="grid gap-4 p-4 min-[901px]:hidden"
                  aria-label="Danh sách phiếu gửi hàng dạng thẻ"
                  aria-busy={loading || refreshing}
                >
                  {shipments.map((shipment) => (
                    <Card key={shipment.shipmentId} className="gap-4 p-4">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 [&>div]:min-w-0">
                        <div>
                          <span className="admin-data-mono break-all text-[13px] font-semibold">
                            {shipment.waybillCode}
                          </span>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatDateTime(shipment.sentAt)}
                          </p>
                        </div>
                        <ResourceStatusBadge
                          tone={getShipmentStatusTone(shipment.status)}
                        >
                          {SHIPMENT_STATUS_LABELS[shipment.status] ??
                            shipment.status}
                        </ResourceStatusBadge>
                      </div>

                      <dl className="grid gap-3 text-[13px] [&>div]:grid [&>div]:grid-cols-[90px_minmax(0,1fr)] [&>div]:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                        <div>
                          <dt>Người gửi</dt>
                          <dd>
                            {shipment.sender.fullName} (
                            <span>{shipment.sender.phoneNumber}</span>)
                          </dd>
                        </div>
                        <div>
                          <dt>Điểm gửi</dt>
                          <dd>{shipment.originPoint.name}</dd>
                        </div>
                        <div>
                          <dt>Điểm nhận</dt>
                          <dd>{shipment.destinationPoint.name}</dd>
                        </div>
                      </dl>

                      <div className="flex justify-end border-t pt-3">
                        <ResourceDetailAction
                          resourceName={`phiếu gửi ${shipment.waybillCode}`}
                          onClick={() =>
                            setSelectedShipmentId(shipment.shipmentId)
                          }
                        />
                      </div>
                    </Card>
                  ))}
                </div>

                <ResourcePagination
                  currentPage={meta.page}
                  disabled={loading || refreshing}
                  onPageChange={setPage}
                  pageSize={meta.pageSize}
                  summaryLabel="phiếu gửi hàng"
                  totalItems={meta.totalItems}
                  totalPages={meta.totalPages}
                />
              </>
            )}
          </div>
        </section>

        {selectedShipmentId !== null && (
          <ShipmentDetails
            shipmentId={selectedShipmentId}
            onClose={() => setSelectedShipmentId(null)}
            onStatusUpdated={refresh}
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}
