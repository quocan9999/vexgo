import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PaymentsController } from './payments.controller.js';
import { RefundProcessorService } from './refund-processor.service.js';

@Module({
  imports: [PrismaModule, BookingsModule],
  controllers: [PaymentsController],
  providers: [RefundProcessorService],
  exports: [RefundProcessorService],
})
export class PaymentsModule {}

