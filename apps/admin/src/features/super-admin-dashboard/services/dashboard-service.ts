import busCompaniesFixture from '../data/bus-companies.json';
import overviewFixture from '../data/overview.json';
import type {
  BusCompany,
  CompanyListQuery,
  CompanySortKey,
  DashboardOverview,
  PaginatedBusCompanies,
} from '../types/dashboard';

const apiPrefix = '/api/v1/super-admin/dashboard';
const collator = new Intl.Collator('vi', {
  sensitivity: 'base',
  numeric: true,
});

function getDataSource() {
  return process.env.NEXT_PUBLIC_ADMIN_DATA_SOURCE?.toLowerCase() === 'api'
    ? 'api'
    : 'mock';
}

function getApiBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('Thiếu NEXT_PUBLIC_API_URL để kết nối API quản trị.');
  }
  return baseUrl;
}

async function readApiResponse<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal });
  const body = (await response.json().catch(() => null)) as
    | { data?: T; payload?: T; message?: string; error?: { message?: string } }
    | T
    | null;

  if (!response.ok) {
    const errorMessage =
      body && typeof body === 'object' && 'error' in body
        ? body.error?.message
        : body && typeof body === 'object' && 'message' in body
          ? body.message
          : undefined;
    throw new Error(
      errorMessage || `Không thể tải dữ liệu (HTTP ${response.status}).`,
    );
  }

  if (!body) throw new Error('API trả về dữ liệu không hợp lệ.');
  if (typeof body === 'object' && ('data' in body || 'payload' in body)) {
    const envelope = body as { data?: T; payload?: T };
    const payload = envelope.data ?? envelope.payload;
    if (payload === undefined) throw new Error('API không có payload hợp lệ.');
    return payload;
  }
  return body as T;
}

export async function getDashboardOverview(
  signal?: AbortSignal,
): Promise<DashboardOverview> {
  if (getDataSource() === 'api') {
    return readApiResponse<DashboardOverview>(
      `${getApiBaseUrl()}${apiPrefix}/overview`,
      signal,
    );
  }

  return {
    ...(overviewFixture as DashboardOverview),
    generatedAt: new Date().toISOString(),
  };
}

function compareCompanies(
  left: BusCompany,
  right: BusCompany,
  sortBy: CompanySortKey,
) {
  if (sortBy === 'name') return collator.compare(left.name, right.name);
  return left[sortBy] - right[sortBy];
}

export async function getBusCompanies(
  query: CompanyListQuery,
  signal?: AbortSignal,
): Promise<PaginatedBusCompanies> {
  if (getDataSource() === 'api') {
    const searchParams = new URLSearchParams({
      search: query.search,
      page: String(query.page),
      pageSize: String(query.pageSize),
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    });
    return readApiResponse<PaginatedBusCompanies>(
      `${getApiBaseUrl()}${apiPrefix}/bus-companies?${searchParams.toString()}`,
      signal,
    );
  }

  const normalizedSearch = query.search.trim().toLocaleLowerCase('vi');
  const matchingCompanies = (busCompaniesFixture as BusCompany[])
    .filter((company) => {
      if (!normalizedSearch) return true;
      return `${company.name} ${company.contactInfo}`
        .toLocaleLowerCase('vi')
        .includes(normalizedSearch);
    })
    .sort((left, right) => {
      const result = compareCompanies(left, right, query.sortBy);
      return query.sortDirection === 'asc' ? result : -result;
    });

  const totalItems = matchingCompanies.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  const page = Math.min(Math.max(query.page, 1), totalPages);
  const startIndex = (page - 1) * query.pageSize;

  return {
    items: matchingCompanies.slice(startIndex, startIndex + query.pageSize),
    meta: { page, pageSize: query.pageSize, totalItems, totalPages },
  };
}
