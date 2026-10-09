// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingManagement } from '@/features/booking-management/components/booking-management';
import { BookingManagementDetail } from '@/features/booking-management/components/booking-management-detail';
import { statusLabel } from '@/features/booking-management/services/booking-management-format';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

const navigation = vi.hoisted(() => {
  let query = '';
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return query;
    },
    navigate(url: string) {
      query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
      listeners.forEach((listener) => listener());
    },
    reset(value = '') {
      query = value;
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock('next/navigation', async () => {
  const React = await import('react');
  return {
    useSearchParams: () => {
      const query = React.useSyncExternalStore(
        navigation.subscribe,
        navigation.getSnapshot,
        navigation.getSnapshot,
      );
      return new URLSearchParams(query);
    },
    useRouter: () => ({
      push: (url: string) => navigation.navigate(url),
      replace: (url: string) => navigation.navigate(url),
      refresh: vi.fn(),
    }),
  };
});

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const trip = {
  tripId: 71,
  tripCode: 'CX-71',
  origin: 'TP. Hồ Chí Minh',
  destination: 'Đà Lạt',
  departureAt: '2026-10-10T15:30:00.000Z',
};

const booking = {
  bookingId: 12,
  bookingCode: 'PD-0012',
  bookedAt: '2026-10-08T03:00:00.000Z',
  customer: { name: 'Nguyễn An', phoneNumber: '0900000012' },
  trip,
  tripIntegrity: 'CONSISTENT',
  initialTicketCount: 3,
  ticketCount: 3,
  cancelledTicketCount: 1,
  activeTicketCount: 2,
  initialTicketAmount: '750000',
  status: 'DA_THANH_TOAN',
  isPartiallyCancelled: true,
};

const ticket = {
  ticketId: 44,
  ticketCode: 'VE-0044',
  bookingId: booking.bookingId,
  bookingCode: booking.bookingCode,
  customer: booking.customer,
  trip,
  tripIntegrity: 'CONSISTENT',
  seatNumber: 'A01',
  actualPrice: '250000',
  status: 'DA_DAT',
  bookedAt: booking.bookedAt,
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function installApi(
  options: {
    historyFailsOnce?: boolean;
    historyForbidden?: boolean;
    deferSlowSearch?: boolean;
    emptyOutOfRange?: boolean;
  } = {},
) {
  setEmployeeAdminTestSession(['booking:read']);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:4001');
  const urls: URL[] = [];
  let historyFailed = false;
  let resolveSlowRequest: ((value: Response) => void) | undefined;
  const slowResponse = options.deferSlowSearch
    ? new Promise<Response>((resolve) => {
        resolveSlowRequest = resolve;
      })
    : null;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    urls.push(url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 10);
    if (url.pathname === '/api/v1/admin/bookings') {
      const search = url.searchParams.get('search');
      if (search === 'slow' && slowResponse) return slowResponse;
      if (search === 'fast') {
        return response({
          data: [{ ...booking, bookingCode: 'PD-FAST' }],
          meta: { page, pageSize, totalItems: 1, totalPages: 1 },
        });
      }
      if (options.emptyOutOfRange && page === 3) {
        return response({
          data: [],
          meta: { page, pageSize, totalItems: 21, totalPages: 3 },
        });
      }
      return response({
        data: [booking],
        meta: { page, pageSize, totalItems: 21, totalPages: 3 },
      });
    }
    if (url.pathname === '/api/v1/admin/tickets') {
      return response({
        data: [ticket],
        meta: { page, pageSize, totalItems: 11, totalPages: 2 },
      });
    }
    if (url.pathname === '/api/v1/admin/bookings/12') {
      return response({
        data: {
          ...booking,
          transactionStatus: 'DA_THANH_TOAN',
          transactionTotalAmount: '1050000',
          paymentSummary: {
            originalPayments: [
              {
                paymentId: 80,
                amountVnd: '1000000',
                method: 'CHUYEN_KHOAN',
                status: 'THANH_CONG',
                occurredAt: booking.bookedAt,
                ticketId: null,
                allocation: 'UNALLOCATED',
              },
            ],
            refunds: {
              pending: [
                {
                  paymentId: 81,
                  amountVnd: '250000',
                  method: 'CHUYEN_KHOAN',
                  status: 'DANG_XU_LY',
                  occurredAt: booking.bookedAt,
                  ticketId: 44,
                  allocation: 'TICKET',
                },
              ],
              succeeded: [
                {
                  paymentId: 82,
                  amountVnd: '100000',
                  method: 'CHUYEN_KHOAN',
                  status: 'THANH_CONG',
                  occurredAt: booking.bookedAt,
                  ticketId: 45,
                  allocation: 'TICKET',
                },
              ],
              other: [],
            },
          },
          shipment: {
            shipmentId: 99,
            trackingCode: 'GH-99',
            status: 'DANG_XU_LY',
            tripId: 71,
            tripIntegrity: 'CONSISTENT',
            items: [
              { name: 'Thùng hàng', quantity: 1, itemType: 'Hàng thường' },
            ],
          },
          tickets: [
            {
              ticketId: 44,
              ticketCode: 'VE-0044',
              seatNumber: 'A01',
              status: 'DA_DAT',
              listedPrice: '250000',
              actualPrice: '250000',
              pickup: null,
            },
          ],
        },
      });
    }
    if (url.pathname === '/api/v1/admin/tickets/44') {
      return response({
        data: {
          ticketId: 44,
          ticketCode: 'VE-0044',
          booking: {
            bookingId: 12,
            bookingCode: 'PD-0012',
            bookedAt: booking.bookedAt,
            status: 'DA_THANH_TOAN',
            initialTicketCount: 3,
            initialTicketAmount: '750000',
            transactionStatus: 'DA_THANH_TOAN',
          },
          customer: booking.customer,
          trip,
          tripIntegrity: 'CONSISTENT',
          seatNumber: 'A01',
          listedPrice: '300000',
          actualPrice: '250000',
          pickup: null,
          status: 'DA_DAT',
          refunds: [
            {
              refundId: 81,
              amountVnd: '250000',
              method: 'CHUYEN_KHOAN',
              status: 'DANG_XU_LY',
              occurredAt: booking.bookedAt,
              ticketId: 44,
            },
          ],
        },
      });
    }
    if (
      /^\/api\/v1\/admin\/(bookings|tickets)\/\d+\/history$/.test(url.pathname)
    ) {
      if (options.historyForbidden) {
        return response(
          { error: 'FORBIDDEN', message: 'permission revoked' },
          403,
        );
      }
      if (options.historyFailsOnce && !historyFailed) {
        historyFailed = true;
        return response(
          { error: 'INTERNAL_SERVER_ERROR', message: 'raw database details' },
          500,
        );
      }
      return response({
        data: [
          {
            historyId: 3,
            oldStatus: null,
            newStatus: 'DA_THANH_TOAN',
            occurredAt: booking.bookedAt,
            source: 'SYSTEM',
            reason: null,
            isOverride: false,
            operationId: 'secret-operation-id',
            actorName: 'Do not show system actor',
          },
        ],
        meta: { page, pageSize, totalItems: 1, totalPages: 1 },
      });
    }
    throw new Error(`Unexpected API request: ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    urls,
    fetchMock,
    resolveSlowSearch: () =>
      resolveSlowRequest?.(
        response({
          data: [{ ...booking, bookingCode: 'PD-SLOW' }],
          meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
        }),
      ),
  };
}

afterEach(() => {
  cleanup();
  navigation.reset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Admin booking and ticket lists', () => {
  it('loads real API lists and retains independent filters and pagination across tabs', async () => {
    const api = installApi();
    navigation.reset(
      'bSearch=PD-0012&bPage=3&tSearch=VE-0044&tPage=2&tab=tickets',
    );

    render(<BookingManagement />);

    expect((await screen.findAllByText('VE-0044')).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        api.urls.some(
          (url) =>
            url.pathname === '/api/v1/admin/tickets' &&
            url.searchParams.get('search') === 'VE-0044' &&
            url.searchParams.get('page') === '2',
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Phiếu đặt vé' }));
    expect((await screen.findAllByText('PD-0012')).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        api.urls.some(
          (url) =>
            url.pathname === '/api/v1/admin/bookings' &&
            url.searchParams.get('search') === 'PD-0012' &&
            url.searchParams.get('page') === '3',
        ),
      ).toBe(true);
    });

    expect(screen.getByText('Hủy 1/3 vé')).toBeTruthy();
    expect((await screen.findAllByText('750.000 ₫')).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: /phiếu PD-0012/ }).getAttribute('href'),
    ).toContain('/booking-management/bookings/12');
  });

  it('debounces search and sends supported server-side sort and date parameters', async () => {
    const api = installApi();
    render(<BookingManagement />);

    fireEvent.change(
      await screen.findByRole('searchbox', { name: 'Tìm phiếu đặt vé' }),
      {
        target: { value: 'Nguyễn An' },
      },
    );
    await waitFor(() => {
      expect(
        api.urls.some((url) => url.searchParams.get('search') === 'Nguyễn An'),
      ).toBe(true);
    });

    fireEvent.change(screen.getByLabelText('Ngày đặt từ'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByLabelText('Ngày đặt đến'), {
      target: { value: '2026-10-08' },
    });
    fireEvent.click(
      await screen.findByRole('button', { name: /Tiền vé ban đầu/ }),
    );
    await waitFor(() => {
      expect(
        api.urls.some(
          (url) =>
            url.searchParams.get('bookedFrom') === '2026-10-01' &&
            url.searchParams.get('bookedTo') === '2026-10-08' &&
            url.searchParams.get('sortBy') === 'totalTicketAmount' &&
            url.searchParams.get('page') === '1',
        ),
      ).toBe(true);
    });
  });

  it('keeps recovery pagination visible when the requested page has no rows', async () => {
    const api = installApi({ emptyOutOfRange: true });
    navigation.reset('bPage=3');
    render(<BookingManagement />);

    expect(
      await screen.findByText(/Trang hiện tại không có dữ liệu/),
    ).toBeTruthy();
    const previous = screen.getByRole('button', { name: 'Trang trước' });
    expect(previous.hasAttribute('disabled')).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Trang sau' }).hasAttribute('disabled'),
    ).toBe(true);

    fireEvent.click(previous);
    await waitFor(() => {
      expect(
        api.urls.some(
          (url) =>
            url.pathname === '/api/v1/admin/bookings' &&
            url.searchParams.get('page') === '2',
        ),
      ).toBe(true);
    });
  });

  it('exposes every ticket sort key through accessible controls', async () => {
    const api = installApi();
    navigation.reset('tab=tickets');
    render(<BookingManagement />);

    await screen.findAllByText('VE-0044');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sắp xếp theo' }), {
      target: { value: 'ticketPrice' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Hướng sắp xếp' }), {
      target: { value: 'asc' },
    });

    await waitFor(() => {
      expect(
        api.urls.some(
          (url) =>
            url.pathname === '/api/v1/admin/tickets' &&
            url.searchParams.get('sortBy') === 'ticketPrice' &&
            url.searchParams.get('sortDirection') === 'asc',
        ),
      ).toBe(true);
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Sắp xếp theo' }), {
      target: { value: 'bookedAt' },
    });
    await waitFor(() => {
      expect(
        api.urls.some(
          (url) =>
            url.pathname === '/api/v1/admin/tickets' &&
            url.searchParams.get('sortBy') === 'bookedAt',
        ),
      ).toBe(true);
    });
  });

  it('ignores a slow earlier search response after the active query changes', async () => {
    const api = installApi({ deferSlowSearch: true });
    render(<BookingManagement />);

    const search = await screen.findByRole('searchbox', {
      name: 'Tìm phiếu đặt vé',
    });
    fireEvent.change(search, { target: { value: 'slow' } });
    await waitFor(() => {
      expect(
        api.urls.some((url) => url.searchParams.get('search') === 'slow'),
      ).toBe(true);
    });

    fireEvent.change(search, { target: { value: 'fast' } });
    expect((await screen.findAllByText('PD-FAST')).length).toBeGreaterThan(0);
    api.resolveSlowSearch();
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(screen.queryByText('PD-SLOW')).toBeNull();
    expect((await screen.findAllByText('PD-FAST')).length).toBeGreaterThan(0);
  });

  it('moves to the next tab with keyboard and denies API data on a forbidden response', async () => {
    const api = installApi();
    const { fetchMock } = api;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      api.urls.push(url);
      return response({ error: 'FORBIDDEN', message: 'denied' }, 403);
    });
    render(<BookingManagement />);

    const bookingsTab = screen.getByRole('tab', { name: 'Phiếu đặt vé' });
    fireEvent.keyDown(bookingsTab, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(
        screen.getByRole('tab', { name: 'Vé' }).getAttribute('aria-selected'),
      ).toBe('true');
    });
    expect(
      (await screen.findByRole('alert')).textContent?.toLowerCase(),
    ).toContain('không có quyền');
    expect(screen.queryByText('VE-0044')).toBeNull();
  });

  it('renders booking totals, partial cancellation, independent refunds, shipment and the real booking timeline', async () => {
    installApi();
    navigation.reset('from=%2Fbooking-management%3FbSearch%3DPD-0012');
    render(<BookingManagementDetail kind="bookings" resourceId={12} />);

    expect(await screen.findByText('PD-0012')).toBeTruthy();
    expect(await screen.findByText('Tổng tiền vé ban đầu')).toBeTruthy();
    expect(screen.getByText('1.050.000 ₫')).toBeTruthy();
    expect(screen.getByText('Hủy 1/3 vé')).toBeTruthy();
    expect((await screen.findAllByText('Đang xử lý')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText('Thùng hàng · Hàng thường · SL 1')).toBeTruthy();
    expect(
      await screen.findByText(/Trạng thái được ghi nhận khi khởi tạo lịch sử/),
    ).toBeTruthy();
    expect(screen.queryByText('Do not show system actor')).toBeNull();
    expect(screen.queryByText('secret-operation-id')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /hủy|hoàn tiền|soát vé/i }),
    ).toBeNull();
  });

  it('keeps detail visible when its history request fails and retries history separately', async () => {
    const api = installApi({ historyFailsOnce: true });
    render(<BookingManagementDetail kind="bookings" resourceId={12} />);

    expect(await screen.findByText('PD-0012')).toBeTruthy();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('1.050.000 ₫')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại lịch sử' }));
    expect(
      await screen.findByText(/Trạng thái được ghi nhận khi khởi tạo lịch sử/),
    ).toBeTruthy();
    expect(
      api.urls.filter((url) => url.pathname.endsWith('/history')),
    ).toHaveLength(2);
  });

  it('hides loaded detail data when history authorization is revoked', async () => {
    installApi({ historyForbidden: true });
    render(<BookingManagementDetail kind="bookings" resourceId={12} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('không có quyền');
    expect(screen.queryByText('Nguyễn An')).toBeNull();
    expect(screen.queryByText('1.050.000 ₫')).toBeNull();
  });

  it('loads the ticket detail and ticket history independently from its booking', async () => {
    installApi();
    navigation.reset('from=%2Fbooking-management%3Ftab%3Dtickets%26tPage%3D2');
    render(<BookingManagementDetail kind="tickets" resourceId={44} />);

    expect(await screen.findByText('VE-0044')).toBeTruthy();
    expect(screen.getByText('A01')).toBeTruthy();
    expect((await screen.findAllByText('250.000 ₫')).length).toBeGreaterThan(0);
    expect(
      await screen.findByText(/Trạng thái được ghi nhận khi khởi tạo lịch sử/),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'PD-0012' }).getAttribute('href'),
    ).toContain('/booking-management/bookings/12');
    expect(
      screen.queryByRole('button', { name: /hủy|hoàn tiền|soát vé/i }),
    ).toBeNull();
  });

  it('formats shipment statuses MOI_TAO and DA_TIEP_NHAN with correct Vietnamese labels', () => {
    expect(statusLabel('MOI_TAO')).toBe('Mới tạo');
    expect(statusLabel('DA_TIEP_NHAN')).toBe('Đã tiếp nhận');
  });

  it('preserves the user-chosen date edge instead of clearing both when date range is invalid', async () => {
    installApi();
    render(<BookingManagement />);

    const fromInput = screen.getByLabelText('Ngày đặt từ') as HTMLInputElement;
    const toInput = screen.getByLabelText('Ngày đặt đến') as HTMLInputElement;

    fireEvent.change(fromInput, { target: { value: '2026-10-05' } });
    fireEvent.change(toInput, { target: { value: '2026-10-10' } });
    expect(fromInput.value).toBe('2026-10-05');
    expect(toInput.value).toBe('2026-10-10');

    // Setting From later than To (2026-10-15 > 2026-10-10): From is kept, only To is cleared
    fireEvent.change(fromInput, { target: { value: '2026-10-15' } });
    expect(fromInput.value).toBe('2026-10-15');
    expect(toInput.value).toBe('');

    // Setting To earlier than From (2026-10-01 < 2026-10-15): To is kept, only From is cleared
    fireEvent.change(toInput, { target: { value: '2026-10-01' } });
    expect(toInput.value).toBe('2026-10-01');
    expect(fromInput.value).toBe('');
  });
});
