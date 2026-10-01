import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { AdminRbacService } from './admin-rbac.service.js';
import { DefaultRolePermissionParamsDto } from './dto/default-role-permission-params.dto.js';
import { UpdateDefaultRolePermissionsDto } from './dto/update-default-role-permissions.dto.js';

@Controller('admin-rbac/default-role-permissions')
@RequireRoles('SUPER_ADMIN')
export class AdminRbacController {
  constructor(private readonly adminRbacService: AdminRbacService) {}

  @Get()
  getDefaultRolePermissions() {
    return this.adminRbacService.getDefaultRolePermissions();
  }

  @Put(':roleName')
  replaceDefaultRolePermissions(
    @Param() params: DefaultRolePermissionParamsDto,
    @Body() body: UpdateDefaultRolePermissionsDto,
  ) {
    return this.adminRbacService.replaceDefaultRolePermissions(
      params.roleName,
      body.permissionKeys,
    );
  }
}
