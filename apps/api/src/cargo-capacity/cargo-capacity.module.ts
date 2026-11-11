import { Module } from '@nestjs/common';
import { CargoCapacityService } from './cargo-capacity.service.js';

@Module({
  providers: [CargoCapacityService],
  exports: [CargoCapacityService],
})
export class CargoCapacityModule {}
