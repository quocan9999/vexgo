import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { TenantRolePermissionsParamsDto } from './dto/tenant-role-permissions-params.dto.js';
import { UpdateTenantRolePermissionsDto } from './dto/update-tenant-role-permissions.dto.js';
import { TenantRolePermissionsService } from './tenant-role-permissions.service.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Phân quyền nội bộ nhà xe (Tenant Admin RBAC)')
@ApiBearerAuth('JWT-auth')
@Controller('admin-rbac/tenant-role-permissions')
@RequireRoles('NHA_XE_ADMIN')
export class TenantAdminRbacController {
  constructor(
    private readonly tenantRolePermissionsService: TenantRolePermissionsService,
  ) {}

  @Get()
  @RequirePermissions('role:read')
  @ApiOperation({
    summary: 'Admin nhà xe xem ma trận phân quyền nội bộ',
    description:
      'Lấy cấu hình danh sách quyền hạn cho các vai trò nhân viên trong phạm vi nhà xe của tài khoản đang đăng nhập.\n\n- **Quyền hạn yêu cầu**: `NHA_XE_ADMIN` có quyền `role:read`.',
  })
  @ApiResponse({ status: 200, description: 'Lấy cấu hình phân quyền thành công.' })
  @ApiResponse({ status: 403, description: 'Không đủ quyền hạn.', type: ApiErrorResponseDto })
  getTenantRolePermissions(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.tenantRolePermissionsService.getConfiguration(
      requireTenantPrincipal(principal),
    );
  }

  @Put(':roleName')
  @RequirePermissions('role:read', 'permission:assign')
  @ApiOperation({
    summary: 'Admin nhà xe cập nhật quyền cho một vai trò nhân viên',
    description:
      'Tùy chỉnh danh sách quyền cho vai trò nhân viên trong nội bộ nhà xe mình.\n\n- **Quyền hạn yêu cầu**: `NHA_XE_ADMIN` có quyền `role:read`, `permission:assign`.',
  })
  @ApiParam({ name: 'roleName', description: 'Tên vai trò nhân viên nội bộ', example: 'DIEU_HANH' })
  @ApiResponse({ status: 200, description: 'Cập nhật phân quyền thành công.' })
  replaceTenantRolePermissions(
    @Param() params: TenantRolePermissionsParamsDto,
    @Body() body: UpdateTenantRolePermissionsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tenantRolePermissionsService.replaceOverride(
      requireTenantPrincipal(principal),
      params.roleName,
      body.permissionKeys,
    );
  }

  @Delete(':roleName')
  @RequirePermissions('role:read', 'permission:assign')
  @ApiOperation({
    summary: 'Admin nhà xe khôi phục quyền mặc định cho vai trò',
    description:
      'Hủy bỏ tùy chỉnh riêng, khôi phục quyền của vai trò về cấu hình mặc định chuẩn của hệ thống.\n\n- **Quyền hạn yêu cầu**: `NHA_XE_ADMIN` có quyền `role:read`, `permission:assign`.',
  })
  @ApiParam({ name: 'roleName', description: 'Tên vai trò nhân viên', example: 'DIEU_HANH' })
  @ApiResponse({ status: 200, description: 'Khôi phục về quyền mặc định thành công.' })
  resetTenantRolePermissions(
    @Param() params: TenantRolePermissionsParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tenantRolePermissionsService.resetOverride(
      requireTenantPrincipal(principal),
      params.roleName,
    );
  }
}
