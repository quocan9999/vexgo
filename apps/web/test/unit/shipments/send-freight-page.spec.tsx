import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SendFreightPage, {
  getCarrierDeliveryEstimate,
} from '../../../src/features/shipments/components/send-freight-page';

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

const publicShipmentLookup = {
  waybillCode: 'VG-VD-PUBLIC-1',
  status: 'DANG_VAN_CHUYEN',
  carrier: { name: 'Nhà xe công khai' },
  route: { origin: 'Đà Lạt', destination: 'TP.HCM' },
  pickupPoint: { name: 'Điểm gửi công khai', address: 'Địa chỉ gửi công khai' },
  dropoffPoint: {
    name: 'Điểm nhận công khai',
    address: 'Địa chỉ nhận công khai',
  },
  scheduledDepartureAt: '2026-10-20T08:00:00.000Z',
  estimatedArrivalAt: '2026-10-20T12:00:00.000Z',
  packageCount: 3,
  timeline: [{ status: 'DA_TIEP_NHAN', time: '2026-10-15T10:00:00.000Z' }],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T00:00:00.000Z'));
  api.searchParams = new URLSearchParams({
    from: 'Đà Lạt',
    to: 'TP.HCM',
    date: '2026-10-20',
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

  it('routes a newly created shipment to a server-verified payment draft instead of reporting success', async () => {
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
    expect(api.getOptions).toHaveBeenCalledWith({
      from: 'Đà Lạt',
      to: 'TP.HCM',
      sendDate: '2026-10-20',
      page: 1,
      pageSize: 8,
    });
    fireEvent.click(screen.getByLabelText(/Thanh toán trực tuyến/i));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã vận đơn' }));

    await waitFor(() => expect(api.routerPush).toHaveBeenCalledTimes(1));
    expect(api.createShipment).toHaveBeenCalledTimes(1);
    expect(api.createShipment.mock.calls[0][0]).toMatchObject({
      routeId: 42,
      sendDate: '2026-10-20',
    });
    expect(api.createShipment.mock.calls[0][0]).not.toHaveProperty('tripId');
    expect(api.createShipment.mock.calls[0][2]).toEqual(expect.any(String));
    expect(api.routerPush.mock.calls[0][0]).toMatch(/^\/payment\?draftId=/);
    expect(
      screen.queryByText('Tạo mã vận đơn gửi hàng thành công!'),
    ).toBeNull();
    expect(window.sessionStorage.length).toBe(1);
    const savedDraft = JSON.parse(
      window.sessionStorage.getItem(window.sessionStorage.key(0)!)!,
    );
    expect(savedDraft).toMatchObject({
      kind: 'shipment',
      shipmentId: createdShipment.shipmentId,
      paymentId: createdShipment.paymentId,
      waybillCode: createdShipment.waybillCode,
      orderCode: createdShipment.orderCode,
      totalFare: createdShipment.pricing.totalFee,
      sender: {
        fullName: createdShipment.sender.fullName,
        phoneNumber: createdShipment.sender.phoneNumber,
      },
    });
  });

  it('creates an authenticated shipment with the active Customer access token', async () => {
    api.auth.isAuthenticated = true;
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
      { target: { value: 'Hồ sơ' } },
    );
    fireEvent.change(
      await screen.findByRole('combobox', { name: 'Loại hàng hóa' }),
      { target: { value: '21' } },
    );
    await waitFor(() =>
      expect(api.getRoutePointsByRoute).toHaveBeenCalledWith(42),
    );

    fireEvent.click(screen.getByLabelText(/Thanh toán trực tuyến/i));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã vận đơn' }));

    await waitFor(() => expect(api.routerPush).toHaveBeenCalledTimes(1));
    expect(api.auth.executeWithAuth).toHaveBeenCalledTimes(1);
    expect(api.createShipment).toHaveBeenCalledTimes(1);
    expect(api.createShipment.mock.calls[0][1]).toBe('test-access-token');
    expect(api.routerPush.mock.calls[0][0]).toMatch(/^\/payment\?draftId=/);
  });

  it('shows public tracking details without exposing sender, receiver, payment, or cargo PII', async () => {
    api.lookupShipment.mockResolvedValue({ data: publicShipmentLookup });
    render(<SendFreightPage />);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Tra cứu vận đơn' })[0],
    );
    fireEvent.change(screen.getByPlaceholderText('VD: FUTA-VD-09102026...'), {
      target: { value: 'VG-VD-PUBLIC-1' },
    });
    fireEvent.change(screen.getByPlaceholderText('09xxxxxxxx'), {
      target: { value: '0901234567' },
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Tra cứu vận đơn' })[1],
    );

    expect(await screen.findByText('VG-VD-PUBLIC-1')).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) =>
          element?.className === 'font-bold text-slate-900' &&
          element.textContent === 'Nhà xe công khai • Đà Lạt → TP.HCM',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Địa chỉ gửi công khai')).toBeTruthy();
    expect(screen.getByText('Địa chỉ nhận công khai')).toBeTruthy();
    expect(screen.getByText('3 kiện')).toBeTruthy();
    expect(screen.getByText('Tiếp nhận hàng tại quầy bến xe')).toBeTruthy();
    expect(screen.queryByText(/Người gửi:/)).toBeNull();
    expect(screen.queryByText(/Người nhận:/)).toBeNull();
    expect(screen.queryByText(/Tổng cước phí:/)).toBeNull();
    expect(screen.queryByText(/Kiện hàng đã gửi:/)).toBeNull();
    expect(api.lookupShipment).toHaveBeenCalledWith({
      waybillCode: 'VG-VD-PUBLIC-1',
      phoneNumber: '0901234567',
    });
  });

  it('displays a popup modal when creating shipment with incomplete form', async () => {
    render(<SendFreightPage />);
    expect(
      (await screen.findAllByText('Nhà xe kiểm thử', { exact: true })).length,
    ).toBeGreaterThan(0);

    // Click "Tạo mã vận đơn" without filling sender/receiver/cargo details
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã vận đơn' }));

    // Popup modal should appear
    const modalHeading = await screen.findByText('Thông tin chưa hoàn tất');
    expect(modalHeading).toBeTruthy();
    const modal = modalHeading.closest('.fixed') as HTMLElement;
    expect(modal).toBeTruthy();

    const modalScope = within(modal);
    expect(
      modalScope.getByText(
        'Vui lòng điền đầy đủ các thông tin bắt buộc trước khi tạo mã vận đơn.',
      ),
    ).toBeTruthy();

    // Clicking "Đóng" dismisses the modal
    fireEvent.click(modalScope.getByRole('button', { name: 'Đóng' }));
    await waitFor(() => {
      expect(screen.queryByText('Thông tin chưa hoàn tất')).toBeNull();
    });

    // Inline field-level errors are displayed directly at input fields
    expect(screen.getByText('Vui lòng nhập họ và tên người gửi')).toBeTruthy();
    expect(
      screen.getByText('Vui lòng nhập số điện thoại người gửi'),
    ).toBeTruthy();
    expect(screen.getByText('Vui lòng nhập họ và tên người nhận')).toBeTruthy();
    expect(
      screen.getByText('Vui lòng nhập số điện thoại người nhận'),
    ).toBeTruthy();
    expect(
      screen.getByText('Vui lòng nhập tên món hàng / kiện hàng'),
    ).toBeTruthy();

    // When typing into an invalid field, its error is cleared
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), {
      target: { value: 'Nguyễn Văn A' },
    });
    expect(screen.queryByText('Vui lòng nhập họ và tên người gửi')).toBeNull();
  });

  it('supports adding multiple cargo items and submits all items in the payload', async () => {
    render(<SendFreightPage />);
    expect(
      (await screen.findAllByText('Nhà xe kiểm thử', { exact: true })).length,
    ).toBeGreaterThan(0);

    // Fill sender and receiver details
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

    // Fill Item 1
    fireEvent.change(
      screen.getByPlaceholderText('Ví dụ: Thùng hoa quả, tài liệu, quần áo...'),
      { target: { value: 'Thùng trái cây' } },
    );
    fireEvent.change(
      await screen.findByRole('combobox', { name: 'Loại hàng hóa' }),
      { target: { value: '21' } },
    );

    // Click "+ Thêm kiện hàng"
    fireEvent.click(screen.getByRole('button', { name: 'Thêm kiện hàng' }));

    // Now Kiện #1 and Kiện #2 exist
    expect(screen.getByText('Kiện #1')).toBeTruthy();
    expect(screen.getByText('Kiện #2')).toBeTruthy();

    // Select protection service for Item 1 (fragile)
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Dịch vụ bảo quản' }),
      {
        target: { value: 'fragile' },
      },
    );

    // Fill Item 2
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Kiện hàng số 2...'), {
      target: { value: 'Thùng quần áo' },
    });
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Loại hàng hóa kiện #2' }),
      { target: { value: '21' } },
    );
    // Select protection service for Item 2 (valuable)
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Dịch vụ bảo quản kiện #2' }),
      { target: { value: 'valuable' } },
    );

    // Sidebar reflects both surcharges
    await waitFor(() =>
      expect(api.getQuote).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFragile: true, isValuable: true }),
      ),
    );
    expect(screen.queryByText('+20.000đ')).toBeNull();
    expect(screen.queryByText('+50.000đ')).toBeNull();

    // Click "Tạo mã vận đơn"
    await waitFor(() =>
      expect(api.getRoutePointsByRoute).toHaveBeenCalledWith(42),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã vận đơn' }));

    await waitFor(() => expect(api.createShipment).toHaveBeenCalledTimes(1));
    const payload = api.createShipment.mock.calls[0][0];
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0].name).toBe('Thùng trái cây');
    expect(payload.items[0].serviceType).toBe('FRAGILE');
    expect(payload.items[1].name).toBe('Thùng quần áo');
    expect(payload.items[1].serviceType).toBe('VALUABLE');
    expect(payload.isFragile).toBe(true);
    expect(payload.isValuable).toBe(true);
  });

  it('supports entering receiver CCCD and displays carrier delivery estimates without Linh hoạt trong ngày', async () => {
    render(<SendFreightPage />);
    expect(
      (await screen.findAllByText('Nhà xe kiểm thử', { exact: true })).length,
    ).toBeGreaterThan(0);

    // Verify 'Linh hoạt trong ngày' is removed and replaced by delivery estimate
    expect(screen.queryByText('Linh hoạt trong ngày')).toBeNull();
    expect(
      screen.getAllByText('Nhà xe điều phối sau khi tiếp nhận').length,
    ).toBeGreaterThan(0);

    // Verify helper calculation for long and short duration routes
    expect(
      getCarrierDeliveryEstimate({ route: { durationMinutes: 1080 } }),
    ).toBe('Nhà xe điều phối sau khi tiếp nhận');
    expect(
      getCarrierDeliveryEstimate({ route: { durationMinutes: 420 } }),
    ).toBe('Nhà xe điều phối sau khi tiếp nhận');
    expect(getCarrierDeliveryEstimate(null)).toBe(
      'Nhà xe điều phối sau khi tiếp nhận',
    );

    // Fill sender and receiver details including CCCD
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
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 079xxxxxxxxxx'), {
      target: { value: '079123456789' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Ví dụ: Thùng hoa quả, tài liệu, quần áo...'),
      { target: { value: 'Hồ sơ pháp lý' } },
    );
    fireEvent.change(
      await screen.findByRole('combobox', { name: 'Loại hàng hóa' }),
      { target: { value: '21' } },
    );

    // Sidebar reflects receiver CCCD
    expect(screen.getByText('079123456789')).toBeTruthy();

    await waitFor(() =>
      expect(api.getRoutePointsByRoute).toHaveBeenCalledWith(42),
    );
    fireEvent.click(screen.getByLabelText(/Thanh toán trực tuyến/i));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã vận đơn' }));

    await waitFor(() => expect(api.createShipment).toHaveBeenCalledTimes(1));
    const payload = api.createShipment.mock.calls[0][0];
    expect(payload.receiver.cccd).toBe('079123456789');

    const savedDraft = JSON.parse(
      window.sessionStorage.getItem(window.sessionStorage.key(0)!)!,
    );
    expect(savedDraft.receiver.cccd).toBe('079123456789');
  });

  it('creates a counter shipment and displays the waybill QR success modal when sender pays at counter', async () => {
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
      { target: { value: 'Hồ sơ' } },
    );
    fireEvent.change(
      await screen.findByRole('combobox', { name: 'Loại hàng hóa' }),
      { target: { value: '21' } },
    );

    // Default payment option is SENDER_COUNTER
    await waitFor(() =>
      expect(api.getRoutePointsByRoute).toHaveBeenCalledWith(42),
    );
    await waitFor(() =>
      expect(screen.getAllByText('50.000đ').length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã vận đơn' }));

    await waitFor(() => expect(api.createShipment).toHaveBeenCalledTimes(1));
    expect(api.createShipment.mock.calls[0][0].freightPayer).toBe('NGUOI_GUI');
    expect(api.createShipment.mock.calls[0][0].paymentMethod).toBe('TAI_BEN');
    expect(api.routerPush).not.toHaveBeenCalled();

    // Success modal appears with waybill code
    expect(
      await screen.findByText('Tạo đơn gửi hàng thành công!'),
    ).toBeTruthy();
    expect(screen.getByText('VG-VD-TEST-601')).toBeTruthy();
    expect(
      screen.getAllByText('Người gửi thanh toán').length,
    ).toBeGreaterThanOrEqual(1);
  });
});
