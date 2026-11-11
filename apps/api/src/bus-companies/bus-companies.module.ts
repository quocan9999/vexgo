import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { BusCompaniesController } from './bus-companies.controller.js';
import { BusCompaniesService } from './bus-companies.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [BusCompaniesController],
  providers: [BusCompaniesService],
})
export class BusCompaniesModule {}
