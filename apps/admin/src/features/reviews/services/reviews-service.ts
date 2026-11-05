import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type {
  AdminReviewPageResponse,
  AdminReviewQuery,
  AdminReviewStatsResponse,
  ReviewReply,
  ReviewStatus,
  UpdateReviewStatusResponse,
} from '../types/review';

export class ReviewApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ReviewApiError';
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
    throw new ReviewApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể tải ${resource} (HTTP ${response.status}).`,
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }
  return body;
}

export async function getAdminReviews(
  query: AdminReviewQuery,
  signal?: AbortSignal,
): Promise<AdminReviewPageResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 10),
  });

  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }
  if (query.rating) {
    params.set('rating', String(query.rating));
  }
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.busCompanyId) {
    params.set('busCompanyId', String(query.busCompanyId));
  }
  if (query.routeId) {
    params.set('routeId', String(query.routeId));
  }
  if (query.hasComment) {
    params.set('hasComment', query.hasComment);
  }
  if (query.timeRange) {
    params.set('timeRange', query.timeRange);
  }
  if (query.sortBy) {
    params.set('sortBy', query.sortBy);
  }
  if (query.sortDirection) {
    params.set('sortDirection', query.sortDirection);
  }

  const endpoint = new URL(
    `/api/v1/reviews/admin?${params.toString()}`,
    getApiBaseUrl(),
  );

  const response = await adminApiFetch(endpoint, {
    method: 'GET',
    signal,
  });

  return (await readResponse(
    response,
    'danh sách đánh giá',
  )) as AdminReviewPageResponse;
}

export async function getAdminReviewStats(
  busCompanyId?: number,
  signal?: AbortSignal,
): Promise<AdminReviewStatsResponse> {
  const params = new URLSearchParams();
  if (busCompanyId) {
    params.set('busCompanyId', String(busCompanyId));
  }
  const endpoint = new URL(
    `/api/v1/reviews/admin/stats${params.toString() ? `?${params.toString()}` : ''}`,
    getApiBaseUrl(),
  );

  const response = await adminApiFetch(endpoint, {
    method: 'GET',
    signal,
  });

  return (await readResponse(
    response,
    'thống kê đánh giá',
  )) as AdminReviewStatsResponse;
}

export async function updateAdminReviewStatus(
  reviewId: number,
  status: ReviewStatus,
): Promise<UpdateReviewStatusResponse> {
  const endpoint = new URL(
    `/api/v1/reviews/admin/${reviewId}/status`,
    getApiBaseUrl(),
  );

  const response = await adminApiFetch(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  return (await readResponse(
    response,
    'trạng thái đánh giá',
  )) as UpdateReviewStatusResponse;
}

export async function replyAdminReview(
  reviewId: number,
  reply: string,
): Promise<{ data: { id: number; reply: ReviewReply | null }; message: string }> {
  const endpoint = new URL(
    `/api/v1/reviews/admin/${reviewId}/reply`,
    getApiBaseUrl(),
  );

  const response = await adminApiFetch(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply }),
  });

  return (await readResponse(
    response,
    'phản hồi đánh giá',
  )) as { data: { id: number; reply: ReviewReply | null }; message: string };
}
