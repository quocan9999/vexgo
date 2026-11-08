'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScanLine } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceCreateAction,
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
import { useTranslations } from 'next-intl';
import { useShipments } from '../hooks/use-shipments';
import type { ShipmentStatus } from '../types/shipment';
import {
  formatDateTime,
  getShipmentStatusTone,
  SHIPMENT_STATUS_LABELS,
} from './shipment-details';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { ShipmentScanDialog } from './shipment-scan-dialog';

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { value: 'MOI_TAO', label: 'Chờ mang hàng đến gửi' },
  { value: 'DA_TIEP_NHAN', label: 'Đã tiếp nhận' },
  { value: 'DANG_VAN_CHUYEN', label: 'Đang vận chuyển' },
  { value: 'DA_GIAO', label: 'Đã giao' },
  { value: 'DA_HUY', label: 'Đã hủy' },
];

export function ShipmentsManagement() {
  const tShipments = useTranslations('shipments');
  const tCommon = useTranslations('common');
  const router = useRouter();
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

  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const { can } = useAdminPermissions();
  const canCreate = can('shipment:update');

  const statusOptions: FilterOption[] = [
    { value: 'MOI_TAO', label: tShipments('statusCreated') },
    { value: 'DA_TIEP_NHAN', label: tShipments('statusReceived') },
    { value: 'DANG_VAN_CHUYEN', label: tShipments('statusInTransit') },
    { value: 'DA_GIAO', label: tShipments('statusDelivered') },
    { value: 'DA_HUY', label: tShipments('statusCancelled') },
  ];

  function getShipmentStatusDisplay(shipmentStatus: ShipmentStatus): string {
    switch (shipmentStatus) {
      case 'MOI_TAO':
        return tShipments('statusCreated');
      case 'DA_TIEP_NHAN':
        return tShipments('statusReceived');
      case 'DANG_VAN_CHUYEN':
        return tShipments('statusInTransit');
      case 'DA_GIAO':
        return tShipments('statusDelivered');
      case 'DA_HUY':
        return tShipments('statusCancelled');
      default:
        return SHIPMENT_STATUS_LABELS[shipmentStatus] ?? shipmentStatus;
    }
  }

  const isFiltered = Boolean(searchInput || status);

  return (
    <SuperAdminLayout activeSection="shipments">
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <div className="flex items-center gap-2 [&>button]:min-w-[120px]">
              {canCreate && (
                <ResourceCreateAction
                  label={tShipments('createShipment')}
                  onClick={() => router.push('/shipments/create')}
                />
              )}
              <Button
                variant="outline"
                onClick={() => router.push('/shipments/rates')}
              >
                {tShipments('shipmentRates')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setScanDialogOpen(true)}
              >
                <ScanLine className="size-4" />
                {tShipments('scanCode')}
              </Button>
              <ResourceRefreshAction loading={refreshing} onClick={refresh} />
            </div>
          }
          eyebrow={tShipments('eyebrow')}
          title={tShipments('shipmentsTitle')}
          titleId="shipments-page-title"
        />

        <section className="min-w-0" aria-labelledby="shipments-table-heading">
          <h2 id="shipments-table-heading" className="sr-only">
            {tShipments('shipmentsTitle')}
          </h2>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <FilterToolbar>
              <SearchInput
                label={tShipments('searchShipments')}
                onChange={setSearchInput}
                placeholder={tShipments('searchPlaceholder')}
                value={searchInput}
              />
              <SelectFilter
                allLabel={tShipments('allStatuses')}
                label={tShipments('statusFilterLabel')}
                onChange={(val) => setStatus(val as ShipmentStatus | '')}
                options={statusOptions}
                value={status}
              />
            </FilterToolbar>

            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={refresh} type="button" variant="outline">
                  {tCommon('retry')}
                </Button>
              </ResourceState>
            )}

            {loading && shipments.length === 0 ? (
              <ResourceTableSkeleton resourceLabel={tShipments('resourceLabel')} />
            ) : shipments.length === 0 ? (
              error ? null : (
                <ResourceState>
                  <p>
                    {isFiltered
                      ? tShipments('emptyFiltered')
                      : tShipments('emptyNoData')}
                  </p>
                  {isFiltered && (
                    <Button
                      onClick={resetFilters}
                      type="button"
                      variant="outline"
                    >
                      {tShipments('resetFilters')}
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
                      {tShipments('shipmentsTitle')}
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">{tShipments('colWaybill')}</TableHead>
                        <TableHead scope="col">{tShipments('colSender')}</TableHead>
                        <TableHead scope="col">{tShipments('colRouteTrip')}</TableHead>
                        <TableHead scope="col">{tShipments('colOrigin')}</TableHead>
                        <TableHead scope="col">{tShipments('colDestination')}</TableHead>
                        <TableHead scope="col">{tShipments('colStatus')}</TableHead>
                        <TableHead scope="col">{tShipments('colDate')}</TableHead>
                        <TableHead scope="col">
                          <span className="sr-only">{tCommon('actions')}</span>
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
                              {shipment.route
                                ? `${shipment.route.origin} → ${shipment.route.destination}`
                                : '—'}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {shipment.carrier?.name} ·{' '}
                              {shipment.trip?.code ?? tShipments('unassignedTrip')}
                            </span>
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
                              {getShipmentStatusDisplay(shipment.status)}
                            </ResourceStatusBadge>
                          </TableCell>
                          <TableCell>
                            {formatDateTime(shipment.sentAt)}
                          </TableCell>
                          <TableCell>
                            <ResourceDetailAction
                              href={`/shipments/${shipment.shipmentId}`}
                              resourceName={tShipments('viewDetailsResource', { code: shipment.waybillCode })}
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
                  aria-label={tShipments('cardListAria')}
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
                          {getShipmentStatusDisplay(shipment.status)}
                        </ResourceStatusBadge>
                      </div>

                      <dl className="grid gap-3 text-[13px] [&>div]:grid [&>div]:grid-cols-[90px_minmax(0,1fr)] [&>div]:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                        <div>
                          <dt>{tShipments('colSender')}</dt>
                          <dd>
                            {shipment.sender.fullName} (
                            <span>{shipment.sender.phoneNumber}</span>)
                          </dd>
                        </div>
                        <div>
                          <dt>{tShipments('colRouteTrip')}</dt>
                          <dd>
                            {shipment.route
                              ? `${shipment.route.origin} → ${shipment.route.destination}`
                              : '—'}
                            <p>{shipment.trip?.code ?? tShipments('unassignedTrip')}</p>
                          </dd>
                        </div>
                        <div>
                          <dt>{tShipments('colOrigin')}</dt>
                          <dd>{shipment.originPoint.name}</dd>
                        </div>
                        <div>
                          <dt>{tShipments('colDestination')}</dt>
                          <dd>{shipment.destinationPoint.name}</dd>
                        </div>
                      </dl>

                      <div className="flex justify-end border-t pt-3">
                        <ResourceDetailAction
                          href={`/shipments/${shipment.shipmentId}`}
                          resourceName={tShipments('viewDetailsResource', { code: shipment.waybillCode })}
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
                  summaryLabel={tShipments('resourceLabel')}
                  totalItems={meta.totalItems}
                  totalPages={meta.totalPages}
                />
              </>
            )}
          </div>
        </section>

        <ShipmentScanDialog
          open={scanDialogOpen}
          onOpenChange={setScanDialogOpen}
          onSelectShipment={(id) => router.push(`/shipments/${id}`)}
        />
      </div>
    </SuperAdminLayout>
  );
}
