import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PaymentSettlementService } from './payment-settlement.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { RefundProcessorService } from './refund-processor.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentSettlementService,
    RefundProcessorService,
  ],
  exports: [PaymentsService, PaymentSettlementService, RefundProcessorService],
})
export class PaymentsModule {}
