import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TripsManagement } from '../src/features/trips/components/trips-management';
import {
  TripDetailSheet,
  tripStatusLabel,
  TripStatusBadge,
} from '../src/features/trips/components/trip-detail-sheet';
import { getTrips, getTripById } from '../src/features/trips/services/trip-service';
import type { Trip } from '../src/features/trips/types/trip';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

const state = vi.hoisted(() => ({
  loading: true,
  tripPage: null as unknown,
  error: null as string | null,
  searchInput: '',
  status: '',
  departureDate: '',
}));

const mockTrip: Trip = {
  tripId: 101,
  code: 'FUTA-CX-001',
  departureDate: '2026-10-10',
  departureTime: '07:30:00',
  status: 'CHUA_KHOI_HANH',
  route: {
    routeId: 1,
    code: 'FUTA-TX-0001',
    origin: 'TP.HCM',
    destination: 'Đà Lạt',
  },
  vehicle: {
    vehicleId: 8,
    licensePlate: '30F-123.45',
    status: 'HOAT_DONG',
    vehicleType: {
      vehicleTypeId: 2,
      name: 'GIƯỜNG NẰM',
    },
  },
  seatSummary: {
    total: 34,
    available: 30,
    held: 2,
    booked: 2,
  },
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

vi.mock('lucide-react', () => {
  const icon = (name: string) =>
    function MockIcon(props: React.SVGProps<SVGSVGElement>) {
      return <svg {...props} data-icon={name} />;
    };
  return {
    ArrowDown: icon('down'),
    ArrowUp: icon('up'),
    ArrowUpDown: icon('sort'),
    Search: icon('search'),
    X: icon('close'),
    ChevronLeft: icon('previous'),
    ChevronRight: icon('next'),
    Eye: icon('eye'),
    RefreshCw: icon('refresh'),
    CalendarDays: icon('calendar'),
  };
});

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock('@/lib/api-url', () => ({
  getApiBaseUrl: () => 'http://localhost:4002',
}));

vi.mock('@/components/data-filters/data-filters', () => ({
  FilterToolbar: ({
    children,
    totalItems,
  }: {
    children: React.ReactNode;
    totalItems: number | null;
  }) => (
    <div data-result-count={totalItems === null ? 'loading' : totalItems}>
      {children}
    </div>
  ),
  SearchInput: () => null,
  SelectFilter: () => null,
}));

vi.mock('@/features/trips/hooks/use-trips', () => ({
  useTrips: () => ({
    tripPage: state.tripPage,
    error: state.error,
    loading: state.loading,
    searchInput: state.searchInput,
    status: state.status,
    departureDate: state.departureDate,
    sortBy: 'departureDate',
    sortDirection: 'asc',
    changePage: vi.fn(),
    updateSearch: vi.fn(),
    updateStatus: vi.fn(),
    updateDepartureDate: vi.fn(),
    sortTrips: vi.fn(),
    refresh: vi.fn(),
  }),
}));

beforeEach(() => {
  setEmployeeAdminTestSession(['trip:read']);
  state.loading = true;
  state.tripPage = null;
  state.error = null;
  state.searchInput = '';
  state.status = '';
  state.departureDate = '';
  vi.restoreAllMocks();
});

describe('Admin trips read page and components', () => {
  it('renders loading skeleton and refresh action without dead create button in 05.1', () => {
    const html = renderToStaticMarkup(<TripsManagement />);
    expect(html).toContain('Đang tải danh sách chuyến xe');
    expect(html).toContain('data-result-count="loading"');
    expect(html).toContain('Làm mới');
    expect(html).not.toContain('Thêm chuyến');
  });

  it('renders trip rows, accessible sort buttons, detail action, and mobile card', () => {
    state.loading = false;
    state.tripPage = {
      data: [mockTrip],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    };

    const html = renderToStaticMarkup(<TripsManagement />);
    expect(html).toContain('data-result-count="1"');
    expect(html).toContain('FUTA-CX-001');
    expect(html).toContain('TP.HCM → Đà Lạt');
    expect(html).toContain('30F-123.45');
    expect(html).toContain('Chưa khởi hành');
    expect(html).toContain('aria-label="Xem chi tiết chuyến FUTA-CX-001"');
    expect(html).toContain('trips-mobile-card');
    expect(html).not.toContain('Đang tải danh sách chuyến xe');
  });

  it('displays empty state with distinct messages when filtered vs unfiltered', () => {
    state.loading = false;
    state.tripPage = {
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    };

    const unfilteredHtml = renderToStaticMarkup(<TripsManagement />);
    expect(unfilteredHtml).toContain('Chưa có chuyến xe trong hệ thống.');

    state.searchInput = 'Hà Nội';
    const filteredHtml = renderToStaticMarkup(<TripsManagement />);
    expect(filteredHtml).toContain('Không tìm thấy chuyến xe phù hợp.');
  });

  it('renders error state and retry button on fetch failure', () => {
    state.loading = false;
    state.error = 'Không thể kết nối đến máy chủ API.';

    const html = renderToStaticMarkup(<TripsManagement />);
    expect(html).toContain('Không thể kết nối đến máy chủ API.');
    expect(html).toContain('Thử lại');
  });

  it('correctly maps status labels and badges for all canonical trip statuses', () => {
    expect(tripStatusLabel('CHUA_KHOI_HANH')).toBe('Chưa khởi hành');
    expect(tripStatusLabel('DANG_CHAY')).toBe('Đang chạy');
    expect(tripStatusLabel('HOAN_THANH')).toBe('Hoàn thành');
    expect(tripStatusLabel('DA_HUY')).toBe('Đã hủy');

    const badgeActive = renderToStaticMarkup(
      <TripStatusBadge status="DANG_CHAY" />,
    );
    expect(badgeActive).toContain('is-active');

    const badgeMuted = renderToStaticMarkup(
      <TripStatusBadge status="CHUA_KHOI_HANH" />,
    );
    expect(badgeMuted).not.toContain('is-active');
  });
});

describe('Trip service API contract validation', () => {
  it('parses valid paginated trip list response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [mockTrip],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getTrips({
      page: 1,
      pageSize: 10,
      search: '',
      sortBy: 'departureDate',
      sortDirection: 'asc',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].code).toBe('FUTA-CX-001');
    expect(result.meta.totalItems).toBe(1);
  });

  it('parses valid trip detail response with seatSummary', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: mockTrip,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getTripById(101);
    expect(result.code).toBe('FUTA-CX-001');
    expect(result.seatSummary?.total).toBe(34);
    expect(result.seatSummary?.available).toBe(30);
  });

  it('throws error when API response is invalid or missing required fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { invalid: true },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTripById(101)).rejects.toThrow(
      'API trả về thông tin chuyến xe không hợp lệ.',
    );
  });
});
