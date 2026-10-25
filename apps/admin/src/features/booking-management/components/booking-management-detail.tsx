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
      ? 'Mã phiếu đặt vé không hợp lệ.'
      : 'Mã vé không hợp lệ.';
  }
  if (error instanceof BookingManagementApiError) {
    if (error.status === 401)
      return 'Phiên quản trị đã hết hạn. Hãy đăng nhập lại.';
    if (error.status === 403)
      return 'Tài khoản hiện không có quyền xem dữ liệu này.';
    if (error.status === 404) {
      return kind === 'bookings'
        ? 'Không tìm thấy phiếu đặt vé trong nhà xe.'
        : 'Không tìm thấy vé trong nhà xe.';
    }
  }
  return 'Không thể tải dữ liệu. Hãy thử lại.';
}

function isAuthorizationError(error: unknown) {
  return (
    error instanceof BookingManagementApiError &&
    (error.status === 401 || error.status === 403)
  );
}

function sourceLabel(source: string) {
  if (source === 'SYSTEM') return 'Hệ thống';
  if (source === 'STAFF') return 'Nhân viên';
  if (source === 'CUSTOMER') return 'Khách hàng';
  return statusLabel(source);
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

  const pageTitle =
    kind === 'bookings' ? 'Chi tiết phiếu đặt vé' : 'Chi tiết vé';

  return (
    <SuperAdminLayout activeSection="booking-management">
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              <Link
                className={buttonVariants({ variant: 'outline' })}
                href={backHref}
              >
                Quay lại danh sách
              </Link>
              <ResourceRefreshAction
                loading={detailLoading}
                onClick={() => {
                  setDetailRetry((retry) => retry + 1);
                  setHistoryRetry((retry) => retry + 1);
                }}
              />
            </div>
          }
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title={pageTitle}
          titleId="booking-management-detail-title"
        />

        {detailLoading && !visibleDetail && !visibleDetailError && (
          <ResourceTableSkeleton
            resourceLabel={kind === 'bookings' ? 'phiếu đặt vé' : 'vé'}
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
              Thử lại
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
  return (
    <section
      aria-labelledby="booking-management-detail-title"
      className="grid min-w-0 items-start gap-6 lg:grid-cols-2"
    >
      <header className="col-span-full flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5 [&_h2]:break-all [&_h2]:text-base [&_h2]:font-semibold">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            PHIẾU ĐẶT VÉ
          </p>
          <h2 className="admin-data-mono">{booking.bookingCode}</h2>
        </div>
        <ResourceStatusBadge
          tone={statusIsActive(booking.status) ? 'active' : 'muted'}
        >
          {statusLabel(booking.status)}
        </ResourceStatusBadge>
      </header>

      {booking.tripIntegrity !== 'CONSISTENT' && (
        <div className="col-span-full">
          <ResourceNotice kind="info">
            {tripIntegrityMessage(booking.tripIntegrity)}
          </ResourceNotice>
        </div>
      )}

      <InfoCard title="Thông tin phiếu">
        <InfoRows>
          <InfoRow label="Ngày đặt">
            {formatTimestamp(booking.bookedAt)}
          </InfoRow>
          <InfoRow label="Khách hàng">{booking.customer.name}</InfoRow>
          <InfoRow label="Điện thoại">{booking.customer.phoneNumber}</InfoRow>
          <InfoRow label="Chuyến xe">
            {booking.trip
              ? `${booking.trip.origin} → ${booking.trip.destination}`
              : 'Chưa xác định'}
          </InfoRow>
          <InfoRow label="Khởi hành">
            {formatTimestamp(booking.trip?.departureAt)}
          </InfoRow>
          <InfoRow label="Vé ban đầu">{booking.initialTicketCount}</InfoRow>
          <InfoRow label="Vé đã hủy">{booking.cancelledTicketCount}</InfoRow>
          <InfoRow label="Vé còn hiệu lực">{booking.activeTicketCount}</InfoRow>
          {booking.isPartiallyCancelled && (
            <InfoRow label="Hủy một phần">
              Hủy {booking.cancelledTicketCount}/{booking.ticketCount} vé
            </InfoRow>
          )}
          <InfoRow label="Tổng tiền vé ban đầu">
            {formatVnd(booking.initialTicketAmount)}
          </InfoRow>
          <InfoRow label="Tổng đơn giao dịch">
            {formatVnd(booking.transactionTotalAmount)}
          </InfoRow>
          <InfoRow label="Trạng thái đơn">
            {statusLabel(booking.transactionStatus)}
          </InfoRow>
        </InfoRows>
      </InfoCard>

      <InfoCard title="Vé trong phiếu">
        {booking.tickets.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Phiếu chưa có vé để hiển thị.
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
                  {statusLabel(ticket.status)}
                </ResourceStatusBadge>
              </li>
            ))}
          </ul>
        )}
      </InfoCard>

      <InfoCard title="Thanh toán và hoàn tiền">
        <div className="space-y-3 border-b pb-4 last:border-0 last:pb-0 [&_h3]:text-[13px] [&_h3]:font-semibold">
          <h3>Giao dịch thanh toán</h3>
          {booking.paymentSummary.originalPayments.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Chưa có thông tin thanh toán.
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
                        : 'Chưa rõ phương thức'}{' '}
                      · {formatTimestamp(payment.occurredAt)}
                    </span>
                  </div>
                  <ResourceStatusBadge
                    tone={statusIsActive(payment.status) ? 'active' : 'muted'}
                  >
                    {statusLabel(payment.status)}
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
              ? 'Hoàn tiền đang xử lý'
              : group === 'succeeded'
                ? 'Hoàn tiền đã thành công'
                : 'Hoàn tiền trạng thái khác';
          return (
            <div
              className="space-y-3 border-b pb-4 last:border-0 last:pb-0 [&_h3]:text-[13px] [&_h3]:font-semibold"
              key={group}
            >
              <h3>{groupLabel}</h3>
              {refunds.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Không có giao dịch.
                </p>
              ) : (
                <ul className="grid gap-3 [&>li]:flex [&>li]:min-w-0 [&>li]:flex-wrap [&>li]:items-start [&>li]:justify-between [&>li]:gap-3 [&>li]:rounded-lg [&>li]:border [&>li]:p-3 [&>li>div]:grid [&>li>div]:min-w-0 [&>li>div]:gap-1 [&>li>div>span]:break-words [&>li>div>span]:text-xs [&>li>div>span]:text-muted-foreground">
                  {refunds.map((refund) => (
                    <li key={refund.paymentId}>
                      <div>
                        <strong>{formatVnd(refund.amountVnd)}</strong>
                        <span>
                          {refund.allocation === 'TICKET'
                            ? 'Gắn với vé'
                            : 'Chưa xác định phân bổ'}{' '}
                          · {formatTimestamp(refund.occurredAt)}
                        </span>
                      </div>
                      <ResourceStatusBadge
                        tone={
                          statusIsActive(refund.status) ? 'active' : 'muted'
                        }
                      >
                        {statusLabel(refund.status)}
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
        <InfoCard title="Phiếu gửi hàng cùng giao dịch">
          {booking.shipment.tripIntegrity !== 'CONSISTENT' && (
            <div className="col-span-full">
              <ResourceNotice kind="info">
                {tripIntegrityMessage(booking.shipment.tripIntegrity)}
              </ResourceNotice>
            </div>
          )}
          <InfoRows>
            <InfoRow label="Mã vận đơn">
              <span className="admin-data-mono">
                {booking.shipment.trackingCode}
              </span>
            </InfoRow>
            <InfoRow label="Trạng thái gửi hàng">
              <ResourceStatusBadge
                tone={
                  statusIsActive(booking.shipment.status) ? 'active' : 'muted'
                }
              >
                {statusLabel(booking.shipment.status)}
              </ResourceStatusBadge>
            </InfoRow>
            <InfoRow label="Chuyến xe">
              {booking.shipment.tripId !== null
                ? `Chuyến #${booking.shipment.tripId}`
                : 'Chuyến chưa xác định'}
            </InfoRow>
            <InfoRow label="Hàng hóa">
              {booking.shipment.items.length === 0
                ? 'Chưa có thông tin hàng hóa'
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
        kind="phiếu"
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
  return (
    <section
      aria-labelledby="booking-management-detail-title"
      className="grid min-w-0 items-start gap-6 lg:grid-cols-2"
    >
      <header className="col-span-full flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5 [&_h2]:break-all [&_h2]:text-base [&_h2]:font-semibold">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">VÉ</p>
          <h2 className="admin-data-mono">{ticket.ticketCode}</h2>
        </div>
        <ResourceStatusBadge
          tone={statusIsActive(ticket.status) ? 'active' : 'muted'}
        >
          {statusLabel(ticket.status)}
        </ResourceStatusBadge>
      </header>

      {ticket.tripIntegrity !== 'CONSISTENT' && (
        <div className="col-span-full">
          <ResourceNotice kind="info">
            {tripIntegrityMessage(ticket.tripIntegrity)}
          </ResourceNotice>
        </div>
      )}

      <InfoCard title="Thông tin vé">
        <InfoRows>
          <InfoRow label="Phiếu đặt">
            <Link
              className="admin-data-mono inline-flex min-h-11 items-center break-all text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              href={`/booking-management/bookings/${ticket.booking.bookingId}?from=${encodeURIComponent(backHref)}`}
            >
              {ticket.booking.bookingCode}
            </Link>
          </InfoRow>
          <InfoRow label="Khách hàng">{ticket.customer.name}</InfoRow>
          <InfoRow label="Điện thoại">{ticket.customer.phoneNumber}</InfoRow>
          <InfoRow label="Tuyến xe">
            {ticket.trip
              ? `${ticket.trip.origin} → ${ticket.trip.destination}`
              : 'Chưa xác định'}
          </InfoRow>
          <InfoRow label="Chuyến xe">
            <span className="admin-data-mono">
              {ticket.trip?.tripCode ?? '—'}
            </span>
          </InfoRow>
          <InfoRow label="Khởi hành">
            {formatTimestamp(ticket.trip?.departureAt)}
          </InfoRow>
          <InfoRow label="Ghế">
            <span className="admin-data-mono">{ticket.seatNumber ?? '—'}</span>
          </InfoRow>
          <InfoRow label="Điểm đón">{ticket.pickup ?? '—'}</InfoRow>
          <InfoRow label="Giá thực tế">{formatVnd(ticket.actualPrice)}</InfoRow>
          <InfoRow label="Giá niêm yết">
            {formatVnd(ticket.listedPrice)}
          </InfoRow>
          <InfoRow label="Trạng thái phiếu">
            {statusLabel(ticket.booking.status)}
          </InfoRow>
          <InfoRow label="Trạng thái đơn">
            {statusLabel(ticket.booking.transactionStatus)}
          </InfoRow>
        </InfoRows>
      </InfoCard>

      <InfoCard title="Hoàn tiền gắn với vé">
        {ticket.refunds.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Chưa có thông tin hoàn tiền gắn với vé này.
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
                      : 'Chưa rõ phương thức'}{' '}
                    · {formatTimestamp(refund.occurredAt)}
                  </span>
                </div>
                <ResourceStatusBadge
                  tone={statusIsActive(refund.status) ? 'active' : 'muted'}
                >
                  {statusLabel(refund.status)}
                </ResourceStatusBadge>
              </li>
            ))}
          </ul>
        )}
      </InfoCard>

      <HistorySection
        error={historyError}
        history={history}
        kind="vé"
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
  kind: string;
  loading: boolean;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <InfoCard title={`Lịch sử trạng thái ${kind}`} className="lg:col-span-2">
      {loading && !history && (
        <p
          aria-live="polite"
          className="text-[13px] text-muted-foreground"
          role="status"
        >
          Đang tải lịch sử…
        </p>
      )}
      {Boolean(error) && (
        <ResourceState error>
          <p>
            {detailErrorMessage(
              error,
              kind === 'phiếu' ? 'bookings' : 'tickets',
            )}
          </p>
          <Button variant="outline" onClick={onRetry} type="button">
            Tải lại lịch sử
          </Button>
        </ResourceState>
      )}
      {!loading && !error && history && history.data.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          Chưa có lịch sử trạng thái.
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
                    Nguồn: {sourceLabel(entry.source)}
                    {entry.isOverride ? ' · Có ghi đè' : ''}
                  </span>
                  {entry.reason && <p>{entry.reason}</p>}
                  {entry.source !== 'SYSTEM' && entry.actorName && (
                    <span>Người thao tác: {entry.actorName}</span>
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
              summaryLabel="sự kiện lịch sử"
              totalItems={history.meta.totalItems}
              totalPages={history.meta.totalPages}
            />
          )}
        </>
      )}
    </InfoCard>
  );
}
