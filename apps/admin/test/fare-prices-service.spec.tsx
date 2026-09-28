import * as serviceModule from '@/features/fare-prices/services/fare-price-service';
import { afterEach, describe, expect, it, vi } from 'vitest';

type FarePriceQuery = {
  page: number;
  pageSize: number;
  search: string;
  sortBy: 'listedPrice' | 'validFrom' | 'validTo' | 'status';
  sortDirection: 'asc' | 'desc';
  routeId?: number;
  vehicleTypeId?: number;
  status?: 'HOAT_DONG' | 'TAM_NGUNG';
  effectiveState?: 'CHUA_HIEU_LUC' | 'DANG_HIEU_LUC' | 'HET_HIEU_LUC' | 'TAM_NGUNG';
};

const service = serviceModule as unknown as {
  getFarePrices?: (query: FarePriceQuery, signal?: AbortSignal) => Promise<unknown>;
  getFarePriceById?: (id: number, signal?: AbortSignal) => Promise<unknown>;
  getFarePriceRouteOptions?: (signal?: AbortSignal) => Promise<Array<{ id: number; label: string }>>;
  getFarePriceVehicleTypeOptions?: (signal?: AbortSignal) => Promise<Array<{ id: number; label: string }>>;
};

const fare = {
  farePriceId: 15,
  listedPrice: 250000,
  currency: 'VND',
  validFrom: '2026-09-01',
  validTo: null,
  status: 'HOAT_DONG',
  effectiveState: 'DANG_HIEU_LUC',
  route: { routeId: 3, code: 'SG-DL-01', origin: 'TP.HCM', destination: 'Đà Lạt' },
  vehicleType: { vehicleTypeId: 2, name: 'Limousine' },
  createdAt: '2026-09-01T08:30:00.000Z',
  updatedAt: '2026-09-02T08:30:00.000Z',
};

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function route(routeId: number, code: string, origin: string, destination: string) {
  return {
    routeId,
    code,
    origin,
    destination,
    status: 'HOAT_DONG',
    busCompany: { busCompanyId: 1, code: 'FUTA', name: 'Phương Trang' },
    createdAt: '2026-09-01T08:30:00.000Z',
    updatedAt: '2026-09-02T08:30:00.000Z',
  };
}

function vehicleType(vehicleTypeId: number, name: string) {
  return {
    vehicleTypeId,
    name,
    description: null,
    createdAt: '2026-09-01T08:30:00.000Z',
    updatedAt: '2026-09-02T08:30:00.000Z',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Fare Price API service', () => {
  it('validates and returns a complete paginated Fare Price response', async () => {
    expect(service.getFarePrices).toBeTypeOf('function');
    if (!service.getFarePrices) return;

    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    const fetchMock = vi.fn().mockResolvedValue(
      response({ data: [fare], meta: { page: 2, pageSize: 5, totalItems: 7, totalPages: 2 } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const query: FarePriceQuery = {
      page: 2,
      pageSize: 5,
      search: 'SG-DL',
      sortBy: 'listedPrice',
      sortDirection: 'asc',
      routeId: 3,
      vehicleTypeId: 2,
      status: 'HOAT_DONG',
      effectiveState: 'DANG_HIEU_LUC',
    };
    const result = await service.getFarePrices(query);

    expect(result).toEqual({
      data: [fare],
      meta: { page: 2, pageSize: 5, totalItems: 7, totalPages: 2 },
    });
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe('/api/v1/fare-prices');
    expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
      page: '2',
      pageSize: '5',
      search: 'SG-DL',
      sortBy: 'listedPrice',
      sortDirection: 'asc',
      routeId: '3',
      vehicleTypeId: '2',
      status: 'HOAT_DONG',
      effectiveState: 'DANG_HIEU_LUC',
    });
  });

  it('rejects an incomplete list item instead of trusting a TypeScript cast', async () => {
    expect(service.getFarePrices).toBeTypeOf('function');
    if (!service.getFarePrices) return;

    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      data: [{ farePriceId: 15, listedPrice: 250000 }],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    })));

    await expect(service.getFarePrices({
      page: 1,
      pageSize: 10,
      search: '',
      sortBy: 'validFrom',
      sortDirection: 'desc',
    })).rejects.toThrow('API trả về danh sách bảng giá không hợp lệ.');
  });

  it('rejects a malformed detail resource', async () => {
    expect(service.getFarePriceById).toBeTypeOf('function');
    if (!service.getFarePriceById) return;

    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      data: { farePriceId: 15, listedPrice: 250000 },
    })));

    await expect(service.getFarePriceById(15)).rejects.toThrow(
      'API trả về thông tin bảng giá không hợp lệ.',
    );
  });

  it('loads all route/type lookup pages and labels routes with code and endpoints', async () => {
    expect(service.getFarePriceRouteOptions).toBeTypeOf('function');
    expect(service.getFarePriceVehicleTypeOptions).toBeTypeOf('function');
    if (!service.getFarePriceRouteOptions || !service.getFarePriceVehicleTypeOptions) return;

    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(`${url.pathname}${url.search}`);
      if (url.pathname === '/api/v1/routes') {
        const page = Number(url.searchParams.get('page'));
        return response({
          data: page === 1
            ? [route(3, 'SG-DL-01', 'TP.HCM', 'Đà Lạt')]
            : [route(4, 'SG-NT-02', 'TP.HCM', 'Nha Trang')],
          meta: { page, pageSize: 100, totalItems: 2, totalPages: 2 },
        });
      }
      if (url.pathname === '/api/v1/vehicle-types') {
        return response({
          data: [vehicleType(2, 'Limousine')],
          meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
        });
      }
      throw new Error(`Unexpected lookup request: ${url.pathname}`);
    }));

    const [routes, vehicleTypes] = await Promise.all([
      service.getFarePriceRouteOptions(),
      service.getFarePriceVehicleTypeOptions(),
    ]);

    expect(routes).toEqual([
      { id: 3, label: 'SG-DL-01 — TP.HCM → Đà Lạt' },
      { id: 4, label: 'SG-NT-02 — TP.HCM → Nha Trang' },
    ]);
    expect(vehicleTypes).toEqual([{ id: 2, label: 'Limousine' }]);
    expect(requests.some((url) => url.startsWith('/api/v1/routes?page=2'))).toBe(true);
  });
});
