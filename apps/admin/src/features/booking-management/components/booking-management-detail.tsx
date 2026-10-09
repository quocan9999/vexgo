'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
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
import styles from './booking-management-detail.module.css';

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

function sourceLabel(source: string) {
  if (source === 'SYSTEM') return 'Hệ thống';
  if (source === 'STAFF') return 'Nhân viên';
  if (source === 'CUSTOMER') return 'Khách hàng';
  return statusLabel(source);
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={styles.card}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function InfoRows({ children }: { children: ReactNode }) {
  return <dl className={styles.infoRows}>{children}</dl>;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
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
          setHistoryResult({ key: historyRequestKey, value });
        }
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
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
  ]);

  const pageTitle =
    kind === 'bookings' ? 'Chi tiết phiếu đặt vé' : 'Chi tiết vé';

  return (
    <SuperAdminLayout activeSection="booking-management">
      <div className="admin-page-content">
        <AdminPageHeader
          actions={
            <Link className={styles.backLink} href={backHref}>
              Quay lại danh sách
            </Link>
          }
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title={pageTitle}
          titleId="booking-management-detail-title"
        />

        {detailLoading && !currentDetail && (
          <AdminTableSkeleton
            resourceLabel={kind === 'bookings' ? 'phiếu đặt vé' : 'vé'}
          />
        )}
        {Boolean(currentDetailError) && (
          <div className={styles.detailError} role="alert">
            <p>{detailErrorMessage(currentDetailError, kind)}</p>
            <button
              onClick={() => setDetailRetry((retry) => retry + 1)}
              type="button"
            >
              Thử lại
            </button>
          </div>
        )}

        {kind === 'bookings' && currentDetail && (
          <BookingDetailContent
            booking={currentDetail as AdminBookingDetail}
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
        {kind === 'tickets' && currentDetail && (
          <TicketDetailContent
            ticket={currentDetail as AdminTicketDetail}
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
        <footer className="admin-page-footer">
          <span>© 2026 VexGo Platform</span>
        </footer>
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
      className={styles.detailGrid}
    >
      <header className={styles.recordHeader}>
        <div>
          <p className={styles.recordEyebrow}>PHIẾU ĐẶT VÉ</p>
          <h2 className="admin-data-mono">{booking.bookingCode}</h2>
        </div>
        <AdminStatusBadge
          tone={statusIsActive(booking.status) ? 'active' : 'muted'}
        >
          {statusLabel(booking.status)}
        </AdminStatusBadge>
      </header>

      {booking.tripIntegrity !== 'CONSISTENT' && (
        <p className={styles.warning} role="status">
          {tripIntegrityMessage(booking.tripIntegrity)}
        </p>
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
          <p className={styles.emptyText}>Phiếu chưa có vé để hiển thị.</p>
        ) : (
          <ul className={styles.ticketList}>
            {booking.tickets.map((ticket) => (
              <li key={ticket.ticketId}>
                <div>
                  <Link
                    href={`/booking-management/tickets/${ticket.ticketId}?from=${encodeURIComponent(backHref)}`}
                  >
                    {ticket.ticketCode}
                  </Link>
                  <span>
                    {ticket.seatNumber ?? '—'} · {formatVnd(ticket.actualPrice)}
                  </span>
                </div>
                <AdminStatusBadge
                  tone={statusIsActive(ticket.status) ? 'active' : 'muted'}
                >
                  {statusLabel(ticket.status)}
                </AdminStatusBadge>
              </li>
            ))}
          </ul>
        )}
      </InfoCard>

      <InfoCard title="Thanh toán và hoàn tiền">
        <div className={styles.moneyGroup}>
          <h3>Giao dịch thanh toán</h3>
          {booking.paymentSummary.originalPayments.length === 0 ? (
            <p className={styles.emptyText}>Chưa có thông tin thanh toán.</p>
          ) : (
            <ul className={styles.paymentList}>
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
                  <AdminStatusBadge
                    tone={statusIsActive(payment.status) ? 'active' : 'muted'}
                  >
                    {statusLabel(payment.status)}
                  </AdminStatusBadge>
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
            <div className={styles.moneyGroup} key={group}>
              <h3>{groupLabel}</h3>
              {refunds.length === 0 ? (
                <p className={styles.emptyText}>Không có giao dịch.</p>
              ) : (
                <ul className={styles.paymentList}>
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
                      <AdminStatusBadge
                        tone={
                          statusIsActive(refund.status) ? 'active' : 'muted'
                        }
                      >
                        {statusLabel(refund.status)}
                      </AdminStatusBadge>
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
          <InfoRows>
            <InfoRow label="Mã vận đơn">
              {booking.shipment.trackingCode}
            </InfoRow>
            <InfoRow label="Trạng thái gửi hàng">
              <AdminStatusBadge
                tone={
                  statusIsActive(booking.shipment.status) ? 'active' : 'muted'
                }
              >
                {statusLabel(booking.shipment.status)}
              </AdminStatusBadge>
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
      className={styles.detailGrid}
    >
      <header className={styles.recordHeader}>
        <div>
          <p className={styles.recordEyebrow}>VÉ</p>
          <h2 className="admin-data-mono">{ticket.ticketCode}</h2>
        </div>
        <AdminStatusBadge
          tone={statusIsActive(ticket.status) ? 'active' : 'muted'}
        >
          {statusLabel(ticket.status)}
        </AdminStatusBadge>
      </header>

      {ticket.tripIntegrity !== 'CONSISTENT' && (
        <p className={styles.warning} role="status">
          {tripIntegrityMessage(ticket.tripIntegrity)}
        </p>
      )}

      <InfoCard title="Thông tin vé">
        <InfoRows>
          <InfoRow label="Phiếu đặt">
            <Link
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
          <InfoRow label="Chuyến xe">{ticket.trip?.tripCode ?? '—'}</InfoRow>
          <InfoRow label="Khởi hành">
            {formatTimestamp(ticket.trip?.departureAt)}
          </InfoRow>
          <InfoRow label="Ghế">{ticket.seatNumber ?? '—'}</InfoRow>
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
          <p className={styles.emptyText}>
            Chưa có thông tin hoàn tiền gắn với vé này.
          </p>
        ) : (
          <ul className={styles.paymentList}>
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
                <AdminStatusBadge
                  tone={statusIsActive(refund.status) ? 'active' : 'muted'}
                >
                  {statusLabel(refund.status)}
                </AdminStatusBadge>
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
    <InfoCard title={`Lịch sử trạng thái ${kind}`}>
      {loading && !history && (
        <p aria-live="polite" className={styles.emptyText} role="status">
          Đang tải lịch sử…
        </p>
      )}
      {Boolean(error) && (
        <div className={styles.historyError} role="alert">
          <p>
            {detailErrorMessage(
              error,
              kind === 'phiếu' ? 'bookings' : 'tickets',
            )}
          </p>
          <button onClick={onRetry} type="button">
            Tải lại lịch sử
          </button>
        </div>
      )}
      {!loading && !error && history && history.data.length === 0 && (
        <p className={styles.emptyText}>Chưa có lịch sử trạng thái.</p>
      )}
      {!error && history && history.data.length > 0 && (
        <>
          <ol className={styles.timeline}>
            {history.data.map((entry) => (
              <li key={entry.historyId}>
                <span aria-hidden="true" className={styles.timelineMarker} />
                <div className={styles.timelineContent}>
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
            <AdminPagination
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
