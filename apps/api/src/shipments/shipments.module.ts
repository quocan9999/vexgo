import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CargoPricingModule } from '../cargo-pricing/cargo-pricing.module.js';
import { CargoCapacityModule } from '../cargo-capacity/cargo-capacity.module.js';
import { LocationsModule } from '../locations/locations.module.js';
import { ShipmentsController } from './shipments.controller.js';
import { ShipmentsService } from './shipments.service.js';
import { ShipmentPersistenceService } from './shipment-persistence.service.js';
import { ShipmentRatesService } from './shipment-rates.service.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    CargoPricingModule,
    CargoCapacityModule,
    LocationsModule,
  ],
  controllers: [ShipmentsController],
  providers: [
    ShipmentsService,
    ShipmentPersistenceService,
    ShipmentRatesService,
  ],
  exports: [
    ShipmentsService,
    ShipmentPersistenceService,
    ShipmentRatesService,
  ],
})
export class ShipmentsModule {}
