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
  originalTicketSubtotal?: number | string;
  discountAmount?: number | string;
  ticketSubtotal?: number | string;
  promotionCode?: string | null;
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

export type BookingResponseData = {
  bookingId?: number;
  tripId?: number;
  seatIds?: number[];
  bookingCode?: string;
  orderCode?: string | null;
  orderId?: number;
  totalAmount?: number | string;
  shippingFee?: number | string;
  ticketPrice?: number | string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentExpiresAt?: string;
  serverTime?: string;
  status?: string;
  busCompanyName?: string | null;
  vehicleType?: string | null;
  departureTime?: string | null;
  route?: string | null;
  pickup?: string | null;
  dropoff?: string | null;
  seats?: string[];
  cargoItems?: Array<{
    name?: string;
    quantity?: number;
    weight?: number;
    category?: string;
    categoryName?: string;
  }>;
  legs?: Array<{
    route?: string;
    departureTime?: string;
    seats?: string[];
    pickup?: string;
    dropoff?: string;
    busCompanyName?: string;
    vehicleType?: string;
    subtotal?: number;
  }>;
  cargoFee?: number | string;
  ticketSubtotal?: number | string;
  originalTicketSubtotal?: number | string;
  discountAmount?: number | string;
  promotionCode?: string | null;
  origin?: string | null;
  destination?: string | null;
  seatNumbers?: string[];
  passenger?: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
  } | null;
  createdAt?: string;
  [key: string]: unknown;
};

export type CreateBookingPayload = {
  tripId: number;
  seatIds: number[];
  holdToken: string;
  promotionCode?: string;
  expectedPromotionQuote?: {
    originalTotal: string;
    discountAmount: string;
    finalTotal: string;
  };
  senderPointId?: number;
  receiverPointId?: number;
  contact: {
    fullName: string;
    phone: string;
    email?: string;
  };
  pickupPoint: string;
  dropoffPoint: string;
  cargoItems?: Array<{
    name: string;
    type?: string;
    loaiHangHoaId?: number;
    quantity: number;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    category?: string;
    note?: string;
    motorbikeModel?: string;
    bicycleType?: string;
    licensePlate?: string;
  }>;
};

export type CreatedBookingData = BookingResponseData & {
  bookingId: number;
  tripId: number;
  seatIds: number[];
  bookingCode: string;
  orderId: number;
  orderCode: string;
  totalAmount: number | string;
  status: string;
};

export type CreateSeatHoldPayload = {
  tripId: number;
  seatIds: number[];
};

export type BookingQuotePayload = {
  tripId: number;
  seatIds: number[];
  promotionCode: string;
  contactPhone?: string;
};

export type BookingQuoteData = {
  unitPrice: number | string;
  seatCount: number;
  originalTotal: number | string;
  discountAmount: number | string;
  finalTotal: number | string;
  currency: 'VND';
  appliedPromotionCode: string | null;
  identityChecked: boolean;
  phoneEligibilityChecked: boolean;
  requiresPhoneBeforeBooking: boolean;
};

export type SeatHoldData = {
  holdToken: string;
  expiresAt: string;
  tripId: number;
  seatIds: number[];
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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
    payload: CreateBookingPayload,
    accessToken?: string,
  ): Promise<{ data: CreatedBookingData }> {
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
        error.error,
      );
    }

    return res.json();
  },

  async getBookingQuote(
    payload: BookingQuotePayload,
    accessToken?: string,
    signal?: AbortSignal,
  ): Promise<{ data: BookingQuoteData }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(`${API_BASE_URL}/bookings/quote`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Không thể kiểm tra mã khuyến mãi.',
        res.status,
        error.error,
      );
    }

    return res.json();
  },

  async createSeatHold(
    payload: CreateSeatHoldPayload,
    accessToken?: string,
  ): Promise<{ data: SeatHoldData }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(`${API_BASE_URL}/seat-holds`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Không thể giữ ghế đã chọn.',
        res.status,
        error.error,
      );
    }
    return res.json();
  },

  async releaseSeatHold(
    holdToken: string,
    accessToken?: string,
  ): Promise<{ data: { success: boolean } }> {
    const headers: Record<string, string> = { 'X-Hold-Token': holdToken };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(`${API_BASE_URL}/seat-holds`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Không thể giải phóng ghế đang giữ.',
        res.status,
        error.error,
      );
    }
    return res.json();
  },

  async getPublicBookingDetail(
    bookingId: number,
    options?: {
      signal?: AbortSignal;
      accessToken?: string;
      bookingCode?: string;
      phoneNumber?: string;
    },
  ): Promise<{ data: BookingResponseData }> {
    const headers: Record<string, string> = {};
    if (options?.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }
    if (options?.bookingCode) {
      headers['x-booking-code'] = options.bookingCode;
    }
    if (options?.phoneNumber) {
      headers['x-booking-phone'] = options.phoneNumber;
    }
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/detail`, {
      signal: options?.signal,
      headers,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Lấy thông tin đơn đặt vé thất bại',
        res.status,
      );
    }
    return res.json();
  },

};
