import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { BookingsService } from './bookings.service.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  findCustomerBookings(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.findCustomerBookings(principal.taiKhoanId, query);
  }

  @Get(':bookingId')
  findCustomerBookingById(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.bookingsService.findCustomerBookingById(
      principal.taiKhoanId,
      bookingId,
    );
  }
}
