import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME } from '../../auth/permissions/permission-catalog.js';

const MANAGED_ROLE_NAMES = Object.keys(ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME);

export class DefaultRolePermissionParamsDto {
  @ApiProperty({
    description: 'Tên vai trò hệ thống cần cấu hình quyền mặc định',
    enum: MANAGED_ROLE_NAMES,
    example: 'ADMIN_NHA_XE',
  })
  @IsString()
  @IsIn(MANAGED_ROLE_NAMES)
  roleName!: string;
}
