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
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api/v1';

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
  routeId: number;
  sendDate?: string;
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
  paymentMethod?: 'TAI_BEN';
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
  routeId?: number;
  tripId?: number;
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
  dropoffDeadline?: string | null;
  expectedSendDate?: string | null;
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
    tripId: number | null;
    code: string | null;
    departureTime: string | null;
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
    } | null;
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
  freightPayer?: 'NGUOI_GUI' | 'NGUOI_NHAN';
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
  dropoffDeadline?: string | null;
  scheduledDepartureAt: string | null;
  estimatedArrivalAt: string | null;
  packageCount: number;
  bookingPromotionCode?: string | null;
  timeline: Array<{ status: string; time: string }>;
};

export type CancelShipmentResult = {
  waybillCode: string;
  status: string;
  updatedAt?: string;
  hasPaidBeforeCancel?: boolean;
  message: string;
  cancelledItemIds?: number[];
  remainingItemsCount?: number;
  newTotalFee?: number;
};

export type CustomerShipmentListItem = {
  shipmentId: number;
  waybillCode: string;
  orderCode: string;
  sentAt: string;
  status: string;
  paymentStatus: string;
  paymentExpiresAt?: string;
  dropoffDeadline?: string | null;
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
    tripId: number | null;
    code: string | null;
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

export type ShipmentOption = {
  routeId: number;
  busCompany: { id: number; name: string };
  route: { origin: string; destination: string };
  minimumEstimatedFee: number | null;
  surcharges?: {
    fragile: number;
    valuable: number;
  };
};

export type ShipmentQuote = {
  baseFee: number;
  serviceFee: number;
  totalFee: number;
  surcharges?: {
    fragile: number;
    valuable: number;
  };
};

// Native date inputs use ISO internally; the shipment API uses DD-MM-YYYY.
export function shipmentApiDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Ngày gửi không hợp lệ.');
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export const shipmentsApi = {
  async getOptions(query: {
    from: string;
    to: string;
    sendDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams({
      from: query.from,
      to: query.to,
      page: String(query.page ?? 1),
      pageSize: String(query.pageSize ?? 10),
    });
    const formattedSendDate = shipmentApiDate(query.sendDate);
    if (formattedSendDate) {
      params.set('sendDate', formattedSendDate);
    }
    const res = await fetch(`${API_BASE_URL}/shipments/options?${params}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Không thể tải nhà xe nhận hàng.',
        res.status,
      );
    }
    return res.json() as Promise<{
      data: ShipmentOption[];
      meta: CustomerShipmentListResponse['meta'];
    }>;
  },

  async getQuote(
    payload: Pick<
      CreateShipmentPayload,
      | 'routeId'
      | 'sendDate'
      | 'senderPointId'
      | 'receiverPointId'
      | 'items'
      | 'isFragile'
      | 'isValuable'
    >,
  ): Promise<{ data: ShipmentQuote }> {
    const formattedSendDate = shipmentApiDate(payload.sendDate);
    const body: Record<string, unknown> = {
      ...payload,
    };
    if (formattedSendDate) {
      body.sendDate = formattedSendDate;
    } else {
      delete body.sendDate;
    }
    const res = await fetch(`${API_BASE_URL}/shipments/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Không thể báo cước. Vui lòng thử lại.',
        res.status,
        error.details,
      );
    }
    return res.json();
  },
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
        err.message || 'Không thể tải điểm gửi/nhận của chuyến xe.',
        res.status,
      );
    }
    return res.json();
  },

  async getRoutePointsByRoute(
    routeId: number,
  ): Promise<{ data: ShipmentRoutePoints }> {
    const res = await fetch(
      `${API_BASE_URL}/shipments/routes/${routeId}/route-points`,
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
    idempotencyKey?: string,
  ): Promise<{ data: ShipmentResponseData }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const formattedSendDate = shipmentApiDate(payload.sendDate);
    const body: Record<string, unknown> = {
      ...payload,
    };
    if (formattedSendDate) {
      body.sendDate = formattedSendDate;
    } else {
      delete body.sendDate;
    }

    const res = await fetch(`${API_BASE_URL}/shipments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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

  async lookupShipment(
    params: {
      waybillCode: string;
      phoneNumber: string;
    },
    options: { signal?: AbortSignal } = {},
  ): Promise<{ data: PublicShipmentLookupData }> {
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

  async cancelShipment(
    params: {
      waybillCode: string;
      phoneNumber: string;
      reason?: string;
      itemIds?: number[];
      itemIndices?: number[];
    },
    accessToken?: string,
  ): Promise<{ data: CancelShipmentResult }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${API_BASE_URL}/shipments/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(
        err.message || 'Không thể hủy đơn gửi hàng.',
        res.status,
        err.details,
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
