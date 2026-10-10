export class ApiError extends Error {
  status: number;
  details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    status: number,
    details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export type CargoItemInput = {
  name: string;
  category?: string;
  quantity: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  note?: string;
};

export type CreateShipmentPayload = {
  tripId: number;
  sender: {
    fullName: string;
    phoneNumber: string;
    email?: string;
  };
  receiver: {
    fullName: string;
    phoneNumber: string;
  };
  items: CargoItemInput[];
  isFragile?: boolean;
  isValuable?: boolean;
  note?: string;
};

export type ShipmentResponseData = {
  shipmentId: number;
  orderId: number;
  waybillCode: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
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

export const shipmentsApi = {
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
  }): Promise<{ data: ShipmentResponseData }> {
    const res = await fetch(`${API_BASE_URL}/shipments/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(
        err.message || 'Không tìm thấy thông tin vận đơn.',
        res.status,
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

  async getCargoCategories(): Promise<{
    data: Array<{
      categoryId: number;
      name: string;
      description: string;
      capacityGroup: string;
    }>;
  }> {
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

