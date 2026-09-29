import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { TripsService } from './trips.service.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('search')
  search(@Query() query: SearchTripsDto) {
    return this.tripsService.search(query);
  }

  @Get(':id')
  getDetails(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getDetails(id);
  }

  @Get(':id/seats')
  getSeats(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getSeats(id);
  }
}
