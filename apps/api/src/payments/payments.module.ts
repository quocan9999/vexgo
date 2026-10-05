import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RefundProcessorService } from './refund-processor.service.js';

@Module({
  imports: [PrismaModule],
  providers: [RefundProcessorService],
  exports: [RefundProcessorService],
})
export class PaymentsModule {}
