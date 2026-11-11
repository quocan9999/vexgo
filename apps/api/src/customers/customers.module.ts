import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminCustomersController } from './admin-customers.controller.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CustomersController, AdminCustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
