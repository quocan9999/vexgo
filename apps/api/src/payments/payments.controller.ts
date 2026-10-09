import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
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
}
