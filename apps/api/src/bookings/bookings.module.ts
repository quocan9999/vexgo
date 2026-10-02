import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FarePricesModule } from '../fare-prices/fare-prices.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { SeatHoldsModule } from '../seat-holds/seat-holds.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [PrismaModule, FarePricesModule, PromotionsModule, SeatHoldsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
