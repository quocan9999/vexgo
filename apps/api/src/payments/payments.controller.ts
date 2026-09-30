import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';

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
}
