import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import {
  TenantRbacTargetParamsDto,
  TenantRbacTargetRoleParamsDto,
} from './dto/tenant-role-permissions-params.dto.js';
import { UpdateTenantRolePermissionsDto } from './dto/update-tenant-role-permissions.dto.js';
import { TenantRolePermissionsService } from './tenant-role-permissions.service.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Phân quyền nhà xe - Cấp nền tảng (Platform Tenant RBAC)')
@ApiBearerAuth('JWT-auth')
@Controller('admin-rbac/tenants/:nhaXeId/role-permissions')
@RequireRoles('SUPER_ADMIN')
export class PlatformTenantRbacController {
  constructor(
    private readonly tenantRolePermissionsService: TenantRolePermissionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Super Admin xem cấu hình phân quyền của nhà xe chỉ định',
    description:
      'Truy vấn cấu hình quyền tùy biến đang áp dụng cho từng vai trò trong một nhà xe cụ thể.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN`.',
  })
  @ApiParam({ name: 'nhaXeId', description: 'ID nhà xe cần kiểm tra phân quyền', example: 1 })
  @ApiResponse({ status: 200, description: 'Lấy cấu hình phân quyền của nhà xe thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhà xe.', type: ApiErrorResponseDto })
  getTenantRolePermissions(@Param() params: TenantRbacTargetParamsDto) {
    return this.tenantRolePermissionsService.getPlatformTenantConfiguration(
      params.nhaXeId,
    );
  }

  @Put(':roleName')
  @ApiOperation({
    summary: 'Super Admin tùy chỉnh quyền vai trò cho một nhà xe',
    description:
      'Ghi đè danh sách quyền cho một vai trò nhân viên thuộc nhà xe chỉ định.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN`.',
  })
  @ApiParam({ name: 'nhaXeId', description: 'ID nhà xe', example: 1 })
  @ApiParam({ name: 'roleName', description: 'Tên vai trò cần tùy chỉnh quyền', example: 'DIEU_HANH' })
  @ApiResponse({ status: 200, description: 'Cập nhật quyền thành công.' })
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
  @ApiOperation({
    summary: 'Super Admin khôi phục quyền vai trò về mặc định cho nhà xe',
    description:
      'Xóa bỏ cấu hình quyền ghi đè tùy biến, đưa vai trò của nhà xe về danh mục quyền mặc định của hệ thống.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN`.',
  })
  @ApiParam({ name: 'nhaXeId', description: 'ID nhà xe', example: 1 })
  @ApiParam({ name: 'roleName', description: 'Tên vai trò cần khôi phục', example: 'DIEU_HANH' })
  @ApiResponse({ status: 200, description: 'Khôi phục quyền mặc định thành công.' })
  resetTenantRolePermissions(@Param() params: TenantRbacTargetRoleParamsDto) {
    return this.tenantRolePermissionsService.resetPlatformTenantOverride(
      params.nhaXeId,
      params.roleName,
    );
  }
}
