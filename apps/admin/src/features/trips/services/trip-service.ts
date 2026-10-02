import { adminApiFetch } from '@/lib/admin-api-client';
import { getRoutes } from '@/features/routes/services/route-service';
import { getVehicles } from '@/features/vehicles/services/vehicle-service';
import { getApiBaseUrl } from '@/lib/api-url';
import {
  TRIP_STATUSES,
  type CreateTripInput,
  type PaginatedTrips,
  type Trip,
  type TripListQuery,
  type TripLookupOption,
  type TripSeat,
  type TripSeatsResponse,
  type TripStatus,
  type UpdateTripInput,
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

export type TripApiErrorDetail = { field: string; message: string };

export class TripApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details: TripApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'TripApiError';
  }
}

export function isTripNotFoundError(error: unknown): boolean {
  return error instanceof TripApiError && error.code === 'TRIP_NOT_FOUND';
}

async function readResponse(response: Response, resource: string): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể tải ${resource} (HTTP ${response.status}).`;
    const code =
      isRecord(body) && typeof body.error === 'string'
        ? body.error
        : response.status === 404
          ? 'TRIP_NOT_FOUND'
          : undefined;
    const details =
      isRecord(body) && Array.isArray(body.details)
        ? body.details.flatMap((detail): TripApiErrorDetail[] =>
            isRecord(detail) &&
            typeof detail.field === 'string' &&
            typeof detail.message === 'string'
              ? [{ field: detail.field, message: detail.message }]
              : [],
          )
        : [];
    throw new TripApiError(message, code, details);
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
      `${getApiBaseUrl()}/api/v1/trips/${tripId}/operational-detail`,
      { cache: 'no-store', signal },
    ),
    'thông tin chuyến xe',
  );

  if (!isRecord(body) || !isTrip(body.data)) {
    throw new Error('API trả về thông tin chuyến xe không hợp lệ.');
  }

  return body.data;
}

async function writeTrip(
  path: string,
  method: 'POST' | 'PATCH',
  input: unknown,
): Promise<Trip> {
  const response = await adminApiFetch(`${getApiBaseUrl()}/api/v1/trips${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const details =
      isRecord(body) && Array.isArray(body.details)
        ? body.details.flatMap((detail): TripApiErrorDetail[] =>
            isRecord(detail) &&
            typeof detail.field === 'string' &&
            typeof detail.message === 'string'
              ? [{ field: detail.field, message: detail.message }]
              : [],
          )
        : [];
    throw new TripApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể lưu chuyến xe (HTTP ${response.status}).`,
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
      details,
    );
  }
  if (!isRecord(body) || !isTrip(body.data)) {
    throw new Error('API trả về thông tin chuyến xe không hợp lệ.');
  }
  return body.data;
}

export function createTrip(input: CreateTripInput): Promise<Trip> {
  return writeTrip('', 'POST', input);
}

export function updateTrip(
  tripId: number,
  input: UpdateTripInput,
): Promise<Trip> {
  return writeTrip(`/${tripId}`, 'PATCH', input);
}

export function updateTripStatus(
  tripId: number,
  status: 'CHUA_KHOI_HANH' | 'DANG_CHAY' | 'HOAN_THANH',
): Promise<Trip> {
  return writeTrip(`/${tripId}/status`, 'PATCH', { status });
}

export function cancelTrip(tripId: number): Promise<Trip> {
  return writeTrip(`/${tripId}/cancel`, 'POST', {});
}

export async function getTripRouteOptions(
  signal?: AbortSignal,
): Promise<TripLookupOption[]> {
  const firstPage = await getRoutes(
    {
      page: 1,
      pageSize: 100,
      search: '',
      sortBy: 'code',
      sortDirection: 'asc',
      status: 'HOAT_DONG',
    },
    signal,
  );

  const allRoutes = [...firstPage.data];
  if (firstPage.meta.totalPages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
        getRoutes(
          {
            page: index + 2,
            pageSize: 100,
            search: '',
            sortBy: 'code',
            sortDirection: 'asc',
            status: 'HOAT_DONG',
          },
          signal,
        ),
      ),
    );
    for (const page of remainingPages) {
      allRoutes.push(...page.data);
    }
  }

  return allRoutes.map((route) => ({
    id: route.routeId,
    label: `${route.code} — ${route.origin} → ${route.destination}`,
  }));
}

export async function getTripVehicleOptions(
  signal?: AbortSignal,
): Promise<TripLookupOption[]> {
  const firstPage = await getVehicles(
    {
      page: 1,
      pageSize: 100,
      search: '',
      sortBy: 'licensePlate',
      sortDirection: 'asc',
      status: 'HOAT_DONG',
    },
    signal,
  );

  const allVehicles = [...firstPage.data];
  if (firstPage.meta.totalPages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
        getVehicles(
          {
            page: index + 2,
            pageSize: 100,
            search: '',
            sortBy: 'licensePlate',
            sortDirection: 'asc',
            status: 'HOAT_DONG',
          },
          signal,
        ),
      ),
    );
    for (const page of remainingPages) {
      allVehicles.push(...page.data);
    }
  }

  return allVehicles.map((vehicle) => ({
    id: vehicle.vehicleId,
    label: `${vehicle.licensePlate} (${vehicle.vehicleType.name})`,
  }));
}

function isTripSeat(value: unknown): value is TripSeat {
  if (!isRecord(value)) return false;
  if (typeof value.tripSeatId !== 'number') return false;
  if (
    value.status !== 'TRONG' &&
    value.status !== 'DANG_GIU' &&
    value.status !== 'DA_DAT'
  ) {
    return false;
  }
  if (!isRecord(value.seat)) return false;
  if (typeof value.seat.seatId !== 'number') return false;
  if (typeof value.seat.code !== 'string') return false;
  if (
    value.seat.position !== null &&
    typeof value.seat.position !== 'string' &&
    value.seat.position !== undefined
  ) {
    return false;
  }
  return true;
}

function isTripSeatsResponse(value: unknown): value is TripSeatsResponse {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.data) || !value.data.every(isTripSeat)) return false;
  if (!isRecord(value.meta)) return false;
  if (typeof value.meta.tripId !== 'number') return false;
  if (typeof value.meta.total !== 'number') return false;
  if (typeof value.meta.available !== 'number') return false;
  if (typeof value.meta.held !== 'number') return false;
  if (typeof value.meta.booked !== 'number') return false;
  return true;
}

export async function getTripSeats(
  tripId: number,
  query?: { status?: string },
  signal?: AbortSignal,
): Promise<TripSeatsResponse> {
  const url = new URL(`${getApiBaseUrl()}/api/v1/trips/${tripId}/seat-inventory`);
  if (query?.status) {
    url.searchParams.set('status', query.status);
  }
  const response = await adminApiFetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new TripApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể tải danh sách ghế chuyến (HTTP ${response.status}).`,
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }

  if (!isTripSeatsResponse(body)) {
    throw new Error('API trả về danh sách ghế chuyến không hợp lệ.');
  }

  return body;
}
