import { Controller, Get } from '@nestjs/common';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { PlatformDashboardService } from './platform-dashboard.service.js';

@Controller('super-admin/dashboard')
@RequireRoles('SUPER_ADMIN')
@RequirePermissions('bus-company:read', 'admin-account:read')
export class PlatformDashboardController {
  constructor(private readonly dashboard: PlatformDashboardService) {}

  @Get('overview')
  getOverview() {
    return this.dashboard.getOverview();
  }
}
