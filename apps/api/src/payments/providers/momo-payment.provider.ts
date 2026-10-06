import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import type {
  PaymentProvider,
  CreatePaymentParams,
  CreatePaymentResult,
  VerifyIpnResult,
} from './payment-provider.interface.js';

@Injectable()
export class MomoPaymentProvider implements PaymentProvider {
  readonly name = 'MOMO';
  private readonly logger = new Logger(MomoPaymentProvider.name);

  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    this.partnerCode =
      this.config.get<string>('MOMO_PARTNER_CODE') || 'MOMO';
    this.accessKey =
      this.config.get<string>('MOMO_ACCESS_KEY') || 'F8BBA842ECF85';
    this.secretKey =
      this.config.get<string>('MOMO_SECRET_KEY') ||
      'K951B6PE1wa8ngf4S01072xAw0nzYmSM';
    this.endpoint =
      this.config.get<string>('MOMO_ENDPOINT') ||
      'https://test-payment.momo.vn/v2/gateway/api/create';
  }

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult> {
    const orderId = String(params.paymentId);
    const requestId = `${orderId}_${Date.now()}`;
    const amount = Math.round(params.amount);
    const orderInfo = params.orderInfo || `Thanh toan ve xe VexGo #${orderId}`;
    const redirectUrl =
      params.returnUrl || 'http://localhost:3000/booking/success';
    const ipnUrl =
      params.ipnUrl || 'http://localhost:4000/api/v1/payments/momo/ipn';
    const extraData = params.extraData || '';
    const requestType = 'captureWallet';

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode: this.partnerCode,
      partnerName: 'VexGo Bus Lines',
      storeId: 'VexGo_Store',
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: 'vi',
      extraData,
      requestType,
      signature,
    };

    this.logger.log(
      `Calling MoMo Sandbox for payment #${orderId}, amount: ${amount} VND`,
    );

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10000), // 10s timeout per Rule 29
      });

      if (!response.ok) {
        throw new Error(
          `MoMo gateway responded with HTTP status ${response.status}`,
        );
      }

      const data = (await response.json()) as any;

      if (data.resultCode !== 0) {
        this.logger.error(
          `MoMo error response for #${orderId}: [code=${data.resultCode}] ${data.message}`,
        );
        throw new BadGatewayException({
          statusCode: 502,
          error: 'PAYMENT_PROVIDER_ERROR',
          message: data.message || 'Lỗi xử lý từ cổng thanh toán MoMo.',
        });
      }

      return {
        paymentUrl: data.payUrl,
        qrCodeUrl: data.qrCodeUrl,
        deeplink: data.deeplink,
        providerTransactionId: data.requestId,
      };
    } catch (err: any) {
      if (err instanceof BadGatewayException) {
        throw err;
      }
      this.logger.error(`MoMo connection failure: ${err.message}`);
      throw new BadGatewayException({
        statusCode: 502,
        error: 'PAYMENT_PROVIDER_ERROR',
        message: 'Không thể kết nối cổng thanh toán MoMo. Vui lòng thử lại.',
      });
    }
  }

  async verifyIpn(payload: any): Promise<VerifyIpnResult> {
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = payload || {};

    if (!signature || !orderId) {
      return {
        isValid: false,
        isSuccess: false,
        paymentId: Number(orderId) || 0,
        amount: Number(amount) || 0,
        message: 'Missing signature or orderId in MoMo IPN',
      };
    }

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData || ''}&message=${message || ''}&orderId=${orderId}&orderInfo=${orderInfo || ''}&orderType=${orderType || ''}&partnerCode=${partnerCode || this.partnerCode}&payType=${payType || ''}&requestId=${requestId || ''}&responseTime=${responseTime || ''}&resultCode=${resultCode}&transId=${transId || ''}`;

    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    const isValid = expectedSignature === signature;
    const isSuccess = isValid && Number(resultCode) === 0;

    return {
      isValid,
      isSuccess,
      paymentId: Number(orderId),
      amount: Number(amount),
      transactionNo: transId ? String(transId) : undefined,
      message: message || undefined,
    };
  }
}
