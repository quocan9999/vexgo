import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { OptionalAuth, Public } from '../auth/decorators/public.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { BookingsService } from './bookings.service.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @OptionalAuth()
  async createBooking(
    @Body() body: CreateBookingDto,
    @CurrentPrincipal() principal?: AuthPrincipal,
  ) {
    const data = await this.bookingsService.createBooking(
      body,
      principal?.taiKhoanId,
    );
    return { data };
  }

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

  @Public()
  @Get(':bookingId/detail')
  findPublicBookingDetail(@Param('bookingId', ParseIntPipe) bookingId: number) {
    return this.bookingsService.findPublicBookingById(bookingId);
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
