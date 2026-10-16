const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export type PaymentStatusData = {
  paymentId: number;
  bookingId: number;
  orderId: number;
  orderCode: string | null;
  orderStatus: string | null;
  shipmentId: number | null;
  shipmentStatus: string | null;
  provider: string;
  amount: number | string;
  status: 'SUCCESS' | 'PENDING' | 'EXPIRED' | 'FAILED' | string;
  paymentStatus: string;
  paymentExpiresAt: string | null;
  serverTime: string;
};

export const paymentsApi = {
  async getPaymentStatus(
    paymentId: number,
    options: { accessToken?: string; signal?: AbortSignal } = {},
  ): Promise<{ data: PaymentStatusData }> {
    if (!Number.isSafeInteger(paymentId) || paymentId <= 0) {
      throw new Error('Mã thanh toán không hợp lệ.');
    }

    const headers: Record<string, string> = {};
    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/status`, {
      headers,
      signal: options.signal,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof body.message === 'string'
        ? body.message
        : 'Không thể kiểm tra trạng thái thanh toán.';
      throw new Error(message);
    }

    return { data: (body.data ?? body) as PaymentStatusData };
  },
};
