import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentPrincipal,
  OptionalPrincipal,
} from '../auth/decorators/current-principal.decorator.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { BookingsService } from './bookings.service.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';
import { BookingQuoteDto } from './dto/booking-quote.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @OptionalAuth()
  @Post('quote')
  async getBookingQuote(
    @Body() dto: BookingQuoteDto,
    @OptionalPrincipal() principal?: AuthPrincipal,
  ) {
    const data = await this.bookingsService.getBookingQuote(
      dto.tripId,
      dto.seatIds,
      dto.promotionCode,
      dto.contactPhone,
      principal,
    );
    return { data };
  }

  @Post()
  @OptionalAuth()
  async createBooking(
    @Body() dto: CreateBookingDto,
    @OptionalPrincipal() principal?: AuthPrincipal,
  ) {
    const data = await this.bookingsService.createBooking(dto, principal);
    return { data };
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

  @OptionalAuth()
  @Get(':bookingId/detail')
  findPublicBookingDetail(
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @OptionalPrincipal() principal?: AuthPrincipal,
    @Headers('x-booking-code') bookingCode?: string,
    @Headers('x-booking-phone') phoneNumber?: string,
  ) {
    return this.bookingsService.findPublicBookingById(
      bookingId,
      principal,
      bookingCode,
      phoneNumber,
    );
  }
}
