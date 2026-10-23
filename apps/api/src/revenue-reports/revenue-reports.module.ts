import { Module } from '@nestjs/common';
import { RevenueReportsController } from './revenue-reports.controller.js';
import { RevenueReportsService } from './revenue-reports.service.js';

@Module({
  controllers: [RevenueReportsController],
  providers: [RevenueReportsService],
})
export class RevenueReportsModule {}
