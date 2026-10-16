import { IsOptional, IsString } from 'class-validator';

export class MomoWebhookDto {
  @IsOptional()
  @IsString()
  accessKey?: string;

  @IsOptional()
  @IsString()
  partnerCode?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  amount?: number | string;

  @IsOptional()
  @IsString()
  orderInfo?: string;

  @IsOptional()
  @IsString()
  orderType?: string;

  @IsOptional()
  transId?: number | string;

  @IsOptional()
  resultCode?: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  payType?: string;

  @IsOptional()
  responseTime?: number;

  @IsOptional()
  @IsString()
  extraData?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  paymentId?: number | string;
}

export class VnpayWebhookDto {
  @IsOptional()
  @IsString()
  vnp_TmnCode?: string;

  @IsOptional()
  @IsString()
  vnp_Amount?: string;

  @IsOptional()
  @IsString()
  vnp_BankCode?: string;

  @IsOptional()
  @IsString()
  vnp_BankTranNo?: string;

  @IsOptional()
  @IsString()
  vnp_CardType?: string;

  @IsOptional()
  @IsString()
  vnp_PayDate?: string;

  @IsOptional()
  @IsString()
  vnp_OrderInfo?: string;

  @IsOptional()
  @IsString()
  vnp_TransactionNo?: string;

  @IsOptional()
  @IsString()
  vnp_ResponseCode?: string;

  @IsOptional()
  @IsString()
  vnp_TransactionStatus?: string;

  @IsOptional()
  @IsString()
  vnp_TxnRef?: string;

  @IsOptional()
  @IsString()
  vnp_SecureHash?: string;

  @IsOptional()
  paymentId?: number | string;
}

export class ZaloPayWebhookDto {
  @IsOptional()
  @IsString()
  data?: string;

  @IsOptional()
  @IsString()
  mac?: string;

  @IsOptional()
  type?: number;

  @IsOptional()
  @IsString()
  app_trans_id?: string;

  @IsOptional()
  paymentId?: number | string;

  @IsOptional()
  amount?: number;
}
