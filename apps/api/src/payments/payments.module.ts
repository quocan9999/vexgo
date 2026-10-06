import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { RefundProcessorService } from './refund-processor.service.js';
import { MomoPaymentProvider } from './providers/momo-payment.provider.js';
import { VnpayPaymentProvider } from './providers/vnpay-payment.provider.js';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    RefundProcessorService,
    MomoPaymentProvider,
    VnpayPaymentProvider,
  ],
  exports: [
    PaymentsService,
    RefundProcessorService,
    MomoPaymentProvider,
    VnpayPaymentProvider,
  ],
})
export class PaymentsModule {}
