import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SeatHoldsController } from './seat-holds.controller.js';
import { SeatHoldsService } from './seat-holds.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [SeatHoldsController],
  providers: [SeatHoldsService],
  exports: [SeatHoldsService],
})
export class SeatHoldsModule {}
