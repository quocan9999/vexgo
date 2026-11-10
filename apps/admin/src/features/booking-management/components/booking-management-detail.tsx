'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourcePagination,
  ResourceStatusBadge,
  ResourceTableSkeleton,
  ResourceState,
  ResourceNotice,
  ResourceRefreshAction,
} from '@/components/admin/resource-ui';
import { Button, buttonVariants } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { useTranslations } from 'next-intl';
import {
  getAdminBookingDetail,
  getAdminBookingHistory,
  getAdminTicketDetail,
  getAdminTicketHistory,
  BookingManagementApiError,
} from '../services/booking-management-service';
import {
  formatTimestamp,
  formatVnd,
  historyStatusText,
  statusIsActive,
  statusLabel,
  tripIntegrityMessage,
} from '../services/booking-management-format';
import { safeBookingManagementReturnPath } from '../services/booking-management-query';
import type {
  AdminBookingDetail,
  AdminHistoryEntry,
  AdminPage,
  AdminTicketDetail,
} from '../types/booking-management';

type DetailKind = 'bookings' | 'tickets';
type DetailRecord = AdminBookingDetail | AdminTicketDetail;

function getSessionKey(authState: ReturnType<typeof useAdminSession>) {
  if (authState.status !== 'authenticated') return authState.status;
  const session = authState.session;
  return [
    session.accountId,
    session.employee?.employeeId ?? 'platform',
    session.busCompanyId ?? 'no-tenant',
    [...session.permissions].sort().join(','),
  ].join(':');
}

function detailErrorMessage(error: unknown, kind: DetailKind) {
  if (error instanceof Error && error.message === 'INVALID_RESOURCE_ID') {
    return kind === 'bookings'
      ? 'Invalid booking ID.'
      : 'Invalid ticket ID.';
  }
  if (error instanceof BookingManagementApiError) {
    if (error.status === 401)
      return 'Admin session expired. Please sign in again.';
    if (error.status === 403)
      return 'Account does not have permission to view this resource.';
    if (error.status === 404) {
      return kind === 'bookings'
        ? 'Booking not found in operator scope.'
        : 'Ticket not found in operator scope.';
    }
  }
  return 'Failed to load data. Please retry.';
}

function isAuthorizationError(error: unknown) {
  return (
    error instanceof BookingManagementApiError &&
    (error.status === 401 || error.status === 403)
  );
}

function sourceLabel(source: string, tBookings: (key: string) => string) {
  if (source === 'SYSTEM') return tBookings('sourceSystem');
  if (source === 'STAFF') return tBookings('sourceStaff');
  if (source === 'CUSTOMER') return tBookings('sourceCustomer');
  return statusLabel(source);
}

function getBookingStatusDisplay(
  status: string,
  tBookings: (key: string) => string,
) {
  switch (status) {
    case 'CHO_THANH_TOAN':
    case 'CHO_THAN_TOAN':
      return tBookings('statusPendingPayment');
    case 'DA_THANH_TOAN':
      return tBookings('statusPaid');
    case 'HOAN_THANH':
      return tBookings('statusCompleted');
    case 'DA_HUY':
    case 'HUY':
      return tBookings('statusCancelled');
    case 'DA_DAT':
      return tBookings('statusConfirmed');
    case 'THAT_BAI':
      return tBookings('statusFailed');
    default:
      return statusLabel(status);
  }
}

function InfoCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      role="region"
      aria-label={title}
      className={`min-w-0 gap-5 p-4 sm:p-5 ${className}`}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

function InfoRows({ children }: { children: ReactNode }) {
  return <dl className="space-y-4 text-[13px]">{children}</dl>;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(120px,0.8fr)_minmax(0,1.2fr)] sm:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function BookingManagementDetail({
  kind,
  resourceId,
}: {
  kind: DetailKind;
  resourceId: number;
}) {
  const searchParams = useSearchParams();
  const backHref = safeBookingManagementReturnPath(
    searchParams.get('from'),
    kind === 'bookings' ? 'bookings' : 'tickets',
  );
  const authState = useAdminSession();
  const sessionKey = getSessionKey(authState);
  const viewKey = `${kind}:${resourceId}:${sessionKey}`;
  const invalidResourceId =
    !Number.isSafeInteger(resourceId) || resourceId <= 0;
  const [detailRetry, setDetailRetry] = useState(0);
  const [historyRetry, setHistoryRetry] = useState(0);
  const [historyPageState, setHistoryPageState] = useState<{
    key: string;
    page: number;
  } | null>(null);
  const historyPageNumber =
    historyPageState?.key === viewKey ? historyPageState.page : 1;
  const detailRequestKey = `${viewKey}:${detailRetry}`;
  const historyRequestKey = `${viewKey}:${historyPageNumber}:${historyRetry}`;
  const [detailResult, setDetailResult] = useState<{
    key: string;
    value: DetailRecord;
  } | null>(null);
  const [detailErrorState, setDetailErrorState] = useState<{
    key: string;
    error: unknown;
  } | null>(null);
  const [historyResult, setHistoryResult] = useState<{
    key: string;
    value: AdminPage<AdminHistoryEntry>;
  } | null>(null);
  const [historyErrorState, setHistoryErrorState] = useState<{
    key: string;
    error: unknown;
  } | null>(null);
  const [historyAuthorizationError, setHistoryAuthorizationError] = useState<{
    viewKey: string;
    error: unknown;
  } | null>(null);
  const currentDetail =
    detailResult?.key === detailRequestKey ? detailResult.value : null;
  const currentDetailError = invalidResourceId
    ? new Error('INVALID_RESOURCE_ID')
    : detailErrorState?.key === detailRequestKey
      ? detailErrorState.error
      : null;
  const currentHistory =
    historyResult?.key === historyRequestKey ? historyResult.value : null;
  const currentHistoryError = invalidResourceId
    ? new Error('INVALID_RESOURCE_ID')
    : historyErrorState?.key === historyRequestKey
      ? historyErrorState.error
      : null;
  const currentHistoryAuthorizationError =
    historyAuthorizationError?.viewKey === viewKey
      ? historyAuthorizationError.error
      : null;
  const visibleDetail = currentHistoryAuthorizationError ? null : currentDetail;
  const visibleDetailError =
    currentDetailError ?? currentHistoryAuthorizationError;
  const detailLoading =
    authState.status === 'authenticated' &&
    !currentDetail &&
    !currentDetailError;
  const historyLoading =
    authState.status === 'authenticated' &&
    !currentHistory &&
    !currentHistoryError;

  useEffect(() => {
    if (authState.status !== 'authenticated' || invalidResourceId) return;

    const controller = new AbortController();
    let active = true;
    const request =
      kind === 'bookings'
        ? getAdminBookingDetail(resourceId, controller.signal)
        : getAdminTicketDetail(resourceId, controller.signal);
    void request
      .then((value) => {
        if (active && !controller.signal.aborted) {
          setDetailResult({ key: detailRequestKey, value });
        }
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
          setDetailErrorState({ key: detailRequestKey, error });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [authState.status, detailRequestKey, invalidResourceId, kind, resourceId]);

  useEffect(() => {
    if (authState.status !== 'authenticated' || invalidResourceId) return;

    const controller = new AbortController();
    let active = true;
    const request =
      kind === 'bookings'
        ? getAdminBookingHistory(
            resourceId,
            historyPageNumber,
            100,
            controller.signal,
          )
        : getAdminTicketHistory(
            resourceId,
            historyPageNumber,
            100,
            controller.signal,
          );
    void request
      .then((value) => {
        if (active && !controller.signal.aborted) {
          setHistoryAuthorizationError(null);
          setHistoryResult({ key: historyRequestKey, value });
        }
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
          if (isAuthorizationError(error)) {
            setHistoryAuthorizationError({ viewKey, error });
          }
          setHistoryErrorState({ key: historyRequestKey, error });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    authState.status,
    historyPageNumber,
    historyRequestKey,
    invalidResourceId,
    kind,
    resourceId,
    viewKey,
  ]);

  const tBookings = useTranslations('bookings');
  const tCommon = useTranslations('common');
  const pageTitle =
    kind === 'bookings' ? tBookings('bookingDetails') : tBookings('ticketDetails');

  return (
    <SuperAdminLayout
      activeSection="booking-management"
      breadcrumbs={[
        { label: tBookings('bookingsTitle'), href: '/booking-management' },
        { label: pageTitle },
      ]}
    >
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              <Link
                className={buttonVariants({ variant: 'outline' })}
                href={backHref}
              >
                {tCommon('backToList')}
              </Link>
              <ResourceRefreshAction
                label={tCommon('refresh')}
                loading={detailLoading}
                onClick={() => {
                  setDetailRetry((retry) => retry + 1);
                  setHistoryRetry((retry) => retry + 1);
                }}
              />
            </div>
          }
          eyebrow={tBookings('eyebrow')}
          title={pageTitle}
          titleId="booking-management-detail-title"
        />

        {detailLoading && !visibleDetail && !visibleDetailError && (
          <ResourceTableSkeleton
            resourceLabel={kind === 'bookings' ? tBookings('resourceBookings') : tBookings('resourceTickets')}
          />
        )}
        {Boolean(visibleDetailError) && (
          <ResourceState error>
            <p>{detailErrorMessage(visibleDetailError, kind)}</p>
            <Button
              variant="outline"
              onClick={() => setDetailRetry((retry) => retry + 1)}
              type="button"
            >
              {tCommon('retry')}
            </Button>
          </ResourceState>
        )}

        {kind === 'bookings' && visibleDetail && (
          <BookingDetailContent
            booking={visibleDetail as AdminBookingDetail}
            backHref={backHref}
            history={currentHistory}
            historyError={currentHistoryError}
            historyLoading={historyLoading}
            onRetryHistory={() => setHistoryRetry((retry) => retry + 1)}
            onHistoryPageChange={(page) =>
              setHistoryPageState({ key: viewKey, page })
            }
          />
        )}
        {kind === 'tickets' && visibleDetail && (
          <TicketDetailContent
            ticket={visibleDetail as AdminTicketDetail}
            backHref={backHref}
            history={currentHistory}
            historyError={currentHistoryError}
            historyLoading={historyLoading}
            onRetryHistory={() => setHistoryRetry((retry) => retry + 1)}
            onHistoryPageChange={(page) =>
              setHistoryPageState({ key: viewKey, page })
            }
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}

function BookingDetailContent({
  booking,
  backHref,
  history,
  historyError,
  historyLoading,
  onRetryHistory,
  onHistoryPageChange,
}: {
  booking: AdminBookingDetail;
  backHref: string;
  history: AdminPage<AdminHistoryEntry> | null;
  historyError: unknown;
  historyLoading: boolean;
  onRetryHistory: () => void;
  onHistoryPageChange: (page: number) => void;
}) {
  const tBookings = useTranslations('bookings');
  return (
    <section
      aria-labelledby="booking-management-detail-title"
      className="grid min-w-0 items-start gap-6 lg:grid-cols-2"
    >
      <header className="col-span-full flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5 [&_h2]:break-all [&_h2]:text-base [&_h2]:font-semibold">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {tBookings('bookingBadge')}
          </p>
          <h2 className="admin-data-mono">{booking.bookingCode}</h2>
        </div>
        <ResourceStatusBadge
          tone={statusIsActive(booking.status) ? 'active' : 'muted'}
        >
          {getBookingStatusDisplay(booking.status, tBookings)}
        </ResourceStatusBadge>
      </header>

      {booking.tripIntegrity !== 'CONSISTENT' && (
        <div className="col-span-full">
          <ResourceNotice kind="info">
            {tripIntegrityMessage(booking.tripIntegrity)}
          </ResourceNotice>
        </div>
      )}

      <InfoCard title={tBookings('cardBookingInfo')}>
        <InfoRows>
          <InfoRow label={tBookings('bookedDateLabel')}>
            {formatTimestamp(booking.bookedAt)}
          </InfoRow>
          <InfoRow label={tBookings('colCustomer')}>{booking.customer.name}</InfoRow>
          <InfoRow label={tBookings('customerPhone')}>{booking.customer.phoneNumber}</InfoRow>
          <InfoRow label={tBookings('colTrip')}>
            {booking.trip
              ? `${booking.trip.origin} → ${booking.trip.destination}`
              : tBookings('unknownTrip')}
          </InfoRow>
          <InfoRow label={tBookings('sortDepartureTime')}>
            {formatTimestamp(booking.trip?.departureAt)}
          </InfoRow>
          <InfoRow label={tBookings('initialTickets')}>{booking.initialTicketCount}</InfoRow>
          <InfoRow label={tBookings('cancelledTickets')}>{booking.cancelledTicketCount}</InfoRow>
          <InfoRow label={tBookings('activeTickets')}>{booking.activeTicketCount}</InfoRow>
          {booking.isPartiallyCancelled && (
            <InfoRow label={tBookings('partialCancellation')}>
              {tBookings('cancelledTicketCount', {
                cancelled: booking.cancelledTicketCount,
                total: booking.ticketCount,
              })}
            </InfoRow>
          )}
          <InfoRow label={tBookings('colInitialAmount')}>
            {formatVnd(booking.initialTicketAmount)}
          </InfoRow>
          <InfoRow label={tBookings('totalTransactionAmount')}>
            {formatVnd(booking.transactionTotalAmount)}
          </InfoRow>
          <InfoRow label={tBookings('orderStatus')}>
            {getBookingStatusDisplay(booking.transactionStatus, tBookings)}
          </InfoRow>
        </InfoRows>
      </InfoCard>

      <InfoCard title={tBookings('cardTicketsInBooking')}>
        {booking.tickets.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            {tBookings('noTicketsInBooking')}
          </p>
        ) : (
          <ul className="grid gap-3 [&>li]:flex [&>li]:min-w-0 [&>li]:flex-wrap [&>li]:items-start [&>li]:justify-between [&>li]:gap-3 [&>li]:border-b [&>li]:pb-3 [&>li:last-child]:border-0 [&>li:last-child]:pb-0 [&>li>div]:min-w-0 [&>li>div]:flex-1 [&>li>div]:space-y-2 [&>li>div>span]:block [&>li>div>span]:text-[13px] [&>li>div>span]:text-muted-foreground">
            {booking.tickets.map((ticket) => (
              <li key={ticket.ticketId}>
                <div>
                  <Link
                    className="admin-data-mono block min-h-11 break-all text-[13px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    href={`/booking-management/tickets/${ticket.ticketId}?from=${encodeURIComponent(backHref)}`}
                  >
                    {ticket.ticketCode}
                  </Link>
                  <span>
                    {ticket.seatNumber ?? '—'} · {formatVnd(ticket.actualPrice)}
                  </span>
                </div>
                <ResourceStatusBadge
                  tone={statusIsActive(ticket.status) ? 'active' : 'muted'}
                >
                  {getBookingStatusDisplay(ticket.status, tBookings)}
                </ResourceStatusBadge>
              </li>
            ))}
          </ul>
        )}
      </InfoCard>

      <InfoCard title={tBookings('cardPaymentRefund')}>
        <div className="space-y-3 border-b pb-4 last:border-0 last:pb-0 [&_h3]:text-[13px] [&_h3]:font-semibold">
          <h3>{tBookings('paymentTransactions')}</h3>
          {booking.paymentSummary.originalPayments.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              {tBookings('noPaymentInfo')}
            </p>
          ) : (
            <ul className="grid gap-3 [&>li]:flex [&>li]:min-w-0 [&>li]:flex-wrap [&>li]:items-start [&>li]:justify-between [&>li]:gap-3 [&>li]:rounded-lg [&>li]:border [&>li]:p-3 [&>li>div]:grid [&>li>div]:min-w-0 [&>li>div]:gap-1 [&>li>div>span]:break-words [&>li>div>span]:text-xs [&>li>div>span]:text-muted-foreground">
              {booking.paymentSummary.originalPayments.map((payment) => (
                <li key={payment.paymentId}>
                  <div>
                    <strong>{formatVnd(payment.amountVnd)}</strong>
                    <span>
                      {payment.method
                        ? statusLabel(payment.method)
                        : tBookings('paymentMethodUnknown')}{' '}
                      · {formatTimestamp(payment.occurredAt)}
                    </span>
                  </div>
                  <ResourceStatusBadge
                    tone={statusIsActive(payment.status) ? 'active' : 'muted'}
                  >
                    {getBookingStatusDisplay(payment.status, tBookings)}
                  </ResourceStatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
        {(['pending', 'succeeded', 'other'] as const).map((group) => {
          const refunds = booking.paymentSummary.refunds[group];
          const groupLabel =
            group === 'pending'
              ? tBookings('refundPending')
              : group === 'succeeded'
                ? tBookings('refundSucceeded')
                : tBookings('refundOther');
          return (
            <div
              className="space-y-3 border-b pb-4 last:border-0 last:pb-0 [&_h3]:text-[13px] [&_h3]:font-semibold"
              key={group}
            >
              <h3>{groupLabel}</h3>
              {refunds.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  {tBookings('noTransactions')}
                </p>
              ) : (
                <ul className="grid gap-3 [&>li]:flex [&>li]:min-w-0 [&>li]:flex-wrap [&>li]:items-start [&>li]:justify-between [&>li]:gap-3 [&>li]:rounded-lg [&>li]:border [&>li]:p-3 [&>li>div]:grid [&>li>div]:min-w-0 [&>li>div]:gap-1 [&>li>div>span]:break-words [&>li>div>span]:text-xs [&>li>div>span]:text-muted-foreground">
                  {refunds.map((refund) => (
                    <li key={refund.paymentId}>
                      <div>
                        <strong>{formatVnd(refund.amountVnd)}</strong>
                        <span>
                          {refund.allocation === 'TICKET'
                            ? tBookings('refundAllocatedTicket')
                            : tBookings('refundAllocatedUnknown')}{' '}
                          · {formatTimestamp(refund.occurredAt)}
                        </span>
                      </div>
                      <ResourceStatusBadge
                        tone={
                          statusIsActive(refund.status) ? 'active' : 'muted'
                        }
                      >
                        {getBookingStatusDisplay(refund.status, tBookings)}
                      </ResourceStatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </InfoCard>

      {booking.shipment && (
        <InfoCard title={tBookings('cardShipmentInTransaction')}>
          {booking.shipment.tripIntegrity !== 'CONSISTENT' && (
            <div className="col-span-full">
              <ResourceNotice kind="info">
                {tripIntegrityMessage(booking.shipment.tripIntegrity)}
              </ResourceNotice>
            </div>
          )}
          <InfoRows>
            <InfoRow label={tBookings('trackingCode')}>
              <span className="admin-data-mono">
                {booking.shipment.trackingCode}
              </span>
            </InfoRow>
            <InfoRow label={tBookings('shipmentStatus')}>
              <ResourceStatusBadge
                tone={
                  statusIsActive(booking.shipment.status) ? 'active' : 'muted'
                }
              >
                {getBookingStatusDisplay(booking.shipment.status, tBookings)}
              </ResourceStatusBadge>
            </InfoRow>
            <InfoRow label={tBookings('colTrip')}>
              {booking.shipment.tripId !== null
                ? tBookings('shipmentTrip', { tripId: booking.shipment.tripId })
                : tBookings('unknownTrip')}
            </InfoRow>
            <InfoRow label={tBookings('shipmentItems')}>
              {booking.shipment.items.length === 0
                ? tBookings('noShipmentItems')
                : booking.shipment.items
                    .map(
                      (item) =>
                        `${item.name} · ${item.itemType} · SL ${item.quantity}`,
                    )
                    .join('; ')}
            </InfoRow>
          </InfoRows>
        </InfoCard>
      )}

      <HistorySection
        error={historyError}
        history={history}
        kind="booking"
        loading={historyLoading}
        onRetry={onRetryHistory}
        onPageChange={onHistoryPageChange}
      />
    </section>
  );
}

function TicketDetailContent({
  ticket,
  backHref,
  history,
  historyError,
  historyLoading,
  onRetryHistory,
  onHistoryPageChange,
}: {
  ticket: AdminTicketDetail;
  backHref: string;
  history: AdminPage<AdminHistoryEntry> | null;
  historyError: unknown;
  historyLoading: boolean;
  onRetryHistory: () => void;
  onHistoryPageChange: (page: number) => void;
}) {
  const tBookings = useTranslations('bookings');
  return (
    <section
      aria-labelledby="booking-management-detail-title"
      className="grid min-w-0 items-start gap-6 lg:grid-cols-2"
    >
      <header className="col-span-full flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5 [&_h2]:break-all [&_h2]:text-base [&_h2]:font-semibold">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{tBookings('ticketBadge')}</p>
          <h2 className="admin-data-mono">{ticket.ticketCode}</h2>
        </div>
        <ResourceStatusBadge
          tone={statusIsActive(ticket.status) ? 'active' : 'muted'}
        >
          {getBookingStatusDisplay(ticket.status, tBookings)}
        </ResourceStatusBadge>
      </header>

      {ticket.tripIntegrity !== 'CONSISTENT' && (
        <div className="col-span-full">
          <ResourceNotice kind="info">
            {tripIntegrityMessage(ticket.tripIntegrity)}
          </ResourceNotice>
        </div>
      )}

      <InfoCard title={tBookings('cardTicketInfo')}>
        <InfoRows>
          <InfoRow label={tBookings('colBooking')}>
            <Link
              className="admin-data-mono inline-flex min-h-11 items-center break-all text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              href={`/booking-management/bookings/${ticket.booking.bookingId}?from=${encodeURIComponent(backHref)}`}
            >
              {ticket.booking.bookingCode}
            </Link>
          </InfoRow>
          <InfoRow label={tBookings('colCustomer')}>{ticket.customer.name}</InfoRow>
          <InfoRow label={tBookings('customerPhone')}>{ticket.customer.phoneNumber}</InfoRow>
          <InfoRow label={tBookings('routeLabel')}>
            {ticket.trip
              ? `${ticket.trip.origin} → ${ticket.trip.destination}`
              : tBookings('unknownTrip')}
          </InfoRow>
          <InfoRow label={tBookings('tripCodeLabel')}>
            <span className="admin-data-mono">
              {ticket.trip?.tripCode ?? '—'}
            </span>
          </InfoRow>
          <InfoRow label={tBookings('sortDepartureTime')}>
            {formatTimestamp(ticket.trip?.departureAt)}
          </InfoRow>
          <InfoRow label={tBookings('colSeat')}>
            <span className="admin-data-mono">{ticket.seatNumber ?? '—'}</span>
          </InfoRow>
          <InfoRow label={tBookings('pickupPoint')}>{ticket.pickup ?? '—'}</InfoRow>
          <InfoRow label={tBookings('colActualPrice')}>{formatVnd(ticket.actualPrice)}</InfoRow>
          <InfoRow label={tBookings('listedPrice')}>
            {formatVnd(ticket.listedPrice)}
          </InfoRow>
          <InfoRow label={tBookings('colBookingStatus')}>
            {getBookingStatusDisplay(ticket.booking.status, tBookings)}
          </InfoRow>
          <InfoRow label={tBookings('orderStatus')}>
            {getBookingStatusDisplay(ticket.booking.transactionStatus, tBookings)}
          </InfoRow>
        </InfoRows>
      </InfoCard>

      <InfoCard title={tBookings('cardTicketRefund')}>
        {ticket.refunds.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            {tBookings('noTicketRefund')}
          </p>
        ) : (
          <ul className="grid gap-3 [&>li]:flex [&>li]:min-w-0 [&>li]:flex-wrap [&>li]:items-start [&>li]:justify-between [&>li]:gap-3 [&>li]:rounded-lg [&>li]:border [&>li]:p-3 [&>li>div]:grid [&>li>div]:min-w-0 [&>li>div]:gap-1 [&>li>div>span]:break-words [&>li>div>span]:text-xs [&>li>div>span]:text-muted-foreground">
            {ticket.refunds.map((refund) => (
              <li key={refund.refundId}>
                <div>
                  <strong>{formatVnd(refund.amountVnd)}</strong>
                  <span>
                    {refund.method
                      ? statusLabel(refund.method)
                      : tBookings('paymentMethodUnknown')}{' '}
                    · {formatTimestamp(refund.occurredAt)}
                  </span>
                </div>
                <ResourceStatusBadge
                  tone={statusIsActive(refund.status) ? 'active' : 'muted'}
                >
                  {getBookingStatusDisplay(refund.status, tBookings)}
                </ResourceStatusBadge>
              </li>
            ))}
          </ul>
        )}
      </InfoCard>

      <HistorySection
        error={historyError}
        history={history}
        kind="ticket"
        loading={historyLoading}
        onRetry={onRetryHistory}
        onPageChange={onHistoryPageChange}
      />
    </section>
  );
}

function HistorySection({
  error,
  history,
  kind,
  loading,
  onRetry,
  onPageChange,
}: {
  error: unknown;
  history: AdminPage<AdminHistoryEntry> | null;
  kind: 'booking' | 'ticket';
  loading: boolean;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}) {
  const tBookings = useTranslations('bookings');
  return (
    <InfoCard
      title={tBookings('historySectionTitle', {
        kind: kind === 'booking' ? tBookings('kindBooking') : tBookings('kindTicket'),
      })}
      className="lg:col-span-2"
    >
      {loading && !history && (
        <p
          aria-live="polite"
          className="text-[13px] text-muted-foreground"
          role="status"
        >
          {tBookings('loadingHistory')}
        </p>
      )}
      {Boolean(error) && (
        <ResourceState error>
          <p>
            {detailErrorMessage(
              error,
              kind === 'booking' ? 'bookings' : 'tickets',
            )}
          </p>
          <Button variant="outline" onClick={onRetry} type="button">
            {tBookings('reloadHistory')}
          </Button>
        </ResourceState>
      )}
      {!loading && !error && history && history.data.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          {tBookings('noHistory')}
        </p>
      )}
      {!error && history && history.data.length > 0 && (
        <>
          <ol className="grid gap-5">
            {history.data.map((entry) => (
              <li key={entry.historyId} className="flex min-w-0 gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 size-2.5 shrink-0 rounded-full border-2 border-primary bg-card"
                />
                <div className="grid min-w-0 gap-1 text-[13px] [&_strong]:break-words [&_strong]:font-semibold [&_time]:text-xs [&_time]:text-muted-foreground [&>span]:text-xs [&>span]:text-muted-foreground [&_p]:mt-1 [&_p]:break-words">
                  <strong>
                    {historyStatusText(entry.oldStatus, entry.newStatus)}
                  </strong>
                  <time dateTime={entry.occurredAt}>
                    {formatTimestamp(entry.occurredAt)}
                  </time>
                  <span>
                    {tBookings('sourceLabel', {
                      source: sourceLabel(entry.source, tBookings),
                    })}
                    {entry.isOverride ? ` · ${tBookings('overrideLabel')}` : ''}
                  </span>
                  {entry.reason && <p>{entry.reason}</p>}
                  {entry.source !== 'SYSTEM' && entry.actorName && (
                    <span>
                      {tBookings('operatorLabel', { name: entry.actorName })}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {history.meta.totalPages > 1 && (
            <ResourcePagination
              currentPage={history.meta.page}
              disabled={loading}
              onPageChange={onPageChange}
              pageSize={history.meta.pageSize}
              summaryLabel={tBookings('historyEvents')}
              totalItems={history.meta.totalItems}
              totalPages={history.meta.totalPages}
            />
          )}
        </>
      )}
    </InfoCard>
  );
}
