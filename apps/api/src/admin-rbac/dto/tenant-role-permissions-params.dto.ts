import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { TENANT_RBAC_ROLE_NAMES } from '../tenant-role-permissions.constants.js';

export class TenantRbacTargetParamsDto {
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt({ message: 'ID nhà xe phải là số nguyên.' })
  @Min(1, { message: 'ID nhà xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID nhà xe vượt giới hạn.' })
  nhaXeId!: number;
}

export class TenantRolePermissionsParamsDto {
  @IsString()
  @IsIn(TENANT_RBAC_ROLE_NAMES)
  roleName!: string;
}

export class TenantRbacTargetRoleParamsDto extends TenantRbacTargetParamsDto {
  @IsString()
  @IsIn(TENANT_RBAC_ROLE_NAMES)
  roleName!: string;
}
