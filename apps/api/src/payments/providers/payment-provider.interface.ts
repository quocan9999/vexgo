export interface CreatePaymentParams {
  paymentId: number;
  amount: number;
  orderInfo: string;
  returnUrl?: string;
  ipnUrl?: string;
  clientIp?: string;
  extraData?: string;
}

export interface CreatePaymentResult {
  paymentUrl: string;
  qrCodeUrl?: string;
  deeplink?: string;
  providerTransactionId?: string;
}

export interface VerifyIpnResult {
  isValid: boolean;
  isSuccess: boolean;
  paymentId: number;
  amount: number;
  transactionNo?: string;
  message?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  verifyIpn(payload: any): Promise<VerifyIpnResult>;
}
