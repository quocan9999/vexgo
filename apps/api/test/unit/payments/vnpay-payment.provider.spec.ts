import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { VnpayPaymentProvider } from '../../../src/payments/providers/vnpay-payment.provider.js';
import type { ConfigService } from '@nestjs/config';

describe('VnpayPaymentProvider', () => {
  const tmnCode = 'CGXZLS0Z';
  const hashSecret = 'XNBCJFAKAZQSGTARRLGCHVZWCIOIGSHN';
  const vnpUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

  const config = {
    get: vi.fn((key: string) => {
      if (key === 'VNPAY_TMN_CODE') return tmnCode;
      if (key === 'VNPAY_HASH_SECRET') return hashSecret;
      if (key === 'VNPAY_URL') return vnpUrl;
      return null;
    }),
  } as unknown as ConfigService;

  let provider: VnpayPaymentProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new VnpayPaymentProvider(config);
  });

  describe('createPayment', () => {
    it('generates valid VNPay redirect URL with secure hash', async () => {
      const result = await provider.createPayment({
        paymentId: 201,
        amount: 280000,
        orderInfo: 'Thanh toan ve',
        returnUrl: 'http://localhost:3000/booking/success',
        clientIp: '127.0.0.1',
      });

      expect(result.paymentUrl).toContain(vnpUrl);
      expect(result.paymentUrl).toContain('vnp_TmnCode=' + tmnCode);
      expect(result.paymentUrl).toContain('vnp_Amount=28000000'); // 280000 * 100
      expect(result.paymentUrl).toContain('vnp_CurrCode=VND');
      expect(result.paymentUrl).toContain('vnp_Command=pay');
      expect(result.paymentUrl).toContain('vnp_SecureHash=');
      expect(result.providerTransactionId).toContain('201_');
    });
  });

  describe('verifyIpn', () => {
    it('verifies valid VNPay IPN with SHA512 hash and vnp_ResponseCode = 00', async () => {
      const rawParams: Record<string, string> = {
        vnp_Amount: '28000000',
        vnp_BankCode: 'NCB',
        vnp_CardType: 'ATM',
        vnp_OrderInfo: 'Thanh toan ve',
        vnp_PayDate: '20261006163000',
        vnp_ResponseCode: '00',
        vnp_TmnCode: tmnCode,
        vnp_TransactionNo: '14567890',
        vnp_TransactionStatus: '00',
        vnp_TxnRef: '201_1728213000000',
      };

      // Generate SHA512 hash
      const sortedKeys = Object.keys(rawParams).sort();
      const signData = sortedKeys
        .map(
          (k) =>
            `${k}=${encodeURIComponent(rawParams[k]).replace(/%20/g, '+')}`,
        )
        .join('&');

      const vnp_SecureHash = crypto
        .createHmac('sha512', hashSecret)
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      const payload = {
        ...rawParams,
        vnp_SecureHash,
        vnp_SecureHashType: 'SHA512',
      };

      const result = await provider.verifyIpn(payload);

      expect(result.isValid).toBe(true);
      expect(result.isSuccess).toBe(true);
      expect(result.paymentId).toBe(201);
      expect(result.amount).toBe(280000);
      expect(result.transactionNo).toBe('14567890');
    });

    it('rejects IPN when hash is invalid/tampered', async () => {
      const payload = {
        vnp_Amount: '28000000',
        vnp_ResponseCode: '00',
        vnp_TxnRef: '201_123',
        vnp_SecureHash: 'tampered_hash_12345',
      };

      const result = await provider.verifyIpn(payload);

      expect(result.isValid).toBe(false);
      expect(result.isSuccess).toBe(false);
    });

    it('rejects IPN when responseCode is not 00', async () => {
      const rawParams: Record<string, string> = {
        vnp_Amount: '28000000',
        vnp_ResponseCode: '24', // User cancelled
        vnp_TmnCode: tmnCode,
        vnp_TxnRef: '201_123',
      };

      const sortedKeys = Object.keys(rawParams).sort();
      const signData = sortedKeys
        .map(
          (k) =>
            `${k}=${encodeURIComponent(rawParams[k]).replace(/%20/g, '+')}`,
        )
        .join('&');

      const vnp_SecureHash = crypto
        .createHmac('sha512', hashSecret)
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      const result = await provider.verifyIpn({
        ...rawParams,
        vnp_SecureHash,
      });

      expect(result.isValid).toBe(true);
      expect(result.isSuccess).toBe(false); // responseCode != 00
    });
  });
});
