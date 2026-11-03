import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsString,
} from 'class-validator';
import { TENANT_PRINCIPAL_ROLES } from '../../auth/principal-scope.js';

type TenantPrincipalRole = (typeof TENANT_PRINCIPAL_ROLES)[number];

export class UpdateAdminAccountRolesDto {
  @ApiProperty({
    description: 'Danh sách các vai trò mới cần gán cho tài khoản (thay thế toàn bộ vai trò cũ)',
    enum: TENANT_PRINCIPAL_ROLES,
    isArray: true,
    example: ['ADMIN_NHA_XE', 'BAN_VE'],
  })
  @IsDefined()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn([...TENANT_PRINCIPAL_ROLES], { each: true })
  roleNames!: TenantPrincipalRole[];
}
