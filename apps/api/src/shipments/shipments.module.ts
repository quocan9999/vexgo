import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CargoPricingModule } from '../cargo-pricing/cargo-pricing.module.js';
import { CargoCapacityModule } from '../cargo-capacity/cargo-capacity.module.js';
import { ShipmentsController } from './shipments.controller.js';
import { ShipmentsService } from './shipments.service.js';
import { ShipmentPersistenceService } from './shipment-persistence.service.js';

@Module({
  imports: [PrismaModule, CargoPricingModule, CargoCapacityModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, ShipmentPersistenceService],
  exports: [ShipmentsService, ShipmentPersistenceService],
})
export class ShipmentsModule {}
