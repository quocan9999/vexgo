import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { MomoPaymentProvider } from '../../../src/payments/providers/momo-payment.provider.js';
import type { ConfigService } from '@nestjs/config';

describe('MomoPaymentProvider', () => {
  const secretKey = 'K951B6PE1wa8ngf4S01072xAw0nzYmSM';
  const partnerCode = 'MOMO';
  const accessKey = 'F8BBA842ECF85';

  const config = {
    get: vi.fn((key: string) => {
      if (key === 'MOMO_PARTNER_CODE') return partnerCode;
      if (key === 'MOMO_ACCESS_KEY') return accessKey;
      if (key === 'MOMO_SECRET_KEY') return secretKey;
      if (key === 'MOMO_ENDPOINT')
        return 'https://test-payment.momo.vn/v2/gateway/api/create';
      return null;
    }),
  } as unknown as ConfigService;

  let provider: MomoPaymentProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MomoPaymentProvider(config);
  });

  describe('createPayment', () => {
    it('calls MoMo endpoint and returns payUrl on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resultCode: 0,
          message: 'Thành công.',
          payUrl: 'https://test-payment.momo.vn/v2/gateway/pay?s=123',
          qrCodeUrl: 'https://test-payment.momo.vn/qr/123',
          deeplink: 'momo://app?123',
          requestId: 'REQ_123',
        }),
      });
      globalThis.fetch = mockFetch;

      const result = await provider.createPayment({
        paymentId: 101,
        amount: 250000,
        orderInfo: 'Thanh toan ve',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.paymentUrl).toBe(
        'https://test-payment.momo.vn/v2/gateway/pay?s=123',
      );
      expect(result.qrCodeUrl).toBe('https://test-payment.momo.vn/qr/123');
      expect(result.deeplink).toBe('momo://app?123');
    });

    it('throws BadGatewayException when MoMo returns non-zero resultCode', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resultCode: 99,
          message: 'Lỗi xác thực chữ ký.',
        }),
      });

      await expect(
        provider.createPayment({
          paymentId: 102,
          amount: 250000,
          orderInfo: 'Thanh toan',
        }),
      ).rejects.toThrow();
    });
  });

  describe('verifyIpn', () => {
    it('verifies valid MoMo IPN signature with resultCode = 0', async () => {
      const payload = {
        partnerCode,
        orderId: '101',
        requestId: 'REQ_101',
        amount: 250000,
        orderInfo: 'Thanh toan',
        orderType: 'momo_wallet',
        transId: 998877,
        resultCode: 0,
        message: 'Thành công.',
        payType: 'qr',
        responseTime: 1700000000000,
        extraData: '',
      };

      const rawSignature = `accessKey=${accessKey}&amount=${payload.amount}&extraData=${payload.extraData}&message=${payload.message}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}&orderType=${payload.orderType}&partnerCode=${payload.partnerCode}&payType=${payload.payType}&requestId=${payload.requestId}&responseTime=${payload.responseTime}&resultCode=${payload.resultCode}&transId=${payload.transId}`;
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');

      const result = await provider.verifyIpn({
        ...payload,
        signature,
      });

      expect(result.isValid).toBe(true);
      expect(result.isSuccess).toBe(true);
      expect(result.paymentId).toBe(101);
      expect(result.amount).toBe(250000);
      expect(result.transactionNo).toBe('998877');
    });

    it('rejects IPN with tampered signature', async () => {
      const result = await provider.verifyIpn({
        partnerCode,
        orderId: '101',
        requestId: 'REQ_101',
        amount: 250000,
        signature: 'invalid-tampered-signature',
      });

      expect(result.isValid).toBe(false);
      expect(result.isSuccess).toBe(false);
    });
  });
});
