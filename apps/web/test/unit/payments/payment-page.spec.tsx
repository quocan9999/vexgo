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

function savePaymentDraft(orderCode: string | null = 'DGD-TEST-4201') {
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
      ...(orderCode === null ? {} : { orderCode }),
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
    expect(screen.getByText('DGD-TEST-4201')).toBeTruthy();
    expect(qr.getAttribute('src')).toContain('addInfo=DGD-TEST-4201');
    expect(qr.getAttribute('src')).not.toContain('VG-TEST-4201');
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
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'x-booking-code': 'VG-TEST-4201',
      'x-booking-phone': '0900000000',
    });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('confirm-payment');
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('keeps the canonical SePay reference identical in QR and displayed transfer content', async () => {
    const orderCode = 'FUTAGD29612020BAC94BCEA507A24A8D759B';
    savePaymentDraft(orderCode);
    configureVietQr();
    fetchMock.mockResolvedValue(jsonResponse({ status: 'CHO_THANH_TOAN', paymentStatus: 'CHO_THANH_TOAN' }));
    render(<PaymentPage />);
    expect(screen.getByText(orderCode)).toBeTruthy();
    const qr = screen.getByRole('img', { name: 'Mã QR thanh toán VietQR' });
    expect(new URL(qr.getAttribute('src')!).searchParams.get('addInfo')).toBe(orderCode);
    await advanceTime(2_500);
    expect(routerPush).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });

  it('does not create a QR or guess a transfer reference when the order code is missing', async () => {
    configureVietQr();
    window.sessionStorage.clear();
    savePaymentDraft(null);

    render(<PaymentPage />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Đơn đặt vé chưa có mã giao dịch hợp lệ nên chưa thể tạo mã VietQR.',
    );
    expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
    expect(screen.queryByText('1234567890')).toBeNull();
    expect(screen.queryByText('DGD-TEST-4201')).toBeNull();
    expect(screen.queryByText('VG-TEST-4201')).toBeNull();

    await advanceTime(5_000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('uses the backend payment deadline for the countdown and removes the QR after it expires', async () => {
    configureVietQr();
    const backendNow = Date.now();
    const paymentExpiresAt = new Date(backendNow + 3_000).toISOString();
    fetchMock
      .mockImplementationOnce(async () =>
        jsonResponse({
          status: 'CHO_THANH_TOAN',
          paymentStatus: 'CHO_THANH_TOAN',
          paymentExpiresAt,
          serverTime: new Date(Date.now()).toISOString(),
        }),
      )
      .mockImplementation(async () =>
        jsonResponse({
          status: 'HET_HAN',
          paymentStatus: 'HET_HAN',
          paymentExpiresAt,
          serverTime: new Date(Date.now()).toISOString(),
        }),
      );

    render(<PaymentPage />);
    await advanceTime(2_500);

    expect(screen.getByText('Thời gian thanh toán còn lại 00:01')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeTruthy();

    await advanceTime(3_000);

    expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
    expect(screen.getByText(/đã hết hạn/i)).toBeTruthy();
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
        headers: {
          Authorization: 'Bearer test-access-token',
          'x-booking-code': 'VG-TEST-4201',
          'x-booking-phone': '0900000000',
        },
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

  it('stops polling after the backend deadline when status reads fail and keeps the payment unverified', async () => {
    configureVietQr();
    const backendNow = Date.now();
    const paymentExpiresAt = new Date(backendNow + 3_000).toISOString();
    fetchMock
      .mockImplementationOnce(async () =>
        jsonResponse({
          status: 'CHO_THANH_TOAN',
          paymentStatus: 'CHO_THANH_TOAN',
          paymentExpiresAt,
          serverTime: new Date(Date.now()).toISOString(),
        }),
      )
      .mockRejectedValue(new Error('status endpoint unavailable'));

    render(<PaymentPage />);
    await advanceTime(5_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status').textContent).toContain(
      'Chưa thể xác minh trạng thái thanh toán',
    );
    expect(
      screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' }),
    ).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();

    await advanceTime(10_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it.each(['DA_HUY', 'HET_HAN'])(
    'stops polling and removes the QR when backend status is %s',
    async (status) => {
      configureVietQr();
      fetchMock.mockResolvedValue(
        jsonResponse({ status, paymentStatus: status }),
      );

      render(<PaymentPage />);
      await advanceTime(2_500);

      expect(
        screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' }),
      ).toBeNull();
      expect(screen.getByRole('status').textContent).toContain(
        status === 'DA_HUY' ? 'đã bị hủy' : 'đã hết hạn',
      );
      expect(routerPush).not.toHaveBeenCalled();

      await advanceTime(10_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

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
