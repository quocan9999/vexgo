import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type {
  CustomerDetail,
  CustomerDetailResponse,
  CustomerPageResponse,
  CustomerQuery,
  CustomerTransactionsQuery,
  CustomerTransactionsResponse,
  CustomerTicketsQuery,
  CustomerTicketsResponse,
} from '../types/customer';

export class CustomerApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'CustomerApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readResponse(
  response: Response,
  resource: string,
): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new CustomerApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể tải ${resource} (HTTP ${response.status}).`,
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }
  return body;
}

export async function getCustomers(
  query: CustomerQuery,
  signal?: AbortSignal,
): Promise<CustomerPageResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 10),
  });

  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }
  if (query.accountStatus) {
    params.set('accountStatus', query.accountStatus);
  }
  if (query.sortBy) {
    params.set('sortBy', query.sortBy);
  }
  if (query.sortDirection) {
    params.set('sortDirection', query.sortDirection);
  }

  const body = await readResponse(
    await adminApiFetch(
      `${getApiBaseUrl()}/api/v1/customers?${params.toString()}`,
      {
        cache: 'no-store',
        signal,
      },
    ),
    'danh sách khách hàng',
  );

  return body as CustomerPageResponse;
}

export async function getCustomerById(
  customerId: number,
  signal?: AbortSignal,
): Promise<CustomerDetail> {
  const body = (await readResponse(
    await adminApiFetch(
      `${getApiBaseUrl()}/api/v1/customers/${customerId}`,
      {
        cache: 'no-store',
        signal,
      },
    ),
    'thông tin khách hàng',
  )) as CustomerDetailResponse;

  return body.data;
}

export async function getCustomerTransactions(
  customerId: number,
  query: CustomerTransactionsQuery = {},
  signal?: AbortSignal,
): Promise<CustomerTransactionsResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 10),
  });

  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }
  if (query.sortBy) {
    params.set('sortBy', query.sortBy);
  }
  if (query.sortDirection) {
    params.set('sortDirection', query.sortDirection);
  }

  const body = await readResponse(
    await adminApiFetch(
      `${getApiBaseUrl()}/api/v1/customers/${customerId}/transactions?${params.toString()}`,
      {
        cache: 'no-store',
        signal,
      },
    ),
    'lịch sử giao dịch khách hàng',
  );

  return body as CustomerTransactionsResponse;
}

export async function getCustomerTickets(
  customerId: number,
  query: CustomerTicketsQuery = {},
  signal?: AbortSignal,
): Promise<CustomerTicketsResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 10),
  });

  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }
  if (query.sortDirection) {
    params.set('sortDirection', query.sortDirection);
  }

  const body = await readResponse(
    await adminApiFetch(
      `${getApiBaseUrl()}/api/v1/customers/${customerId}/tickets?${params.toString()}`,
      {
        cache: 'no-store',
        signal,
      },
    ),
    'lịch sử vé của khách hàng',
  );

  return body as CustomerTicketsResponse;
}
