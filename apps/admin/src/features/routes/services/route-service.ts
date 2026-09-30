import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import { ROUTE_STATUSES, type PaginatedRoutes, type Route, type RouteListQuery } from '../types/route';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRouteStatus(value: unknown): value is Route['status'] {
  return ROUTE_STATUSES.some((status) => status === value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRoute(value: unknown): value is Route {
  return isRecord(value) &&
    isPositiveInteger(value.routeId) &&
    typeof value.code === 'string' &&
    typeof value.origin === 'string' &&
    typeof value.destination === 'string' &&
    isRouteStatus(value.status) &&
    isRecord(value.busCompany) &&
    isPositiveInteger(value.busCompany.busCompanyId) &&
    typeof value.busCompany.code === 'string' &&
    typeof value.busCompany.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string';
}

function isPaginatedRoutes(value: unknown): value is PaginatedRoutes {
  return isRecord(value) &&
    Array.isArray(value.data) && value.data.every(isRoute) &&
    isRecord(value.meta) &&
    isPositiveInteger(value.meta.page) &&
    isPositiveInteger(value.meta.pageSize) &&
    isNonNegativeInteger(value.meta.totalItems) &&
    isNonNegativeInteger(value.meta.totalPages);
}

export type RouteApiErrorDetail = { field: string; message: string };

export class RouteApiError extends Error {
  constructor(message: string, readonly code?: string, readonly details: RouteApiErrorDetail[] = []) {
    super(message);
    this.name = 'RouteApiError';
  }
}

async function writeRoute(path: string, method: 'POST' | 'PATCH', input: unknown): Promise<Route> {
  const response = await adminApiFetch(`${getApiBaseUrl()}/api/v1/routes${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const details = isRecord(body) && Array.isArray(body.details)
      ? body.details.flatMap((detail): RouteApiErrorDetail[] =>
          isRecord(detail) && typeof detail.field === 'string' && typeof detail.message === 'string'
            ? [{ field: detail.field, message: detail.message }] : [])
      : [];
    throw new RouteApiError(
      isRecord(body) && typeof body.message === 'string' ? body.message : `Không thể lưu tuyến xe (HTTP ${response.status}).`,
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
      details,
    );
  }
  if (!isRecord(body) || !isRoute(body.data)) {
    throw new Error('API trả về thông tin tuyến xe không hợp lệ.');
  }
  return body.data;
}

export type CreateRouteInput = {
  code: string;
  origin: string;
  destination: string;
  busCompanyId: number;
  status: Route['status'];
};

export type UpdateRouteInput = Pick<Route, 'origin' | 'destination'>;

export function createRoute(input: CreateRouteInput): Promise<Route> {
  return writeRoute('', 'POST', input);
}

export function updateRoute(routeId: number, input: UpdateRouteInput): Promise<Route> {
  return writeRoute(`/${routeId}`, 'PATCH', input);
}

export type UpdateRouteStatusInput = Pick<Route, 'status'>;

export function updateRouteStatus(routeId: number, input: UpdateRouteStatusInput): Promise<Route> {
  return writeRoute(`/${routeId}/status`, 'PATCH', input);
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

export async function getRoutes(query: RouteListQuery, signal?: AbortSignal): Promise<PaginatedRoutes> {
  const params = new URLSearchParams({
    page: String(query.page), pageSize: String(query.pageSize), search: query.search,
    sortBy: query.sortBy, sortDirection: query.sortDirection,
  });
  if (query.status) params.set('status', query.status);
  if (query.busCompanyId) params.set('busCompanyId', String(query.busCompanyId));
  const body = await readResponse(await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/routes?${params.toString()}`,
    { cache: 'no-store', signal },
  ), 'danh sách tuyến xe');
  if (!isPaginatedRoutes(body)) {
    throw new Error('API trả về danh sách tuyến xe không hợp lệ.');
  }
  return body;
}

export async function getRouteById(routeId: number, signal?: AbortSignal): Promise<Route> {
  const body = await readResponse(await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/routes/${routeId}`, { cache: 'no-store', signal },
  ), 'thông tin tuyến xe');
  if (!isRecord(body) || !isRoute(body.data)) {
    throw new Error('API trả về thông tin tuyến xe không hợp lệ.');
  }
  return body.data;
}
