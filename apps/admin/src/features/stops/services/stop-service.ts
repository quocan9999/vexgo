import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type { RouteStopItem, TripPassengerPointItem } from '../types/stop';

export class StopApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details: Array<{ field?: string; code?: string; message: string }> = [],
  ) {
    super(message);
    this.name = 'StopApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// 1. Route Stops
export async function getRouteStops(routeId: number): Promise<RouteStopItem[]> {
  const url = `${getApiBaseUrl()}/api/v1/routes/${routeId}/stops`;
  const response = await adminApiFetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new StopApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Không thể tải lộ trình mẫu của tuyến xe.',
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }

  return Array.isArray(body?.data) ? body.data : [];
}

export async function updateRouteStops(
  routeId: number,
  stops: Array<{
    diemDonTraId: number;
    loaiDiem: 'DON' | 'TRA' | 'NGHI';
    phutLech: number;
    thuTu: number;
    phuPhi?: number;
    phutCoMatTruoc?: number;
    nhanKhach?: boolean;
    ghiChu?: string | null;
  }>,
): Promise<RouteStopItem[]> {
  const url = `${getApiBaseUrl()}/api/v1/routes/${routeId}/stops`;
  const response = await adminApiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stops }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new StopApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Không thể cập nhật lộ trình mẫu của tuyến xe.',
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
      Array.isArray(body?.details) ? body.details : [],
    );
  }

  return Array.isArray(body?.data) ? body.data : [];
}

// 2. Trip Passenger Points
export async function getTripStops(tripId: number): Promise<TripPassengerPointItem[]> {
  const url = `${getApiBaseUrl()}/api/v1/trips/${tripId}/passenger-points`;
  const response = await adminApiFetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new StopApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Không thể tải danh sách điểm đón trả của chuyến xe.',
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }

  return Array.isArray(body?.data) ? body.data : [];
}

export async function updateTripStops(
  tripId: number,
  points: Array<{
    diemDonTraId: number;
    loaiDiem: 'DON' | 'TRA' | 'NGHI';
    phutLech?: number;
    thuTu: number;
    phuPhi?: number;
    phutCoMatTruoc?: number;
    nhanKhach?: boolean;
    ghiChu?: string | null;
  }>,
): Promise<TripPassengerPointItem[]> {
  const url = `${getApiBaseUrl()}/api/v1/trips/${tripId}/passenger-points`;
  const response = await adminApiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new StopApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Không thể cập nhật danh sách điểm đón trả của chuyến xe.',
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
      Array.isArray(body?.details) ? body.details : [],
    );
  }

  return Array.isArray(body?.data) ? body.data : [];
}

export async function applyRouteTemplate(
  tripId: number,
): Promise<{ message: string; pointsCount: number }> {
  const url = `${getApiBaseUrl()}/api/v1/trips/${tripId}/passenger-points/apply-route-template`;
  const response = await adminApiFetch(url, {
    method: 'POST',
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new StopApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Không thể áp dụng khuôn lộ trình cho chuyến xe.',
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }

  return body?.data ?? { message: 'Đã áp dụng khuôn lộ trình thành công.', pointsCount: 0 };
}
