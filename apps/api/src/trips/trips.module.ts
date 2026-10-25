import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CargoCapacityModule } from '../cargo-capacity/cargo-capacity.module.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';
import { TripDepartureService } from './trip-departure.service.js';

@Module({
  imports: [PrismaModule, CargoCapacityModule, LocationsModule],
  controllers: [TripsController],
  providers: [TripsService, TripDepartureService],
  exports: [TripsService],
})
export class TripsModule {}
