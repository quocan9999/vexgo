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

vi.mock('@/features/booking/components/luggage/luggage-step', () => ({
  LuggageStep: () => null,
}));

vi.mock('@/features/booking/components/luggage/luggage-summary', () => ({
  LuggageSummary: () => null,
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

type RecordedRequest = { url: string; init?: RequestInit };

const requests: RecordedRequest[] = [];
const fetchMock = vi.fn();
let holdResponse: () => Promise<unknown>;
let bookingResponse: () => Promise<unknown>;
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

beforeEach(() => {
  requests.length = 0;
  state.routerPush.mockReset();
  state.routerBack.mockReset();
  state.auth.isAuthenticated = false;
  holdResponse = async () => holdOk();
  bookingResponse = async () => bookingOk();
  tripSeatResponse = async () => seatList();
  releaseResponse = async () => response({ data: { success: true } });

  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    const pathname = new URL(url).pathname;
    const method = init?.method || 'GET';

    if (/\/trips\/(42|43)\/cargo-capacity$/.test(pathname)) {
      return response({ data: { acceptsShipments: false, capacities: {} } });
    }
    if (pathname.endsWith('/seat-holds') && method === 'POST') {
      return holdResponse();
    }
    if (pathname.endsWith('/seat-holds') && method === 'DELETE') {
      return releaseResponse();
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
});
