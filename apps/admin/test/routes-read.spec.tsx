import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutesManagement } from '../src/features/routes/components/routes-management';
import { getRoutes, getRouteById } from '../src/features/routes/services/route-service';

const state = vi.hoisted(() => ({
  loading: true,
  routePage: null as unknown,
  error: null as string | null,
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) =>
    function MockIcon(props: React.SVGProps<SVGSVGElement>) {
      return <svg {...props} data-icon={name} />;
    };
  return {
    ArrowDown: icon('down'), ArrowUp: icon('up'), ArrowUpDown: icon('sort'),
    Search: icon('search'), X: icon('close'), ChevronLeft: icon('previous'),
    ChevronRight: icon('next'), Eye: icon('eye'), RefreshCw: icon('refresh'),
  };
});

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/lib/api-url', () => ({ getApiBaseUrl: () => 'http://localhost:4000' }));

vi.mock('@/components/data-filters/data-filters', () => ({
  FilterToolbar: ({ children, totalItems }: { children: React.ReactNode; totalItems: number | null }) =>
    <div data-result-count={totalItems === null ? 'loading' : totalItems}>{children}</div>,
  SearchInput: () => null,
  SelectFilter: () => null,
}));

vi.mock('@/features/routes/hooks/use-routes', () => ({
  useRoutes: () => ({
    routePage: state.routePage, error: state.error, loading: state.loading,
    searchInput: '', status: '', busCompanyId: '', sortBy: 'code', sortDirection: 'asc',
    changePage: vi.fn(), updateSearch: vi.fn(), updateStatus: vi.fn(),
    updateBusCompany: vi.fn(), sortRoutes: vi.fn(), refresh: vi.fn(),
  }),
}));

beforeEach(() => {
  state.loading = true;
  state.routePage = null;
  state.error = null;
  vi.restoreAllMocks();
});

describe('Admin routes read page', () => {
  it('uses the shared skeleton and loading result summary before the API responds', () => {
    const html = renderToStaticMarkup(<RoutesManagement />);
    expect(html).toContain('Đang tải danh sách tuyến xe');
    expect(html).toContain('data-result-count="loading"');
    expect(html).toContain('Làm mới');
    expect(html).not.toContain('Thêm tuyến');
  });

  it('renders backend totalItems, accessible sort state, detail action, and mobile card', () => {
    state.loading = false;
    state.routePage = {
      data: [{
        routeId: 17, code: 'FUTA-TX-0001', origin: 'TP.HCM', destination: 'Đà Lạt',
        status: 'HOAT_DONG', busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
        createdAt: '2026-09-22T07:34:00.000Z', updatedAt: '2026-09-23T07:34:00.000Z',
      }],
      meta: { page: 1, pageSize: 10, totalItems: 41, totalPages: 5 },
    };
    const html = renderToStaticMarkup(<RoutesManagement />);
    expect(html).toContain('data-result-count="41"');
    expect(html).toContain('aria-sort="ascending"');
    expect(html).toContain('aria-label="Xem chi tiết tuyến FUTA-TX-0001"');
    expect(html).toContain('routes-mobile-card');
    expect(html).toContain('Phương Trang');
    expect(html).not.toContain('Đang tải danh sách tuyến xe');
  });

  it('retains the list without showing the initial skeleton during a refetch', () => {
    state.routePage = { data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } };
    const html = renderToStaticMarkup(<RoutesManagement />);
    expect(html).toContain('data-result-count="0"');
    expect(html).not.toContain('Đang tải danh sách tuyến xe');
  });

  it('hides stale rows and presents retry when the latest request fails', () => {
    state.loading = false;
    state.error = 'API tạm thời không khả dụng';
    state.routePage = { data: [{ routeId: 17, code: 'OLD-ROUTE' }], meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } };
    const html = renderToStaticMarkup(<RoutesManagement />);
    expect(html).toContain('API tạm thời không khả dụng');
    expect(html).toContain('Thử lại');
    expect(html).not.toContain('OLD-ROUTE');
    expect(html).not.toContain('data-result-count="1"');
  });
});

describe('Route frontend API service', () => {
  it('sends search, filters, sort, and pagination to the shared API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [], meta: { page: 2, pageSize: 5, totalItems: 0, totalPages: 0 },
    }), { status: 200 }));
    await getRoutes({
      page: 2, pageSize: 5, search: 'Đà Lạt', status: 'TAM_NGUNG',
      busCompanyId: 3, sortBy: 'updatedAt', sortDirection: 'desc',
    });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/routes');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2', pageSize: '5', search: 'Đà Lạt', sortBy: 'updatedAt',
      sortDirection: 'desc', status: 'TAM_NGUNG', busCompanyId: '3',
    });
  });

  it('fetches route detail by ID and propagates API errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      data: { routeId: 17, code: 'FUTA-TX-0001' },
    }), { status: 200 }));
    await expect(getRouteById(17)).resolves.toMatchObject({ routeId: 17 });
    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/api/v1/routes/17');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Không tìm thấy tuyến xe.' }), { status: 404 }));
    await expect(getRouteById(999)).rejects.toThrow('Không tìm thấy tuyến xe.');
  });
});
