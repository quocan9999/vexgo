import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import InvoicePage from '../../../src/features/payments/components/invoice-page';
import { PAYMENT_DRAFT_STORAGE_PREFIX } from '../../../src/features/booking/services/payment-draft';

const bookingId = 4201;
const bookingCode = 'PDV-TEST-PDV-0123456789ABCDEF0123456789ABCD';
const phoneNumber = '0900000000';
const fetchMock = vi.fn();

const { auth } = vi.hoisted(() => ({
  auth: {
    isAuthenticated: false,
    isHydrated: true,
    executeWithAuth: async <T,>(action: (token: string) => Promise<T>) =>
      action('invoice-test-token'),
  },
}));

vi.mock('@/features/auth/auth-session', () => ({
  useAuthSession: () => auth,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    <a href={href}>{children}</a>,
}));

function paidBooking(overrides: Record<string, unknown> = {}) {
  return {
    bookingId,
    bookingCode,
    orderCode: 'FUTAGD0123456789ABCDEF0123456789ABCD',
    status: 'DA_THANH_TOAN',
    paymentStatus: 'DA_THANH_TOAN',
    totalAmount: 125000,
    ticketSubtotal: 125000,
    cargoFee: 0,
    cargoItems: [],
    busCompanyName: 'Nhà xe kiểm thử',
    route: 'TP. Hồ Chí Minh - Đà Lạt',
    departureTime: '2026-10-15T22:00:00.000Z',
    seatNumbers: ['A02'],
    pickup: 'Bến xe Miền Đông',
    dropoff: 'Bến xe Đà Lạt',
    passenger: {
      fullName: 'Nguyễn Minh Anh',
      phoneNumber,
      email: 'minhanh@example.test',
    },
    createdAt: '2026-10-14T10:00:00.000Z',
    tickets: [
      {
        ticketId: 5101,
        ticketCode: 'VE-REAL-5101',
        seatNumber: 'A02',
        price: 125000,
        status: 'DA_THANH_TOAN',
        pickup: 'Bến xe Miền Đông',
      },
    ],
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
  };
}

function saveGuestReadCredentials() {
  window.sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}guest-invoice-test`,
    JSON.stringify({
      bookingId,
      bookingCode,
      passenger: { phoneNumber },
    }),
  );
}

async function renderInvoiceWithParams(params: Promise<{ id: string }>) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Suspense fallback={<p>Đang tải</p>}>
        <InvoicePage params={params} />
      </Suspense>,
    );
    await params;
  });
  return result!;
}

async function renderInvoice(id = String(bookingId)) {
  return renderInvoiceWithParams(Promise.resolve({ id }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  auth.isAuthenticated = false;
  auth.isHydrated = true;
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe('Customer invoice page', () => {
  it('does not render an invoice while the backend says the booking is pending', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(paidBooking({ status: 'CHO_THANH_TOAN', paymentStatus: 'CHO_THANH_TOAN' })),
    );

    await renderInvoice();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Đã thanh toán')).toBeNull();
    expect(screen.queryByRole('button', { name: 'In vé' })).toBeNull();
  });

  it('does not treat a provider attempt state as a pending booking/order state', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(paidBooking({ status: 'DANG_XU_LY', paymentStatus: 'DANG_XU_LY' })),
    );

    await renderInvoice();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Chưa thể xác minh trạng thái thanh toán',
    );
    expect(screen.queryByText('Thanh toán chưa được hệ thống xác nhận')).toBeNull();
    expect(screen.queryByRole('button', { name: 'In vé' })).toBeNull();
  });

  it.each([403, 404, 500])(
    'does not fall back to a success invoice when booking detail returns HTTP %s',
    async (status) => {
      fetchMock.mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ message: 'Không thể xác minh booking' }),
      });

      await renderInvoice();

      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(screen.queryByText('Đã thanh toán')).toBeNull();
      expect(screen.queryByRole('button', { name: 'In vé' })).toBeNull();
      expect(screen.queryByText('620.000đ')).toBeNull();
    },
  );

  it('does not fall back to a success invoice when the backend is offline', async () => {
    saveGuestReadCredentials();
    fetchMock.mockRejectedValue(new Error('API offline'));

    await renderInvoice();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Đã thanh toán')).toBeNull();
    expect(screen.queryByRole('button', { name: 'In vé' })).toBeNull();
  });

  it('ignores legacy session invoice data and requires a paid backend response', async () => {
    window.sessionStorage.setItem(
      'vexgo:last-completed-booking',
      JSON.stringify({ bookingId, bookingCode, paymentStatus: 'DA_THANH_TOAN' }),
    );
    window.sessionStorage.setItem(
      `vexgo:invoice:${bookingId}`,
      JSON.stringify({ bookingId, bookingCode, paymentStatus: 'DA_THANH_TOAN' }),
    );
    fetchMock.mockResolvedValue(
      jsonResponse(paidBooking({ status: 'CHO_THANH_TOAN', paymentStatus: 'CHO_THANH_TOAN' })),
    );

    await renderInvoice();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Vé xe điện tử (E-Ticket)')).toBeNull();
    expect(screen.queryByRole('button', { name: 'In vé' })).toBeNull();
  });

  it('renders the real invoice only after an authorized backend read reports paid', async () => {
    saveGuestReadCredentials();
    fetchMock.mockResolvedValue(jsonResponse(paidBooking()));

    await renderInvoice();

    expect(await screen.findByText('Vé xe điện tử (E-Ticket)')).toBeTruthy();
    expect(screen.getByText('Nhà xe kiểm thử')).toBeTruthy();
    expect(screen.getByText(/FUTAGD0123456789ABCDEF0123456789ABCD/)).toBeTruthy();
    expect(screen.getByText('Nguyễn Minh Anh')).toBeTruthy();
    expect(screen.getByText('125.000đ')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/bookings/${bookingId}/detail`),
      expect.objectContaining({
        headers: {
          'x-booking-code': bookingCode,
          'x-booking-phone': phoneNumber,
        },
      }),
    );
  });

  it('uses the authenticated customer token to read the paid invoice', async () => {
    auth.isAuthenticated = true;
    fetchMock.mockResolvedValue(jsonResponse(paidBooking()));

    await renderInvoice();

    expect(await screen.findByRole('button', { name: 'In vé' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/bookings/${bookingId}/detail`),
      expect.objectContaining({
        headers: { Authorization: 'Bearer invoice-test-token' },
      }),
    );
  });

  it('clears a guest read error when an authenticated retry verifies the paid invoice', async () => {
    saveGuestReadCredentials();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Không thể xác minh booking' }),
    });
    const params = Promise.resolve({ id: String(bookingId) });
    const view = await renderInvoiceWithParams(params);

    expect(await screen.findByRole('alert')).toBeTruthy();

    auth.isAuthenticated = true;
    fetchMock.mockResolvedValue(jsonResponse(paidBooking()));
    view.rerender(
      <Suspense fallback={<p>Đang tải</p>}>
        <InvoicePage params={params} />
      </Suspense>,
    );

    expect(await screen.findByRole('button', { name: 'In vé' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not treat a paid order with a non-paid booking status as a valid invoice', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(paidBooking({ status: 'CHO_THANH_TOAN', paymentStatus: 'DA_THANH_TOAN' })),
    );

    await renderInvoice();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'In vé' })).toBeNull();
  });

  it('does not render a paid response for a different booking id', async () => {
    fetchMock.mockResolvedValue(jsonResponse(paidBooking({ bookingId: bookingId + 1 })));

    await renderInvoice();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Vé xe điện tử (E-Ticket)')).toBeNull();
  });

  it('aborts an in-flight backend read when the invoice route unmounts', async () => {
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url, options) => {
      requestSignal = options?.signal;
      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('Request aborted', 'AbortError')),
          { once: true },
        );
      });
    });

    const { unmount } = await renderInvoice();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    unmount();

    expect(requestSignal?.aborted).toBe(true);
  });
});
