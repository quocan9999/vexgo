import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FarePricesController } from './fare-prices.controller.js';
import { FarePricesService } from './fare-prices.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [FarePricesController],
  providers: [FarePricesService],
  exports: [FarePricesService],
})
export class FarePricesModule {}
