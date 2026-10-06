import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import type {
  PaymentProvider,
  CreatePaymentParams,
  CreatePaymentResult,
  VerifyIpnResult,
} from './payment-provider.interface.js';

@Injectable()
export class VnpayPaymentProvider implements PaymentProvider {
  readonly name = 'VNPAY';
  private readonly logger = new Logger(VnpayPaymentProvider.name);

  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly vnpUrl: string;

  constructor(private readonly config: ConfigService) {
    this.tmnCode =
      this.config.get<string>('VNPAY_TMN_CODE') || 'CGXZLS0Z';
    this.hashSecret =
      this.config.get<string>('VNPAY_HASH_SECRET') ||
      'XNBCJFAKAZQSGTARRLGCHVZWCIOIGSHN';
    this.vnpUrl =
      this.config.get<string>('VNPAY_URL') ||
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  }

  private sortParams(params: Record<string, any>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(params).sort();
    for (const key of keys) {
      const val = params[key];
      if (val !== null && val !== undefined && val !== '') {
        sorted[key] = encodeURIComponent(String(val)).replace(/%20/g, '+');
      }
    }
    return sorted;
  }

  private formatVnpayDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
  }

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult> {
    const now = new Date();
    const createDate = this.formatVnpayDate(now);
    const orderId = String(params.paymentId);
    // VNPay txnRef can include timestamp for uniqueness on retries
    const txnRef = `${orderId}_${now.getTime()}`;
    const amount = Math.round(params.amount) * 100; // VNPay multiplies by 100
    const orderInfo =
      params.orderInfo || `Thanh toan ve xe VexGo #${orderId}`;
    const returnUrl =
      params.returnUrl || 'http://localhost:3000/booking/success';
    const clientIp = params.clientIp || '127.0.0.1';

    const vnpParams: Record<string, any> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: amount,
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: clientIp,
      vnp_CreateDate: createDate,
    };

    const sorted = this.sortParams(vnpParams);
    const signData = Object.entries(sorted)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const secureHash = crypto
      .createHmac('sha512', this.hashSecret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    const paymentUrl = `${this.vnpUrl}?${signData}&vnp_SecureHash=${secureHash}`;

    this.logger.log(
      `Generated VNPay Sandbox URL for payment #${orderId}, amount: ${params.amount} VND`,
    );

    return {
      paymentUrl,
      providerTransactionId: txnRef,
    };
  }

  async verifyIpn(payload: any): Promise<VerifyIpnResult> {
    const query = { ...payload };
    const secureHash = query.vnp_SecureHash;

    delete query.vnp_SecureHash;
    delete query.vnp_SecureHashType;

    if (!secureHash) {
      return {
        isValid: false,
        isSuccess: false,
        paymentId: 0,
        amount: 0,
        message: 'Missing vnp_SecureHash in VNPay payload',
      };
    }

    const sorted = this.sortParams(query);
    const signData = Object.entries(sorted)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const expectedHash = crypto
      .createHmac('sha512', this.hashSecret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    const isValid =
      expectedHash.toLowerCase() === String(secureHash).toLowerCase();

    const rawTxnRef = String(query.vnp_TxnRef || '');
    const paymentId = Number(rawTxnRef.split('_')[0]) || 0;
    const amount = Number(query.vnp_Amount) / 100 || 0;
    const isSuccess = isValid && query.vnp_ResponseCode === '00';

    return {
      isValid,
      isSuccess,
      paymentId,
      amount,
      transactionNo: query.vnp_TransactionNo
        ? String(query.vnp_TransactionNo)
        : undefined,
      message: query.vnp_OrderInfo || undefined,
    };
  }
}
