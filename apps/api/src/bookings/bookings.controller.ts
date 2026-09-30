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

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

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

  @Get(':bookingId')
  async getBookingById(@Param('bookingId', ParseIntPipe) bookingId: number) {
    return this.bookingsService.getBookingById(bookingId);
  }

  @Get()
  async getMyBookings(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.bookingsService.getMyBookings({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
    });
  }
}
