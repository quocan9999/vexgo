import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type {
  CreatePromotionRequest,
  PaginatedPromotions,
  Promotion,
  PromotionEffectiveState,
  PromotionListQuery,
  PromotionStatus,
} from '../types/promotion';

export type PromotionApiErrorDetail = { field: string; message: string };

export class PromotionApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details: PromotionApiErrorDetail[] = [],
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PromotionApiError';
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
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const EFFECTIVE_STATES: readonly PromotionEffectiveState[] = [
  'UPCOMING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'EXHAUSTED', 'UNAVAILABLE',
];

function isPromotion(value: unknown): value is Promotion {
  return isRecord(value) &&
    isPositiveInteger(value.id) &&
    typeof value.name === 'string' &&
    typeof value.code === 'string' &&
    (value.discountType === 'PHAN_TRAM' || value.discountType === 'SO_TIEN') &&
    typeof value.discountValue === 'string' &&
    (value.maxDiscount === null || typeof value.maxDiscount === 'string') &&
    (value.minimumTicketAmount === null || typeof value.minimumTicketAmount === 'string') &&
    isDateOnly(value.startsOn) &&
    isDateOnly(value.endsOn) &&
    (value.status === 'HOAT_DONG' || value.status === 'TAM_NGUNG') &&
    isNonNegativeInteger(value.usageCount) &&
    isNonNegativeInteger(value.usageLimit) &&
    isNonNegativeInteger(value.remainingUses) &&
    EFFECTIVE_STATES.some((state) => state === value.effectiveState);
}

function isPaginatedPromotions(value: unknown): value is PaginatedPromotions {
  return isRecord(value) && Array.isArray(value.data) && value.data.every(isPromotion) &&
    isRecord(value.meta) && isPositiveInteger(value.meta.page) &&
    isPositiveInteger(value.meta.pageSize) && isNonNegativeInteger(value.meta.totalItems) &&
    isNonNegativeInteger(value.meta.totalPages);
}

function getErrorDetails(value: unknown): PromotionApiErrorDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((detail): PromotionApiErrorDetail[] =>
    isRecord(detail) && typeof detail.field === 'string' && typeof detail.message === 'string'
      ? [{ field: detail.field, message: detail.message }]
      : [],
  );
}

async function readResponse(response: Response, resource: string): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PromotionApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể xử lý ${resource} (HTTP ${response.status}).`,
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
      isRecord(body) ? getErrorDetails(body.details) : [],
      response.status,
    );
  }
  return body;
}

function apiUrl(path: string): string {
  return `${getApiBaseUrl().replace(/\/$/, '')}/api/v1/promotions${path}`;
}

function unwrapPromotion(body: unknown, resource: string): Promotion {
  if (!isRecord(body) || !isPromotion(body.data)) {
    throw new Error(`API trả về ${resource} không hợp lệ.`);
  }
  return body.data;
}

export async function getPromotions(
  query: PromotionListQuery,
  signal?: AbortSignal,
): Promise<PaginatedPromotions> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });
  if (query.status) params.set('status', query.status);
  if (query.fromDate) params.set('fromDate', query.fromDate);
  if (query.toDate) params.set('toDate', query.toDate);
  const body = await readResponse(
    await adminApiFetch(`${apiUrl('')}?${params.toString()}`, { cache: 'no-store', signal }),
    'danh sách khuyến mãi',
  );
  if (!isPaginatedPromotions(body)) throw new Error('API trả về danh sách khuyến mãi không hợp lệ.');
  return body;
}

export async function getPromotionById(id: number, signal?: AbortSignal): Promise<Promotion> {
  const body = await readResponse(
    await adminApiFetch(apiUrl(`/${id}`), { cache: 'no-store', signal }),
    'chi tiết khuyến mãi',
  );
  return unwrapPromotion(body, 'chi tiết khuyến mãi');
}

export async function createPromotion(input: CreatePromotionRequest): Promise<Promotion> {
  const body = await readResponse(
    await adminApiFetch(apiUrl(''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
    'khuyến mãi',
  );
  return unwrapPromotion(body, 'thông tin khuyến mãi');
}

export async function updatePromotionStatus(
  id: number,
  status: PromotionStatus,
): Promise<Promotion> {
  const body = await readResponse(
    await adminApiFetch(apiUrl(`/${id}/status`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
    'trạng thái khuyến mãi',
  );
  return unwrapPromotion(body, 'thông tin khuyến mãi');
}

export async function updatePromotion(id: number, input: CreatePromotionRequest): Promise<Promotion> {
  const body = await readResponse(
    await adminApiFetch(apiUrl(`/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
    'khuyến mãi',
  );
  return unwrapPromotion(body, 'thông tin khuyến mãi');
}
