// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { renderPortalMarkup, selectCanonicalOption } from './canonical-test-helpers';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TripFormDialog } from '../src/features/trips/components/trip-form-dialog';
import { TripDetailSheet } from '../src/features/trips/components/trip-detail-sheet';
import { TripsManagement } from '../src/features/trips/components/trips-management';
import {
  cancelTrip,
  createTrip,
  getTripRouteOptions,
  getTripVehicleOptions,
  updateTrip,
  updateTripStatus,
} from '../src/features/trips/services/trip-service';
import type {
  Trip,
  TripLookupOptionsState,
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
    ArrowDown: icon('down'),
    ArrowUp: icon('up'),
    ArrowUpDown: icon('sort'),
    CheckCircle2: icon('check'),
    ChevronLeft: icon('previous'),
    ChevronRight: icon('next'),
    Eye: icon('eye'),
    LoaderCircle: icon('loader'),
    Plus: icon('plus'),
    RefreshCw: icon('refresh'),
    Search: icon('search'),
    X: icon('close'),
  };
});

vi.mock('@/lib/api-url', () => ({
  getApiBaseUrl: () => 'http://localhost:4002',
}));

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock('@/components/data-filters/data-filters', () => ({
  FilterToolbar: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SearchInput: () => null,
  SelectFilter: () => null,
  SingleDateFilter: () => null,
}));

vi.mock('../src/features/trips/hooks/use-trips', () => ({
  useTrips: () => ({
    tripPage: {
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    },
    error: null,
    loading: false,
    searchInput: '',
    status: '',
    departureDate: '',
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

const mockTrip: Trip = {
  tripId: 101,
  code: 'FUTA-CX-001',
  departureDate: '2026-10-10',
  departureTime: '07:30:00',
  status: 'CHUA_KHOI_HANH',
  acceptsShipments: true,
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
    total: 34,
    available: 30,
    held: 2,
    booked: 2,
  },
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

const routeOptionsSuccess: TripLookupOptionsState = {
  status: 'success',
  options: [
    { id: 1, label: 'FUTA-TX-0001 (TP.HCM → Đà Lạt)' },
    { id: 2, label: 'FUTA-TX-0002 (TP.HCM → Nha Trang)' },
  ],
};

const vehicleOptionsSuccess: TripLookupOptionsState = {
  status: 'success',
  options: [
    { id: 8, label: '30F-123.45 (GIƯỜNG NẰM)' },
    { id: 9, label: '51B-999.88 (LIMOUSINE)' },
  ],
};

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Trip Form Composition & Validation', () => {
  it('renders create mode with all required fields and options', () => {
    const html = renderPortalMarkup(
      <TripFormDialog
        onClose={vi.fn()}
        onRetryRouteOptions={vi.fn()}
        onRetryVehicleOptions={vi.fn()}
        onSaved={vi.fn()}
        routeOptions={routeOptionsSuccess}
        vehicleOptions={vehicleOptionsSuccess}
      />,
    );

    expect(html).toContain('Thêm chuyến xe');
    expect(html).toContain('Mã chuyến xe');
    expect(html).toContain('Tuyến xe');
    expect(html).toContain('Xe phục vụ');
    expect(html).toContain('Nhận gửi hàng');
    expect(html).toContain('Ngày khởi hành');
    expect(html).toContain('Giờ khởi hành');
    expect(screen.getByRole('combobox', { name: /Tuyến xe/ })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /Xe phục vụ/ })).toBeTruthy();
    expect(html).toContain('Tạo chuyến xe');
  });

  it('renders edit mode with immutable code, route, and vehicle', () => {
    const html = renderPortalMarkup(
      <TripFormDialog
        onClose={vi.fn()}
        onRetryRouteOptions={vi.fn()}
        onRetryVehicleOptions={vi.fn()}
        onSaved={vi.fn()}
        routeOptions={routeOptionsSuccess}
        trip={mockTrip}
        vehicleOptions={vehicleOptionsSuccess}
      />,
    );

    expect(html).toContain('Chỉnh sửa chuyến xe');
    expect(html).toContain('FUTA-CX-001');
    expect(html).toContain('TP.HCM → Đà Lạt');
    expect(html).toContain('30F-123.45');
    // In edit mode, code/route/vehicle are read-only text, not select inputs
    expect(html).not.toContain('id="edit-trip-101-code"');
    expect(html).not.toContain('id="edit-trip-101-route"');
    expect(html).not.toContain('id="edit-trip-101-vehicle"');
    // Date and time inputs are present
    expect(html).toContain('id="edit-trip-101-departureDate"');
    expect(html).toContain('id="edit-trip-101-departureTime"');
    expect(html).toContain('2026-10-10');
    expect(html).toContain('07:30');
    expect(html).not.toContain('Nhận gửi hàng');
  });

  it.each([
    ['unchecked', false],
    ['selected', true],
  ])(
    'when the create checkbox is %s, submits acceptsShipments=%s',
    async (state, acceptsShipments) => {
      const onSaved = vi.fn();
      const savedTrip = { ...mockTrip, acceptsShipments };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) =>
        new Response(JSON.stringify({ data: String(url).includes('/code-preview') ? { code: 'FUTA-CX-10102026-0001' } : savedTrip }), { status: init?.method === 'POST' ? 201 : 200 }),
      );
      render(
        <TripFormDialog
          onClose={vi.fn()}
          onRetryRouteOptions={vi.fn()}
          onRetryVehicleOptions={vi.fn()}
          onSaved={onSaved}
          routeOptions={routeOptionsSuccess}
          vehicleOptions={vehicleOptionsSuccess}
        />,
      );

      const dialog = await screen.findByRole('dialog', {
        name: 'Thêm chuyến xe',
      });
      const checkbox = within(dialog).getByRole('checkbox', {
        name: 'Nhận gửi hàng',
      }) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
      if (state === 'selected') fireEvent.click(checkbox);

      expect((within(dialog).getByLabelText(/Mã chuyến xe/) as HTMLInputElement).disabled).toBe(true);
      await selectCanonicalOption(within(dialog).getByLabelText(/Tuyến xe/), /FUTA-TX-0001/);
      await selectCanonicalOption(within(dialog).getByLabelText(/Xe phục vụ/), /30F-123.45/);
      fireEvent.change(within(dialog).getByLabelText(/Ngày khởi hành/), {
        target: { value: '2026-10-10' },
      });
      fireEvent.change(within(dialog).getByLabelText(/Giờ khởi hành/), {
        target: { value: '07:30' },
      });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Tạo chuyến xe' }),
      );

      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedTrip));
      expect((within(dialog).getByLabelText(/Mã chuyến xe/) as HTMLInputElement).value).toBe('FUTA-CX-10102026-0001');
      const createRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
      await waitFor(() => expect(createRequests()).toHaveLength(1));
      const [createUrl, init] = createRequests()[0];
      expect(new URL(String(createUrl)).pathname).toBe('/api/v1/trips');
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/code-preview'))).toHaveLength(1);
      expect(JSON.parse(init?.body as string)).toEqual({
        routeId: 1,
        vehicleId: 8,
        departureDate: '2026-10-10',
        departureTime: '07:30:00',
        acceptsShipments,
      });
    },
  );

  it('does not expose or submit shipment fields while editing a trip', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: mockTrip }), { status: 200 }),
      );
    render(
      <TripFormDialog
        onClose={vi.fn()}
        onRetryRouteOptions={vi.fn()}
        onRetryVehicleOptions={vi.fn()}
        onSaved={vi.fn()}
        routeOptions={routeOptionsSuccess}
        trip={mockTrip}
        vehicleOptions={vehicleOptionsSuccess}
      />,
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Chỉnh sửa chuyến xe',
    });
    expect(
      within(dialog).queryByRole('checkbox', { name: 'Nhận gửi hàng' }),
    ).toBeNull();
    fireEvent.change(within(dialog).getByLabelText(/Ngày khởi hành/), {
      target: { value: '2026-10-15' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Giờ khởi hành/), {
      target: { value: '08:00' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Lưu thay đổi' }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      departureDate: '2026-10-15',
      departureTime: '08:00:00',
    });
  });

  it('shows loading state for route and vehicle options', () => {
    const html = renderPortalMarkup(
      <TripFormDialog
        onClose={vi.fn()}
        onRetryRouteOptions={vi.fn()}
        onRetryVehicleOptions={vi.fn()}
        onSaved={vi.fn()}
        routeOptions={{ status: 'loading' }}
        vehicleOptions={{ status: 'loading' }}
      />,
    );

    expect(html).toContain('Đang tải tuyến xe…');
    expect(html).toContain('Đang tải xe phục vụ…');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });

  it('shows error state with retry buttons when lookup options fail', () => {
    const html = renderPortalMarkup(
      <TripFormDialog
        onClose={vi.fn()}
        onRetryRouteOptions={vi.fn()}
        onRetryVehicleOptions={vi.fn()}
        onSaved={vi.fn()}
        routeOptions={{ status: 'error', message: 'Lỗi tải tuyến xe.' }}
        vehicleOptions={{ status: 'error', message: 'Lỗi tải phương tiện.' }}
      />,
    );

    expect(html).toContain('Lỗi tải tuyến xe.');
    expect(html).toContain('Lỗi tải phương tiện.');
    expect(html).toContain('Thử tải lại');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });
});

describe('Trip permission gates', () => {
  it('renders "Thêm chuyến" button when user has trip:create permission', () => {
    setEmployeeAdminTestSession(['trip:read', 'trip:create']);
    const html = renderPortalMarkup(<TripsManagement />);
    expect(html).toContain('Thêm chuyến');
  });

  it('hides "Thêm chuyến" button when user only has trip:read', () => {
    setEmployeeAdminTestSession(['trip:read']);
    const html = renderPortalMarkup(<TripsManagement />);
    expect(html).not.toContain('Thêm chuyến');
  });
});

describe('Trip shipment snapshot details', () => {
  it('shows the shipment flag and total snapshot capacities in the detail sheet', () => {
    setEmployeeAdminTestSession(['trip:read']);
    const html = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={mockTrip}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );

    expect(html).toContain('Nhận gửi hàng');
    expect(html).toContain('Có');
    expect(html).toContain('Sức chứa hàng');
    expect(html).toContain('Xe máy');
    expect(html).toContain('Hàng cồng kềnh');
    expect(html).toContain('Hàng nhẹ');
    expect(html).toMatch(/<dt>Xe máy<\/dt><dd>1<\/dd>/);
    expect(html).toMatch(/<dt>Hàng cồng kềnh<\/dt><dd>2<\/dd>/);
    expect(html).toMatch(/<dt>Hàng nhẹ<\/dt><dd>3<\/dd>/);
    expect(html).not.toContain('Còn lại');

    const nonShipmentHtml = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={{ ...mockTrip, acceptsShipments: false }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );
    expect(nonShipmentHtml).toContain('<dt>Nhận gửi hàng</dt><dd>Không</dd>');
  });
});

describe('Trip write service API contracts', () => {
  it('createTrip sends POST /api/v1/trips with correct payload', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: mockTrip }), { status: 201 }),
      );

    const result = await createTrip({
      code: 'FUTA-CX-001',
      routeId: 1,
      vehicleId: 8,
      departureDate: '2026-10-10',
      departureTime: '07:30',
      acceptsShipments: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/v1/trips');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      code: 'FUTA-CX-001',
      routeId: 1,
      vehicleId: 8,
      departureDate: '2026-10-10',
      departureTime: '07:30',
      acceptsShipments: true,
    });
    expect(result.tripId).toBe(101);
  });

  it('updateTrip sends PATCH /api/v1/trips/:id with departure date and time only', async () => {
    const updatedMock = {
      ...mockTrip,
      departureDate: '2026-10-15',
      departureTime: '08:00:00',
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: updatedMock }), { status: 200 }),
      );

    const result = await updateTrip(101, {
      departureDate: '2026-10-15',
      departureTime: '08:00',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/v1/trips/101');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({
      departureDate: '2026-10-15',
      departureTime: '08:00',
    });
    expect(result.departureDate).toBe('2026-10-15');
  });

  it('maps TRIP_CODE_EXISTS into TripApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 409,
          error: 'TRIP_CODE_EXISTS',
          message: 'Mã chuyến xe đã tồn tại.',
        }),
        { status: 409 },
      ),
    );

    await expect(
      createTrip({
        code: 'FUTA-CX-001',
        routeId: 1,
        vehicleId: 8,
        departureDate: '2026-10-10',
        departureTime: '07:30',
        acceptsShipments: false,
      }),
    ).rejects.toMatchObject({
      name: 'TripApiError',
      code: 'TRIP_CODE_EXISTS',
      message: 'Mã chuyến xe đã tồn tại.',
    });
  });

  it('maps VEHICLE_HAS_NO_SEATS into TripApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 409,
          error: 'VEHICLE_HAS_NO_SEATS',
          message: 'Xe chưa được cấu hình ghế nên chưa thể lập chuyến.',
        }),
        { status: 409 },
      ),
    );

    await expect(
      createTrip({
        code: 'FUTA-CX-001',
        routeId: 1,
        vehicleId: 8,
        departureDate: '2026-10-10',
        departureTime: '07:30',
        acceptsShipments: false,
      }),
    ).rejects.toMatchObject({
      name: 'TripApiError',
      code: 'VEHICLE_HAS_NO_SEATS',
      message: 'Xe chưa được cấu hình ghế nên chưa thể lập chuyến.',
    });
  });

  it('getTripRouteOptions queries active routes and maps into id/label options', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              routeId: 1,
              code: 'FUTA-TX-0001',
              origin: 'TP.HCM',
              destination: 'Đà Lạt',
              status: 'HOAT_DONG',
              busCompany: {
                busCompanyId: 3,
                code: 'FUTA',
                name: 'Phương Trang',
              },
              createdAt: '2026-09-22T07:34:00.000Z',
              updatedAt: '2026-09-23T07:34:00.000Z',
            },
          ],
          meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
        }),
        { status: 200 },
      ),
    );

    const options = await getTripRouteOptions();
    expect(options).toEqual([
      { id: 1, label: 'FUTA-TX-0001 — TP.HCM → Đà Lạt' },
    ]);
  });

  it('getTripVehicleOptions queries active vehicles and maps into id/label options', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              vehicleId: 8,
              licensePlate: '30F-123.45',
              status: 'HOAT_DONG',
              busCompany: {
                busCompanyId: 3,
                code: 'FUTA',
                name: 'Phương Trang',
              },
              vehicleType: { vehicleTypeId: 2, name: 'GIƯỜNG NẰM' },
              createdAt: '2026-09-22T07:34:00.000Z',
              updatedAt: '2026-09-23T07:34:00.000Z',
            },
          ],
          meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
        }),
        { status: 200 },
      ),
    );

    const options = await getTripVehicleOptions();
    expect(options).toEqual([{ id: 8, label: '30F-123.45 (GIƯỜNG NẰM)' }]);
  });

  it('getTripRouteOptions fetches all pages when totalPages > 1 and combines options', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                routeId: 1,
                code: 'TX-01',
                origin: 'TP.HCM',
                destination: 'Đà Lạt',
                status: 'HOAT_DONG',
                busCompany: {
                  busCompanyId: 3,
                  code: 'FUTA',
                  name: 'Phương Trang',
                },
                createdAt: '2026-09-22T07:34:00.000Z',
                updatedAt: '2026-09-23T07:34:00.000Z',
              },
            ],
            meta: { page: 1, pageSize: 100, totalItems: 2, totalPages: 2 },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                routeId: 2,
                code: 'TX-02',
                origin: 'TP.HCM',
                destination: 'Cần Thơ',
                status: 'HOAT_DONG',
                busCompany: {
                  busCompanyId: 3,
                  code: 'FUTA',
                  name: 'Phương Trang',
                },
                createdAt: '2026-09-22T07:34:00.000Z',
                updatedAt: '2026-09-23T07:34:00.000Z',
              },
            ],
            meta: { page: 2, pageSize: 100, totalItems: 2, totalPages: 2 },
          }),
          { status: 200 },
        ),
      );

    const options = await getTripRouteOptions();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(options).toEqual([
      { id: 1, label: 'TX-01 — TP.HCM → Đà Lạt' },
      { id: 2, label: 'TX-02 — TP.HCM → Cần Thơ' },
    ]);
  });

  it('getTripVehicleOptions fetches all pages when totalPages > 1 and combines options', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                vehicleId: 8,
                licensePlate: '30F-123.45',
                status: 'HOAT_DONG',
                busCompany: {
                  busCompanyId: 3,
                  code: 'FUTA',
                  name: 'Phương Trang',
                },
                vehicleType: { vehicleTypeId: 2, name: 'GIƯỜNG NẰM' },
                createdAt: '2026-09-22T07:34:00.000Z',
                updatedAt: '2026-09-23T07:34:00.000Z',
              },
            ],
            meta: { page: 1, pageSize: 100, totalItems: 2, totalPages: 2 },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                vehicleId: 9,
                licensePlate: '51B-999.99',
                status: 'HOAT_DONG',
                busCompany: {
                  busCompanyId: 3,
                  code: 'FUTA',
                  name: 'Phương Trang',
                },
                vehicleType: { vehicleTypeId: 2, name: 'LIMOUSINE' },
                createdAt: '2026-09-22T07:34:00.000Z',
                updatedAt: '2026-09-23T07:34:00.000Z',
              },
            ],
            meta: { page: 2, pageSize: 100, totalItems: 2, totalPages: 2 },
          }),
          { status: 200 },
        ),
      );

    const options = await getTripVehicleOptions();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(options).toEqual([
      { id: 8, label: '30F-123.45 (GIƯỜNG NẰM)' },
      { id: 9, label: '51B-999.99 (LIMOUSINE)' },
    ]);
  });
});

describe('Trip lifecycle & cancellation action gates in detail sheet', () => {
  it('renders edit and cancel, but never manual start, for pending trips with full permissions', () => {
    setEmployeeAdminTestSession(['trip:read', 'trip:update', 'trip:cancel']);
    const html = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={{ ...mockTrip, status: 'CHUA_KHOI_HANH' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );
    expect(html).toContain('Chỉnh sửa');
    expect(html).not.toContain('Bắt đầu chạy');
    expect(html).toContain('Hủy chuyến');
    expect(html).not.toContain('Hoàn thành chuyến');
  });

  it('renders "Hoàn thành chuyến" and hides "Chỉnh sửa" for DANG_CHAY with trip:update', () => {
    setEmployeeAdminTestSession(['trip:read', 'trip:update', 'trip:cancel']);
    const html = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={{ ...mockTrip, status: 'DANG_CHAY' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );
    expect(html).not.toContain('Chỉnh sửa');
    expect(html).toContain('Hoàn thành chuyến');
    expect(html).not.toContain('Bắt đầu chạy');
    expect(html).not.toContain('Hủy chuyến');
  });

  it('hides edit and all lifecycle actions for terminal statuses HOAN_THANH and DA_HUY', () => {
    setEmployeeAdminTestSession(['trip:read', 'trip:update', 'trip:cancel']);
    const htmlCompleted = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={{ ...mockTrip, status: 'HOAN_THANH' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );
    expect(htmlCompleted).not.toContain('Chỉnh sửa');
    expect(htmlCompleted).not.toContain('Bắt đầu chạy');
    expect(htmlCompleted).not.toContain('Hoàn thành chuyến');
    expect(htmlCompleted).not.toContain('Hủy chuyến');

    const htmlCancelled = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={{ ...mockTrip, status: 'DA_HUY' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );
    expect(htmlCancelled).not.toContain('Chỉnh sửa');
    expect(htmlCancelled).not.toContain('Bắt đầu chạy');
    expect(htmlCancelled).not.toContain('Hoàn thành chuyến');
    expect(htmlCancelled).not.toContain('Hủy chuyến');
  });

  it('respects granular permissions: hides status and edit without trip:update, hides cancel without trip:cancel', () => {
    setEmployeeAdminTestSession(['trip:read']);
    const readOnlyHtml = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={{ ...mockTrip, status: 'CHUA_KHOI_HANH' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );
    expect(readOnlyHtml).not.toContain('Chỉnh sửa');
    expect(readOnlyHtml).not.toContain('Bắt đầu chạy');
    expect(readOnlyHtml).not.toContain('Hủy chuyến');
    const readOnlyRunningHtml = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={{ ...mockTrip, status: 'DANG_CHAY' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );
    expect(readOnlyRunningHtml).not.toContain('Hoàn thành chuyến');

    setEmployeeAdminTestSession(['trip:read', 'trip:update']);
    const updateOnlyHtml = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={{ ...mockTrip, status: 'CHUA_KHOI_HANH' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );
    expect(updateOnlyHtml).toContain('Chỉnh sửa');
    expect(updateOnlyHtml).not.toContain('Bắt đầu chạy');
    expect(updateOnlyHtml).not.toContain('Hủy chuyến');
    const updateRunningHtml = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={{ ...mockTrip, status: 'DANG_CHAY' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );
    expect(updateRunningHtml).toContain('Hoàn thành chuyến');
    expect(updateRunningHtml).not.toContain('Bắt đầu chạy');

    setEmployeeAdminTestSession(['trip:read', 'trip:cancel']);
    const cancelOnlyHtml = renderPortalMarkup(
      <TripDetailSheet
        initialTrip={{ ...mockTrip, status: 'CHUA_KHOI_HANH' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        tripId={101}
      />,
    );
    expect(cancelOnlyHtml).not.toContain('Chỉnh sửa');
    expect(cancelOnlyHtml).not.toContain('Bắt đầu chạy');
    expect(cancelOnlyHtml).toContain('Hủy chuyến');
  });
});

describe('Trip status update and cancellation service API contracts', () => {
  it('updateTripStatus sends PATCH /api/v1/trips/:id/status with target status', async () => {
    const updatedMock = { ...mockTrip, status: 'DANG_CHAY' as const };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: updatedMock }), { status: 200 }),
      );

    const result = await updateTripStatus(101, 'DANG_CHAY');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/v1/trips/101/status');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({ status: 'DANG_CHAY' });
    expect(result.status).toBe('DANG_CHAY');
  });

  it('cancelTrip sends POST /api/v1/trips/:id/cancel', async () => {
    const cancelledMock = { ...mockTrip, status: 'DA_HUY' as const };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: cancelledMock }), { status: 200 }),
      );

    const result = await cancelTrip(101);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/v1/trips/101/cancel');
    expect(init?.method).toBe('POST');
    expect(result.status).toBe('DA_HUY');
  });

  it('maps TRIP_STATUS_TRANSITION_NOT_ALLOWED conflict error properly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 409,
          error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
          message: 'Không thể chuyển đổi trạng thái chuyến xe.',
        }),
        { status: 409 },
      ),
    );

    await expect(updateTripStatus(101, 'HOAN_THANH')).rejects.toMatchObject({
      code: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
      message: 'Không thể chuyển đổi trạng thái chuyến xe.',
    });
  });
});
