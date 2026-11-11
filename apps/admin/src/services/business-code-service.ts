import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';

export async function getBusinessCodePreview(
  resource: 'routes' | 'trips',
  date: string | undefined,
  signal: AbortSignal,
): Promise<string> {
  const query = date ? `?departureDate=${encodeURIComponent(date)}` : '';
  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/${resource}/code-preview${query}`,
    { signal, cache: 'no-store' },
  );
  const body: unknown = await response.json();
  if (
    !response.ok ||
    typeof body !== 'object' ||
    body === null ||
    !('data' in body)
  )
    throw new Error('Không thể tải mã tự động.');
  const data = body.data;
  if (
    typeof data !== 'object' ||
    data === null ||
    !('code' in data) ||
    typeof data.code !== 'string'
  )
    throw new Error('Mã tự động trả về không hợp lệ.');
  return data.code;
}
