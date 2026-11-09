import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type {
  ShipmentDetail,
  ShipmentDetailResponse,
  ShipmentQuery,
  ShipmentStatus,
  ShipmentsResponse,
} from '../types/shipment';

export async function getShipments(
  query: ShipmentQuery = {},
  signal?: AbortSignal,
): Promise<ShipmentsResponse> {
  const params = new URLSearchParams();

  if (query.page && query.page > 0) {
    params.set('page', String(query.page));
  }
  if (query.pageSize && query.pageSize > 0) {
    params.set('pageSize', String(query.pageSize));
  }
  if (query.search && query.search.trim()) {
    params.set('search', query.search.trim());
  }
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.sortDirection) {
    params.set('sortDirection', query.sortDirection);
  }

  const queryString = params.toString();
  const endpoint = queryString
    ? `${getApiBaseUrl()}/api/v1/shipments?${queryString}`
    : `${getApiBaseUrl()}/api/v1/shipments`;

  const response = await adminApiFetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    let errorMessage = 'Unable to load shipments list.';
    try {
      const errorData = await response.json();
      if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message;
      }
    } catch {
      // Use default errorMessage
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function getShipmentById(
  id: number,
  signal?: AbortSignal,
): Promise<ShipmentDetail> {
  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/shipments/${id}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    },
  );

  if (!response.ok) {
    let errorMessage = 'Unable to load shipment details.';
    try {
      const errorData = await response.json();
      if (response.status === 404) {
        errorMessage = 'Shipment not found.';
      } else if (response.status === 403) {
        errorMessage = 'You do not have permission to view this shipment.';
      } else if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message;
      }
    } catch {
      // Use default errorMessage
    }
    throw new Error(errorMessage);
  }

  const json: ShipmentDetailResponse = await response.json();
  return json.data;
}

export interface UpdateShipmentStatusPayload {
  status: ShipmentStatus;
  note?: string;
}

export interface UpdateShipmentStatusResult {
  shipmentId: number;
  status: ShipmentDetail['status'];
  updatedAt: string;
}

type ShipmentStatusErrorResponse = {
  error?: string;
  message?: string | string[];
};

export class ShipmentStatusUpdateError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ShipmentStatusUpdateError';
  }
}

export async function updateShipmentStatus(
  id: number,
  payload: UpdateShipmentStatusPayload,
  signal?: AbortSignal,
): Promise<UpdateShipmentStatusResult> {
  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/shipments/${id}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    },
  );

  if (!response.ok) {
    let errorMessage = 'Unable to update shipment status.';
    let errorData: ShipmentStatusErrorResponse | null = null;
    try {
      errorData = (await response.json()) as ShipmentStatusErrorResponse;
      if (response.status === 409) {
        if (errorData?.error === 'SHIPMENT_PAYMENT_NOT_CONFIRMED') {
          errorMessage =
            'Shipment status can only be updated to in-transit after payment is confirmed.';
        } else if (errorData?.error === 'CONCURRENT_STATUS_UPDATE') {
          errorMessage =
            'Shipment status was updated by another operation. Fresh data has been reloaded; please verify before continuing.';
        } else if (errorData?.error === 'INVALID_STATUS_TRANSITION') {
          errorMessage =
            'Shipment status has changed or operation is invalid. Fresh data has been reloaded; please verify before continuing.';
        } else if (errorData?.message) {
          errorMessage = Array.isArray(errorData.message)
            ? errorData.message.join(', ')
            : errorData.message;
        }
      } else if (response.status === 403) {
        errorMessage = 'You do not have permission to update shipment status.';
      } else if (response.status === 404) {
        errorMessage = 'Shipment not found.';
      } else if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message;
      }
    } catch {
      // Use default errorMessage
    }
    throw new ShipmentStatusUpdateError(
      errorMessage,
      response.status,
      errorData?.error,
    );
  }

  const json = (await response.json()) as {
    data: UpdateShipmentStatusResult;
  };
  return json.data;
}

export interface AdminShipmentRouteOption {
  routeId: number;
  busCompany: { id: number; name: string };
  route: { origin: string; destination: string };
  minimumEstimatedFee: number | null;
}

export interface AdminCargoCategory {
  categoryId: number;
  name: string;
  description: string;
  capacityGroup: string;
}

export interface AdminRoutePointOption {
  id: number;
  name: string;
  address: string;
}

export interface AdminRoutePointsResult {
  senderPoints: AdminRoutePointOption[];
  receiverPoints: AdminRoutePointOption[];
  rates: unknown[];
}

export interface AdminShipmentQuoteItem {
  name: string;
  quantity: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  serviceType?: 'NORMAL' | 'FRAGILE' | 'VALUABLE';
  category?: string;
  loaiHangHoaId?: number;
}

export interface AdminShipmentQuotePayload {
  routeId: number;
  sendDate?: string;
  senderPointId: number;
  receiverPointId: number;
  items: AdminShipmentQuoteItem[];
  isFragile?: boolean;
  isValuable?: boolean;
}

export interface AdminShipmentQuoteResult {
  baseFee: number;
  serviceFee: number;
  totalFee: number;
  rates: Array<{
    categoryId: number;
    rateId: number;
    billableWeight: number;
    fee: number;
  }>;
}

export interface CreateAdminShipmentPayload {
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
  items: Array<{
    name: string;
    quantity: number;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    serviceType?: 'NORMAL' | 'FRAGILE' | 'VALUABLE';
    note?: string;
    category?: string;
    loaiHangHoaId?: number;
  }>;
  isFragile?: boolean;
  isValuable?: boolean;
  note?: string;
  freightPayer: 'NGUOI_GUI' | 'NGUOI_NHAN';
  paymentMethod?: 'TAI_BEN';
  acceptAtCounter?: boolean;
  collectPaymentAtCounter?: boolean;
}

export interface CreateAdminShipmentResult {
  shipmentId: number;
  waybillCode: string;
  orderCode: string;
  orderId: number;
  status: string;
  paymentStatus: string;
  pricing: {
    baseFee: number;
    serviceFee: number;
    discount: number;
    totalFee: number;
  };
}

export async function getAdminShipmentRouteOptions(
  query?: { from?: string; to?: string },
  signal?: AbortSignal,
): Promise<AdminShipmentRouteOption[]> {
  const params = new URLSearchParams({ page: '1', pageSize: '100' });
  if (query?.from?.trim()) params.set('from', query.from.trim());
  if (query?.to?.trim()) params.set('to', query.to.trim());

  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/shipments/options?${params.toString()}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
  );
  if (!response.ok) {
    throw new Error('Unable to load shipment routes list.');
  }
  const json = (await response.json()) as { data: AdminShipmentRouteOption[] };
  return json.data ?? [];
}

export async function getAdminShipmentCategories(
  signal?: AbortSignal,
): Promise<AdminCargoCategory[]> {
  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/shipments/categories`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
  );
  if (!response.ok) {
    throw new Error('Unable to load cargo categories list.');
  }
  const json = (await response.json()) as { data: AdminCargoCategory[] };
  return json.data ?? [];
}

export async function getAdminRoutePointsByRoute(
  routeId: number,
  signal?: AbortSignal,
): Promise<AdminRoutePointsResult> {
  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/shipments/routes/${routeId}/route-points`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
  );
  if (!response.ok) {
    throw new Error('Unable to load route points list.');
  }
  const json = (await response.json()) as { data: AdminRoutePointsResult };
  return json.data ?? { senderPoints: [], receiverPoints: [], rates: [] };
}

export async function quoteAdminShipment(
  payload: AdminShipmentQuotePayload,
  signal?: AbortSignal,
): Promise<AdminShipmentQuoteResult> {
  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/shipments/quotes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    },
  );
  if (!response.ok) {
    let msg = 'Unable to calculate freight quote.';
    try {
      const err = await response.json();
      if (err?.message) {
        msg = Array.isArray(err.message) ? err.message.join(', ') : err.message;
      }
    } catch {
      // Ignore json parse error
    }
    throw new Error(msg);
  }
  const json = (await response.json()) as { data: AdminShipmentQuoteResult };
  return json.data;
}

export async function createAdminShipment(
  payload: CreateAdminShipmentPayload,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<CreateAdminShipmentResult> {
  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/shipments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal,
    },
  );
  if (!response.ok) {
    let msg = 'Unable to create counter shipment.';
    try {
      const err = await response.json();
      if (err?.message) {
        msg = Array.isArray(err.message) ? err.message.join(', ') : err.message;
      }
    } catch {
      // Ignore json parse error
    }
    throw new Error(msg);
  }
  const json = (await response.json()) as { data: CreateAdminShipmentResult };
  return json.data;
}
