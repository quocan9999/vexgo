import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
})
export class VehiclesModule {}
