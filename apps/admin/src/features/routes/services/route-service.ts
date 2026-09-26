import { getApiBaseUrl } from '@/lib/api-url';
import type { PaginatedRoutes, Route, RouteListQuery } from '../types/route';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
