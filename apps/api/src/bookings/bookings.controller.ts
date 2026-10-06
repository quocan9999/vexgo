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
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Public()
  @Post('quote')
  async getBookingQuote(
    @Body()
    body: {
      tripId: number | string;
      seatIds: Array<number | string>;
      promotionCode?: string;
    },
  ) {
    return this.bookingsService.getBookingQuote(
      Number(body.tripId),
      (body.seatIds || []).map(Number),
      body.promotionCode,
    );
  }

  @Public()
  @Post()
  async createBooking(
    @Body()
    body: {
      tripId: number | string;
      seatIds: Array<number | string>;
      pickupPoint: string;
      dropoffPoint: string;
      contact: { fullName: string; phone: string; email?: string };
      promotionCode?: string;
      holdToken?: string;
    },
  ) {
    return this.bookingsService.createBooking({
      tripId: Number(body.tripId),
      seatIds: (body.seatIds || []).map(Number),
      pickupPoint: body.pickupPoint,
      dropoffPoint: body.dropoffPoint,
      contact: body.contact,
      promotionCode: body.promotionCode,
      holdToken: body.holdToken,
    });
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
