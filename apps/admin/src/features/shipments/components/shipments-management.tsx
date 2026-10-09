'use client';

import { useState } from 'react';
import { AdminDetailAction } from '@/components/admin/admin-detail-action';
import { AdminRefreshAction } from '@/components/admin/admin-page-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useShipments } from '../hooks/use-shipments';
import type { ShipmentStatus } from '../types/shipment';
import {
  formatCurrency,
  formatDateTime,
  getShipmentStatusTone,
  SHIPMENT_STATUS_LABELS,
  ShipmentDetails,
} from './shipment-details';
import '../shipments.css';

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
    page,
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
      <div className="admin-page-content">
        <AdminPageHeader
          actions={<AdminRefreshAction loading={refreshing} onClick={refresh} />}
          eyebrow="QUẢN LÝ GỬI HÀNG"
          title="Danh sách phiếu gửi hàng"
          titleId="shipments-page-title"
        />

        <section
          className="shipments-section"
          aria-labelledby="shipments-table-heading"
        >
          <h2 id="shipments-table-heading" className="sr-only">
            Bảng danh sách phiếu gửi hàng
          </h2>

          <div className="panel admin-resource-panel">
            <FilterToolbar
              totalItems={error ? null : loading ? null : meta.totalItems}
            >
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
              <div className="shipments-state-panel" role="alert">
                <p>{error}</p>
                <Button onClick={refresh} type="button" variant="secondary">
                  Thử lại
                </Button>
              </div>
            )}

            {loading && shipments.length === 0 ? (
              <AdminTableSkeleton resourceLabel="phiếu gửi hàng" />
            ) : shipments.length === 0 ? (
              <div className="shipments-state-panel">
                <p>
                  {isFiltered
                    ? 'Không tìm thấy phiếu gửi hàng phù hợp với bộ lọc.'
                    : 'Chưa có phiếu gửi hàng nào trong hệ thống nhà xe.'}
                </p>
                {isFiltered && (
                  <Button onClick={resetFilters} type="button" variant="secondary">
                    Đặt lại bộ lọc
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div
                  className="admin-resource-table-wrap"
                  aria-busy={loading || refreshing}
                >
                  <table className="admin-resource-table">
                    <caption className="sr-only">
                      Danh sách phiếu gửi hàng
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Mã vận đơn</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Ngày gửi</th>
                        <th scope="col">Người gửi</th>
                        <th scope="col">Người nhận</th>
                        <th scope="col">Chuyến xe</th>
                        <th scope="col">Lộ trình</th>
                        <th scope="col" className="text-right">
                          Tổng cước
                        </th>
                        <th scope="col">
                          <span className="sr-only">Thao tác</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipments.map((shipment) => (
                        <tr key={shipment.shipmentId}>
                          <td>
                            <span className="shipments-waybill-code admin-data-mono">
                              {shipment.waybillCode}
                            </span>
                          </td>
                          <td>
                            <AdminStatusBadge
                              tone={getShipmentStatusTone(shipment.status)}
                            >
                              {SHIPMENT_STATUS_LABELS[shipment.status] ??
                                shipment.status}
                            </AdminStatusBadge>
                          </td>
                          <td>{formatDateTime(shipment.sentAt)}</td>
                          <td>
                            <div>
                              <strong>{shipment.sender.fullName}</strong>
                              <br />
                              <span className="shipments-phone admin-data-mono">
                                {shipment.sender.phoneNumber}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div>
                              <strong>{shipment.receiver.fullName}</strong>
                              <br />
                              <span className="shipments-phone admin-data-mono">
                                {shipment.receiver.phoneNumber}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="admin-data-mono">
                              {shipment.trip.code}
                            </span>
                            <br />
                            <small className="shipments-trip-time">
                              {shipment.trip.departureTime} ·{' '}
                              {shipment.trip.departureDate}
                            </small>
                          </td>
                          <td>
                            <span className="shipments-route-point">
                              {shipment.originPoint.name}
                            </span>
                            <span
                              className="shipments-route-arrow"
                              aria-hidden="true"
                            >
                              {' → '}
                            </span>
                            <span className="shipments-route-point">
                              {shipment.destinationPoint.name}
                            </span>
                          </td>
                          <td className="text-right">
                            <strong>
                              {formatCurrency(shipment.totalFee)}
                            </strong>
                          </td>
                          <td>
                            <AdminDetailAction
                              resourceName={`phiếu gửi ${shipment.waybillCode}`}
                              onClick={() =>
                                setSelectedShipmentId(shipment.shipmentId)
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Fallback */}
                <div
                  className="shipments-mobile-list"
                  aria-label="Danh sách phiếu gửi hàng dạng thẻ"
                  aria-busy={loading || refreshing}
                >
                  {shipments.map((shipment) => (
                    <article
                      key={shipment.shipmentId}
                      className="shipments-mobile-card"
                    >
                      <div className="shipments-mobile-card-header">
                        <div>
                          <span className="shipments-waybill-code admin-data-mono">
                            {shipment.waybillCode}
                          </span>
                          <p className="shipments-mobile-date">
                            {formatDateTime(shipment.sentAt)}
                          </p>
                        </div>
                        <AdminStatusBadge
                          tone={getShipmentStatusTone(shipment.status)}
                        >
                          {SHIPMENT_STATUS_LABELS[shipment.status] ??
                            shipment.status}
                        </AdminStatusBadge>
                      </div>

                      <dl className="shipments-mobile-fields">
                        <div>
                          <dt>Người gửi</dt>
                          <dd>
                            {shipment.sender.fullName} (
                            <span className="admin-data-mono">
                              {shipment.sender.phoneNumber}
                            </span>
                            )
                          </dd>
                        </div>
                        <div>
                          <dt>Người nhận</dt>
                          <dd>
                            {shipment.receiver.fullName} (
                            <span className="admin-data-mono">
                              {shipment.receiver.phoneNumber}
                            </span>
                            )
                          </dd>
                        </div>
                        <div>
                          <dt>Chuyến xe</dt>
                          <dd className="admin-data-mono">
                            {shipment.trip.code}
                          </dd>
                        </div>
                        <div>
                          <dt>Lộ trình</dt>
                          <dd>
                            {shipment.originPoint.name} →{' '}
                            {shipment.destinationPoint.name}
                          </dd>
                        </div>
                        <div>
                          <dt>Tổng cước</dt>
                          <dd>
                            <strong>{formatCurrency(shipment.totalFee)}</strong>
                          </dd>
                        </div>
                      </dl>

                      <div className="shipments-mobile-actions">
                        <AdminDetailAction
                          resourceName={`phiếu gửi ${shipment.waybillCode}`}
                          onClick={() =>
                            setSelectedShipmentId(shipment.shipmentId)
                          }
                        />
                      </div>
                    </article>
                  ))}
                </div>

                <AdminPagination
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
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}
