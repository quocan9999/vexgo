import { Module } from '@nestjs/common';
import { PlatformDashboardController } from './platform-dashboard.controller.js';
import { PlatformDashboardService } from './platform-dashboard.service.js';

@Module({
  controllers: [PlatformDashboardController],
  providers: [PlatformDashboardService],
})
export class PlatformDashboardModule {}
