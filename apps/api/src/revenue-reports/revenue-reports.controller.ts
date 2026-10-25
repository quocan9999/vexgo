import { Controller, Get, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto.js';
import { RevenueReportsService } from './revenue-reports.service.js';

@Controller('revenue-reports')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
export class RevenueReportsController {
  constructor(private readonly revenueReportsService: RevenueReportsService) {}

  @Get()
  @RequirePermissions('revenue:read')
  getReport(
    @Query() query: RevenueReportQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.revenueReportsService.getReport(query, principal);
  }
}
