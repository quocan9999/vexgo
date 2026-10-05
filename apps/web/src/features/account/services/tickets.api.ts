export type TicketItem = {
  ticketId: number;
  ticketCode: string;
  bookingId: number;
  bookingCode: string | null;
  route: string | null;
  origin: string | null;
  destination: string | null;
  busCompanyName: string | null;
  vehicleType: string | null;
  departureTime: string | null;
  arrivalTime?: string | null;
  seatNumber: string | null;
  seatPosition: string | null;
  price: number;
  status: string;
  bookingStatus: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  pickup: string | null;
  dropoff: string | null;
  passengerName: string | null;
  passengerPhone: string | null;
  createdAt: string;
  updatedAt: string;
  cancellation?: TicketCancellationQuote;
};

export type TicketCancellationQuote = {
  eligible: boolean;
  reason?:
    | 'ALREADY_CANCELLED'
    | 'ALREADY_DEPARTED'
    | 'LESS_THAN_12_HOURS'
    | 'DEPARTURE_TIME_UNAVAILABLE';
  cancelFeeRate: number;
  cancelFee: number;
  refundAmount: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type TicketListResponse = {
  data: TicketItem[];
  meta: PaginationMeta;
};

export type TicketQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  code?: string;
  route?: string;
  departureDate?: string;
  status?: string;
  sortBy?: 'createdAt' | 'departureTime' | 'price';
  sortDirection?: 'asc' | 'desc';
};

export class ApiError extends Error {
  status: number;
  error?: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    error?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
    this.details = details;
  }
}

export function isCancellationQuoteExpiredError(
  error: unknown,
): error is ApiError {
  return (
    error instanceof ApiError && error.error === 'CANCELLATION_QUOTE_EXPIRED'
  );
}

export function isCancellationCutoffPassedError(
  error: unknown,
): error is ApiError {
  return (
    error instanceof ApiError && error.error === 'CANCELLATION_CUTOFF_PASSED'
  );
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const ticketsApi = {
  async getTickets(
    accessToken: string,
    query?: TicketQuery,
  ): Promise<TicketListResponse> {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    if (query?.search) params.set('search', query.search);
    if (query?.code) params.set('code', query.code);
    if (query?.route) params.set('route', query.route);
    if (query?.departureDate) params.set('departureDate', query.departureDate);
    if (query?.status) params.set('status', query.status);
    if (query?.sortBy) params.set('sortBy', query.sortBy);
    if (query?.sortDirection) params.set('sortDirection', query.sortDirection);

    const queryString = params.toString();
    const url = `${API_BASE_URL}/tickets${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Lấy danh sách vé thất bại',
        res.status,
        error.error,
        error.details,
      );
    }

    return res.json();
  },

  async getTicketDetail(
    accessToken: string,
    ticketId: number,
  ): Promise<{ data: TicketItem }> {
    const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Lấy chi tiết vé thất bại',
        res.status,
        error.error,
        error.details,
      );
    }

    return res.json();
  },

  async lookupTicket(
    ticketCode: string,
    phoneNumber: string,
  ): Promise<{ data: TicketItem }> {
    const res = await fetch(`${API_BASE_URL}/tickets/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketCode: ticketCode.trim(),
        phoneNumber: phoneNumber.trim(),
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Không tìm thấy vé hoặc thông tin không khớp',
        res.status,
        error.error,
        error.details,
      );
    }

    return res.json();
  },

  async cancelTicket(
    ticketCode: string,
    phoneNumber: string,
    reason: string | undefined,
    expectedCancelFeeRate: number,
  ): Promise<{ data: CancelTicketResult }> {
    const res = await fetch(`${API_BASE_URL}/tickets/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticketCode: ticketCode.trim(),
        phoneNumber: phoneNumber.trim(),
        reason,
        expectedCancelFeeRate,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Hủy vé thất bại',
        res.status,
        error.error,
        error.details,
      );
    }

    return res.json();
  },
};

export interface CancelTicketResult {
  ticketId: number;
  ticketCode: string;
  status: string;
  cancelFee: number;
  refundAmount: number;
  message: string;
}
