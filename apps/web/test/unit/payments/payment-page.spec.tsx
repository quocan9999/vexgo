import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentPage from '../../../src/features/payments/components/payment-page';
import { PAYMENT_DRAFT_STORAGE_PREFIX } from '../../../src/features/booking/services/payment-draft';

const { routerPush, router, auth } = vi.hoisted(() => {
  const routerPush = vi.fn();
  const auth = {
    isAuthenticated: false,
    isHydrated: true,
    executeWithAuth: async <T,>(action: (token: string) => Promise<T>) =>
      action('test-access-token'),
  };
  return { routerPush, router: { push: routerPush }, auth };
});
const draftId = 'vietqr-payment-test';
const bookingId = 4201;
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(`draftId=${draftId}`),
}));

vi.mock('@/features/auth/auth-session', () => ({
  useAuthSession: () => auth,
}));

function savePaymentDraft() {
  window.sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}${draftId}`,
    JSON.stringify({
      id: draftId,
      tripType: 'one-way',
      legs: [
        {
          tripId: 71,
          route: 'TP. Hồ Chí Minh - Đà Lạt',
          departureTime: '2026-10-15T22:00:00.000Z',
          seats: ['A02'],
          pickup: 'Bến xe Miền Đông',
          dropoff: 'Bến xe Đà Lạt',
          unitFare: 125000,
          subtotal: 125000,
        },
      ],
      passenger: {
        fullName: 'Khách kiểm thử',
        phoneNumber: '0900000000',
        email: 'customer@example.test',
      },
      totalFare: 125000,
      bookingId,
      bookingCode: 'VG-TEST-4201',
      status: 'CHO_THANH_TOAN',
      paymentStatus: 'CHO_THANH_TOAN',
    }),
  );
}

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data }),
  };
}

async function advanceTime(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

function configureVietQr() {
  vi.stubEnv('NEXT_PUBLIC_SEPAY_BANK_ID', 'BIDV');
  vi.stubEnv('NEXT_PUBLIC_SEPAY_ACCOUNT_NUMBER', '1234567890');
  vi.stubEnv('NEXT_PUBLIC_SEPAY_ACCOUNT_NAME', 'VEXGO TEST');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('NEXT_PUBLIC_SEPAY_BANK_ID', '');
  vi.stubEnv('NEXT_PUBLIC_SEPAY_ACCOUNT_NUMBER', '');
  vi.stubEnv('NEXT_PUBLIC_SEPAY_ACCOUNT_NAME', '');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  routerPush.mockReset();
  auth.isAuthenticated = false;
  auth.isHydrated = true;
  window.sessionStorage.clear();
  savePaymentDraft();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.sessionStorage.clear();
});

describe('Customer VietQR payment page', () => {
  it('shows the missing configuration warning without QR, confirmation action, or payment requests', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'DA_THANH_TOAN', paymentStatus: 'DA_THANH_TOAN' }),
    );

    render(<PaymentPage />);

    expect(screen.getByRole('alert').textContent).toContain(
      'VietQR chưa được cấu hình đầy đủ nên chưa thể hiển thị mã thanh toán. Vui lòng liên hệ bộ phận hỗ trợ.',
    );
    expect(
      screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Tôi đã chuyển khoản thành công' }),
    ).toBeNull();

    await advanceTime(5_000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('shows a QR with the configured bank details and starts in a pending state', async () => {
    configureVietQr();
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'CHO_THANH_TOAN',
        paymentStatus: 'CHO_THANH_TOAN',
      }),
    );

    render(<PaymentPage />);

    const qr = screen.getByRole('img', { name: 'Mã QR thanh toán VietQR' });
    expect(qr.getAttribute('src')).toContain('BIDV-1234567890-compact2.png');
    expect(qr.getAttribute('src')).toContain('amount=125000');
    expect(screen.getByText('BIDV')).toBeTruthy();
    expect(screen.getByText('1234567890')).toBeTruthy();
    expect(screen.getByText('VEXGO TEST')).toBeTruthy();
    expect(screen.getByText('VEXGO VG-TEST-4201')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain(
      'Đang chờ hệ thống xác nhận thanh toán từ ngân hàng.',
    );
    expect(
      screen.queryByRole('button', { name: 'Tôi đã chuyển khoản thành công' }),
    ).toBeNull();

    await advanceTime(2_500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `/bookings/${bookingId}/detail`,
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('confirm-payment');
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('reads an account booking status with the authenticated customer token', async () => {
    configureVietQr();
    auth.isAuthenticated = true;
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'CHO_THANH_TOAN', paymentStatus: 'CHO_THANH_TOAN' }),
    );

    render(<PaymentPage />);
    await advanceTime(2_500);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/bookings/${bookingId}/detail`),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-access-token' },
      }),
    );
  });


  it('navigates once only after the booking detail endpoint reports paid', async () => {
    configureVietQr();
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'DA_THANH_TOAN', paymentStatus: 'DA_THANH_TOAN' }),
    );

    render(<PaymentPage />);
    await advanceTime(2_500);

    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith(`/invoice/${bookingId}`);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `/bookings/${bookingId}/detail`,
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('confirm-payment');

    await advanceTime(7_500);

    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stays pending when the status endpoint returns an error', async () => {
    configureVietQr();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: 'Payment status unavailable' }),
    });

    render(<PaymentPage />);
    await advanceTime(2_500);

    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain(
      'Đang chờ hệ thống xác nhận thanh toán từ ngân hàng.',
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `/bookings/${bookingId}/detail`,
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('confirm-payment');
  });

  it('aborts an in-flight status request and stops polling when unmounted', async () => {
    configureVietQr();
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

    const { unmount } = render(<PaymentPage />);
    await advanceTime(2_500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestSignal).toBeDefined();
    expect(requestSignal?.aborted).toBe(false);

    unmount();
    expect(requestSignal?.aborted).toBe(true);

    await advanceTime(7_500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
  });
});
