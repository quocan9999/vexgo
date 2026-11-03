import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import {
  MomoWebhookDto,
  VnpayWebhookDto,
  ZaloPayWebhookDto,
} from './dto/webhook.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('Thanh toán & Cổng thanh toán (Payments & Webhooks)')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Khởi tạo giao dịch thanh toán',
    description:
      'Tạo phiên thanh toán mới cho đơn đặt vé qua cổng MoMo, VNPay hoặc ZaloPay. Trả về URL thanh toán hoặc mã QR để chuyển hướng khách hàng.',
  })
  @ApiResponse({
    status: 201,
    description: 'Khởi tạo giao dịch thanh toán thành công, trả về thông tin URL thanh toán.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc đơn hàng không ở trạng thái chờ thanh toán.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy đơn đặt vé.',
    type: ApiErrorResponseDto,
  })
  async createPayment(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(
      dto.bookingId,
      dto.provider,
      principal,
    );
  }

  @Get(':paymentId/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Tra cứu trạng thái thanh toán',
    description:
      'Kiểm tra tình trạng thanh toán hiện tại của giao dịch (CHO_THANH_TOAN, THANH_CONG, THAT_BAI, HOAN_TIEN).',
  })
  @ApiParam({
    name: 'paymentId',
    type: Number,
    description: 'ID bản ghi thanh toán',
    example: 12,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy trạng thái thanh toán thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy thông tin giao dịch thanh toán.',
    type: ApiErrorResponseDto,
  })
  async getPaymentStatus(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.paymentsService.getPaymentStatus(paymentId, principal);
  }

  @Get(':paymentId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Chi tiết giao dịch thanh toán',
    description:
      'Xem thông tin chi tiết đầy đủ của giao dịch thanh toán bao gồm số tiền, phương thức, mã giao dịch nhà cung cấp và lịch sử xử lý.',
  })
  @ApiParam({
    name: 'paymentId',
    type: Number,
    description: 'ID bản ghi thanh toán',
    example: 12,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết thanh toán thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy giao dịch thanh toán.',
    type: ApiErrorResponseDto,
  })
  async getPaymentById(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.paymentsService.getPaymentById(paymentId, principal);
  }

  @Public()
  @Post('momo/webhook')
  @ApiOperation({
    summary: 'Webhook xử lý kết quả IPN từ MoMo',
    description:
      'Endpoint nhận thông báo kết quả giao dịch thanh toán tự động (IPN) từ cổng MoMo, xác minh chữ ký HMAC và hoàn tất đơn hàng.',
  })
  @ApiResponse({
    status: 200,
    description: 'Xử lý webhook MoMo thành công.',
  })
  async momoWebhook(@Body() body: MomoWebhookDto) {
    return this.paymentsService.handleMomoWebhook(body);
  }

  @Public()
  @Post('vnpay/webhook')
  @ApiOperation({
    summary: 'Webhook xử lý kết quả IPN từ VNPay',
    description:
      'Endpoint nhận thông báo kết quả giao dịch (IPN) từ cổng thanh toán VNPay, xác minh checksum SHA512 và cập nhật đơn vé.',
  })
  @ApiResponse({
    status: 200,
    description: 'Xử lý webhook VNPay thành công.',
  })
  async vnpayWebhook(@Body() body: VnpayWebhookDto) {
    return this.paymentsService.handleVnpayWebhook(body);
  }

  @Public()
  @Post('zalopay/webhook')
  @ApiOperation({
    summary: 'Webhook xử lý kết quả IPN từ ZaloPay',
    description:
      'Endpoint nhận thông báo thanh toán thành công từ ZaloPay Server qua cơ chế mã xác thực tin nhắn (MAC).',
  })
  @ApiResponse({
    status: 200,
    description: 'Xử lý webhook ZaloPay thành công.',
  })
  async zalopayWebhook(@Body() body: ZaloPayWebhookDto) {
    return this.paymentsService.handleZaloPayWebhook(body);
  }

  @Public()
  @Post('sepay-webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook nhận thông báo biến động số dư SePay',
    description:
      'Nhận webhook từ cổng thanh toán / ngân hàng SePay khi có chuyển khoản khớp nội dung đơn hàng, xác minh chữ ký bảo mật ở header.',
  })
  @ApiHeader({
    name: 'x-sepay-signature',
    required: false,
    description: 'Chữ ký HMAC bảo mật do SePay cung cấp để xác thực payload webhook',
  })
  @ApiHeader({
    name: 'x-sepay-timestamp',
    required: false,
    description: 'Timestamp thời điểm gửi webhook từ SePay',
  })
  @ApiResponse({
    status: 200,
    description: 'Xác nhận xử lý webhook SePay thành công ({ success: true }).',
  })
  async handleSepayWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Res() response: Response,
    @Headers('x-sepay-signature') signature?: string,
    @Headers('x-sepay-timestamp') timestamp?: string,
  ) {
    await this.paymentsService.handleSepayWebhook({
      rawBody: request.rawBody,
      signature,
      timestamp,
    });
    // SePay yêu cầu acknowledgment ở cấp ngoài, không dùng envelope REST của ứng dụng.
    response.status(HttpStatus.OK).json({ success: true });
  }
}
