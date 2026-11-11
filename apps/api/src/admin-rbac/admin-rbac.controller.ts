import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { AdminRbacService } from './admin-rbac.service.js';
import { DefaultRolePermissionParamsDto } from './dto/default-role-permission-params.dto.js';
import { UpdateDefaultRolePermissionsDto } from './dto/update-default-role-permissions.dto.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Phân quyền hệ thống (Default RBAC)')
@ApiBearerAuth('JWT-auth')
@Controller('admin-rbac/default-role-permissions')
@RequireRoles('SUPER_ADMIN')
export class AdminRbacController {
  constructor(private readonly adminRbacService: AdminRbacService) {}

  @Get()
  @ApiOperation({
    summary: 'Xem ma trận phân quyền mặc định của các vai trò',
    description:
      'Lấy danh sách các quyền hạn được gán mặc định cho từng vai trò quản trị trong toàn hệ sinh thái VexGo.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy cấu hình quyền mặc định thành công.',
  })
  @ApiResponse({
    status: 403,
    description: 'Không đủ quyền hạn.',
    type: ApiErrorResponseDto,
  })
  getDefaultRolePermissions() {
    return this.adminRbacService.getDefaultRolePermissions();
  }

  @Put(':roleName')
  @ApiOperation({
    summary: 'Cập nhật quyền mặc định cho một vai trò',
    description:
      'Thay thế toàn bộ danh sách quyền mặc định của một vai trò hệ thống.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN`.',
  })
  @ApiParam({
    name: 'roleName',
    description: 'Tên vai trò hệ thống cần cập nhật',
    example: 'ADMIN_NHA_XE',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật phân quyền mặc định thành công.',
  })
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
