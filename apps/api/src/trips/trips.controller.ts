import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { TripsService } from './trips.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Public()
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('search')
  async searchTrips(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('departureDate') departureDate?: string,
    @Query('busCompanyId') busCompanyId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.tripsService.searchTrips({
      from,
      to,
      departureDate,
      busCompanyId: busCompanyId ? Number(busCompanyId) : undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
    });
  }

  @Get(':tripId')
  async getTripDetail(@Param('tripId', ParseIntPipe) tripId: number) {
    return this.tripsService.getTripDetail(tripId);
  }

  @Get(':tripId/seats')
  async getTripSeats(@Param('tripId', ParseIntPipe) tripId: number) {
    return this.tripsService.getTripSeats(tripId);
  }

  @Get(':tripId/alternatives')
  async getTripAlternatives(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Query('limit') limit?: string,
  ) {
    return this.tripsService.getTripAlternatives(
      tripId,
      limit ? Number(limit) : 5,
    );
  }
}
