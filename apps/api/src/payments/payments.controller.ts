import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Public()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async createPayment(
    @Body() body: CreatePaymentDto,
    @Req() req: Request,
  ) {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    return this.paymentsService.createPayment(body, clientIp);
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

  // MoMo IPN Webhook
  @Post('momo/ipn')
  @HttpCode(HttpStatus.OK)
  async momoIpn(@Body() body: any) {
    return this.paymentsService.handleMomoIpn(body);
  }

  // Backward compatibility alias for MoMo webhook
  @Post('momo/webhook')
  @HttpCode(HttpStatus.OK)
  async momoWebhook(@Body() body: any) {
    return this.paymentsService.handleMomoIpn(body);
  }

  // VNPay IPN Webhook (server-to-server)
  @Get('vnpay/ipn')
  @HttpCode(HttpStatus.OK)
  async vnpayIpnGet(@Query() query: any) {
    return this.paymentsService.handleVnpayIpn(query);
  }

  @Post('vnpay/ipn')
  @HttpCode(HttpStatus.OK)
  async vnpayIpnPost(@Body() body: any, @Query() query: any) {
    return this.paymentsService.handleVnpayIpn(
      Object.keys(body || {}).length > 0 ? body : query,
    );
  }

  // Backward compatibility alias for VNPay webhook
  @Post('vnpay/webhook')
  @HttpCode(HttpStatus.OK)
  async vnpayWebhook(@Body() body: any, @Query() query: any) {
    return this.paymentsService.handleVnpayIpn(
      Object.keys(body || {}).length > 0 ? body : query,
    );
  }

  // VNPay Return URL (browser redirect after payment)
  @Get('vnpay/return')
  async vnpayReturn(@Query() query: any) {
    return this.paymentsService.handleVnpayReturn(query);
  }
}
