import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PaymentSettlementService } from './payment-settlement.service.js';
import { RefundProcessorService } from './refund-processor.service.js';

@Module({
  imports: [PrismaModule],
  providers: [PaymentSettlementService, RefundProcessorService],
  exports: [PaymentSettlementService, RefundProcessorService],
})
export class PaymentsModule {}
