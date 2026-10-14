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
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import {
  MomoWebhookDto,
  VnpayWebhookDto,
  ZaloPayWebhookDto,
} from './dto/webhook.dto.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
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
  async getPaymentStatus(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.paymentsService.getPaymentStatus(paymentId, principal);
  }

  @Get(':paymentId')
  async getPaymentById(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.paymentsService.getPaymentById(paymentId, principal);
  }

  @Public()
  @Post('momo/webhook')
  async momoWebhook(@Body() body: MomoWebhookDto) {
    return this.paymentsService.handleMomoWebhook(body);
  }

  @Public()
  @Post('vnpay/webhook')
  async vnpayWebhook(@Body() body: VnpayWebhookDto) {
    return this.paymentsService.handleVnpayWebhook(body);
  }

  @Public()
  @Post('zalopay/webhook')
  async zalopayWebhook(@Body() body: ZaloPayWebhookDto) {
    return this.paymentsService.handleZaloPayWebhook(body);
  }

  @Public()
  @Post('sepay-webhook')
  @HttpCode(HttpStatus.OK)
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
