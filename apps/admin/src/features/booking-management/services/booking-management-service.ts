import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type {
  AdminBookingListItem,
  AdminBookingDetail,
  AdminBookingQuery,
  AdminHistoryEntry,
  AdminPage,
  AdminTicketDetail,
  AdminTicketListItem,
  AdminTicketQuery,
} from '../types/booking-management';

export class BookingManagementApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'BookingManagementApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  );
}

function isMoney(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value);
}

function isCustomer(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.phoneNumber === 'string'
  );
}

function isTrip(value: unknown): boolean {
  return (
    isRecord(value) &&
    isPositiveInteger(value.tripId) &&
    typeof value.tripCode === 'string' &&
    typeof value.origin === 'string' &&
    typeof value.destination === 'string' &&
    isTimestamp(value.departureAt)
  );
}

function isBookingItem(value: unknown): value is AdminBookingListItem {
  return (
    isRecord(value) &&
    isPositiveInteger(value.bookingId) &&
    typeof value.bookingCode === 'string' &&
    isTimestamp(value.bookedAt) &&
    isCustomer(value.customer) &&
    (value.trip === null || isTrip(value.trip)) &&
    typeof value.tripIntegrity === 'string' &&
    isNonNegativeInteger(value.initialTicketCount) &&
    isNonNegativeInteger(value.ticketCount) &&
    isNonNegativeInteger(value.cancelledTicketCount) &&
    isNonNegativeInteger(value.activeTicketCount) &&
    isMoney(value.initialTicketAmount) &&
    typeof value.status === 'string' &&
    typeof value.isPartiallyCancelled === 'boolean'
  );
}

function isTicketItem(value: unknown): value is AdminTicketListItem {
  return (
    isRecord(value) &&
    isPositiveInteger(value.ticketId) &&
    typeof value.ticketCode === 'string' &&
    isPositiveInteger(value.bookingId) &&
    typeof value.bookingCode === 'string' &&
    isCustomer(value.customer) &&
    (value.trip === null || isTrip(value.trip)) &&
    typeof value.tripIntegrity === 'string' &&
    (typeof value.seatNumber === 'string' || value.seatNumber === null) &&
    isMoney(value.actualPrice) &&
    typeof value.status === 'string' &&
    isTimestamp(value.bookedAt)
  );
}

function isPayment(value: unknown): boolean {
  return (
    isRecord(value) &&
    isPositiveInteger(value.paymentId) &&
    isMoney(value.amountVnd) &&
    (typeof value.method === 'string' || value.method === null) &&
    typeof value.status === 'string' &&
    isTimestamp(value.occurredAt) &&
    (isPositiveInteger(value.ticketId) || value.ticketId === null) &&
    (value.allocation === 'TICKET' || value.allocation === 'UNALLOCATED')
  );
}

function isHistoryEntry(value: unknown): value is AdminHistoryEntry {
  return (
    isRecord(value) &&
    isPositiveInteger(value.historyId) &&
    (typeof value.oldStatus === 'string' || value.oldStatus === null) &&
    typeof value.newStatus === 'string' &&
    isTimestamp(value.occurredAt) &&
    typeof value.source === 'string' &&
    (typeof value.reason === 'string' || value.reason === null) &&
    typeof value.isOverride === 'boolean' &&
    (typeof value.operationId === 'string' || value.operationId === null) &&
    (typeof value.actorName === 'string' || value.actorName === null)
  );
}

function isBookingDetail(value: unknown): value is AdminBookingDetail {
  if (!isBookingItem(value) || !isRecord(value)) return false;
  const detail = value as unknown as Record<string, unknown>;
  const paymentSummary = detail.paymentSummary;
  const shipment = detail.shipment;

  return (
    typeof detail.transactionStatus === 'string' &&
    isMoney(detail.transactionTotalAmount) &&
    isRecord(paymentSummary) &&
    Array.isArray(paymentSummary.originalPayments) &&
    paymentSummary.originalPayments.every(isPayment) &&
    isRecord(paymentSummary.refunds) &&
    Array.isArray(paymentSummary.refunds.pending) &&
    paymentSummary.refunds.pending.every(isPayment) &&
    Array.isArray(paymentSummary.refunds.succeeded) &&
    paymentSummary.refunds.succeeded.every(isPayment) &&
    Array.isArray(paymentSummary.refunds.other) &&
    paymentSummary.refunds.other.every(isPayment) &&
    (shipment === null ||
      (isRecord(shipment) &&
        isPositiveInteger(shipment.shipmentId) &&
        typeof shipment.trackingCode === 'string' &&
        typeof shipment.status === 'string' &&
        (isPositiveInteger(shipment.tripId) || shipment.tripId === null) &&
        typeof shipment.tripIntegrity === 'string' &&
        Array.isArray(shipment.items) &&
        shipment.items.every(
          (item) =>
            isRecord(item) &&
            typeof item.name === 'string' &&
            isNonNegativeInteger(item.quantity) &&
            typeof item.itemType === 'string',
        ))) &&
    Array.isArray(detail.tickets) &&
    detail.tickets.every(
      (ticket) =>
        isRecord(ticket) &&
        isPositiveInteger(ticket.ticketId) &&
        typeof ticket.ticketCode === 'string' &&
        (typeof ticket.seatNumber === 'string' || ticket.seatNumber === null) &&
        typeof ticket.status === 'string' &&
        isMoney(ticket.listedPrice) &&
        isMoney(ticket.actualPrice) &&
        (typeof ticket.pickup === 'string' || ticket.pickup === null),
    )
  );
}

function isTicketDetail(value: unknown): value is AdminTicketDetail {
  return (
    isRecord(value) &&
    isPositiveInteger(value.ticketId) &&
    typeof value.ticketCode === 'string' &&
    isRecord(value.booking) &&
    isPositiveInteger(value.booking.bookingId) &&
    typeof value.booking.bookingCode === 'string' &&
    isTimestamp(value.booking.bookedAt) &&
    typeof value.booking.status === 'string' &&
    isNonNegativeInteger(value.booking.initialTicketCount) &&
    isMoney(value.booking.initialTicketAmount) &&
    typeof value.booking.transactionStatus === 'string' &&
    isCustomer(value.customer) &&
    (value.trip === null || isTrip(value.trip)) &&
    typeof value.tripIntegrity === 'string' &&
    (typeof value.seatNumber === 'string' || value.seatNumber === null) &&
    isMoney(value.listedPrice) &&
    isMoney(value.actualPrice) &&
    (typeof value.pickup === 'string' || value.pickup === null) &&
    typeof value.status === 'string' &&
    Array.isArray(value.refunds) &&
    value.refunds.every(
      (refund) =>
        isRecord(refund) &&
        isPositiveInteger(refund.refundId) &&
        isMoney(refund.amountVnd) &&
        (typeof refund.method === 'string' || refund.method === null) &&
        typeof refund.status === 'string' &&
        isTimestamp(refund.occurredAt) &&
        isPositiveInteger(refund.ticketId),
    )
  );
}

function isPage<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is AdminPage<T> {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    value.data.every(isItem) &&
    isRecord(value.meta) &&
    isPositiveInteger(value.meta.page) &&
    isPositiveInteger(value.meta.pageSize) &&
    isNonNegativeInteger(value.meta.totalItems) &&
    isNonNegativeInteger(value.meta.totalPages)
  );
}

function queryParams(query: BookingManagementListStateLike): URLSearchParams {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.bookedFrom) params.set('bookedFrom', query.bookedFrom);
  if (query.bookedTo) params.set('bookedTo', query.bookedTo);
  if (query.departureFrom) params.set('departureFrom', query.departureFrom);
  if (query.departureTo) params.set('departureTo', query.departureTo);
  return params;
}

type BookingManagementListStateLike = {
  page: number;
  pageSize: number;
  search: string;
  status?: string;
  bookedFrom?: string;
  bookedTo?: string;
  departureFrom?: string;
  departureTo?: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
};

async function readPage<T>(
  path: string,
  isItem: (value: unknown) => value is T,
  resource: string,
  signal?: AbortSignal,
): Promise<AdminPage<T>> {
  const body = await readEndpoint(path, resource, signal);
  if (!isPage(body, isItem)) {
    throw new Error(`API trả về danh sách ${resource} không hợp lệ.`);
  }
  return body;
}

async function readEndpoint(
  path: string,
  resource: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await adminApiFetch(`${getApiBaseUrl()}${path}`, {
    cache: 'no-store',
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new BookingManagementApiError(
      response.status < 500 &&
        isRecord(body) &&
        typeof body.message === 'string'
        ? body.message
        : `Không thể tải ${resource} (HTTP ${response.status}).`,
      response.status,
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }
  return body;
}

export function getAdminBookings(
  query: AdminBookingQuery,
  signal?: AbortSignal,
): Promise<AdminPage<AdminBookingListItem>> {
  return readPage(
    `/api/v1/admin/bookings?${queryParams(query).toString()}`,
    isBookingItem,
    'phiếu đặt vé',
    signal,
  );
}

export function getAdminTickets(
  query: AdminTicketQuery,
  signal?: AbortSignal,
): Promise<AdminPage<AdminTicketListItem>> {
  return readPage(
    `/api/v1/admin/tickets?${queryParams(query).toString()}`,
    isTicketItem,
    'vé',
    signal,
  );
}

async function readDetail<T>(
  path: string,
  isItem: (value: unknown) => value is T,
  resource: string,
  signal?: AbortSignal,
): Promise<T> {
  const body = await readEndpoint(path, resource, signal);
  if (!isRecord(body) || !isItem(body.data)) {
    throw new Error(`API trả về thông tin ${resource} không hợp lệ.`);
  }
  return body.data;
}

export function getAdminBookingDetail(
  bookingId: number,
  signal?: AbortSignal,
): Promise<AdminBookingDetail> {
  return readDetail(
    `/api/v1/admin/bookings/${bookingId}`,
    isBookingDetail,
    'phiếu đặt vé',
    signal,
  );
}

export function getAdminTicketDetail(
  ticketId: number,
  signal?: AbortSignal,
): Promise<AdminTicketDetail> {
  return readDetail(
    `/api/v1/admin/tickets/${ticketId}`,
    isTicketDetail,
    'vé',
    signal,
  );
}

export function getAdminBookingHistory(
  bookingId: number,
  page = 1,
  pageSize = 100,
  signal?: AbortSignal,
): Promise<AdminPage<AdminHistoryEntry>> {
  return readPage(
    `/api/v1/admin/bookings/${bookingId}/history?page=${page}&pageSize=${pageSize}`,
    isHistoryEntry,
    'lịch sử phiếu đặt vé',
    signal,
  );
}

export function getAdminTicketHistory(
  ticketId: number,
  page = 1,
  pageSize = 100,
  signal?: AbortSignal,
): Promise<AdminPage<AdminHistoryEntry>> {
  return readPage(
    `/api/v1/admin/tickets/${ticketId}/history?page=${page}&pageSize=${pageSize}`,
    isHistoryEntry,
    'lịch sử vé',
    signal,
  );
}
