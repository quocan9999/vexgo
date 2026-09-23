import type {
  BusCompanyListQuery,
  PaginatedBusCompanies,
} from '../types/bus-company';
import { getApiBaseUrl } from '@/lib/api-url';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(body: unknown, status: number) {
  if (isRecord(body) && typeof body.message === 'string') {
    return body.message;
  }
  return `Không thể tải danh sách nhà xe (HTTP ${status}).`;
}

function localDateBoundary(dateValue: string, endOfDay: boolean) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const boundary = endOfDay
    ? new Date(year, month - 1, day + 1)
    : new Date(year, month - 1, day);

  if (endOfDay) boundary.setTime(boundary.getTime() - 1);
  return boundary.toISOString();
}

export async function getBusCompanies(
  query: BusCompanyListQuery,
  signal?: AbortSignal,
): Promise<PaginatedBusCompanies> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });
  if (query.status) searchParams.set('status', query.status);
  if (query.createdFrom) {
    searchParams.set('createdFrom', localDateBoundary(query.createdFrom, false));
  }
  if (query.createdTo) {
    searchParams.set('createdTo', localDateBoundary(query.createdTo, true));
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/bus-companies?${searchParams.toString()}`,
    { cache: 'no-store', signal },
  );
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.status));
  }
  if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.meta)) {
    throw new Error('API trả về dữ liệu nhà xe không hợp lệ.');
  }

  return body as unknown as PaginatedBusCompanies;
}
