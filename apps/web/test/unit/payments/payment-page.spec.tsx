import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

function savePaymentDraft(
  orderCode: string | null = 'DGD-TEST-4201',
  options: {
    totalFare?: number;
    luggage?: Record<string, unknown>;
    legs?: unknown[];
  } = {},
) {
  window.sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}${draftId}`,
    JSON.stringify({
      id: draftId,
      tripType: 'one-way',
      legs: options.legs ?? [
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
      totalFare: options.totalFare ?? 125000,
      ...(options.luggage ? { luggage: options.luggage } : {}),
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

function bookingDetail(overrides: Record<string, unknown> = {}) {
  return {
    bookingId,
    bookingCode: 'VG-TEST-4201',
    orderCode: 'DGD-TEST-4201',
    totalAmount: 125000,
    ticketSubtotal: 125000,
    originalTicketSubtotal: 125000,
    discountAmount: 0,
    cargoFee: 0,
    cargoItems: [],
    status: 'CHO_THANH_TOAN',
    paymentStatus: 'CHO_THANH_TOAN',
    paymentExpiresAt: new Date(Date.now() + 600_000).toISOString(),
    serverTime: new Date(Date.now()).toISOString(),
    ...overrides,
  };
}

function saveShipmentPaymentDraft() {
  window.sessionStorage.setItem(
    `${PAYMENT_DRAFT_STORAGE_PREFIX}${draftId}`,
    JSON.stringify({
      id: draftId,
      kind: 'shipment',
      shipmentId: 601,
      paymentId: 801,
      waybillCode: 'VG-VD-TEST-601',
      orderCode: 'VG-DH-TEST-701',
      totalFare: 50000,
      sender: {
        fullName: 'Nguyễn An',
        phoneNumber: '0900000001',
        email: 'an@example.test',
      },
      receiver: { fullName: 'Trần Bình', phoneNumber: '0900000002' },
      route: {
        origin: 'Đà Lạt',
        destination: 'TP.HCM',
        departureTime: '2026-10-20T08:00:00.000Z',
      },
      pickupPoint: { name: 'Điểm gửi', address: 'Địa chỉ gửi' },
      dropoffPoint: { name: 'Điểm nhận', address: 'Địa chỉ nhận' },
    }),
  );
}

function shipmentLookup(overrides: Record<string, unknown> = {}) {
  return {
    waybillCode: 'VG-VD-TEST-601',
    status: 'MOI_TAO',
    orderCode: 'VG-DH-TEST-701',
    amount: 50000,
    orderStatus: 'CHO_THANH_TOAN',
    paymentStatus: 'DANG_XU_LY',
    paymentMethod: 'SEPAY',
    paymentExpiresAt: new Date(Date.now() + 600_000).toISOString(),
    serverTime: new Date(Date.now()).toISOString(),
    pickupPoint: { name: 'Điểm gửi', address: 'Địa chỉ gửi' },
    dropoffPoint: { name: 'Điểm nhận', address: 'Địa chỉ nhận' },
    carrier: { name: 'Nhà xe kiểm thử' },
    route: { origin: 'Đà Lạt', destination: 'TP.HCM' },
    scheduledDepartureAt: '2026-10-20T08:00:00.000Z',
    estimatedArrivalAt: null,
    packageCount: 1,
    timeline: [],
    ...overrides,
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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

  it('shows and polls a QR while backend booking/order state is CHO_THANH_TOAN', async () => {
    configureVietQr();
    fetchMock.mockResolvedValue(jsonResponse(bookingDetail()));

    render(<PaymentPage />);
    expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
    await flushPromises();

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

    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it('verifies a guest shipment with waybill and sender phone, then stops showing QR after paid status', async () => {
    configureVietQr();
    saveShipmentPaymentDraft();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(shipmentLookup()))
      .mockResolvedValueOnce(jsonResponse(shipmentLookup({
        orderStatus: 'DA_THANH_TOAN',
        paymentStatus: 'THANH_CONG',
      })));

    render(<PaymentPage />);
    await flushPromises();

    const qr = screen.getByRole('img', { name: 'Mã QR thanh toán VietQR' });
    expect(qr.getAttribute('src')).toContain('amount=50000');
    expect(qr.getAttribute('src')).toContain('addInfo=VG-DH-TEST-701');
    expect(screen.getByText('VG-VD-TEST-601')).toBeTruthy();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/shipments/lookup');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      waybillCode: 'VG-VD-TEST-601',
      phoneNumber: '0900000001',
    });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/bookings/');

    await advanceTime(2_500);

    expect(
      screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' }),
    ).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('đã được xác nhận');
    expect(routerPush).not.toHaveBeenCalledWith('/invoice/601');
  });

  it('shows reconciliation guidance when a late payment is recorded for a cancelled shipment', async () => {
    configureVietQr();
    saveShipmentPaymentDraft();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(shipmentLookup()))
      .mockResolvedValueOnce(jsonResponse(shipmentLookup({
        status: 'DA_HUY',
        orderStatus: 'DA_HUY',
        paymentStatus: 'THANH_CONG',
        requiresReconciliation: true,
      })));

    render(<PaymentPage />);
    await flushPromises();
    expect(screen.getByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeTruthy();

    await advanceTime(2_500);

    expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
    const status = screen.getByRole('status').textContent ?? '';
    expect(status).toContain('Khoản tiền đã được ghi nhận');
    expect(status).toContain('Đơn không được khôi phục');
    expect(status).toContain('đối soát');
    expect(status).not.toContain('Thanh toán phiếu gửi hàng đã được xác nhận');
  });

  it('uses the authenticated payment status endpoint and renders only its confirmed amount', async () => {
    configureVietQr();
    saveShipmentPaymentDraft();
    auth.isAuthenticated = true;
    fetchMock.mockResolvedValue(jsonResponse({
      paymentId: 801,
      bookingId: 0,
      orderId: 701,
      orderCode: 'VG-DH-TEST-701',
      orderStatus: 'CHO_THANH_TOAN',
      shipmentId: 601,
      shipmentStatus: 'MOI_TAO',
      provider: 'SEPAY',
      amount: 50000,
      status: 'PENDING',
      paymentStatus: 'DANG_XU_LY',
      paymentExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      serverTime: new Date(Date.now()).toISOString(),
    }));

    render(<PaymentPage />);
    await flushPromises();

    expect(String(fetchMock.mock.calls[0][0])).toContain('/payments/801/status');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer test-access-token',
    });
    const qr = screen.getByRole('img', { name: 'Mã QR thanh toán VietQR' });
    expect(qr.getAttribute('src')).toContain('amount=50000');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/shipments/lookup');
  });

  it('falls back to verified waybill and sender phone lookup when a signed-in guest gets 403', async () => {
    configureVietQr();
    saveShipmentPaymentDraft();
    auth.isAuthenticated = true;
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'FORBIDDEN', message: 'Forbidden' }),
      })
      .mockResolvedValueOnce(jsonResponse(shipmentLookup()));

    render(<PaymentPage />);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/payments/801/status');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer test-access-token',
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain('/shipments/lookup');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      waybillCode: 'VG-VD-TEST-601',
      phoneNumber: '0900000001',
    });
    expect(
      screen.getByRole('img', { name: 'Mã QR thanh toán VietQR' }),
    ).toBeTruthy();
    expect(screen.getByText('VG-VD-TEST-601')).toBeTruthy();
  });

  it('hides shipment QR when the verified server amount differs from the draft', async () => {
    configureVietQr();
    saveShipmentPaymentDraft();
    fetchMock.mockResolvedValue(jsonResponse(shipmentLookup({ amount: 50001 })));

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain(
      'Không thể xác minh thông tin phiếu gửi hàng với máy chủ',
    );
  });

  it('shows backend ticket, cargo, and total amounts without estimating per-item cargo fees', async () => {
    configureVietQr();
    savePaymentDraft('DGD-TEST-4201', {
      totalFare: 157000,
      luggage: {
        fee: 0,
        weight: 10,
        items: [{ id: 'cargo-1', type: 'Vali', quantity: 1, weight: 10 }],
      },
    });
    fetchMock.mockResolvedValue(
      jsonResponse(bookingDetail({
        totalAmount: 157000,
        ticketSubtotal: 125000,
        cargoFee: 32000,
      })),
    );

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByText('Tổng tiền vé sau ưu đãi').parentElement?.textContent).toContain('125.000đ');
    expect(screen.getByText('Cước hàng').parentElement?.textContent).toContain('32.000đ');
    expect(screen.getAllByText('Tổng thanh toán').some((label) =>
      label.parentElement?.textContent?.includes('157.000đ'),
    )).toBe(true);
    expect(screen.getByText('Cước hàng theo đơn').parentElement?.textContent).toContain('32.000đ');
    expect(screen.queryByText('Miễn phí')).toBeNull();
    expect(screen.queryByText(/250\.000đ|100\.000đ|30\.000đ/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Chi tiết hàng gửi hầm xe' }));
    expect(screen.getAllByText('Cước tính chung theo đơn').length).toBeGreaterThan(0);
    expect(screen.queryByText(/250\.000đ|100\.000đ|30\.000đ/)).toBeNull();
  });

  it('says cargo is free only when the backend returns a verified zero cargo fee', async () => {
    configureVietQr();
    savePaymentDraft('DGD-TEST-4201', {
      luggage: { fee: 0, weight: 10, items: [{ id: 'cargo-1', type: 'Vali', weight: 10 }] },
    });
    fetchMock.mockResolvedValue(jsonResponse(bookingDetail({ cargoFee: 0 })));

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByText('Cước hàng').parentElement?.textContent).toContain('Miễn phí');
    expect(screen.queryByText(/250\.000đ|100\.000đ|30\.000đ/)).toBeNull();
  });

  it('shows a backend cargo fee even when the local draft has no cargo details', async () => {
    configureVietQr();
    savePaymentDraft('DGD-TEST-4201', { totalFare: 157000 });
    fetchMock.mockResolvedValue(
      jsonResponse(bookingDetail({
        totalAmount: 157000,
        ticketSubtotal: 125000,
        cargoFee: 32000,
      })),
    );

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByText('Cước hàng').parentElement?.textContent).toContain('32.000đ');
  });

  it('does not treat a missing backend cargo fee as free even when the payment total is verified', async () => {
    configureVietQr();
    savePaymentDraft('DGD-TEST-4201', {
      luggage: { fee: 0, weight: 10, items: [{ id: 'cargo-1', type: 'Vali', weight: 10 }] },
    });
    fetchMock.mockResolvedValue(
      jsonResponse(bookingDetail({ cargoFee: undefined, ticketSubtotal: undefined })),
    );

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByText('Cước hàng').parentElement?.textContent).toContain(
      'Chưa có dữ liệu cước từ máy chủ',
    );
    expect(screen.getByText('Tổng tiền vé sau ưu đãi').parentElement?.textContent).toContain(
      'Chưa có dữ liệu từ máy chủ',
    );
    expect(screen.queryByText('Miễn phí')).toBeNull();
  });

  it('shows the authoritative promotion breakdown in the payment summary and trip detail modal', async () => {
    configureVietQr();
    savePaymentDraft('DGD-TEST-4201', {
      totalFare: 280000,
      legs: [
        {
          tripId: 71,
          route: 'TP. Hồ Chí Minh - Đà Lạt',
          departureTime: '2026-10-15T22:00:00.000Z',
          seats: ['A02', 'A03'],
          pickup: 'Bến xe Miền Đông',
          dropoff: 'Bến xe Đà Lạt',
          unitFare: 150000,
          subtotal: 300000,
        },
      ],
      luggage: {
        fee: 0,
        weight: 10,
        items: [{ id: 'cargo-1', type: 'Vali', quantity: 1, weight: 10 }],
      },
    });
    fetchMock.mockResolvedValue(
      jsonResponse(bookingDetail({
        totalAmount: 280000,
        ticketSubtotal: 250000,
        originalTicketSubtotal: 300000,
        discountAmount: 50000,
        promotionCode: 'SAVE50',
        cargoFee: 30000,
      })),
    );

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByText('Giá vé gốc').parentElement?.textContent).toContain('300.000đ');
    expect(screen.getByText('Mã khuyến mãi').parentElement?.textContent).toContain('SAVE50');
    expect(screen.getByText('Giảm giá').parentElement?.textContent).toContain('50.000đ');
    expect(screen.getByText('Tổng tiền vé sau ưu đãi').parentElement?.textContent).toContain('250.000đ');
    expect(screen.getByText('Cước hàng').parentElement?.textContent).toContain('30.000đ');
    expect(screen.getByRole('img', { name: 'Mã QR thanh toán VietQR' }).getAttribute('src')).toContain('amount=280000');

    fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0]);

    const dialog = screen.getByRole('dialog', { name: 'Chi tiết chuyến đi' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.className).toContain('max-h-[85vh]');
    expect(dialog.querySelector('.overflow-y-auto')).not.toBeNull();
    expect(dialog.textContent).toContain('300.000đ');
    expect(dialog.textContent).toContain('50.000đ');
    expect(dialog.textContent).toContain('250.000đ');
    expect(dialog.textContent).toContain('30.000đ');
    expect(dialog.textContent).toContain('280.000đ');
  });

  it('does not show a discount row when the backend confirms there was no promotion', async () => {
    configureVietQr();
    fetchMock.mockResolvedValue(
      jsonResponse(bookingDetail({
        originalTicketSubtotal: 125000,
        ticketSubtotal: 125000,
        discountAmount: 0,
      })),
    );

    render(<PaymentPage />);
    await flushPromises();
    fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0]);

    expect(screen.queryByText('Giảm giá')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Chi tiết chuyến đi' }).textContent).toContain('125.000đ');
  });

  it('shows missing discount data without inventing a promotion or a zero discount', async () => {
    configureVietQr();
    fetchMock.mockResolvedValue(
      jsonResponse(bookingDetail({ discountAmount: undefined })),
    );

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByText('Giảm giá').parentElement?.textContent).toContain(
      'Chưa có dữ liệu từ máy chủ',
    );
    expect(screen.queryByText(/khuyến mãi|voucher|ưu đãi [A-Z0-9]/i)).toBeNull();
  });

  it('counts quantity instead of item rows for a multi-package cargo item in payment and both modals', async () => {
    configureVietQr();
    savePaymentDraft('DGD-TEST-4201', {
      totalFare: 155000,
      luggage: {
        fee: 0,
        weight: 50,
        items: [{ id: 'cargo-1', type: 'Vali', quantity: 2, weight: 25 }],
      },
    });
    fetchMock.mockResolvedValue(
      jsonResponse(bookingDetail({
        totalAmount: 155000,
        cargoFee: 30000,
        cargoItems: [{ name: 'Vali', quantity: 2, weight: 25, categoryName: 'Hàng nhẹ' }],
      })),
    );

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByText('2 kiện').parentElement?.textContent).toContain('50kg');

    fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0]);
    const tripDialog = screen.getByRole('dialog', { name: 'Chi tiết chuyến đi' });
    expect(tripDialog.className).toContain('max-h-[85vh]');
    expect(tripDialog.querySelector('.overflow-y-auto')).not.toBeNull();
    expect(tripDialog.textContent).toContain('2 kiện');
    expect(tripDialog.textContent).toContain('25 kg/kiện');
    expect(tripDialog.textContent).toContain('50 kg');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết chuyến đi' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết hàng gửi hầm xe' })[0]);
    const cargoDialog = screen.getByRole('dialog', { name: 'Chi tiết hàng gửi hầm xe' });
    expect(cargoDialog.getAttribute('aria-modal')).toBe('true');
    expect(cargoDialog.className).toContain('max-h-[85vh]');
    expect(cargoDialog.textContent).toContain('2 kiện');
    expect(cargoDialog.textContent).toContain('25 kg/kiện');
    expect(cargoDialog.textContent).toContain('50 kg');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Chi tiết hàng gửi hầm xe' })).toBeNull();
  });

  it('sums quantities across cargo rows for the payment card and detail modals', async () => {
    configureVietQr();
    savePaymentDraft('DGD-TEST-4201', {
      totalFare: 155000,
      luggage: {
        fee: 0,
        weight: 50,
        items: [
          { id: 'cargo-1', type: 'Vali', quantity: 2, weight: 10 },
          { id: 'cargo-2', type: 'Thùng hàng', quantity: 3, weight: 10 },
        ],
      },
    });
    fetchMock.mockResolvedValue(
      jsonResponse(bookingDetail({
        totalAmount: 155000,
        cargoFee: 30000,
        cargoItems: [
          { name: 'Vali', quantity: 2, weight: 10, categoryName: 'Hàng nhẹ' },
          { name: 'Thùng hàng', quantity: 3, weight: 10, categoryName: 'Hàng nhẹ' },
        ],
      })),
    );

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByText('5 kiện').parentElement?.textContent).toContain('50kg');

    fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0]);
    expect(screen.getByRole('dialog', { name: 'Chi tiết chuyến đi' }).textContent).toContain('5 kiện');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết chuyến đi' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết hàng gửi hầm xe' })[0]);
    expect(screen.getByRole('dialog', { name: 'Chi tiết hàng gửi hầm xe' }).textContent).toContain('5 kiện');
  });

  it('does not invent a package count when cargo quantity is missing from the draft', async () => {
    configureVietQr();
    savePaymentDraft('DGD-TEST-4201', {
      luggage: {
        fee: 0,
        weight: 10,
        items: [{ id: 'cargo-1', type: 'Vali', weight: 10 }],
      },
    });
    fetchMock.mockResolvedValue(jsonResponse(bookingDetail()));

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByText('Chưa rõ số kiện')).toBeTruthy();
    expect(screen.queryByText('1 kiện')).toBeNull();
  });

  it('keeps the canonical SePay reference identical in QR and displayed transfer content', async () => {
    const orderCode = 'FUTAGD29612020BAC94BCEA507A24A8D759B';
    savePaymentDraft(orderCode);
    configureVietQr();
    fetchMock.mockResolvedValue(jsonResponse(bookingDetail({ orderCode })));
    render(<PaymentPage />);
    await flushPromises();
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

  it('does not query the API or render a QR when the draft has no valid booking id', async () => {
    configureVietQr();
    const key = `${PAYMENT_DRAFT_STORAGE_PREFIX}${draftId}`;
    const draft = JSON.parse(window.sessionStorage.getItem(key)!);
    draft.bookingId = 0;
    window.sessionStorage.setItem(key, JSON.stringify(draft));

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByRole('alert').textContent).toContain('Không thể xác minh');
    expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the backend payment deadline for the countdown and removes the QR after it expires', async () => {
    configureVietQr();
    const backendNow = Date.now();
    const paymentExpiresAt = new Date(backendNow + 3_000).toISOString();
    fetchMock
      .mockImplementationOnce(async () =>
        jsonResponse(bookingDetail({
          paymentExpiresAt,
          serverTime: new Date(Date.now()).toISOString(),
        })),
      )
      .mockImplementation(async () =>
        jsonResponse(bookingDetail({
          status: 'HET_HAN',
          paymentStatus: 'HET_HAN',
          paymentExpiresAt,
          serverTime: new Date(Date.now()).toISOString(),
        })),
      );

    render(<PaymentPage />);
    await flushPromises();
    expect(screen.getByText(/Thời gian thanh toán còn lại 00:0[23]/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeTruthy();

    await advanceTime(2_500);

    expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
    expect(screen.getByText(/đã hết hạn/i)).toBeTruthy();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('reads an account booking status with the authenticated customer token', async () => {
    configureVietQr();
    auth.isAuthenticated = true;
    fetchMock.mockResolvedValue(jsonResponse(bookingDetail()));

    render(<PaymentPage />);
    await flushPromises();

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
    fetchMock.mockResolvedValue(jsonResponse(bookingDetail({
      status: 'DA_THANH_TOAN',
      paymentStatus: 'DA_THANH_TOAN',
    })));

    render(<PaymentPage />);
    await flushPromises();

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

  it('keeps the booking pending until a later backend read confirms payment', async () => {
    configureVietQr();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(bookingDetail()))
      .mockResolvedValueOnce(jsonResponse(bookingDetail({
        status: 'DA_THANH_TOAN',
        paymentStatus: 'DA_THANH_TOAN',
      })));

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeTruthy();
    expect(routerPush).not.toHaveBeenCalled();

    await advanceTime(2_500);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith(`/invoice/${bookingId}`);
  });

  it('stays pending when the status endpoint returns an error', async () => {
    configureVietQr();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: 'Payment status unavailable' }),
    });

    render(<PaymentPage />);
    await flushPromises();
    await advanceTime(7_500);

    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Không thể xác minh');
    expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `/bookings/${bookingId}/detail`,
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('confirm-payment');
  });

  it.each([401, 403, 404, 500])(
    'keeps QR hidden when initial booking verification returns HTTP %s',
    async (status) => {
      configureVietQr();
      fetchMock.mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ message: 'Không thể xác minh booking' }),
      });

      render(<PaymentPage />);
      await flushPromises();
      await advanceTime(7_500);

      expect(screen.getByRole('alert').textContent).toContain('Không thể xác minh');
      expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
      expect(routerPush).not.toHaveBeenCalled();
    },
  );

  it('times out stalled reads and stops after the bounded initial retry budget', async () => {
    configureVietQr();
    fetchMock.mockImplementation((_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Request timed out', 'AbortError')),
          { once: true },
        );
      }),
    );

    render(<PaymentPage />);
    await advanceTime(40_000);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('alert').textContent).toContain('Không thể xác minh');
    expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('stops polling after the backend deadline when status reads fail and keeps the payment unverified', async () => {
    configureVietQr();
    const backendNow = Date.now();
    const paymentExpiresAt = new Date(backendNow + 3_000).toISOString();
    fetchMock
      .mockImplementationOnce(async () =>
        jsonResponse(bookingDetail({
          paymentExpiresAt,
          serverTime: new Date(Date.now()).toISOString(),
        })),
      )
      .mockRejectedValue(new Error('status endpoint unavailable'));

    render(<PaymentPage />);
    await flushPromises();
    await advanceTime(5_000);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('alert').textContent).toContain('Không thể xác minh');
    expect(
      screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' }),
    ).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();

    await advanceTime(10_000);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it.each(['DA_HUY', 'HET_HAN'])(
    'stops polling and removes the QR when backend status is %s',
    async (status) => {
      configureVietQr();
      fetchMock.mockResolvedValue(
        jsonResponse(bookingDetail({ status, paymentStatus: status })),
      );

      render(<PaymentPage />);
      await flushPromises();

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
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestSignal).toBeDefined();
    expect(requestSignal?.aborted).toBe(false);

    unmount();
    expect(requestSignal?.aborted).toBe(true);

    await advanceTime(7_500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it.each([
    ['another booking', { bookingId: 9999 }],
    ['another transfer reference', { orderCode: 'FUTAGD-OTHER' }],
    ['a different amount', { totalAmount: 125001 }],
    ['an incomplete deadline', { paymentExpiresAt: undefined }],
  ])('does not expose QR for backend data that has %s', async (_label, overrides) => {
    configureVietQr();
    fetchMock.mockResolvedValue(jsonResponse(bookingDetail(overrides)));

    render(<PaymentPage />);
    await flushPromises();

    expect(screen.getByRole('alert').textContent).toContain('Không thể xác minh');
    expect(screen.queryByRole('img', { name: 'Mã QR thanh toán VietQR' })).toBeNull();
    expect(screen.queryByText('DGD-TEST-4201')).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not navigate for a paid response whose booking identity does not match the draft', async () => {
    configureVietQr();
    fetchMock.mockResolvedValue(jsonResponse(bookingDetail({
      status: 'DA_THANH_TOAN',
      paymentStatus: 'DA_THANH_TOAN',
      orderCode: 'FUTAGD-OTHER',
    })));

    render(<PaymentPage />);
    await flushPromises();

    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Không thể xác minh');
  });
});


describe('G4 verified payment regression coverage', () => {
  it.each([
    { total: 0, cargo: 0, paid: true, qr: false },
    { total: 50000, cargo: 50000, paid: false, qr: true },
    { total: 0, cargo: 0, paid: false, qr: false },
  ])('handles free tickets with total=$total cargo=$cargo paid=$paid', async ({total, cargo, paid, qr}) => {
    configureVietQr();
    savePaymentDraft('DGD-TEST-4201', {totalFare: total});
    fetchMock.mockResolvedValue(jsonResponse(bookingDetail({
      totalAmount: total, originalTicketSubtotal: 125000, discountAmount: 125000,
      ticketSubtotal: 0, cargoFee: cargo, promotionCode: 'FREE-TICKET',
      status: paid ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN',
      paymentStatus: paid ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN',
    })));
    render(<PaymentPage />);
    await flushPromises();
    const image = screen.queryByRole('img', {name: 'Mã QR thanh toán VietQR'});
    expect(Boolean(image)).toBe(qr);
    if (qr) {
      expect(image?.getAttribute('src')).toContain('amount=50000');
      expect(screen.getAllByText('FREE-TICKET').length).toBeGreaterThan(0);
    }
    if (paid) expect(routerPush).toHaveBeenCalledExactlyOnceWith(`/invoice/${bookingId}`);
    else expect(routerPush).not.toHaveBeenCalled();
  });

  it.each([
    {orderCode: 'OTHER'}, {totalAmount: 1}, {bookingId: 999},
    {paymentExpiresAt: null}, {serverTime: 'invalid'},
  ])('rejects invalid booking snapshot %j', async (overrides) => {
    configureVietQr();
    fetchMock.mockResolvedValue(jsonResponse(bookingDetail(overrides)));
    render(<PaymentPage />);
    await flushPromises();
    expect(screen.queryByRole('img', {name: 'Mã QR thanh toán VietQR'})).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it.each([
    {paymentId: 999, shipmentId: 601},
    {paymentId: 801, shipmentId: 999},
    {paymentId: 801},
  ])('rejects authenticated shipment identity mismatch %j', async (identity) => {
    configureVietQr(); saveShipmentPaymentDraft(); auth.isAuthenticated = true;
    fetchMock.mockResolvedValue(jsonResponse({
      ...shipmentLookup(), provider: 'SEPAY', shipmentStatus: 'MOI_TAO', ...identity,
    }));
    render(<PaymentPage />); await flushPromises();
    expect(screen.queryByRole('img', {name: 'Mã QR thanh toán VietQR'})).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it.each([
    {status: 'HET_HAN', orderStatus: 'HET_HAN', paymentStatus: 'HET_HAN'},
    {status: 'DA_HUY', orderStatus: 'DA_HUY'},
    {paymentStatus: 'CAN_DOI_SOAT'},
    {waybillCode: 'OTHER'},
  ])('does not advertise payment or success for shipment %j', async (overrides) => {
    configureVietQr(); saveShipmentPaymentDraft();
    fetchMock.mockResolvedValue(jsonResponse(shipmentLookup(overrides)));
    render(<PaymentPage />); await flushPromises();
    expect(screen.queryByRole('img', {name: 'Mã QR thanh toán VietQR'})).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();
    if (overrides.paymentStatus === 'CAN_DOI_SOAT') {
      expect(screen.getByRole('status').textContent).toContain('đối soát');
    }
  });

  it('ignores a late response after changing the draft, including paid redirects', async () => {
    configureVietQr();
    let resolveOld!: (response: ReturnType<typeof jsonResponse>) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const view = render(<PaymentPage />); await flushPromises();
    const oldSignal = fetchMock.mock.calls[0][1].signal;
    saveShipmentPaymentDraft();
    fetchMock.mockResolvedValue(jsonResponse(shipmentLookup()));
    view.rerender(<PaymentPage />); await flushPromises();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld(jsonResponse(bookingDetail({status: 'DA_THANH_TOAN', paymentStatus: 'DA_THANH_TOAN'}))));
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole('img', {name: 'Mã QR thanh toán VietQR'}).getAttribute('src')).toContain('addInfo=VG-DH-TEST-701');
  });
});

it('routes a completed zero-value booking to invoice even without bank configuration', async () => {
  savePaymentDraft('DGD-TEST-4201', {totalFare: 0});
  fetchMock.mockResolvedValue(jsonResponse(bookingDetail({
    totalAmount: 0, status: 'DA_THANH_TOAN', paymentStatus: 'DA_THANH_TOAN',
  })));
  render(<PaymentPage />); await flushPromises();
  expect(routerPush).toHaveBeenCalledExactlyOnceWith(`/invoice/${bookingId}`);
  expect(screen.queryByRole('img', {name: 'Mã QR thanh toán VietQR'})).toBeNull();
});

it('rejects a timed-out response even when the transport ignores abort', async () => {
  configureVietQr();
  let resolveRead!: (response: ReturnType<typeof jsonResponse>) => void;
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveRead = resolve; }));
  render(<PaymentPage />); await flushPromises();
  await advanceTime(10_001);
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => resolveRead(jsonResponse(bookingDetail({status: 'DA_THANH_TOAN', paymentStatus: 'DA_THANH_TOAN'}))));
  expect(routerPush).not.toHaveBeenCalled();
  expect(screen.queryByRole('img', {name: 'Mã QR thanh toán VietQR'})).toBeNull();
});

it('uses server clock offset instead of browser time or draft timestamps', async () => {
  configureVietQr();
  const serverNow = Date.now() + 3_600_000;
  fetchMock.mockResolvedValue(jsonResponse(bookingDetail({
    serverTime: new Date(serverNow).toISOString(),
    paymentExpiresAt: new Date(serverNow + 60_000).toISOString(),
  })));
  render(<PaymentPage />); await flushPromises();
  expect(screen.getByText(/Thời gian thanh toán còn lại 01:00/)).toBeTruthy();
  expect(screen.getByRole('img', {name: 'Mã QR thanh toán VietQR'})).toBeTruthy();
});
