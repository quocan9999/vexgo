import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { BusCompaniesModule } from './bus-companies/bus-companies.module.js';
import { VehicleTypesModule } from './vehicle-types/vehicle-types.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';
import { RoutesModule } from './routes/routes.module.js';
import { FarePricesModule } from './fare-prices/fare-prices.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { TripsModule } from './trips/trips.module.js';
import { AdminAccountsModule } from './admin-accounts/admin-accounts.module.js';
import { AdminRbacModule } from './admin-rbac/admin-rbac.module.js';
import { ContactsModule } from './contacts/contacts.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { ShipmentsModule } from './shipments/shipments.module.js';
import { PaymentsModule } from './payments/payments.module.js';

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
    RoutesModule,
    FarePricesModule,
    AuthModule,
    CustomersModule,
    TripsModule,
    AdminAccountsModule,
    AdminRbacModule,
    ContactsModule,
    BookingsModule,
    TicketsModule,
    ShipmentsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
