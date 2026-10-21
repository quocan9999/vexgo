// @vitest-environment jsdom
import {
  act,
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
  let pathname = '/booking-management';
  let historyEntries = [{ pathname, query }];
  let historyIndex = 0;
  let transitionCount = 0;
  let lastPushedUrl = '';
  const listeners = new Set<() => void>();

  function updateBrowserLocation() {
    const search = query ? `?${query}` : '';
    window.history.replaceState(null, '', `${pathname}${search}`);
  }

  function notify() {
    listeners.forEach((listener) => listener());
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return query;
    },
    navigate(url: string, method: 'push' | 'replace' = 'push') {
      const separator = url.indexOf('?');
      pathname = separator === -1 ? url : url.slice(0, separator);
      query = separator === -1 ? '' : url.slice(separator + 1);
      const location = { pathname, query };
      if (method === 'push') {
        lastPushedUrl = url;
        historyEntries = historyEntries.slice(0, historyIndex + 1);
        historyEntries.push(location);
        historyIndex += 1;
      } else {
        historyEntries[historyIndex] = location;
      }
      transitionCount += 1;
      updateBrowserLocation();
      notify();
    },
    reset(value = '') {
      pathname = '/booking-management';
      query = value;
      historyEntries = [{ pathname, query }];
      historyIndex = 0;
      transitionCount = 0;
      lastPushedUrl = '';
      updateBrowserLocation();
      notify();
    },
    back() {
      if (historyIndex === 0) return;
      historyIndex -= 1;
      ({ pathname, query } = historyEntries[historyIndex]);
      updateBrowserLocation();
      notify();
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    forward() {
      if (historyIndex >= historyEntries.length - 1) return;
      historyIndex += 1;
      ({ pathname, query } = historyEntries[historyIndex]);
      updateBrowserLocation();
      notify();
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    getHistoryLength() {
      return historyEntries.length;
    },
    getTransitionCount() {
      return transitionCount;
    },
    getLastPushedUrl() {
      return lastPushedUrl;
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
      push: (url: string) => navigation.navigate(url, 'push'),
      replace: (url: string) => navigation.navigate(url, 'replace'),
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
    rejectsInvalidPagination?: boolean;
    ticketStatus?: string;
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
    if (
      options.rejectsInvalidPagination &&
      (!Number.isSafeInteger(page) ||
        page < 1 ||
        page > 10_000 ||
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100)
    ) {
      return response(
        {
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ.',
        },
        400,
      );
    }
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
        data: [{ ...ticket, status: options.ticketStatus ?? ticket.status }],
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
              status: options.ticketStatus ?? 'DA_DAT',
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
          status: options.ticketStatus ?? 'DA_DAT',
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
  it.each([
    {
      tab: 'bookings' as const,
      query:
        'bPage=10001&bSearch=PD-0012&bBookedFrom=2026-10-05&bBookedTo=2026-10-10&tPage=4&tSearch=VE-0044',
      pageKey: 'bPage',
      otherPageKey: 'tPage',
      otherPage: '4',
      activeSearchKey: 'bSearch',
      activeSearch: 'PD-0012',
      otherSearchKey: 'tSearch',
      otherSearch: 'VE-0044',
      apiPath: '/api/v1/admin/bookings',
    },
    {
      tab: 'tickets' as const,
      query:
        'tab=tickets&tPage=10001&tSearch=VE-0044&tDepartureFrom=2026-11-01&tDepartureTo=2026-11-05&bPage=3&bSearch=PD-0012',
      pageKey: 'tPage',
      otherPageKey: 'bPage',
      otherPage: '3',
      activeSearchKey: 'tSearch',
      activeSearch: 'VE-0044',
      otherSearchKey: 'bSearch',
      otherSearch: 'PD-0012',
      apiPath: '/api/v1/admin/tickets',
    },
  ])(
    'canonicalizes an over-limit deep-link page for the $tab tab without losing URL filters',
    async (scenario) => {
      navigation.reset(scenario.query);
      const api = installApi({ rejectsInvalidPagination: true });
      render(<BookingManagement />);

      await waitFor(() => {
        const requests = api.urls.filter(
          (url) => url.pathname === scenario.apiPath,
        );
        expect(requests.length).toBeGreaterThan(0);
        expect(
          requests.some(
            (url) =>
              url.searchParams.get('page') === '1' &&
              url.searchParams.get('search') === scenario.activeSearch,
          ),
        ).toBe(true);
      });

      await waitFor(() => {
        const params = new URLSearchParams(navigation.getSnapshot());
        expect(params.has(scenario.pageKey)).toBe(false);
        expect(params.get(scenario.otherPageKey)).toBe(scenario.otherPage);
        expect(params.get(scenario.activeSearchKey)).toBe(
          scenario.activeSearch,
        );
        expect(params.get(scenario.otherSearchKey)).toBe(scenario.otherSearch);
        expect(params.get('tab')).toBe(
          scenario.tab === 'tickets' ? 'tickets' : null,
        );
      });

      const activeRequests = api.urls.filter(
        (url) => url.pathname === scenario.apiPath,
      );
      expect(
        activeRequests.every(
          (url) => Number(url.searchParams.get('page')) <= 10_000,
        ),
      ).toBe(true);
      expect(screen.queryByRole('alert')).toBeNull();

      if (scenario.tab === 'bookings') {
        expect((await screen.findAllByText('PD-0012')).length).toBeGreaterThan(
          0,
        );
        expect(
          screen.getByRole('button', {
            name: 'Ngày đặt: 05/10/2026 đến 10/10/2026',
          }),
        ).toBeTruthy();
      } else {
        expect((await screen.findAllByText('VE-0044')).length).toBeGreaterThan(
          0,
        );
        expect(
          screen.getByRole('button', {
            name: 'Ngày khởi hành: 01/11/2026 đến 05/11/2026',
          }),
        ).toBeTruthy();
      }

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
      expect(navigation.getTransitionCount()).toBe(1);
    },
  );

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
    const detailActions = screen.getAllByRole('button', {
      name: 'Xem chi tiết phiếu PD-0012',
    });
    fireEvent.click(detailActions[0]);
    const detailTarget = new URL(
      navigation.getLastPushedUrl(),
      window.location.origin,
    );
    expect(detailTarget.pathname).toBe('/booking-management/bookings/12');
    expect(detailTarget.searchParams.get('from')).toContain(
      '/booking-management?bSearch=PD-0012&bPage=3',
    );
  });

  it('applies booking and departure ranges through the shared date-range filters', async () => {
    const api = installApi();
    render(<BookingManagement />);
    await screen.findAllByText('PD-0012');

    fireEvent.click(screen.getByRole('button', { name: 'Lọc theo ngày đặt' }));
    fireEvent.change(await screen.findByLabelText('Ngày đặt từ'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(await screen.findByLabelText('Ngày đặt đến'), {
      target: { value: '2026-10-08' },
    });
    expect(navigation.getSnapshot()).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      expect(
        new URLSearchParams(navigation.getSnapshot()).get('bBookedFrom'),
      ).toBe('2026-10-01');
      expect(
        api.urls.some(
          (url) =>
            url.searchParams.get('bookedFrom') === '2026-10-01' &&
            url.searchParams.get('bookedTo') === '2026-10-08',
        ),
      ).toBe(true);
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Lọc theo ngày khởi hành' }),
    );
    fireEvent.change(await screen.findByLabelText('Khởi hành từ'), {
      target: { value: '2026-10-10' },
    });
    fireEvent.change(await screen.findByLabelText('Khởi hành đến'), {
      target: { value: '2026-10-12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      const params = new URLSearchParams(navigation.getSnapshot());
      expect(params.get('bDepartureFrom')).toBe('2026-10-10');
      expect(params.get('bDepartureTo')).toBe('2026-10-12');
      expect(params.get('bBookedFrom')).toBe('2026-10-01');
      expect(params.get('bBookedTo')).toBe('2026-10-08');
    });
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

    fireEvent.click(screen.getByRole('button', { name: 'Lọc theo ngày đặt' }));
    fireEvent.change(await screen.findByLabelText('Ngày đặt từ'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(await screen.findByLabelText('Ngày đặt đến'), {
      target: { value: '2026-10-08' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
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
      screen
        .getByRole('button', { name: 'Trang sau' })
        .hasAttribute('disabled'),
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

  it('selects and toggles ticket sorting through its accessible popover', async () => {
    const api = installApi();
    navigation.reset('tab=tickets');
    render(<BookingManagement />);

    await screen.findAllByText('VE-0044');
    const trigger = screen.getByRole('button', {
      name: 'Sắp xếp theo: Ngày đặt, Giảm dần',
    });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    const priceOption = (await screen.findAllByRole('button', { name: 'Giá thực tế' }))
      .find((option) => option.hasAttribute('aria-pressed'));
    if (!priceOption) throw new Error('Không tìm thấy tùy chọn giá vé.');
    expect(priceOption.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(priceOption);

    await waitFor(() => {
      expect(
        api.urls.some(
          (url) =>
            url.pathname === '/api/v1/admin/tickets' &&
            url.searchParams.get('sortBy') === 'ticketPrice' &&
            url.searchParams.get('sortDirection') === 'desc',
        ),
      ).toBe(true);
    });
    expect(screen.getByRole('button', {
      name: 'Sắp xếp theo: Giá thực tế, Giảm dần',
    })).toBeTruthy();
    expect(new URLSearchParams(navigation.getSnapshot()).get('tSortDirection')).toBeNull();
  });

  it('toggles the active ticket sort direction and updates its accessible arrow label', async () => {
    const api = installApi();
    navigation.reset('tab=tickets');
    render(<BookingManagement />);
    await screen.findAllByText('VE-0044');

    const trigger = screen.getByRole('button', {
      name: 'Sắp xếp theo: Ngày đặt, Giảm dần',
    });
    fireEvent.click(trigger);
    const selectedDateOption = await screen.findByRole('button', {
      name: /Ngày đặt/,
      pressed: true,
    });
    fireEvent.click(selectedDateOption);

    await waitFor(() => {
      expect(
        api.urls.some(
          (url) =>
            url.pathname === '/api/v1/admin/tickets' &&
            url.searchParams.get('sortBy') === 'bookedAt' &&
            url.searchParams.get('sortDirection') === 'asc',
        ),
      ).toBe(true);
    });
    expect(screen.getByRole('button', {
      name: 'Sắp xếp theo: Ngày đặt, Tăng dần',
    })).toBeTruthy();
    expect(new URLSearchParams(navigation.getSnapshot()).get('tSortDirection')).toBe('asc');
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

  it('filters paid tickets and shows the settled status in both list and detail', async () => {
    const api = installApi({ ticketStatus: 'DA_THANH_TOAN' });
    navigation.reset('tab=tickets');
    render(<BookingManagement />);
    await screen.findAllByText('VE-0044');
    const statusFilter = screen.getByRole('combobox', { name: 'Lọc theo trạng thái' });
    fireEvent.click(statusFilter);
    const paidStatusOption = await screen.findByRole('option', { name: 'Đã thanh toán' });
    fireEvent.pointerDown(paidStatusOption, { button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(paidStatusOption, { button: 0, pointerType: 'mouse' });
    fireEvent.click(paidStatusOption);
    await waitFor(() => {
      expect(api.urls.some((url) =>
        url.pathname === '/api/v1/admin/tickets' &&
        url.searchParams.get('status') === 'DA_THANH_TOAN',
      )).toBe(true);
    });
    expect((await screen.findAllByText('Đã thanh toán')).length).toBeGreaterThan(0);

    cleanup();
    installApi({ ticketStatus: 'DA_THANH_TOAN' });
    navigation.reset('from=%2Fbooking-management%3Ftab=tickets');
    render(<BookingManagementDetail kind="tickets" resourceId={44} />);
    expect((await screen.findAllByText('Đã thanh toán')).length).toBeGreaterThan(0);
  });

  it('formats shipment statuses MOI_TAO and DA_TIEP_NHAN with correct Vietnamese labels', () => {
    expect(statusLabel('MOI_TAO')).toBe('Mới tạo');
    expect(statusLabel('DA_TIEP_NHAN')).toBe('Đã tiếp nhận');
  });

  it('rejects an inverted date range without changing the applied URL or issuing another request', async () => {
    navigation.reset('bPage=3&bBookedFrom=2026-10-05&bBookedTo=2026-10-10');
    const api = installApi();
    render(<BookingManagement />);
    await screen.findAllByText('PD-0012');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ngày đặt: 05/10/2026 đến 10/10/2026',
      }),
    );
    const fromInput = (await screen.findByLabelText(
      'Ngày đặt từ',
    )) as HTMLInputElement;
    const toInput = (await screen.findByLabelText(
      'Ngày đặt đến',
    )) as HTMLInputElement;
    const requestCount = api.urls.length;
    fireEvent.change(fromInput, { target: { value: '2026-10-15' } });

    expect(fromInput.getAttribute('max')).toBe('2026-10-10');
    expect(toInput.getAttribute('min')).toBe('2026-10-15');
    expect(
      screen.getByRole('button', { name: 'Áp dụng' }).hasAttribute('disabled'),
    ).toBe(true);
    const appliedParams = new URLSearchParams(navigation.getSnapshot());
    expect(appliedParams.get('bPage')).toBe('3');
    expect(appliedParams.get('bBookedFrom')).toBe('2026-10-05');
    expect(appliedParams.get('bBookedTo')).toBe('2026-10-10');
    expect(api.urls).toHaveLength(requestCount);
    expect(
      api.urls.some(
        (url) => url.searchParams.get('bookedFrom') === '2026-10-15',
      ),
    ).toBe(false);
  });

  it('clears only the selected date range from the shared range picker', async () => {
    navigation.reset(
      'bPage=2&bBookedFrom=2026-10-05&bBookedTo=2026-10-10&bDepartureFrom=2026-11-01&bDepartureTo=2026-11-05',
    );
    const api = installApi();
    render(<BookingManagement />);
    await screen.findAllByText('PD-0012');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ngày đặt: 05/10/2026 đến 10/10/2026',
      }),
    );
    await screen.findByLabelText('Ngày đặt từ');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));

    await waitFor(() => {
      const params = new URLSearchParams(navigation.getSnapshot());
      expect(params.has('bBookedFrom')).toBe(false);
      expect(params.has('bBookedTo')).toBe(false);
      expect(params.has('bPage')).toBe(false);
      expect(params.get('bDepartureFrom')).toBe('2026-11-01');
      expect(params.get('bDepartureTo')).toBe('2026-11-05');
    });
    expect(
      api.urls.some(
        (url) =>
          url.searchParams.get('departureFrom') === '2026-11-01' &&
          url.searchParams.get('departureTo') === '2026-11-05' &&
          !url.searchParams.has('bookedFrom') &&
          !url.searchParams.has('bookedTo'),
      ),
    ).toBe(true);
  });

  it('clears the active tab date ranges while preserving the other tab filters', async () => {
    navigation.reset(
      'bPage=3&bBookedFrom=2026-10-05&bBookedTo=2026-10-10&tPage=4&tDepartureFrom=2026-11-01&tDepartureTo=2026-11-05',
    );
    const api = installApi();
    render(<BookingManagement />);
    await screen.findAllByText('PD-0012');

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    await waitFor(() => {
      const params = new URLSearchParams(navigation.getSnapshot());
      expect(params.has('bBookedFrom')).toBe(false);
      expect(params.has('bBookedTo')).toBe(false);
      expect(params.has('bPage')).toBe(false);
      expect(params.get('tPage')).toBe('4');
      expect(params.get('tDepartureFrom')).toBe('2026-11-01');
      expect(params.get('tDepartureTo')).toBe('2026-11-05');
    });
    expect(
      api.urls.some(
        (url) =>
          url.searchParams.get('page') === '1' &&
          !url.searchParams.has('bookedFrom') &&
          !url.searchParams.has('bookedTo'),
      ),
    ).toBe(true);
  });

  it('keeps each tab date ranges independent when switching between bookings and tickets', async () => {
    navigation.reset(
      'bBookedFrom=2026-10-05&bBookedTo=2026-10-10&tDepartureFrom=2026-11-01&tDepartureTo=2026-11-05',
    );
    installApi();
    render(<BookingManagement />);
    await screen.findAllByText('PD-0012');
    expect(
      screen.getByRole('button', {
        name: 'Ngày đặt: 05/10/2026 đến 10/10/2026',
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Vé' }));
    await screen.findAllByText('VE-0044');
    expect(
      screen.getByRole('button', { name: 'Lọc theo ngày đặt' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Ngày khởi hành: 01/11/2026 đến 05/11/2026',
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Phiếu đặt vé' }));
    await screen.findAllByText('PD-0012');
    expect(
      screen.getByRole('button', {
        name: 'Ngày đặt: 05/10/2026 đến 10/10/2026',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Lọc theo ngày khởi hành' }),
    ).toBeTruthy();
  });

  it('restores applied date ranges on browser back and forward', async () => {
    const api = installApi();
    render(<BookingManagement />);
    await screen.findAllByText('PD-0012');

    fireEvent.click(screen.getByRole('button', { name: 'Lọc theo ngày đặt' }));
    fireEvent.change(await screen.findByLabelText('Ngày đặt từ'), {
      target: { value: '2026-10-05' },
    });
    fireEvent.change(await screen.findByLabelText('Ngày đặt đến'), {
      target: { value: '2026-10-10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      expect(navigation.getSnapshot()).toContain('bBookedFrom=2026-10-05');
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ngày đặt: 05/10/2026 đến 10/10/2026',
      }),
    );
    fireEvent.change(await screen.findByLabelText('Ngày đặt từ'), {
      target: { value: '2026-10-08' },
    });
    fireEvent.change(await screen.findByLabelText('Ngày đặt đến'), {
      target: { value: '2026-10-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      expect(navigation.getSnapshot()).toContain('bBookedFrom=2026-10-08');
    });
    const historyLength = navigation.getHistoryLength();
    const transitionCount = navigation.getTransitionCount();
    act(() => navigation.back());
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Ngày đặt: 05/10/2026 đến 10/10/2026',
        }),
      ).toBeTruthy();
    });
    expect(
      api.urls.some(
        (url) =>
          url.searchParams.get('bookedFrom') === '2026-10-05' &&
          url.searchParams.get('bookedTo') === '2026-10-10',
      ),
    ).toBe(true);

    act(() => navigation.forward());
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Ngày đặt: 08/10/2026 đến 15/10/2026',
        }),
      ).toBeTruthy();
    });
    expect(navigation.getHistoryLength()).toBe(historyLength);
    expect(navigation.getTransitionCount()).toBe(transitionCount);
  });

  it('canonicalizes inverted deep-link ranges and keeps the valid endpoint visible', async () => {
    navigation.reset(
      'bBookedFrom=2026-10-15&bBookedTo=2026-10-10&bDepartureFrom=2026-11-15&bDepartureTo=2026-11-10',
    );
    const api = installApi();
    render(<BookingManagement />);

    await waitFor(() => {
      expect(navigation.getSnapshot()).toBe(
        'bBookedFrom=2026-10-15&bDepartureFrom=2026-11-15',
      );
    });
    const bookedFilter = screen.getByRole('button', {
      name: 'Ngày đặt: ngày đặt từ 15/10/2026',
    });
    expect(bookedFilter).toBeTruthy();
    fireEvent.click(bookedFilter);
    expect(
      ((await screen.findByLabelText('Ngày đặt từ')) as HTMLInputElement).value,
    ).toBe('2026-10-15');
    expect(
      ((await screen.findByLabelText('Ngày đặt đến')) as HTMLInputElement)
        .value,
    ).toBe('');
    expect(
      screen.getByRole('button', { name: 'Áp dụng' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      api.urls.some((url) => {
        const from = url.searchParams.get('bookedFrom');
        const to = url.searchParams.get('bookedTo');
        return Boolean(from && to && from > to);
      }),
    ).toBe(false);
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(navigation.getTransitionCount()).toBe(1);
  });
});
