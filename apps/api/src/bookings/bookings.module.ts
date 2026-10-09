import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { AdminBookingsController } from './admin-bookings.controller.js';
import { AdminBookingsService } from './admin-bookings.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService, AdminBookingsService],
  exports: [BookingsService, AdminBookingsService],
})
export class BookingsModule {}
