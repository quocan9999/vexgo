import { Module } from '@nestjs/common';
import { LocationsModule } from './locations/locations.module.js';
import { StationsModule } from './stations/stations.module.js';
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
import { TicketsModule } from './tickets/tickets.module.js';
import { ShipmentsModule } from './shipments/shipments.module.js';
import { SeatHoldsModule } from './seat-holds/seat-holds.module.js';
import { PromotionsModule } from './promotions/promotions.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SupportChatModule } from './support-chat/support-chat.module.js';
import { RevenueReportsModule } from './revenue-reports/revenue-reports.module.js';
import { PlatformDashboardModule } from './platform-dashboard/platform-dashboard.module.js';

@Module({
  imports: [
    LocationsModule,
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
    TicketsModule,
    ShipmentsModule,
    SeatHoldsModule,
    PromotionsModule,
    BookingsModule,
    PaymentsModule,
    NotificationsModule,
    ReviewsModule,
    SupportChatModule,
    RevenueReportsModule,
    PlatformDashboardModule,
    StationsModule,
  ],
})
export class AppModule {}
