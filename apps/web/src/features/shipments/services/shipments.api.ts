export class ApiError extends Error {
  status: number;
  details?: Array<{ field: string; message: string }>;
  retryAfter: string | null;

  constructor(
    message: string,
    status: number,
    details?: Array<{ field: string; message: string }>,
    retryAfter: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export type CargoItemInput = {
  name: string;
  category?: string;
  loaiHangHoaId?: number;
  quantity: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  serviceType?: 'NORMAL' | 'FRAGILE' | 'VALUABLE';
  note?: string;
};

export type CreateShipmentPayload = {
  tripId: number;
  senderPointId: number;
  receiverPointId: number;
  sender: {
    fullName: string;
    phoneNumber: string;
    email?: string;
  };
  receiver: {
    fullName: string;
    phoneNumber: string;
    cccd?: string;
  };
  items: CargoItemInput[];
  isFragile?: boolean;
  isValuable?: boolean;
  note?: string;
  freightPayer?: 'NGUOI_GUI' | 'NGUOI_NHAN';
  paymentMethod?: 'TAI_BEN' | 'ONLINE';
};

export type ShipmentRoutePoint = {
  id: number;
  name: string;
  address: string;
};

export type ShipmentCargoRate = {
  senderPointId: number;
  receiverPointId: number;
  categoryId: number;
  minWeight: number;
  maxWeight: number | null;
  fee: number;
};

export type ShipmentRoutePoints = {
  tripId: number;
  senderPoints: ShipmentRoutePoint[];
  receiverPoints: ShipmentRoutePoint[];
  rates?: ShipmentCargoRate[];
  minFee?: number | null;
};

export type CargoCategory = {
  categoryId: number;
  name: string;
  description: string;
  capacityGroup: string;
};

export type ShipmentResponseData = {
  shipmentId: number;
  orderId: number;
  paymentId: number;
  paymentExpiresAt: string;
  waybillCode: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  freightPayer?: 'NGUOI_GUI' | 'NGUOI_NHAN';
  sentAt: string;
  pricing: {
    baseFee: number;
    serviceFee: number;
    discount: number;
    totalFee: number;
  };
  sender: {
    fullName: string;
    phoneNumber: string;
    email: string | null;
  };
  receiver: {
    fullName: string;
    phoneNumber: string;
    cccd?: string | null;
  };
  pickupPoint: {
    id: number;
    name: string;
    address: string;
  };
  dropoffPoint: {
    id: number;
    name: string;
    address: string;
  };
  trip: {
    tripId: number;
    code: string;
    departureTime: string;
    route: {
      origin: string;
      destination: string;
    };
    busCompany: {
      id: number;
      name: string;
    };
    vehicle: {
      licensePlate: string;
    };
  };
  items: Array<{
    id: number;
    name: string;
    quantity: number;
    weight: number;
    category: string;
    dimensions: string | null;
    note: string | null;
  }>;
  timeline?: Array<{
    id: number;
    status: string;
    time: string;
    note: string | null;
  }>;
  note?: string | null;
};

export type PublicShipmentLookupData = {
  waybillCode: string;
  status: string;
  orderCode?: string;
  amount?: number | string;
  orderStatus?: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  paymentExpiresAt?: string;
  serverTime?: string;
  pickupPoint: { name: string; address: string };
  dropoffPoint: { name: string; address: string };
  carrier: { name: string };
  route: { origin: string; destination: string };
  scheduledDepartureAt: string;
  estimatedArrivalAt: string | null;
  packageCount: number;
  bookingPromotionCode?: string | null;
  timeline: Array<{ status: string; time: string }>;
};

export type CustomerShipmentListItem = {
  shipmentId: number;
  waybillCode: string;
  orderCode: string;
  sentAt: string;
  status: string;
  paymentStatus: string;
  paymentExpiresAt?: string;
  totalFee: number;
  sender: {
    fullName: string;
    phoneNumber: string;
  };
  receiver: {
    fullName: string;
    phoneNumber: string;
  };
  trip: {
    tripId: number;
    code: string;
    route: string;
    busCompany: string;
  };
  itemsCount: number;
};

export type CustomerShipmentListResponse = {
  data: CustomerShipmentListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export const shipmentsApi = {
  async getCustomerShipments(
    accessToken: string,
    query?: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
    },
  ): Promise<CustomerShipmentListResponse> {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    if (query?.search) params.set('search', query.search);
    if (query?.status) params.set('status', query.status);

    const qs = params.toString();
    const url = `${API_BASE_URL}/shipments${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(
        err.message || 'Không thể tải danh sách vận đơn gửi hàng.',
        res.status,
      );
    }

    return res.json();
  },

  async getRoutePoints(tripId: number): Promise<{ data: ShipmentRoutePoints }> {
    const res = await fetch(
      `${API_BASE_URL}/shipments/trips/${tripId}/route-points`,
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(
        err.message || 'Không thể tải điểm gửi và điểm nhận của chuyến xe.',
        res.status,
      );
    }
    return res.json();
  },

  async createShipment(
    payload: CreateShipmentPayload,
    accessToken?: string,
  ): Promise<{ data: ShipmentResponseData }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${API_BASE_URL}/shipments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(
        err.message || 'Tạo đơn gửi hàng thất bại.',
        res.status,
        err.details,
      );
    }

    return res.json();
  },

  async lookupShipment(params: {
    waybillCode: string;
    phoneNumber: string;
  }, options: { signal?: AbortSignal } = {}): Promise<{ data: PublicShipmentLookupData }> {
    const res = await fetch(`${API_BASE_URL}/shipments/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal: options.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(
        err.message || 'Không tìm thấy thông tin vận đơn.',
        res.status,
        undefined,
        res.headers?.get('Retry-After') ?? null,
      );
    }

    return res.json();
  },

  async getShipmentDetail(
    id: number,
    accessToken?: string,
  ): Promise<{ data: ShipmentResponseData }> {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${API_BASE_URL}/shipments/${id}`, { headers });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(
        err.message || 'Không tìm thấy thông tin đơn gửi hàng.',
        res.status,
      );
    }

    return res.json();
  },

  async getCargoCategories(): Promise<{ data: CargoCategory[] }> {
    const res = await fetch(`${API_BASE_URL}/shipments/categories`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(
        err.message || 'Không thể tải danh mục loại hàng hóa.',
        res.status,
      );
    }
    return res.json();
  },
};

