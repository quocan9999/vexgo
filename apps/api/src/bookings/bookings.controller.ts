import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentPrincipal,
  OptionalPrincipal,
} from '../auth/decorators/current-principal.decorator.js';
import { OptionalAuth, Public } from '../auth/decorators/public.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { BookingsService } from './bookings.service.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';
import { BookingQuoteDto } from './dto/booking-quote.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

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
  ) {
    return this.bookingsService.findPublicBookingById(bookingId, principal);
  }

  @Public()
  @Post(':bookingId/confirm-payment')
  async confirmPayment(
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() body?: { paymentMethod?: string },
  ) {
    const data = await this.bookingsService.confirmBookingPayment(
      bookingId,
      body?.paymentMethod || 'CHUYEN_KHOAN',
    );
    return { data };
  }
}
