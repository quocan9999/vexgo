import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { BusCompaniesModule } from './bus-companies/bus-companies.module.js';
import { VehicleTypesModule } from './vehicle-types/vehicle-types.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '../../.env'),
        resolve(process.cwd(), '.env'),
      ],
    }),
    PrismaModule,
    HealthModule,
    BusCompaniesModule,
    VehicleTypesModule,
    VehiclesModule,
  ],
})
export class AppModule {}
