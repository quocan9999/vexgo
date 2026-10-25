// @vitest-environment jsdom
import { renderPortalMarkup } from './canonical-test-helpers';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TripSeatsManagement,
  TripSeatStatusBadge,
} from '../src/features/trips/components/trip-seats-management';
import { TripDetailSheet } from '../src/features/trips/components/trip-detail-sheet';
import { getTripSeats } from '../src/features/trips/services/trip-service';
import type {
  Trip,
  TripSeat,
  TripSeatsResponse,
} from '../src/features/trips/types/trip';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  const icon = (name: string) =>
    function MockIcon(props: React.SVGProps<SVGSVGElement>) {
      return <svg {...props} data-icon={name} />;
    };
  return {
    ...actual,
    CheckCircle2: icon('check'),
    LoaderCircle: icon('loader'),
    RefreshCw: icon('refresh'),
    X: icon('close'),
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

const mockTrip: Trip = {
  tripId: 101,
  code: 'FUTA-CX-001',
  departureDate: '2026-10-10',
  departureTime: '07:30:00',
  status: 'CHUA_KHOI_HANH',
  acceptsShipments: false,
  cargoCapacity: { motorbikes: 1, bulkyCargo: 2, lightCargo: 3 },
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
    total: 3,
    available: 1,
    held: 1,
    booked: 1,
  },
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

const mockSeats: TripSeat[] = [
  {
    tripSeatId: 1001,
    status: 'TRONG',
    seat: {
      seatId: 501,
      code: 'A01',
      position: 'Tầng dưới',
      floor: 1,
      x: 160,
      y: 1000,
    },
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    tripSeatId: 1002,
    status: 'DANG_GIU',
    seat: {
      seatId: 502,
      code: 'A02',
      position: 'Tầng dưới',
      floor: 1,
      x: 360,
      y: 1000,
    },
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    tripSeatId: 1003,
    status: 'DA_DAT',
    seat: {
      seatId: 503,
      code: 'B01',
      position: 'Tầng trên',
      floor: 2,
      x: 640,
      y: 1000,
    },
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
];

const mockSeatsResponse: TripSeatsResponse = {
  data: mockSeats,
  meta: {
    tripId: 101,
    total: 3,
    available: 1,
    held: 1,
    booked: 1,
  },
};

beforeEach(() => {
  setEmployeeAdminTestSession(['trip:read']);
  vi.restoreAllMocks();
});

describe('TripSeatStatusBadge', () => {
  it('maps TRONG, DANG_GIU, and DA_DAT to distinguishable visual badges with explicit text', () => {
    const availableHtml = renderToStaticMarkup(
      <TripSeatStatusBadge status="TRONG" />,
    );
    expect(availableHtml).toContain('Trống');
    expect(availableHtml).toContain('data-variant="success"');

    const heldHtml = renderToStaticMarkup(
      <TripSeatStatusBadge status="DANG_GIU" />,
    );
    expect(heldHtml).toContain('Đang giữ');
    expect(heldHtml).toContain('data-variant="warning"');

    const bookedHtml = renderToStaticMarkup(
      <TripSeatStatusBadge status="DA_DAT" />,
    );
    expect(bookedHtml).toContain('Đã đặt');
    expect(bookedHtml).toContain('data-variant="destructive"');
  });
});

describe('TripSeatsManagement Workspace', () => {
  it('renders workspace with title, back link, trip context, and accurate summary counts', () => {
    const html = renderToStaticMarkup(
      <TripSeatsManagement
        initialSeats={mockSeatsResponse}
        initialTrip={mockTrip}
        tripId={101}
      />,
    );

    expect(html).toContain('QUẢN LÝ VẬN HÀNH');
    expect(html).toContain('Ghế chuyến FUTA-CX-001');
    expect(html).toContain('Danh sách chuyến');
    expect(html).toContain('href="/trips"');
    // Context
    expect(html).toContain(
      'FUTA-TX-0001',
    );
    expect(html).toContain('30F-123.45');
    expect(html).toContain('Chưa khởi hành');
    // Summary
    expect(html).toContain('Tổng số ghế');
    expect(html).toContain('Ghế trống');
    expect(html).toContain('Đang giữ');
    expect(html).toContain('Đã đặt');
  });

  it('renders a 2D floor map from saved seat coordinates with status and accessible labels', () => {
    const html = renderToStaticMarkup(
      <TripSeatsManagement
        initialSeats={mockSeatsResponse}
        initialTrip={mockTrip}
        tripId={101}
      />,
    );

    const document = new DOMParser().parseFromString(html, 'text/html');
    const lowerFloor = document.querySelector(
      '[aria-labelledby="trip-seat-floor-1"]',
    );
    const upperFloor = document.querySelector(
      '[aria-labelledby="trip-seat-floor-2"]',
    );

    expect(lowerFloor?.textContent).toContain('Tầng dưới');
    expect(lowerFloor?.textContent).toContain('2 ghế');
    expect(upperFloor?.textContent).toContain('Tầng trên');
    expect(upperFloor?.textContent).toContain('1 ghế');
    expect(html).toContain('aria-label="Sơ đồ ghế tầng dưới"');
    expect(html).toContain('aria-label="Sơ đồ ghế tầng trên"');
    // Seat tokens preserve each saved 2D position and remain non-interactive.
    expect(html).toContain('data-seat-code="A01"');
    expect(html).toContain('data-seat-code="A02"');
    expect(html).toContain('data-seat-code="B01"');
    const lowerLeftStyle = document
      .querySelector('[data-seat-code="A01"]')
      ?.getAttribute('style');
    const lowerRightStyle = document
      .querySelector('[data-seat-code="A02"]')
      ?.getAttribute('style');
    const upperSeatStyle = document
      .querySelector('[data-seat-code="B01"]')
      ?.getAttribute('style');
    expect(lowerLeftStyle).toContain('left:16%');
    expect(lowerLeftStyle).toContain('top:64px');
    expect(lowerRightStyle).toContain('left:36%');
    expect(lowerRightStyle).toContain('top:64px');
    expect(upperSeatStyle).toContain('left:64%');
    expect(upperSeatStyle).toContain('top:64px');
    expect(
      document.querySelector('[data-seat-code="A02"]')?.getAttribute('aria-label'),
    ).toContain('đang giữ');
    expect(
      document.querySelector('[data-seat-code="B01"]')?.getAttribute('aria-label'),
    ).toContain('đã đặt');
    // Read-only: no button tag used for seat tokens
    expect(html).not.toMatch(/<button[^>]*data-seat-code/);
    // Legend
    expect(html).toContain('Có thể đặt');
    expect(html).toContain('Đang được giữ tạm thời');
    expect(html).toContain('Đã đặt');
  });

  it('places seats without saved coordinates in a visible fallback slot', () => {
    const seatsWithNullPos: TripSeatsResponse = {
      data: [
        {
          tripSeatId: 1004,
          status: 'TRONG',
          seat: {
            seatId: 504,
            code: 'X01',
            position: null,
            floor: 1,
            x: null,
            y: null,
          },
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
      ],
      meta: {
        tripId: 101,
        total: 1,
        available: 1,
        held: 0,
        booked: 0,
      },
    };

    const html = renderToStaticMarkup(
      <TripSeatsManagement
        initialSeats={seatsWithNullPos}
        initialTrip={mockTrip}
        tripId={101}
      />,
    );

    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(
      document.querySelector('[aria-labelledby="trip-seat-floor-1"]')?.textContent,
    ).toContain('1 ghế');
    const fallbackStyle = document
      .querySelector('[data-seat-code="X01"]')
      ?.getAttribute('style');
    expect(fallbackStyle).toContain('left:16%');
    expect(fallbackStyle).toContain('top:64px');
    expect(html).toContain('X01');
  });

  it('renders filter buttons with counts and handles empty seat state', () => {
    const emptySeats: TripSeatsResponse = {
      data: [],
      meta: {
        tripId: 101,
        total: 0,
        available: 0,
        held: 0,
        booked: 0,
      },
    };

    const html = renderToStaticMarkup(
      <TripSeatsManagement
        initialSeats={emptySeats}
        initialTrip={mockTrip}
        tripId={101}
      />,
    );

    expect(html).toContain('Chuyến xe chưa có dữ liệu ghế.');
    expect(html).toContain('Tất cả (0)');
    expect(html).toContain('Trống (0)');
  });

  it('denies access with clear message when user lacks trip:read permission', () => {
    setEmployeeAdminTestSession([]);

    const html = renderToStaticMarkup(
      <TripSeatsManagement
        initialSeats={mockSeatsResponse}
        initialTrip={mockTrip}
        tripId={101}
      />,
    );

    expect(html).toContain('Bạn không có quyền xem thông tin ghế chuyến xe.');
    expect(html).not.toContain('Ghế chuyến FUTA-CX-001');
  });
});

describe('TripDetailSheet "Xem ghế chuyến" integration', () => {
  it('renders "Xem ghế chuyến" link leading to /trips/:id/seats when user has trip:read', () => {
    setEmployeeAdminTestSession(['trip:read']);

    const html = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={mockTrip}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );

    expect(html).toContain('Xem ghế chuyến');
    expect(html).toContain('href="/trips/101/seats"');
  });
});

describe('getTripSeats API Service Contract', () => {
  it('queries GET /api/v1/trips/:id/seat-inventory without query when no filter applied', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(mockSeatsResponse), { status: 200 }),
      );

    const result = await getTripSeats(101);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe(
      '/api/v1/trips/101/seat-inventory',
    );
    expect(new URL(url as string).search).toBe('');
    expect(init?.method).toBe('GET');
    expect(result.data).toHaveLength(3);
    expect(result.meta.total).toBe(3);
  });

  it('queries GET /api/v1/trips/:id/seat-inventory?status=TRONG when status filter provided', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [mockSeats[0]],
          meta: mockSeatsResponse.meta,
        }),
        { status: 200 },
      ),
    );

    const result = await getTripSeats(101, { status: 'TRONG' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe(
      '/api/v1/trips/101/seat-inventory',
    );
    expect(new URL(url as string).searchParams.get('status')).toBe('TRONG');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].seat.code).toBe('A01');
  });

  it('throws TripApiError on 404 TRIP_NOT_FOUND', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 404,
          error: 'TRIP_NOT_FOUND',
          message: 'Không tìm thấy chuyến xe.',
        }),
        { status: 404 },
      ),
    );

    await expect(getTripSeats(999)).rejects.toMatchObject({
      code: 'TRIP_NOT_FOUND',
      message: 'Không tìm thấy chuyến xe.',
    });
  });
});
