import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { RefundProcessorService } from './refund-processor.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RefundProcessorService],
  exports: [PaymentsService, RefundProcessorService],
})
export class PaymentsModule {}
