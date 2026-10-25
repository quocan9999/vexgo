import { routesApi } from '@/features/routes/services/routes.api';

export type LocationOption = {
  id: string;
  name: string;
  value: string;
  aliases: string[];
  versions: ('current' | 'legacy')[];
  kind: 'province' | 'city';
  province: string | null;
  legacyNames?: string[];
};

type LocationCatalog = { data: LocationOption[]; warning: string };
let pending: Promise<LocationCatalog> | undefined;
let cached: LocationCatalog | undefined;
let expires = 0;

export function getLocations(force = false): Promise<LocationCatalog> {
  if (!force && cached && Date.now() < expires) return Promise.resolve(cached);
  const base = (
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api/v1'
  ).replace(/\/$/, '');
  const loadCatalogue = () =>
    fetch(`${base.replace(/\/api\/v1$/, '')}/api/v1/locations`, {
      signal: AbortSignal.timeout(12_000),
    }).then(async (response) => {
      if (!response.ok)
        throw new Error('Không thể tải địa điểm. Vui lòng thử lại.');
      const body = await response.json();
      if (!Array.isArray(body.data))
        throw new Error('Danh mục địa điểm không hợp lệ.');
      return body.data as LocationOption[];
    });
  const loadRoutePoints = async (): Promise<LocationOption[]> => {
    const names = new Set<string>();
    let page = 1;
    let totalPages = 1;
    do {
      const response = await routesApi.listRoutes(
        { status: 'HOAT_DONG', pageSize: 100, page },
        AbortSignal.timeout(8_000),
      );
      for (const route of response.data) {
        names.add(route.origin);
        names.add(route.destination);
      }
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);
    return [...names].filter(Boolean).map((name) => ({
      id: `route:${name}`,
      name,
      value: name,
      aliases: [name],
      versions: [],
      kind: 'city',
      province: null,
    }));
  };
  pending ??= Promise.allSettled([loadCatalogue(), loadRoutePoints()])
    .then(([catalogue, points]) => {
      if (catalogue.status === 'rejected' && points.status === 'rejected') {
        throw new Error('Không thể tải địa điểm. Vui lòng thử lại.');
      }
      const data = catalogue.status === 'fulfilled' ? [...catalogue.value] : [];
      if (points.status === 'fulfilled') {
        const values = new Set(
          data.flatMap((item) => [item.value, ...item.aliases]),
        );
        data.push(...points.value.filter((item) => !values.has(item.value)));
      }
      const warning =
        catalogue.status === 'rejected'
          ? 'Không thể tải danh mục tỉnh/thành. Đang hiển thị các điểm có tuyến.'
          : points.status === 'rejected'
            ? 'Chưa tải được các điểm riêng của tuyến xe.'
            : '';
      cached = { data, warning };
      expires = Date.now() + (warning ? 30_000 : 5 * 60_000);
      return cached;
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
