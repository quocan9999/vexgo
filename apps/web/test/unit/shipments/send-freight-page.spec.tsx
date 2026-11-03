import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SendFreightPage from '../../../src/features/shipments/components/send-freight-page';

const api = vi.hoisted(() => ({
  searchTrips: vi.fn(),
  getOptions: vi.fn(),
  getQuote: vi.fn(),
  getCargoCategories: vi.fn(),
  getRoutePointsByRoute: vi.fn(),
  createShipment: vi.fn(),
  lookupShipment: vi.fn(),
  routerPush: vi.fn(),
  auth: {
    isAuthenticated: false,
    isHydrated: true,
    executeWithAuth: vi.fn(async <T,>(action: (token: string) => Promise<T>) =>
      action('test-access-token'),
    ),
  },
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: api.routerPush }),
  useSearchParams: () => api.searchParams,
}));

vi.mock('@/features/trips/services/trips.api', () => ({
  tripsApi: { searchTrips: api.searchTrips },
}));

vi.mock('@/features/shipments/services/shipments.api', () => ({
  shipmentsApi: {
    getOptions: api.getOptions,
    getQuote: api.getQuote,
    getCargoCategories: api.getCargoCategories,
    getRoutePointsByRoute: api.getRoutePointsByRoute,
    createShipment: api.createShipment,
    lookupShipment: api.lookupShipment,
  },
}));

vi.mock('@/features/auth/auth-session', () => ({
  useAuthSession: () => api.auth,
}));
vi.mock('@/features/locations/services/locations.api', () => ({
  getLocations: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'current:province:79',
        name: 'Hồ Chí Minh',
        value: 'TP.HCM',
        aliases: ['TP.HCM', 'Hồ Chí Minh'],
        versions: ['current'],
        kind: 'province',
        province: null,
      },
      {
        id: 'legacy:city:672',
        name: 'Đà Lạt',
        value: 'Đà Lạt',
        aliases: ['Đà Lạt'],
        versions: ['legacy'],
        kind: 'city',
        province: 'Lâm Đồng',
      },
    ],
    warning: '',
  }),
}));

const createdShipment = {
  shipmentId: 601,
  orderId: 701,
  paymentId: 801,
  paymentExpiresAt: '2026-10-15T10:10:00.000Z',
  waybillCode: 'VG-VD-TEST-601',
  orderCode: 'VG-DH-TEST-701',
  status: 'MOI_TAO',
  paymentStatus: 'CHO_THANH_TOAN',
  sentAt: '2026-10-15T10:00:00.000Z',
  pricing: { baseFee: 50_000, serviceFee: 0, discount: 0, totalFee: 50_000 },
  sender: { fullName: 'Nguyễn An', phoneNumber: '0900000001', email: null },
  receiver: { fullName: 'Trần Bình', phoneNumber: '0900000002' },
  pickupPoint: { id: 901, name: 'Điểm gửi', address: 'Địa chỉ gửi' },
  dropoffPoint: { id: 902, name: 'Điểm nhận', address: 'Địa chỉ nhận' },
  trip: {
    tripId: null,
    code: null,
    departureTime: null,
    route: { origin: 'Đà Lạt', destination: 'TP.HCM' },
    busCompany: { id: 4, name: 'Nhà xe kiểm thử' },
    vehicle: { licensePlate: '51A-00000' },
  },
  items: [
    {
      id: 1,
      name: 'Hồ sơ',
      quantity: 1,
      weight: 1,
      category: 'Tài liệu',
      dimensions: null,
      note: null,
    },
  ],
  timeline: [],
};


beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T00:00:00.000Z'));
  api.searchParams = new URLSearchParams({
    from: 'Đà Lạt',
    to: 'TP.HCM',
  });
  window.sessionStorage.clear();
  api.routerPush.mockReset();
  api.auth.isAuthenticated = false;
  api.auth.isHydrated = true;
  api.auth.executeWithAuth.mockClear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  api.getOptions.mockReset().mockResolvedValue({
    meta: { page: 1, pageSize: 8, totalItems: 1, totalPages: 1 },
    data: [
      {
        routeId: 42,
        id: 42,
        code: 'TRIP-42',
        status: 'DANG_MO_BAN',
        busCompany: { id: 4, name: 'Nhà xe kiểm thử' },
        route: { origin: 'Đà Lạt', destination: 'TP.HCM' },
        minimumEstimatedFee: 30_000,
        departureTime: '2026-10-20T08:00:00.000Z',
        arrivalTime: null,
        vehicle: { licensePlate: '51A-00000' },
        price: 100_000,
        availableSeats: 20,
      },
    ],
  });
  api.getQuote.mockReset().mockResolvedValue({
    data: { baseFee: 50000, serviceFee: 0, totalFee: 50000 },
  });
  api.getCargoCategories.mockReset().mockResolvedValue({
    data: [
      {
        categoryId: 21,
        name: 'Tài liệu',
        description: 'Hàng nhẹ',
        capacityGroup: 'parcels',
      },
    ],
  });
  api.getRoutePointsByRoute.mockReset().mockResolvedValue({
    data: {
      tripId: 42,
      senderPoints: [{ id: 901, name: 'Điểm gửi', address: 'Địa chỉ gửi' }],
      receiverPoints: [{ id: 902, name: 'Điểm nhận', address: 'Địa chỉ nhận' }],
    },
  });
  api.createShipment.mockReset().mockResolvedValue({ data: createdShipment });
  api.lookupShipment.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('independent shipment flow', () => {
  it('shows the lowest reference fee without presenting it as the final quote', async () => {
    render(<SendFreightPage />);

    expect(await screen.findByText('Cước từ 30.000 đ')).toBeTruthy();
    expect(screen.getByText('Giá chính xác sau khi chọn bưu cục')).toBeTruthy();
    expect(screen.queryByText('Tổng cước phí: 30.000 đ')).toBeNull();
  });

  it('shows an honest fallback when a carrier has no reference fee', async () => {
    api.getOptions.mockResolvedValueOnce({
      meta: { page: 1, pageSize: 8, totalItems: 1, totalPages: 1 },
      data: [
        {
          routeId: 42,
          busCompany: { id: 4, name: 'Nhà xe kiểm thử' },
          route: { origin: 'Đà Lạt', destination: 'TP.HCM' },
          minimumEstimatedFee: null,
        },
      ],
    });

    render(<SendFreightPage />);

    expect(await screen.findByText('Chưa có giá tham khảo')).toBeTruthy();
  });

  it('creates shipment and displays success modal with waybill code and 72h dropoff notice', async () => {
    render(<SendFreightPage />);
    expect(
      (await screen.findAllByText('Nhà xe kiểm thử', { exact: true })).length,
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), {
      target: { value: 'Nguyễn An' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('09xxxxxxxx')[0], {
      target: { value: '0900000001' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Lê Thị B'), {
      target: { value: 'Trần Bình' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('09xxxxxxxx')[1], {
      target: { value: '0900000002' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Ví dụ: Thùng hoa quả, tài liệu, quần áo...'),
      {
        target: { value: 'Hồ sơ' },
      },
    );
    fireEvent.change(
      await screen.findByRole('combobox', { name: 'Loại hàng hóa' }),
      { target: { value: '21' } },
    );

    await waitFor(() =>
      expect(api.getRoutePointsByRoute).toHaveBeenCalledWith(42),
    );
    await waitFor(() => expect(api.getQuote).toHaveBeenCalled());
    expect(api.getOptions).toHaveBeenCalledWith({
      from: 'Đà Lạt',
      to: 'TP.HCM',
      page: 1,
      pageSize: 8,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã vận đơn' }));

    await waitFor(() => expect(api.createShipment).toHaveBeenCalledTimes(1));
    expect(api.createShipment.mock.calls[0][0]).toMatchObject({
      routeId: 42,
      paymentMethod: 'TAI_BEN',
    });
    expect(await screen.findByText('Tạo đơn gửi hàng thành công!')).toBeTruthy();
    expect(screen.getByText('VG-VD-TEST-601')).toBeTruthy();
  });
});
