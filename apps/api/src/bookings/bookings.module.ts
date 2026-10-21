import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SeatHoldsModule } from '../seat-holds/seat-holds.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { CargoPricingModule } from '../cargo-pricing/cargo-pricing.module.js';
import { CargoCapacityModule } from '../cargo-capacity/cargo-capacity.module.js';
import { ShipmentsModule } from '../shipments/shipments.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { AdminBookingsController } from './admin-bookings.controller.js';
import { AdminBookingsService } from './admin-bookings.service.js';

@Module({
  imports: [
    PrismaModule,
    SeatHoldsModule,
    PromotionsModule,
    CargoPricingModule,
    CargoCapacityModule,
    ShipmentsModule,
  ],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService, AdminBookingsService],
  exports: [BookingsService, AdminBookingsService],
})
export class BookingsModule {}
