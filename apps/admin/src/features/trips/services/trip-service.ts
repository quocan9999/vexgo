import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import {
  TRIP_STATUSES,
  type PaginatedTrips,
  type Trip,
  type TripListQuery,
  type TripStatus,
} from '../types/trip';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTripStatus(value: unknown): value is TripStatus {
  return TRIP_STATUSES.some((status) => status === value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isTripRoute(value: unknown): value is Trip['route'] {
  return (
    isRecord(value) &&
    isPositiveInteger(value.routeId) &&
    typeof value.code === 'string' &&
    typeof value.origin === 'string' &&
    typeof value.destination === 'string'
  );
}

function isTripVehicle(value: unknown): value is Trip['vehicle'] {
  return (
    isRecord(value) &&
    isPositiveInteger(value.vehicleId) &&
    typeof value.licensePlate === 'string' &&
    typeof value.status === 'string' &&
    isRecord(value.vehicleType) &&
    isPositiveInteger(value.vehicleType.vehicleTypeId) &&
    typeof value.vehicleType.name === 'string'
  );
}

function isTripSeatSummary(value: unknown): value is NonNullable<Trip['seatSummary']> {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.total) &&
    isNonNegativeInteger(value.available) &&
    isNonNegativeInteger(value.held) &&
    isNonNegativeInteger(value.booked)
  );
}

function isTrip(value: unknown): value is Trip {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.tripId) ||
    typeof value.code !== 'string' ||
    typeof value.departureDate !== 'string' ||
    typeof value.departureTime !== 'string' ||
    !isTripStatus(value.status) ||
    !isTripRoute(value.route) ||
    !isTripVehicle(value.vehicle) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return false;
  }

  if (value.seatSummary !== undefined && !isTripSeatSummary(value.seatSummary)) {
    return false;
  }

  return true;
}

function isPaginatedTrips(value: unknown): value is PaginatedTrips {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    value.data.every(isTrip) &&
    isRecord(value.meta) &&
    isPositiveInteger(value.meta.page) &&
    isPositiveInteger(value.meta.pageSize) &&
    isNonNegativeInteger(value.meta.totalItems) &&
    isNonNegativeInteger(value.meta.totalPages)
  );
}

async function readResponse(response: Response, resource: string): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể tải ${resource} (HTTP ${response.status}).`,
    );
  }
  return body;
}

export async function getTrips(
  query: TripListQuery,
  signal?: AbortSignal,
): Promise<PaginatedTrips> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });

  if (query.status) {
    params.set('status', query.status);
  }
  if (query.routeId) {
    params.set('routeId', String(query.routeId));
  }
  if (query.vehicleId) {
    params.set('vehicleId', String(query.vehicleId));
  }
  if (query.departureDate) {
    params.set('departureDate', query.departureDate);
  }

  const body = await readResponse(
    await adminApiFetch(
      `${getApiBaseUrl()}/api/v1/trips?${params.toString()}`,
      { cache: 'no-store', signal },
    ),
    'danh sách chuyến xe',
  );

  if (!isPaginatedTrips(body)) {
    throw new Error('API trả về danh sách chuyến xe không hợp lệ.');
  }

  return body;
}

export async function getTripById(
  tripId: number,
  signal?: AbortSignal,
): Promise<Trip> {
  const body = await readResponse(
    await adminApiFetch(
      `${getApiBaseUrl()}/api/v1/trips/${tripId}`,
      { cache: 'no-store', signal },
    ),
    'thông tin chuyến xe',
  );

  if (!isRecord(body) || !isTrip(body.data)) {
    throw new Error('API trả về thông tin chuyến xe không hợp lệ.');
  }

  return body.data;
}
