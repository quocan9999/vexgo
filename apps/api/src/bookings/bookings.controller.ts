import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { BookingsService } from './bookings.service.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';
import { BookingQuoteDto } from './dto/booking-quote.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Public()
  @Post('quote')
  async getBookingQuote(@Body() dto: BookingQuoteDto) {
    return this.bookingsService.getBookingQuote(
      dto.tripId,
      dto.seatIds,
      dto.promotionCode,
    );
  }

  @Post()
  async createBooking(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(principal, dto);
  }

  @Get()
  findCustomerBookings(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.findCustomerBookings(
      principal.taiKhoanId,
      query,
    );
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
