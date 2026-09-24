import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { VehicleTypesController } from './vehicle-types.controller.js';
import { VehicleTypesService } from './vehicle-types.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [VehicleTypesController],
  providers: [VehicleTypesService],
})
export class VehicleTypesModule {}
