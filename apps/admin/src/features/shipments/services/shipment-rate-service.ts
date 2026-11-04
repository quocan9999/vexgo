import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type { PaginatedRoutes } from '@/features/routes/types/route';
import type {
  CreateShipmentRateRequest,
  PaginatedShipmentRates,
  PaginationMeta,
  ShipmentRate,
  ShipmentRateListQuery,
  ShipmentRateOption,
  UpdateShipmentRateRequest,
  UpdateShipmentRateStatusRequest,
} from '../types/shipment-rate';

type ApiShipmentRateResponse = {
  data: ShipmentRate;
};

type ApiValidationDetail = {
  field: string;
  message: string;
};

type ApiErrorBody = {
  statusCode?: number;
  error?: string;
  message?: string;
  details?: ApiValidationDetail[];
};

const SHIPMENT_RATES_API_PATH = '/api/v1/shipments/rates';
const ROUTES_API_PATH = '/api/v1/routes';
const CATEGORIES_API_PATH = '/api/v1/shipments/categories';
const OPTIONS_PAGE_SIZE = 100;
const MAX_OPTIONS_PAGES = 20;

export class ShipmentRateApiError extends Error {
  statusCode: number;
  code: string;
  details: ApiValidationDetail[];

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      details?: ApiValidationDetail[];
    } = {},
  ) {
    super(message);
    this.name = 'ShipmentRateApiError';
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'INTERNAL_SERVER_ERROR';
    this.details = options.details ?? [];
  }
}

export async function getShipmentRates(
  query: ShipmentRateListQuery = {},
  signal?: AbortSignal,
): Promise<PaginatedShipmentRates> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 10));

  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.routeId) params.set('routeId', String(query.routeId));
  if (query.cargoTypeId) params.set('cargoTypeId', String(query.cargoTypeId));
  if (query.status) params.set('status', query.status);
  if (query.effectiveState) params.set('effectiveState', query.effectiveState);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortDirection) params.set('sortDirection', query.sortDirection);

  const response = await request(
    `${getApiBaseUrl()}${SHIPMENT_RATES_API_PATH}?${params.toString()}`,
    { cache: 'no-store', signal },
    'Không thể tải danh sách bảng cước gửi hàng.',
  );

  return parsePaginatedShipmentRatesResponse(
    await readJson(
      response,
      'Dữ liệu danh sách bảng cước gửi hàng không hợp lệ.',
    ),
  );
}

export async function getShipmentRateById(
  rateId: number,
  signal?: AbortSignal,
): Promise<ShipmentRate> {
  const response = await request(
    `${getApiBaseUrl()}${SHIPMENT_RATES_API_PATH}/${rateId}`,
    { cache: 'no-store', signal },
    'Không thể tải chi tiết mức cước gửi hàng.',
  );

  return parseShipmentRateResponse(
    await readJson(response, 'Dữ liệu mức cước gửi hàng không hợp lệ.'),
  );
}

export async function createShipmentRate(
  payload: CreateShipmentRateRequest,
): Promise<ShipmentRate> {
  const response = await request(
    `${getApiBaseUrl()}${SHIPMENT_RATES_API_PATH}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Không thể tạo mức cước gửi hàng mới.',
  );

  return parseShipmentRateResponse(
    await readJson(response, 'Dữ liệu mức cước mới không hợp lệ.'),
  );
}

export async function updateShipmentRate(
  rateId: number,
  payload: UpdateShipmentRateRequest,
): Promise<ShipmentRate> {
  const response = await request(
    `${getApiBaseUrl()}${SHIPMENT_RATES_API_PATH}/${rateId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Không thể cập nhật mức cước gửi hàng.',
  );

  return parseShipmentRateResponse(
    await readJson(response, 'Dữ liệu mức cước cập nhật không hợp lệ.'),
  );
}

export async function updateShipmentRateStatus(
  rateId: number,
  payload: UpdateShipmentRateStatusRequest,
): Promise<ShipmentRate> {
  const response = await request(
    `${getApiBaseUrl()}${SHIPMENT_RATES_API_PATH}/${rateId}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Không thể cập nhật trạng thái mức cước gửi hàng.',
  );

  return parseShipmentRateResponse(
    await readJson(response, 'Dữ liệu trạng thái mức cước không hợp lệ.'),
  );
}

export async function getShipmentRateRouteOptions(
  options: { activeOnly?: boolean; signal?: AbortSignal } = {},
): Promise<ShipmentRateOption[]> {
  const routes = await fetchAllPages<PaginatedRoutes['data'][number]>(
    (page) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(OPTIONS_PAGE_SIZE),
        sortBy: 'code',
        sortDirection: 'asc',
      });
      if (options.activeOnly) params.set('status', 'HOAT_DONG');
      return `${getApiBaseUrl()}${ROUTES_API_PATH}?${params.toString()}`;
    },
    'Không thể tải danh sách tuyến xe.',
    options.signal,
  );

  return routes.map((route) => ({
    id: route.routeId,
    code: route.code,
    label: `${route.origin} → ${route.destination} (${route.code})`,
    description: `${route.origin} → ${route.destination}`,
  }));
}

export async function getShipmentRateCargoTypeOptions(
  signal?: AbortSignal,
): Promise<ShipmentRateOption[]> {
  const response = await request(
    `${getApiBaseUrl()}${CATEGORIES_API_PATH}`,
    { cache: 'no-store', signal },
    'Không thể tải danh mục loại hàng hóa.',
  );

  const payload = (await readJson(
    response,
    'Dữ liệu danh mục loại hàng hóa không hợp lệ.',
  )) as {
    data?: Array<{
      categoryId: number;
      name: string;
      description?: string | null;
      capacityGroup: string;
    }>;
  };

  if (!Array.isArray(payload?.data)) {
    throw new ShipmentRateApiError(
      'Dữ liệu danh mục loại hàng hóa không hợp lệ.',
    );
  }

  return payload.data.map((cat) => ({
    id: cat.categoryId,
    code: cat.capacityGroup,
    label: cat.name,
    description: cat.description || undefined,
  }));
}

async function fetchAllPages<T>(
  buildUrl: (page: number) => string,
  fallbackMessage: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_OPTIONS_PAGES) {
    const response = await request(
      buildUrl(page),
      { cache: 'no-store', signal },
      fallbackMessage,
    );
    const payload = parsePaginatedItemsResponse<T>(
      await readJson(response, fallbackMessage),
      fallbackMessage,
    );
    items.push(...payload.data);
    totalPages = payload.meta.totalPages;
    page += 1;
  }

  return items;
}

async function request(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await adminApiFetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ShipmentRateApiError(
      'Không thể kết nối máy chủ VexGo. Vui lòng thử lại.',
      { statusCode: 0, code: 'NETWORK_ERROR' },
    );
  }

  if (!response.ok) {
    throw await toApiError(response, fallbackMessage);
  }

  return response;
}

async function readJson(
  response: Response,
  fallbackMessage: string,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ShipmentRateApiError(fallbackMessage, {
      statusCode: response.status,
      code: 'INVALID_RESPONSE',
    });
  }
}

function parseShipmentRateResponse(payload: unknown): ShipmentRate {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'data' in payload &&
    isShipmentRate((payload as ApiShipmentRateResponse).data)
  ) {
    return (payload as ApiShipmentRateResponse).data;
  }
  throw new ShipmentRateApiError('Dữ liệu mức cước gửi hàng không hợp lệ.', {
    code: 'INVALID_RESPONSE',
  });
}

function parsePaginatedShipmentRatesResponse(
  payload: unknown,
): PaginatedShipmentRates {
  const parsed = parsePaginatedItemsResponse<ShipmentRate>(
    payload,
    'Dữ liệu danh sách bảng cước gửi hàng không hợp lệ.',
  );
  if (!parsed.data.every(isShipmentRate)) {
    throw new ShipmentRateApiError(
      'Dữ liệu danh sách bảng cước gửi hàng không hợp lệ.',
      { code: 'INVALID_RESPONSE' },
    );
  }
  return parsed;
}

function parsePaginatedItemsResponse<T>(
  payload: unknown,
  fallbackMessage: string,
): { data: T[]; meta: PaginationMeta } {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'data' in payload &&
    'meta' in payload &&
    Array.isArray((payload as { data: unknown }).data) &&
    isPaginationMeta((payload as { meta: unknown }).meta)
  ) {
    return payload as { data: T[]; meta: PaginationMeta };
  }
  throw new ShipmentRateApiError(fallbackMessage, {
    code: 'INVALID_RESPONSE',
  });
}

function isShipmentRate(value: unknown): value is ShipmentRate {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.rateId === 'number' &&
    typeof item.weightFrom === 'number' &&
    (typeof item.weightTo === 'number' || item.weightTo === null) &&
    typeof item.fee === 'number' &&
    item.currency === 'VND' &&
    typeof item.validFrom === 'string' &&
    (typeof item.validTo === 'string' || item.validTo === null) &&
    (item.status === 'HOAT_DONG' || item.status === 'TAM_NGUNG') &&
    (item.effectiveState === 'CHUA_DEN_NGAY' ||
      item.effectiveState === 'DANG_HIEU_LUC' ||
      item.effectiveState === 'HET_HIEU_LUC') &&
    typeof item.route === 'object' &&
    item.route !== null &&
    typeof item.cargoType === 'object' &&
    item.cargoType !== null &&
    typeof (item.cargoType as Record<string, unknown>).cargoTypeId === 'number' &&
    typeof (item.cargoType as Record<string, unknown>).name === 'string' &&
    typeof (item.cargoType as Record<string, unknown>).capacityGroup === 'string'
  );
}

function isPaginationMeta(value: unknown): value is PaginationMeta {
  if (typeof value !== 'object' || value === null) return false;
  const meta = value as Record<string, unknown>;
  return (
    typeof meta.page === 'number' &&
    typeof meta.pageSize === 'number' &&
    typeof meta.totalItems === 'number' &&
    typeof meta.totalPages === 'number'
  );
}

async function toApiError(
  response: Response,
  fallbackMessage: string,
): Promise<ShipmentRateApiError> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = {};
  }

  const statusCode = body.statusCode ?? response.status;
  const details = Array.isArray(body.details) ? body.details : [];
  const message =
    statusCode >= 500
      ? fallbackMessage
      : details[0]?.message || body.message || fallbackMessage;

  return new ShipmentRateApiError(message, {
    statusCode,
    code: body.error,
    details,
  });
}
