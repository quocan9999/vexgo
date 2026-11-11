import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MomoWebhookDto {
  @ApiPropertyOptional({ description: 'Mã Access Key của MoMo', example: 'klmno...' })
  @IsOptional()
  @IsString()
  accessKey?: string;

  @ApiPropertyOptional({ description: 'Mã đối tác MoMo', example: 'MOMOBKUN20180529' })
  @IsOptional()
  @IsString()
  partnerCode?: string;

  @ApiPropertyOptional({ description: 'Mã đơn hàng phía VexGo gửi sang MoMo', example: 'MM_171123456789' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Mã yêu cầu giao dịch', example: 'REQ_171123456789' })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ description: 'Số tiền thanh toán', example: 250000 })
  @IsOptional()
  amount?: number | string;

  @ApiPropertyOptional({ description: 'Thông tin đơn hàng', example: 'Thanh toan ve xe VexGo' })
  @IsOptional()
  @IsString()
  orderInfo?: string;

  @ApiPropertyOptional({ description: 'Loại đơn hàng', example: 'momo_wallet' })
  @IsOptional()
  @IsString()
  orderType?: string;

  @ApiPropertyOptional({ description: 'Mã giao dịch MoMo', example: 23000012345 })
  @IsOptional()
  transId?: number | string;

  @ApiPropertyOptional({ description: 'Mã kết quả giao dịch (0 là thành công)', example: 0 })
  @IsOptional()
  resultCode?: number;

  @ApiPropertyOptional({ description: 'Thông báo kết quả giao dịch', example: 'Thành công.' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Phương thức thanh toán MoMo', example: 'qr' })
  @IsOptional()
  @IsString()
  payType?: string;

  @ApiPropertyOptional({ description: 'Thời gian phản hồi (timestamp)', example: 1711234567890 })
  @IsOptional()
  responseTime?: number;

  @ApiPropertyOptional({ description: 'Dữ liệu kèm theo bổ sung' })
  @IsOptional()
  @IsString()
  extraData?: string;

  @ApiPropertyOptional({ description: 'Chữ ký số xác thực HMAC-SHA256 từ MoMo' })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional({ description: 'ID bản ghi thanh toán nội bộ VexGo', example: 12 })
  @IsOptional()
  paymentId?: number | string;
}

export class VnpayWebhookDto {
  @ApiPropertyOptional({ description: 'Mã website của merchant trên hệ thống VNPay', example: 'VEXGO001' })
  @IsOptional()
  @IsString()
  vnp_TmnCode?: string;

  @ApiPropertyOptional({ description: 'Số tiền thanh toán (nhân 100 theo chuẩn VNPay)', example: '25000000' })
  @IsOptional()
  @IsString()
  vnp_Amount?: string;

  @ApiPropertyOptional({ description: 'Mã ngân hàng thanh toán', example: 'NCB' })
  @IsOptional()
  @IsString()
  vnp_BankCode?: string;

  @ApiPropertyOptional({ description: 'Mã giao dịch tại ngân hàng', example: 'VNP12345678' })
  @IsOptional()
  @IsString()
  vnp_BankTranNo?: string;

  @ApiPropertyOptional({ description: 'Loại thẻ/tài khoản', example: 'ATM' })
  @IsOptional()
  @IsString()
  vnp_CardType?: string;

  @ApiPropertyOptional({ description: 'Thời gian thanh toán (yyyyMMddHHmmss)', example: '20261030180000' })
  @IsOptional()
  @IsString()
  vnp_PayDate?: string;

  @ApiPropertyOptional({ description: 'Nội dung thanh toán', example: 'Thanh toan ve xe VexGo' })
  @IsOptional()
  @IsString()
  vnp_OrderInfo?: string;

  @ApiPropertyOptional({ description: 'Mã giao dịch trên cổng VNPay', example: '14523678' })
  @IsOptional()
  @IsString()
  vnp_TransactionNo?: string;

  @ApiPropertyOptional({ description: 'Mã phản hồi kết quả (00 là thành công)', example: '00' })
  @IsOptional()
  @IsString()
  vnp_ResponseCode?: string;

  @ApiPropertyOptional({ description: 'Trạng thái giao dịch VNPay (00 là thành công)', example: '00' })
  @IsOptional()
  @IsString()
  vnp_TransactionStatus?: string;

  @ApiPropertyOptional({ description: 'Mã tham chiếu giao dịch (TxnRef) do VexGo sinh', example: 'VN1711234567' })
  @IsOptional()
  @IsString()
  vnp_TxnRef?: string;

  @ApiPropertyOptional({ description: 'Chữ ký kiểm tra tính toàn vẹn (HMAC-SHA512)' })
  @IsOptional()
  @IsString()
  vnp_SecureHash?: string;

  @ApiPropertyOptional({ description: 'ID bản ghi thanh toán nội bộ VexGo', example: 12 })
  @IsOptional()
  paymentId?: number | string;
}

export class ZaloPayWebhookDto {
  @ApiPropertyOptional({ description: 'Dữ liệu JSON chứa thông tin giao dịch ZaloPay' })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiPropertyOptional({ description: 'Mã xác thực chữ ký (MAC)' })
  @IsOptional()
  @IsString()
  mac?: string;

  @ApiPropertyOptional({ description: 'Loại sự kiện callback (thường là 1 cho thanh toán đơn)', example: 1 })
  @IsOptional()
  type?: number;

  @ApiPropertyOptional({ description: 'Mã giao dịch ứng dụng', example: '240501_12345' })
  @IsOptional()
  @IsString()
  app_trans_id?: string;

  @ApiPropertyOptional({ description: 'ID bản ghi thanh toán nội bộ VexGo', example: 12 })
  @IsOptional()
  paymentId?: number | string;

  @ApiPropertyOptional({ description: 'Số tiền thanh toán', example: 250000 })
  @IsOptional()
  amount?: number;
}
