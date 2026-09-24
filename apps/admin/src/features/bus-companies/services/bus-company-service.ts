import type {
  BusCompany,
  BusCompanyListQuery,
  PaginatedBusCompanies,
} from '../types/bus-company';
import { getApiBaseUrl } from '@/lib/api-url';

export type CreateBusCompanyInput = {
  code: string;
  name: string;
  contactInfo: string | null;
  status: BusCompany['status'];
};

export type BusCompanyApiErrorDetail = {
  field: string;
  message: string;
};

export class BusCompanyApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details: BusCompanyApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'BusCompanyApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(
  body: unknown,
  status: number,
  resource = 'danh sách nhà xe',
) {
  if (isRecord(body) && typeof body.message === 'string') {
    return body.message;
  }
  return `Không thể tải ${resource} (HTTP ${status}).`;
}

function getApiErrorDetails(body: unknown): BusCompanyApiErrorDetail[] {
  if (!isRecord(body) || !Array.isArray(body.details)) return [];

  return body.details.flatMap((detail) =>
    isRecord(detail) &&
    typeof detail.field === 'string' &&
    typeof detail.message === 'string'
      ? [{ field: detail.field, message: detail.message }]
      : [],
  );
}

export async function createBusCompany(
  input: CreateBusCompanyInput,
): Promise<BusCompany> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/bus-companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể tạo nhà xe (HTTP ${response.status}).`;
    const code =
      isRecord(body) && typeof body.error === 'string'
        ? body.error
        : undefined;

    throw new BusCompanyApiError(message, code, getApiErrorDetails(body));
  }
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error('API trả về thông tin nhà xe không hợp lệ.');
  }

  return body.data as unknown as BusCompany;
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
    searchParams.set('createdFrom', query.createdFrom);
  }
  if (query.createdTo) {
    searchParams.set('createdTo', query.createdTo);
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

export async function getBusCompanyById(
  busCompanyId: number,
  signal?: AbortSignal,
): Promise<BusCompany> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/bus-companies/${busCompanyId}`,
    { cache: 'no-store', signal },
  );
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.status, 'thông tin nhà xe'));
  }
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error('API trả về thông tin nhà xe không hợp lệ.');
  }

  return body.data as unknown as BusCompany;
}
