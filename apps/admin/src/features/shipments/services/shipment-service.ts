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

export interface UpdateShipmentStatusPayload {
  status: ShipmentDetail['status'];
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
    let errorMessage = 'Không thể cập nhật trạng thái phiếu gửi hàng.';
    let errorData: ShipmentStatusErrorResponse | null = null;
    try {
      errorData = (await response.json()) as ShipmentStatusErrorResponse;
      if (response.status === 409) {
        if (errorData?.error === 'SHIPMENT_REFUND_REQUIRED') {
          errorMessage =
            'Phiếu gửi hàng đã thanh toán thành công, không thể hủy khi chưa có quy trình hoàn tiền trong MVP.';
        } else if (errorData?.error === 'CONCURRENT_STATUS_UPDATE') {
          errorMessage =
            'Trạng thái phiếu gửi đã được cập nhật bởi thao tác khác. Dữ liệu mới đã được tải lại; vui lòng kiểm tra trước khi tiếp tục.';
        } else if (errorData?.error === 'INVALID_STATUS_TRANSITION') {
          errorMessage =
            'Trạng thái phiếu gửi đã thay đổi hoặc thao tác không còn hợp lệ. Dữ liệu mới đã được tải lại; vui lòng kiểm tra trước khi tiếp tục.';
        } else if (errorData?.message) {
          errorMessage = Array.isArray(errorData.message)
            ? errorData.message.join(', ')
            : errorData.message;
        }
      } else if (response.status === 403) {
        errorMessage = 'Bạn không có quyền cập nhật trạng thái phiếu gửi hàng.';
      } else if (response.status === 404) {
        errorMessage = 'Không tìm thấy phiếu gửi hàng.';
      } else if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message;
      }
    } catch {
      // Dùng default errorMessage
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
