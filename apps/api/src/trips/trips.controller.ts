import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { TripsService } from './trips.service.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('search')
  @OptionalAuth()
  search(@Query() query: SearchTripsDto) {
    return this.tripsService.search(query);
  }

  @Get(':id')
  @OptionalAuth()
  getDetails(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getDetails(id);
  }

  @Get(':id/seats')
  @OptionalAuth()
  getSeats(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getSeats(id);
  }
}
