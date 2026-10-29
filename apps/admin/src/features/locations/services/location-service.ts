import { getApiBaseUrl } from '@/lib/api-url';

export type LocationOption = {
  id: string;
  name: string;
  value: string;
  aliases: string[];
  versions: ('current' | 'legacy')[];
  kind: 'province' | 'city' | 'district' | 'station';
  province: string | null;
  legacyNames?: string[];
  popular?: boolean;
  address?: string;
  parentName?: string;
  isLegacy?: boolean;
  mergedFromText?: string | null;
  diaDiemId?: number;
};

let pending: Promise<LocationOption[]> | undefined;
let cached: LocationOption[] | undefined;
let expires = 0;

export async function getLocations(): Promise<LocationOption[]> {
  if (cached && Date.now() < expires) return Promise.resolve(cached);
  pending ??= fetch(
    `${getApiBaseUrl().replace(/\/api\/v1\/?$/, '')}/api/v1/locations`,
    {
      signal: AbortSignal.timeout(12_000),
    },
  )
    .then(async (response) => {
      if (!response.ok)
        throw new Error('Không thể tải địa điểm. Vui lòng thử lại.');
      const body = await response.json();
      if (!Array.isArray(body.data))
        throw new Error('Danh mục địa điểm không hợp lệ.');
      cached = body.data;
      expires = Date.now() + 5 * 60_000;
      return body.data as LocationOption[];
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
