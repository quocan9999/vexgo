import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TenantDashboardController } from './tenant-dashboard.controller.js';
import { TenantDashboardService } from './tenant-dashboard.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TenantDashboardController],
  providers: [TenantDashboardService],
  exports: [TenantDashboardService],
})
export class TenantDashboardModule {}
