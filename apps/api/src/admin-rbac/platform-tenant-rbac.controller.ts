import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import {
  TenantRbacTargetParamsDto,
  TenantRbacTargetRoleParamsDto,
} from './dto/tenant-role-permissions-params.dto.js';
import { UpdateTenantRolePermissionsDto } from './dto/update-tenant-role-permissions.dto.js';
import { TenantRolePermissionsService } from './tenant-role-permissions.service.js';

@Controller('admin-rbac/tenants/:nhaXeId/role-permissions')
@RequireRoles('SUPER_ADMIN')
export class PlatformTenantRbacController {
  constructor(
    private readonly tenantRolePermissionsService: TenantRolePermissionsService,
  ) {}

  @Get()
  getTenantRolePermissions(@Param() params: TenantRbacTargetParamsDto) {
    return this.tenantRolePermissionsService.getPlatformTenantConfiguration(
      params.nhaXeId,
    );
  }

  @Put(':roleName')
  replaceTenantRolePermissions(
    @Param() params: TenantRbacTargetRoleParamsDto,
    @Body() body: UpdateTenantRolePermissionsDto,
  ) {
    return this.tenantRolePermissionsService.replacePlatformTenantOverride(
      params.nhaXeId,
      params.roleName,
      body.permissionKeys,
    );
  }

  @Delete(':roleName')
  resetTenantRolePermissions(@Param() params: TenantRbacTargetRoleParamsDto) {
    return this.tenantRolePermissionsService.resetPlatformTenantOverride(
      params.nhaXeId,
      params.roleName,
    );
  }
}
