import { getApiBaseUrl } from '@/lib/api-url';
import type { PaginatedRoutes, Route, RouteListQuery } from '../types/route';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type RouteApiErrorDetail = { field: string; message: string };

export class RouteApiError extends Error {
  constructor(message: string, readonly code?: string, readonly details: RouteApiErrorDetail[] = []) {
    super(message);
    this.name = 'RouteApiError';
  }
}

async function writeRoute(path: string, method: 'POST' | 'PATCH', input: unknown): Promise<Route> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/routes${path}`, {
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
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error('API trả về thông tin tuyến xe không hợp lệ.');
  }
  return body.data as Route;
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
  const body = await readResponse(await fetch(
    `${getApiBaseUrl()}/api/v1/routes?${params.toString()}`,
    { cache: 'no-store', signal },
  ), 'danh sách tuyến xe');
  if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.meta)) {
    throw new Error('API trả về danh sách tuyến xe không hợp lệ.');
  }
  return body as PaginatedRoutes;
}

export async function getRouteById(routeId: number, signal?: AbortSignal): Promise<Route> {
  const body = await readResponse(await fetch(
    `${getApiBaseUrl()}/api/v1/routes/${routeId}`, { cache: 'no-store', signal },
  ), 'thông tin tuyến xe');
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error('API trả về thông tin tuyến xe không hợp lệ.');
  }
  return body.data as Route;
}
