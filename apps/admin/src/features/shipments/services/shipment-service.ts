import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type {
  ShipmentDetail,
  ShipmentDetailResponse,
  ShipmentQuery,
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
    let errorMessage = 'Không thể tải danh sách phiếu gửi hàng.';
    try {
      const errorData = await response.json();
      if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message;
      }
    } catch {
      // Dùng default errorMessage
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function getShipmentById(
  id: number,
  signal?: AbortSignal,
): Promise<ShipmentDetail> {
  const response = await adminApiFetch(`${getApiBaseUrl()}/api/v1/shipments/${id}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    let errorMessage = 'Không thể tải thông tin chi tiết phiếu gửi hàng.';
    try {
      const errorData = await response.json();
      if (response.status === 404) {
        errorMessage = 'Không tìm thấy phiếu gửi hàng.';
      } else if (response.status === 403) {
        errorMessage = 'Bạn không có quyền xem phiếu gửi hàng này.';
      } else if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message;
      }
    } catch {
      // Dùng default errorMessage
    }
    throw new Error(errorMessage);
  }

  const json: ShipmentDetailResponse = await response.json();
  return json.data;
}
