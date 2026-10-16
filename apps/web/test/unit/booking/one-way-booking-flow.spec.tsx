import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OneWayBooking } from '../../../src/features/booking/components/one-way-booking';
import { RoundTripBooking } from '../../../src/features/booking/components/round-trip-booking';
import type { Post } from '../../../src/features/posts/types/post';
import type { ApiTripSeat } from '../../../src/features/trips/services/trips.api';

const state = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerBack: vi.fn(),
  auth: {
    user: null,
    isAuthenticated: false,
    isHydrated: true,
    executeWithAuth: async <T,>(action: (token: string) => Promise<T>) =>
      action('test-access-token'),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: state.routerPush, back: state.routerBack }),
}));

vi.mock('@/features/auth/auth-session', () => ({
  useAuthSession: () => state.auth,
}));

const post: Post = {
  id: '42',
  title: 'TP. Hồ Chí Minh - Đà Lạt',
  needType: 'BUY',
  propertyType: 'Ghế ngồi',
  price: '250.000đ',
  area: '',
  location: '',
  province: 'Bến xe Miền Đông',
  district: 'Bến xe Đà Lạt',
  description: '',
  timeAgo: '',
  createdAt: '2026-10-15T08:00:00.000Z',
  authorName: 'VexGo',
  authorCode: 'VG',
  authorPhone: '',
};

const tripSeats: ApiTripSeat[] = [
  { tripSeatId: 9001, seatNumber: 'A01', position: 'Trái', status: 'TRONG' },
];

const cargoCategories = [
  {
    categoryId: 11,
    name: 'Xe máy',
    description: 'Phương tiện xe máy',
    capacityGroup: 'XE_MAY',
  },
  {
    categoryId: 12,
    name: 'Xe đạp',
    description: 'Phương tiện xe đạp',
    capacityGroup: 'HANG_CONG_KENH',
  },
  {
    categoryId: 13,
    name: 'Hàng thường',
    description: 'Hàng hóa thông thường',
    capacityGroup: 'HANG_NHE',
  },
  {
    categoryId: 14,
    name: 'Hàng cồng kềnh',
    description: 'Hàng hóa từ 20kg đến 40kg mỗi kiện',
    capacityGroup: 'HANG_CONG_KENH',
  },
];

type RecordedRequest = { url: string; init?: RequestInit };

const requests: RecordedRequest[] = [];
const fetchMock = vi.fn();
let holdResponse: () => Promise<unknown>;
let bookingResponse: () => Promise<unknown>;
let quoteResponse: () => Promise<unknown>;
let tripSeatResponse: () => Promise<unknown>;
let releaseResponse: () => Promise<unknown>;

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function holdOk() {
  return response({
    data: {
      holdToken: 'signed-hold-token',
      tripId: 42,
      seatIds: [9001],
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    },
  }, 201);
}

function bookingOk() {
  return response({
    data: {
      bookingId: 101,
      tripId: 42,
      seatIds: [9001],
      bookingCode: 'VG-101',
      orderId: 202,
      orderCode: 'OD-202',
      status: 'CHO_THANH_TOAN',
      totalAmount: 250000,
      shippingFee: 0,
    },
  }, 201);
}

function quoteOk() {
  return response({
    data: {
      unitPrice: '250000.00',
      seatCount: 1,
      originalTotal: '250000.00',
      discountAmount: '50000.00',
      finalTotal: '200000.00',
      currency: 'VND',
      appliedPromotionCode: 'SAVE50',
      identityChecked: true,
      phoneEligibilityChecked: true,
      requiresPhoneBeforeBooking: false,
    },
  });
}

function seatList(status = 'TRONG') {
  return response({
    data: [{ ...tripSeats[0], status }],
  });
}

function requestsFor(path: string, method?: string) {
  return requests.filter((request) => {
    const matchesPath = new URL(request.url).pathname.endsWith(path);
    const matchesMethod =
      method === undefined || (request.init?.method || 'GET') === method;
    return matchesPath && matchesMethod;
  });
}

function requestBody(request: RecordedRequest) {
  return JSON.parse(String(request.init?.body));
}

function completeForm() {
  fireEvent.click(screen.getByRole('button', { name: 'A01 còn trống' }));
  fireEvent.change(screen.getByPlaceholderText('Nhập họ và tên'), {
    target: { value: 'Nguyễn Văn An' },
  });
  fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại'), {
    target: { value: '0901234567' },
  });
  fireEvent.change(screen.getByPlaceholderText('Nhập email'), {
    target: { value: 'an@example.test' },
  });
  fireEvent.click(screen.getByRole('checkbox', { hidden: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Thanh toán' }));
}

async function enableExtraLuggage() {
  fireEvent.click(screen.getByText(/Có hàng gửi/));
  await screen.findByLabelText('Loại hành lý');
}

async function selectCargoCategory(
  itemIndex: number,
  type: string,
  categoryId: number,
  weight?: number,
) {
  const typeSelect = screen.getAllByLabelText('Loại hành lý')[itemIndex] as HTMLSelectElement;
  if (typeSelect.value !== type) {
    fireEvent.change(typeSelect, { target: { value: type } });
  }

  if (weight !== undefined) {
    const weightInputs = screen.getAllByLabelText('Khối lượng ước tính (kg)');
    const weightInput = weightInputs[Math.min(itemIndex, weightInputs.length - 1)];
    fireEvent.change(weightInput, { target: { value: String(weight) } });
  }

  const categorySelect = screen.getAllByLabelText('Danh mục hàng hóa')[itemIndex] as HTMLSelectElement;
  await waitFor(() => {
    expect(
      Array.from(categorySelect.options).some(
        (option) => option.value === String(categoryId),
      ),
    ).toBe(true);
  });
  fireEvent.change(categorySelect, { target: { value: String(categoryId) } });
}

function setCargoQuantity(itemIndex: number, quantity: number) {
  const quantityInputs = screen.getAllByLabelText('Số lượng');
  fireEvent.change(quantityInputs[itemIndex], {
    target: { value: String(quantity) },
  });
}

beforeEach(() => {
  requests.length = 0;
  state.routerPush.mockReset();
  state.routerBack.mockReset();
  Object.assign(state.auth, { user: null });
  state.auth.isAuthenticated = false;
  holdResponse = async () => holdOk();
  bookingResponse = async () => bookingOk();
  quoteResponse = async () => quoteOk();
  tripSeatResponse = async () => seatList();
  releaseResponse = async () => response({ data: { success: true } });

  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    const pathname = new URL(url).pathname;
    const method = init?.method || 'GET';

    if (pathname.endsWith('/me')) {
      return response({
        data: {
          accountId: 1,
          customerId: 10,
          customerCode: 'KH-10',
          loyaltyPoints: 0,
          fullName: 'Nguyễn Văn An',
          phoneNumber: '0901234567',
          dateOfBirth: null,
          citizenId: null,
          email: 'an@example.test',
          phoneVerified: true,
          status: 'HOAT_DONG',
          createdAt: '2026-10-15T08:00:00.000Z',
        },
      });
    }
    if (/\/trips\/(42|43)\/cargo-capacity$/.test(pathname)) {
      return response({
        data: {
          acceptsShipments: true,
          capacities: {
            motorcycles: { total: 4, used: 0, remaining: 4 },
            bulkyGoods: { total: 8, used: 0, remaining: 8 },
            parcels: { total: 12, used: 0, remaining: 12 },
          },
        },
      });
    }
    if (pathname.endsWith('/shipments/categories')) {
      return response({ data: cargoCategories });
    }
    if (/\/shipments\/trips\/(42|43)\/route-points$/.test(pathname)) {
      return response({
        data: {
          tripId: 42,
          senderPoints: [{ id: 901, name: 'Điểm gửi', address: 'Địa chỉ gửi' }],
          receiverPoints: [{ id: 902, name: 'Điểm nhận', address: 'Địa chỉ nhận' }],
        },
      });
    }
    if (pathname.endsWith('/seat-holds') && method === 'POST') {
      return holdResponse();
    }
    if (pathname.endsWith('/seat-holds') && method === 'DELETE') {
      return releaseResponse();
    }
    if (pathname.endsWith('/bookings/quote') && method === 'POST') {
      return quoteResponse();
    }
    if (pathname.endsWith('/bookings') && method === 'POST') {
      return bookingResponse();
    }
    if (/\/trips\/(42|43)\/seats$/.test(pathname)) {
      return tripSeatResponse();
    }
    throw new Error(`Unexpected request: ${method} ${pathname}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe('one-way booking with server seat holds', () => {
  it('quotes a guest coupon with the supplied phone and carries it into booking', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    fireEvent.click(screen.getByRole('button', { name: 'A01 còn trống' }));
    fireEvent.change(screen.getByPlaceholderText('Nhập họ và tên'), {
      target: { value: 'Nguyễn Văn An' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại'), {
      target: { value: '0901234567' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập email'), {
      target: { value: 'an@example.test' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nhập một mã cho đơn đặt vé' }), {
      target: { value: 'save50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await screen.findByText('Mã SAVE50 đã được áp dụng.');
    expect(requestBody(requestsFor('/bookings/quote', 'POST')[0])).toEqual({
      tripId: 42,
      seatIds: [9001],
      promotionCode: 'SAVE50',
      contactPhone: '0901234567',
    });
    expect(screen.getByText('Giá vé gốc').parentElement?.textContent).toContain('250.000đ');
    expect(screen.getByText('Giảm giá').parentElement?.textContent).toContain('50.000đ');
    expect(screen.getByText('Tổng tiền vé sau ưu đãi').parentElement?.textContent).toContain('200.000đ');

    fireEvent.click(screen.getByRole('checkbox', { hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán' }));
    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));
    expect(requestBody(requestsFor('/bookings', 'POST')[0]).promotionCode).toBe('SAVE50');
    await waitFor(() => expect(state.routerPush).toHaveBeenCalledTimes(1));
  });

  it('rechecks an applied guest coupon when the phone changes', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    fireEvent.click(screen.getByRole('button', { name: 'A01 còn trống' }));
    fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại'), {
      target: { value: '0901234567' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nhập một mã cho đơn đặt vé' }), {
      target: { value: 'SAVE50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    await screen.findByText('Mã SAVE50 đã được áp dụng.');

    fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại'), {
      target: { value: '0912345678' },
    });

    await waitFor(() => expect(requestsFor('/bookings/quote', 'POST')).toHaveLength(2));
    expect(requestBody(requestsFor('/bookings/quote', 'POST')[1]).contactPhone).toBe('0912345678');
  });

  it('uses the verified account identity and omits an editable contact phone from its quote', async () => {
    state.auth.isAuthenticated = true;
    Object.assign(state.auth, {
      user: {
        accountId: 1,
        customerId: 10,
        fullName: 'Nguyễn Văn An',
        phoneNumber: '0901234567',
        roles: ['KHACH_HANG'],
      },
    });
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    fireEvent.click(screen.getByRole('button', { name: 'A01 còn trống' }));
    const verifiedPhone = await screen.findByText('0901234567');
    expect(verifiedPhone.closest('p')?.textContent).toContain(
      'SĐT tài khoản đã xác minh:',
    );
    const profileRequest = requestsFor('/me')[0];
    expect(new Headers(profileRequest.init?.headers).get('authorization')).toBe(
      'Bearer test-access-token',
    );
    fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại'), {
      target: { value: '0987654321' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nhập một mã cho đơn đặt vé' }), {
      target: { value: 'SAVE50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await screen.findByText('Mã SAVE50 đã được áp dụng.');
    const quoteRequest = requestsFor('/bookings/quote', 'POST')[0];
    expect(requestBody(quoteRequest)).toEqual({
      tripId: 42,
      seatIds: [9001],
      promotionCode: 'SAVE50',
    });
    expect(new Headers(quoteRequest.init?.headers).get('authorization')).toBe(
      'Bearer test-access-token',
    );
  });

  it('keeps the booking form and coupon when create rejects a newly unavailable promotion', async () => {
    bookingResponse = async () => response({
      statusCode: 409,
      error: 'PROMOTION_EXHAUSTED',
      message: 'Mã khuyến mãi vừa hết lượt sử dụng.',
    }, 409);
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    fireEvent.click(screen.getByRole('button', { name: 'A01 còn trống' }));
    fireEvent.change(screen.getByPlaceholderText('Nhập họ và tên'), {
      target: { value: 'Nguyễn Văn An' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại'), {
      target: { value: '0901234567' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập email'), {
      target: { value: 'an@example.test' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nhập một mã cho đơn đặt vé' }), {
      target: { value: 'SAVE50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    await screen.findByText('Mã SAVE50 đã được áp dụng.');
    fireEvent.click(screen.getByRole('checkbox', { hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán' }));

    expect(await screen.findByText('Mã khuyến mãi vừa hết lượt sử dụng.')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Nhập một mã cho đơn đặt vé' }) as HTMLInputElement).value).toBe('SAVE50');
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(1);
  });

  it('creates a hold with trip-seat IDs before booking and routes with persisted IDs and amount', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);

    completeForm();

    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));

    const holdRequest = requestsFor('/seat-holds', 'POST')[0];
    expect(holdRequest).toBeDefined();
    expect(requestBody(holdRequest)).toEqual({ tripId: 42, seatIds: [9001] });
    expect(
      new Headers(holdRequest.init?.headers).get('authorization'),
    ).toBeNull();
    expect(requests.indexOf(holdRequest)).toBeLessThan(
      requests.indexOf(requestsFor('/bookings', 'POST')[0]),
    );

    const bookingRequest = requestsFor('/bookings', 'POST')[0];
    expect(
      new Headers(bookingRequest.init?.headers).get('authorization'),
    ).toBeNull();
    expect(requestBody(bookingRequest)).toMatchObject({
      tripId: 42,
      seatIds: [9001],
      holdToken: 'signed-hold-token',
      contact: {
        fullName: 'Nguyễn Văn An',
        phone: '0901234567',
        email: 'an@example.test',
      },
      pickupPoint: 'Bến xe Miền Đông',
      dropoffPoint: 'Bến xe Đà Lạt',
    });
    expect(requestBody(bookingRequest)).not.toHaveProperty('seatNumbers');
    expect(requestBody(bookingRequest)).not.toHaveProperty('passenger');

    await waitFor(() => expect(state.routerPush).toHaveBeenCalledTimes(1));
    expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(0);
    const paymentUrl = new URL(state.routerPush.mock.calls[0][0], 'http://localhost');
    const draftId = paymentUrl.searchParams.get('draftId');
    const draft = JSON.parse(
      window.sessionStorage.getItem(`vexgo:payment-draft:${draftId}`) || 'null',
    );
    expect(draft).toMatchObject({
      bookingId: 101,
      orderId: 202,
      bookingCode: 'VG-101',
      orderCode: 'OD-202',
      totalFare: 250000,
    });
  });

  it('sends the selected cargo type and route points so the backend can price and persist luggage', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    await selectCargoCategory(0, 'Vali', 13, 10);
    await waitFor(() => {
      expect(
        (screen.getByLabelText('Điểm gửi hàng') as HTMLSelectElement).value,
      ).toBe('901');
      expect(
        (screen.getByLabelText('Điểm nhận hàng') as HTMLSelectElement).value,
      ).toBe('902');
    });
    expect(
      screen.getByRole('heading', { name: 'Bạn có hàng hóa cần gửi dưới hầm xe không?' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Hành lý xách tay tiêu chuẩn không thuộc dịch vụ hàng gửi dưới hầm xe.'),
    ).toBeTruthy();
    const cargoSummary = screen.getByText('Hàng gửi hầm xe (10kg)').parentElement;
    expect(cargoSummary?.textContent).toContain('Tính khi đặt vé');
    expect(cargoSummary?.textContent).not.toMatch(/0đ|miễn phí/i);
    expect(screen.getByText(/Cước vận chuyển hàng hóa được tính theo loại hàng/)).toBeTruthy();
    expect(screen.getAllByText('Tạm tính tiền vé').length).toBeGreaterThan(0);
    completeForm();

    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));

    expect(requestBody(requestsFor('/bookings', 'POST')[0]).cargoItems).toEqual([
      expect.objectContaining({
        name: 'Vali',
        type: 'Vali',
        loaiHangHoaId: 13,
        quantity: 1,
        weight: 10,
      }),
    ]);
    expect(requestBody(requestsFor('/bookings', 'POST')[0])).toMatchObject({
      senderPointId: 901,
      receiverPointId: 902,
    });
  });

  it('submits quantity two at 25kg each while retaining 50kg as the displayed total', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    await selectCargoCategory(0, 'Vali', 14, 25);
    setCargoQuantity(0, 2);
    await screen.findByLabelText('Điểm gửi hàng');

    expect(screen.getByText('2 kiện • 50kg')).toBeTruthy();
    expect(screen.queryByText(/mỗi kiện tối đa 40kg/i)).toBeNull();
    completeForm();

    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));
    expect(requestBody(requestsFor('/bookings', 'POST')[0]).cargoItems).toEqual([
      expect.objectContaining({
        type: 'Vali',
        quantity: 2,
        weight: 25,
        loaiHangHoaId: 14,
      }),
    ]);
  });

  it('submits separate 25kg rows without treating their 50kg sum as one package', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    await selectCargoCategory(0, 'Vali', 14, 25);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm kiện hành lý' }));
    await waitFor(() => expect(screen.getAllByLabelText('Loại hành lý')).toHaveLength(2));
    await selectCargoCategory(1, 'Vali', 14, 25);
    await screen.findByLabelText('Điểm gửi hàng');

    expect(screen.getByText('2 kiện • 50kg')).toBeTruthy();
    expect(screen.queryByText(/mỗi kiện tối đa 40kg/i)).toBeNull();
    completeForm();

    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));
    expect(requestBody(requestsFor('/bookings', 'POST')[0]).cargoItems).toEqual([
      expect.objectContaining({ type: 'Vali', quantity: 1, weight: 25, loaiHangHoaId: 14 }),
      expect.objectContaining({ type: 'Vali', quantity: 1, weight: 25, loaiHangHoaId: 14 }),
    ]);
  });

  it('submits a 100kg motorcycle without applying the regular-luggage limit and preserves its cargo payload', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    await selectCargoCategory(0, 'Xe máy', 11);
    await screen.findByLabelText('Điểm gửi hàng');

    completeForm();

    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));
    expect(requestBody(requestsFor('/bookings', 'POST')[0])).toMatchObject({
      senderPointId: 901,
      receiverPointId: 902,
      cargoItems: [
        expect.objectContaining({
          type: 'Xe máy',
          name: 'Xe máy (Xe số)',
          quantity: 1,
          weight: 100,
          loaiHangHoaId: 11,
          motorbikeModel: 'Xe số',
        }),
      ],
    });
    await waitFor(() => expect(state.routerPush).toHaveBeenCalledTimes(1));
  });

  it('submits a 15kg bicycle with its matching cargo category', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    await selectCargoCategory(0, 'Xe đạp', 12);
    await screen.findByLabelText('Điểm gửi hàng');

    completeForm();

    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));
    expect(requestBody(requestsFor('/bookings', 'POST')[0]).cargoItems).toEqual([
      expect.objectContaining({
        type: 'Xe đạp',
        name: 'Xe đạp (Xe đạp thường)',
        quantity: 1,
        weight: 15,
        loaiHangHoaId: 12,
        bicycleType: 'Xe đạp thường',
      }),
    ]);
    await waitFor(() => expect(state.routerPush).toHaveBeenCalledTimes(1));
  });

  it('submits a 100kg motorcycle and two 25kg packages without treating cargo totals as per-package limits', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    await selectCargoCategory(0, 'Xe máy', 11);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm kiện hành lý' }));
    await waitFor(() => expect(screen.getAllByLabelText('Loại hành lý')).toHaveLength(2));
    await selectCargoCategory(1, 'Vali', 14, 25);
    setCargoQuantity(1, 2);
    await screen.findByLabelText('Điểm gửi hàng');

    completeForm();

    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));
    expect(requestBody(requestsFor('/bookings', 'POST')[0]).cargoItems).toEqual([
      expect.objectContaining({ type: 'Xe máy', weight: 100, loaiHangHoaId: 11 }),
      expect.objectContaining({ type: 'Vali', quantity: 2, weight: 25, loaiHangHoaId: 14 }),
    ]);
    await waitFor(() => expect(state.routerPush).toHaveBeenCalledTimes(1));
  });

  it('keeps the regular-luggage limit when one regular item exceeds 40kg', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    fireEvent.change(screen.getByLabelText('Khối lượng ước tính (kg)'), {
      target: { value: '41' },
    });

    completeForm();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('mỗi kiện tối đa 40kg'),
    );
    const overweightNotice = screen.getByText(/Vé xe nhận hàng thường tối đa 40kg mỗi kiện/);
    expect(overweightNotice.textContent).toContain('Cước hàng');
    expect(overweightNotice.textContent).not.toMatch(/miễn phí|30\.000đ/i);
    expect(screen.getByText(/Có kiện hành lý thường vượt quá 40kg/)).toBeTruthy();
    expect(requestsFor('/seat-holds', 'POST')).toHaveLength(0);
    expect(requestsFor('/bookings', 'POST')).toHaveLength(0);
    expect(state.routerPush).not.toHaveBeenCalled();
  });

  it('blocks a package whose effective volumetric weight exceeds 40kg', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    fireEvent.change(screen.getByPlaceholderText('Dài (tối đa 150)'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByPlaceholderText('Rộng (tối đa 80)'), {
      target: { value: '50' },
    });
    fireEvent.change(screen.getByPlaceholderText('Cao (tối đa 80)'), {
      target: { value: '41' },
    });
    await selectCargoCategory(0, 'Vali', 13, 1);
    await screen.findByLabelText('Điểm gửi hàng');

    completeForm();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('mỗi kiện tối đa 40kg'),
    );
    expect(requestsFor('/seat-holds', 'POST')).toHaveLength(0);
    expect(requestsFor('/bookings', 'POST')).toHaveLength(0);
    expect(state.routerPush).not.toHaveBeenCalled();
  });

  it('clears an incompatible category when cargo changes between motorcycle, bicycle, and regular luggage', async () => {
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    await selectCargoCategory(0, 'Xe máy', 11);

    const typeSelect = screen.getAllByLabelText('Loại hành lý')[0] as HTMLSelectElement;
    const categorySelect = screen.getAllByLabelText('Danh mục hàng hóa')[0] as HTMLSelectElement;
    expect(categorySelect.value).toBe('11');

    fireEvent.change(typeSelect, { target: { value: 'Xe đạp' } });
    await waitFor(() => expect(categorySelect.value).toBe(''));
    expect(Array.from(categorySelect.options).map((option) => option.value)).toContain('12');
    expect(Array.from(categorySelect.options).map((option) => option.value)).not.toContain('11');
    fireEvent.change(categorySelect, { target: { value: '12' } });

    fireEvent.change(typeSelect, { target: { value: 'Vali' } });
    await waitFor(() => expect(categorySelect.value).toBe(''));
    expect(Array.from(categorySelect.options).map((option) => option.value)).toContain('13');
    expect(Array.from(categorySelect.options).map((option) => option.value)).not.toContain('12');
    fireEvent.change(screen.getByLabelText('Khối lượng ước tính (kg)'), {
      target: { value: '10' },
    });
    fireEvent.change(categorySelect, { target: { value: '13' } });
    await screen.findByLabelText('Điểm gửi hàng');

    completeForm();

    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));
    expect(requestBody(requestsFor('/bookings', 'POST')[0]).cargoItems).toEqual([
      expect.objectContaining({ type: 'Vali', weight: 10, loaiHangHoaId: 13 }),
    ]);
  });

  it.each([
    ['CARGO_CAPACITY_EXCEEDED', 'Chuyến xe đã hết chỗ chứa xe máy.'],
    ['CARGO_RATE_NOT_FOUND', 'Chưa có mức cước phù hợp cho loại xe máy.'],
  ])('shows backend %s errors without creating a successful booking', async (code, message) => {
    bookingResponse = async () =>
      response({ statusCode: 409, error: code, message }, 409);
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    await selectCargoCategory(0, 'Xe máy', 11);
    await screen.findByLabelText('Điểm gửi hàng');

    completeForm();

    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(message),
    );
    expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(1);
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it.each([
    ['CARGO_CAPACITY_EXCEEDED', 'Chuyến xe đã hết sức chứa hàng cồng kềnh.'],
    ['CARGO_RATE_NOT_FOUND', 'Chưa có mức cước phù hợp cho tổng khối lượng 50kg.'],
  ])('shows regular cargo backend %s without creating a successful booking', async (code, message) => {
    bookingResponse = async () =>
      response({ statusCode: 409, error: code, message }, 409);
    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    await enableExtraLuggage();
    await selectCargoCategory(0, 'Vali', 14, 25);
    setCargoQuantity(0, 2);
    await screen.findByLabelText('Điểm gửi hàng');

    completeForm();

    await waitFor(() => expect(requestsFor('/bookings', 'POST')).toHaveLength(1));
    expect(requestBody(requestsFor('/bookings', 'POST')[0]).cargoItems).toEqual([
      expect.objectContaining({ quantity: 2, weight: 25, loaiHangHoaId: 14 }),
    ]);
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(message),
    );
    expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(1);
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('refreshes seats and does not create a booking when the hold conflicts', async () => {
    holdResponse = async () =>
      response({ error: 'SEAT_UNAVAILABLE', message: 'Ghế vừa được giữ.' }, 409);
    tripSeatResponse = async () => seatList('DANG_GIU');

    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    completeForm();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Ghế vừa được giữ'),
    );
    expect(requestsFor('/trips/42/seats', 'GET')).toHaveLength(1);
    expect(requestsFor('/bookings', 'POST')).toHaveLength(0);
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'A01 đã bán' }).hasAttribute('disabled')).toBe(true);
  });

  it('releases an already expired hold response without creating a booking', async () => {
    holdResponse = async () =>
      response({
        data: {
          holdToken: 'expired-hold-token',
          tripId: 42,
          seatIds: [9001],
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      }, 201);

    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    completeForm();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Không thể xác nhận lượt giữ ghế',
      ),
    );
    expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(1);
    expect(requestsFor('/bookings', 'POST')).toHaveLength(0);
    expect(state.routerPush).not.toHaveBeenCalled();
  });

  it('releases a held seat after a definitive booking rejection and refreshes the map', async () => {
    bookingResponse = async () =>
      response({ error: 'SEAT_UNAVAILABLE', message: 'Ghế không còn hợp lệ.' }, 409);
    tripSeatResponse = async () => seatList('DANG_GIU');

    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    completeForm();

    await waitFor(() => expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(1));
    const releaseRequest = requestsFor('/seat-holds', 'DELETE')[0];
    expect(new Headers(releaseRequest.init?.headers).get('x-hold-token')).toBe(
      'signed-hold-token',
    );
    expect(requestsFor('/trips/42/seats', 'GET')).toHaveLength(1);
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Ghế không còn hợp lệ');
  });

  it('does not permit another hold when a rejected booking hold cannot be released', async () => {
    bookingResponse = async () =>
      response({ error: 'SEAT_UNAVAILABLE', message: 'Ghế không còn hợp lệ.' }, 409);
    releaseResponse = async () =>
      response({ error: 'SERVICE_UNAVAILABLE', message: 'Không thể giải phóng.' }, 503);

    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    completeForm();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'chưa xác nhận được việc giải phóng ghế',
      ),
    );
    expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(1);
    expect(requestsFor('/seat-holds', 'POST')).toHaveLength(1);
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Kết quả chưa xác định' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('keeps a network-uncertain booking locked without releasing or retrying it', async () => {
    bookingResponse = async () => {
      throw new TypeError('Network request failed');
    };

    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    completeForm();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Chưa xác định được kết quả',
      ),
    );
    expect(requestsFor('/bookings', 'POST')).toHaveLength(1);
    expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(0);
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Kết quả chưa xác định' }).hasAttribute('disabled')).toBe(true);
  });

  it('treats a server error after booking submission as an unknown result', async () => {
    bookingResponse = async () =>
      response({ error: 'INTERNAL_SERVER_ERROR', message: 'Máy chủ gặp lỗi.' }, 500);

    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    completeForm();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Chưa xác định được kết quả đặt vé',
      ),
    );
    expect(requestsFor('/bookings', 'POST')).toHaveLength(1);
    expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(0);
    expect(state.routerPush).not.toHaveBeenCalled();
  });

  it('does not retry an uncertain hold creation that may already have reserved seats', async () => {
    holdResponse = async () => {
      throw new TypeError('Network request failed');
    };

    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    completeForm();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Chưa xác định được kết quả giữ ghế',
      ),
    );
    expect(requestsFor('/seat-holds', 'POST')).toHaveLength(1);
    expect(requestsFor('/bookings', 'POST')).toHaveLength(0);
    expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Kết quả chưa xác định' }).hasAttribute('disabled')).toBe(true);
  });

  it('does not navigate or release a hold when a success response lacks persisted booking and order IDs', async () => {
    bookingResponse = async () =>
      response({ data: { bookingId: 101, totalAmount: 250000 } }, 201);

    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    completeForm();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Chưa xác định được kết quả',
      ),
    );
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Kết quả chưa xác định' }).hasAttribute('disabled')).toBe(true);
  });

  it.each([401, 403])(
    'does not retry an authenticated booking as anonymous after HTTP %i',
    async (status) => {
      state.auth.isAuthenticated = true;
      bookingResponse = async () =>
        response(
          { error: 'UNAUTHENTICATED', message: 'Phiên đăng nhập hết hạn.' },
          status,
        );

      render(<OneWayBooking post={post} tripSeats={tripSeats} />);
      completeForm();

      await waitFor(() =>
        expect(requestsFor('/bookings', 'POST')).toHaveLength(1),
      );
      await waitFor(() =>
        expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(1),
      );
      expect(
        new Headers(requestsFor('/seat-holds', 'POST')[0].init?.headers).get(
          'authorization',
        ),
      ).toBe('Bearer test-access-token');
      expect(
        new Headers(requestsFor('/bookings', 'POST')[0].init?.headers).get(
          'authorization',
        ),
      ).toBe('Bearer test-access-token');
      expect(state.routerPush).not.toHaveBeenCalled();
    },
  );

  it('releases a newly created hold if the checkout unmounts before booking starts', async () => {
    let resolveHold: ((value: unknown) => void) | undefined;
    holdResponse = () =>
      new Promise((resolve) => {
        resolveHold = resolve;
      });

    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    completeForm();
    await waitFor(() => expect(requestsFor('/seat-holds', 'POST')).toHaveLength(1));

    cleanup();
    resolveHold?.(holdOk());

    await waitFor(() => expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(1));
    expect(requestsFor('/bookings', 'POST')).toHaveLength(0);
    expect(state.routerPush).not.toHaveBeenCalled();
  });

  it('releases the old trip hold and does not book when the trip changes during hold creation', async () => {
    let resolveHold: ((value: unknown) => void) | undefined;
    holdResponse = () =>
      new Promise((resolve) => {
        resolveHold = resolve;
      });

    const { rerender } = render(
      <OneWayBooking post={post} tripSeats={tripSeats} />,
    );
    completeForm();
    await waitFor(() => expect(requestsFor('/seat-holds', 'POST')).toHaveLength(1));

    rerender(
      <OneWayBooking
        post={{ ...post, id: '43' }}
        tripSeats={tripSeats}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Đang xử lý...' }).hasAttribute('disabled'),
    ).toBe(true);
    resolveHold?.(holdOk());

    await waitFor(() => expect(requestsFor('/seat-holds', 'DELETE')).toHaveLength(1));
    expect(requestsFor('/bookings', 'POST')).toHaveLength(0);
    expect(state.routerPush).not.toHaveBeenCalled();
  });

  it('sends only one hold request when the submit action is triggered twice', async () => {
    let resolveHold: ((value: unknown) => void) | undefined;
    holdResponse = () =>
      new Promise((resolve) => {
        resolveHold = resolve;
      });

    render(<OneWayBooking post={post} tripSeats={tripSeats} />);
    fireEvent.click(screen.getByRole('button', { name: 'A01 còn trống' }));
    fireEvent.change(screen.getByPlaceholderText('Nhập họ và tên'), {
      target: { value: 'Nguyễn Văn An' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại'), {
      target: { value: '0901234567' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập email'), {
      target: { value: 'an@example.test' },
    });
    fireEvent.click(screen.getByRole('checkbox', { hidden: true }));
    const submitButton = screen.getByRole('button', { name: 'Thanh toán' });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(requestsFor('/seat-holds', 'POST')).toHaveLength(1));
    resolveHold?.(holdOk());
  });

  it('blocks the round-trip path instead of generating a booking or payment draft', () => {
    render(
      <RoundTripBooking
        outboundPost={post}
        returnPost={{ ...post, id: '43', title: 'Đà Lạt - TP. Hồ Chí Minh' }}
        departureDate="2026-10-15"
        returnDate="2026-10-18"
        outboundTripSeats={tripSeats}
        returnTripSeats={[{ ...tripSeats[0], tripSeatId: 9002 }]}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain(
      'Đặt vé khứ hồi hiện chưa được hỗ trợ',
    );
    expect(
      screen.getByRole('button', { name: 'Khứ hồi chưa khả dụng' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(requestsFor('/bookings', 'POST')).toHaveLength(0);
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('does not present selected round-trip cargo as free before a backend quote', async () => {
    render(
      <RoundTripBooking
        outboundPost={post}
        returnPost={{ ...post, id: '43', title: 'Đà Lạt - TP. Hồ Chí Minh' }}
        departureDate="2026-10-15"
        returnDate="2026-10-18"
        outboundTripSeats={tripSeats}
        returnTripSeats={[{ ...tripSeats[0], tripSeatId: 9002 }]}
      />,
    );

    fireEvent.click(screen.getAllByText(/Có hàng gửi/)[0]);
    await screen.findAllByLabelText('Loại hành lý');
    fireEvent.click(screen.getByLabelText('Áp dụng giống chuyến đi'));

    const cargoSummary = screen.getByText('Hàng gửi hầm xe (0kg)').parentElement;
    expect(cargoSummary?.textContent).toContain('Chưa tính trong đơn vé khứ hồi');
    expect(cargoSummary?.textContent).not.toMatch(/0đ|miễn phí/i);
    expect(screen.queryByText(/\(\+0đ\)/)).toBeNull();
  });
});


it('opens the verified invoice directly for a completed free booking and keeps guest credentials', async () => {
  bookingResponse = async () => {
    const result = bookingOk();
    const body = await result.json() as { data: { status: string; totalAmount: number } };
    body.data.status = 'DA_THANH_TOAN';
    body.data.totalAmount = 0;
    return response(body, 201);
  };
  render(<OneWayBooking post={post} tripSeats={tripSeats} />);
  completeForm();
  await waitFor(() =>
    expect(state.routerPush).toHaveBeenCalledWith('/invoice/101'),
  );
  expect(state.routerPush).not.toHaveBeenCalledWith(
    expect.stringContaining('/payment'),
  );
  const drafts = Object.keys(sessionStorage)
    .map((key) => sessionStorage.getItem(key))
    .filter(Boolean)
    .map((raw) => JSON.parse(raw!));
  expect(drafts).toContainEqual(
    expect.objectContaining({
      bookingId: 101,
      bookingCode: 'VG-101',
      passenger: expect.objectContaining({ phoneNumber: '0901234567' }),
    }),
  );
});
