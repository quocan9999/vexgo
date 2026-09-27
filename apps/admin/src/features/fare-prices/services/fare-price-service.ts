import { getApiBaseUrl } from '@/lib/api-url';
import { getRoutes } from '@/features/routes/services/route-service';
import type { RouteListQuery } from '@/features/routes/types/route';
import { getVehicleTypes } from '@/features/vehicle-types/services/vehicle-type-service';
import type { VehicleTypeListQuery } from '@/features/vehicle-types/types/vehicle-type';
import {
  FARE_PRICE_EFFECTIVE_STATES,
  FARE_PRICE_STATUSES,
  type CreateFarePriceRequest,
  type FarePrice,
  type FarePriceEffectiveState,
  type FarePriceListQuery,
  type FarePriceOption,
  type PaginatedFarePrices,
  type UpdateFarePriceRequest,
} from '../types/fare-price';

export type FarePriceApiErrorDetail = { field: string; message: string };

export class FarePriceApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details: FarePriceApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'FarePriceApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  );
}

function isFarePriceStatus(value: unknown): value is FarePrice['status'] {
  return FARE_PRICE_STATUSES.some((status) => status === value);
}

function isFarePriceEffectiveState(
  value: unknown,
): value is FarePriceEffectiveState {
  return FARE_PRICE_EFFECTIVE_STATES.some((state) => state === value);
}

function isFarePrice(value: unknown): value is FarePrice {
  return (
    isRecord(value) &&
    isPositiveInteger(value.farePriceId) &&
    isPositiveInteger(value.listedPrice) &&
    value.currency === 'VND' &&
    isDateOnly(value.validFrom) &&
    (value.validTo === null || isDateOnly(value.validTo)) &&
    isFarePriceStatus(value.status) &&
    isFarePriceEffectiveState(value.effectiveState) &&
    isRecord(value.route) &&
    isPositiveInteger(value.route.routeId) &&
    typeof value.route.code === 'string' &&
    typeof value.route.origin === 'string' &&
    typeof value.route.destination === 'string' &&
    isRecord(value.vehicleType) &&
    isPositiveInteger(value.vehicleType.vehicleTypeId) &&
    typeof value.vehicleType.name === 'string' &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}

function isPaginatedFarePrices(value: unknown): value is PaginatedFarePrices {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    value.data.every(isFarePrice) &&
    isRecord(value.meta) &&
    isPositiveInteger(value.meta.page) &&
    isPositiveInteger(value.meta.pageSize) &&
    isNonNegativeInteger(value.meta.totalItems) &&
    isNonNegativeInteger(value.meta.totalPages)
  );
}

function getErrorDetails(value: unknown): FarePriceApiErrorDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((detail): FarePriceApiErrorDetail[] =>
    isRecord(detail) &&
    typeof detail.field === 'string' &&
    typeof detail.message === 'string'
      ? [{ field: detail.field, message: detail.message }]
      : [],
  );
}

async function readResponse(response: Response, resource: string): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new FarePriceApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể tải ${resource} (HTTP ${response.status}).`,
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
      isRecord(body) ? getErrorDetails(body.details) : [],
    );
  }
  return body;
}

export async function getFarePrices(
  query: FarePriceListQuery,
  signal?: AbortSignal,
): Promise<PaginatedFarePrices> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });
  if (query.routeId !== undefined) params.set('routeId', String(query.routeId));
  if (query.vehicleTypeId !== undefined) {
    params.set('vehicleTypeId', String(query.vehicleTypeId));
  }
  if (query.status) params.set('status', query.status);
  if (query.effectiveState) params.set('effectiveState', query.effectiveState);

  const body = await readResponse(
    await fetch(`${getApiBaseUrl()}/api/v1/fare-prices?${params.toString()}`, {
      cache: 'no-store',
      signal,
    }),
    'danh sách bảng giá',
  );
  if (!isPaginatedFarePrices(body)) {
    throw new Error('API trả về danh sách bảng giá không hợp lệ.');
  }
  return body;
}

export async function getFarePriceById(
  farePriceId: number,
  signal?: AbortSignal,
): Promise<FarePrice> {
  const body = await readResponse(
    await fetch(`${getApiBaseUrl()}/api/v1/fare-prices/${farePriceId}`, {
      cache: 'no-store',
      signal,
    }),
    'thông tin bảng giá',
  );
  if (!isRecord(body) || !isFarePrice(body.data)) {
    throw new Error('API trả về thông tin bảng giá không hợp lệ.');
  }
  return body.data;
}

export async function createFarePrice(
  input: CreateFarePriceRequest,
): Promise<FarePrice> {
  const body = await readResponse(
    await fetch(`${getApiBaseUrl()}/api/v1/fare-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
    'bảng giá',
  );
  if (!isRecord(body) || !isFarePrice(body.data)) {
    throw new Error('API trả về thông tin bảng giá không hợp lệ.');
  }
  return body.data;
}

export async function updateFarePrice(
  farePriceId: number,
  input: UpdateFarePriceRequest,
): Promise<FarePrice> {
  const body = await readResponse(
    await fetch(`${getApiBaseUrl()}/api/v1/fare-prices/${farePriceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
    'bảng giá',
  );
  if (!isRecord(body) || !isFarePrice(body.data)) {
    throw new Error('API trả về thông tin bảng giá không hợp lệ.');
  }
  return body.data;
}

type PaginatedItems<T> = { data: T[]; meta: { totalPages: number } };

async function loadRemainingPages<T>(
  firstPage: PaginatedItems<T>,
  getPage: (page: number) => Promise<PaginatedItems<T>>,
): Promise<T[]> {
  const { totalPages } = firstPage.meta;
  if (!Number.isSafeInteger(totalPages) || totalPages < 0) {
    throw new Error('API trả về thông tin phân trang bộ lọc không hợp lệ.');
  }
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
      getPage(index + 2),
    ),
  );
  return [firstPage, ...remaining].flatMap((page) => page.data);
}

const ROUTE_OPTIONS_QUERY: RouteListQuery = {
  page: 1,
  pageSize: 100,
  search: '',
  sortBy: 'code',
  sortDirection: 'asc',
};

const VEHICLE_TYPE_OPTIONS_QUERY: VehicleTypeListQuery = {
  page: 1,
  pageSize: 100,
  search: '',
  sortBy: 'name',
  sortDirection: 'asc',
};

export async function getFarePriceRouteOptions(
  signal?: AbortSignal,
): Promise<FarePriceOption[]> {
  const firstPage = await getRoutes(ROUTE_OPTIONS_QUERY, signal);
  const routes = await loadRemainingPages(firstPage, (page) =>
    getRoutes({ ...ROUTE_OPTIONS_QUERY, page }, signal),
  );
  return routes.map((route) => ({
    id: route.routeId,
    label: `${route.code} — ${route.origin} → ${route.destination}`,
  }));
}

export async function getFarePriceVehicleTypeOptions(
  signal?: AbortSignal,
): Promise<FarePriceOption[]> {
  const firstPage = await getVehicleTypes(VEHICLE_TYPE_OPTIONS_QUERY, signal);
  const vehicleTypes = await loadRemainingPages(firstPage, (page) =>
    getVehicleTypes({ ...VEHICLE_TYPE_OPTIONS_QUERY, page }, signal),
  );
  return vehicleTypes.map((vehicleType) => ({
    id: vehicleType.vehicleTypeId,
    label: vehicleType.name,
  }));
}
