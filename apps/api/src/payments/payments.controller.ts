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

@Public()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async createPayment(
    @Body() body: { bookingId: number | string; provider: string },
  ) {
    return this.paymentsService.createPayment(
      Number(body.bookingId),
      body.provider,
    );
  }

  @Get(':paymentId/status')
  async getPaymentStatus(
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.paymentsService.getPaymentStatus(paymentId);
  }

  @Get(':paymentId')
  async getPaymentById(
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.paymentsService.getPaymentById(paymentId);
  }

  @Post('momo/webhook')
  async momoWebhook(@Body() body: any) {
    return this.paymentsService.handleMomoWebhook(body);
  }

  @Post('vnpay/webhook')
  async vnpayWebhook(@Body() body: any) {
    return this.paymentsService.handleVnpayWebhook(body);
  }

  @Post('zalopay/webhook')
  async zalopayWebhook(@Body() body: any) {
    return this.paymentsService.handleZaloPayWebhook(body);
  }
}
