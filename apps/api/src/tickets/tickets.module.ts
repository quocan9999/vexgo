import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { AdminTicketsController } from './admin-tickets.controller.js';
import { AdminTicketsService } from './admin-tickets.service.js';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [TicketsController, AdminTicketsController],
  providers: [TicketsService, AdminTicketsService],
  exports: [TicketsService, AdminTicketsService],
})
export class TicketsModule {}
