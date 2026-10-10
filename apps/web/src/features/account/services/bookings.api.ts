export type BookingItem = {
  bookingId: number;
  bookingCode: string;
  orderId: number;
  orderCode: string | null;
  ticketCount: number;
  route: string | null;
  origin: string | null;
  destination: string | null;
  departureTime: string | null;
  busCompanyName: string | null;
  vehicleType: string | null;
  seatNumbers: string[];
  totalAmount: number;
  status: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  tickets: Array<{
    ticketId: number;
    ticketCode: string;
    seatNumber: string | null;
    seatPosition: string | null;
    price: number;
    status: string;
    pickup: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type BookingListResponse = {
  data: BookingItem[];
  meta: PaginationMeta;
};

export type BookingQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  code?: string;
  route?: string;
  departureDate?: string;
  status?: string;
  sortBy?: 'createdAt' | 'totalAmount';
  sortDirection?: 'asc' | 'desc';
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const bookingsApi = {
  async getBookings(
    accessToken: string,
    query?: BookingQuery,
  ): Promise<BookingListResponse> {
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
    const url = `${API_BASE_URL}/bookings${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Lấy danh sách đặt vé thất bại',
        res.status,
      );
    }

    return res.json();
  },

  async getBookingDetail(
    accessToken: string,
    bookingId: number,
  ): Promise<{ data: BookingItem }> {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Lấy chi tiết đặt vé thất bại',
        res.status,
      );
    }

    return res.json();
  },

  async createBooking(
    payload: {
      tripId: number;
      seatNumbers: string[];
      passenger: {
        fullName: string;
        phoneNumber: string;
        email: string;
      };
      pickup?: string;
      dropoff?: string;
      cargoItems?: Array<{
        name: string;
        type?: string;
        quantity: number;
        weight: number;
        length?: number;
        width?: number;
        height?: number;
        category?: string;
        note?: string;
      }>;
    },
    accessToken?: string,
  ): Promise<{ data: any }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${API_BASE_URL}/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Tạo đơn đặt vé thất bại',
        res.status,
      );
    }

    return res.json();
  },

  async getPublicBookingDetail(bookingId: number): Promise<{ data: any }> {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/detail`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Lấy thông tin đơn đặt vé thất bại',
        res.status,
      );
    }
    return res.json();
  },

  async confirmPayment(
    bookingId: number,
    paymentMethod: string = 'CHUYEN_KHOAN',
  ): Promise<{ data: any }> {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentMethod }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Xác nhận thanh toán thất bại',
        res.status,
      );
    }
    return res.json();
  },
};
