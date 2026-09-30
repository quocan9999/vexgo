import { IsIn, IsString } from 'class-validator';
import { ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME } from '../../auth/permissions/permission-catalog.js';

const MANAGED_ROLE_NAMES = Object.keys(ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME);

export class DefaultRolePermissionParamsDto {
  @IsString()
  @IsIn(MANAGED_ROLE_NAMES)
  roleName!: string;
}
