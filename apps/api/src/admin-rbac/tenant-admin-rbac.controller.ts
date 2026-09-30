import { Controller, Get } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { TenantRolePermissionsService } from './tenant-role-permissions.service.js';

@Controller('admin-rbac/tenant-role-permissions')
@RequireRoles('NHA_XE_ADMIN')
export class TenantAdminRbacController {
  constructor(
    private readonly tenantRolePermissionsService: TenantRolePermissionsService,
  ) {}

  @Get()
  @RequirePermissions('role:read')
  getTenantRolePermissions(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.tenantRolePermissionsService.getConfiguration(
      requireTenantPrincipal(principal),
    );
  }
}
