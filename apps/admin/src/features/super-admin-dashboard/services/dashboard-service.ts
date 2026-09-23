import overviewFixture from '../data/overview.json';
import { getApiBaseUrl } from '@/lib/api-url';
import type { DashboardOverview } from '../types/dashboard';

const apiPrefix = '/api/v1/super-admin/dashboard';

function getDataSource() {
  return process.env.NEXT_PUBLIC_ADMIN_DATA_SOURCE?.toLowerCase() === 'api'
    ? 'api'
    : 'mock';
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
