import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsString,
  MaxLength,
} from 'class-validator';
import { ADMIN_PERMISSION_CATALOG } from '../../auth/permissions/permission-catalog.js';

const TENANT_PERMISSION_KEYS = ADMIN_PERMISSION_CATALOG.filter(
  ({ scope }) => scope === 'tenant',
).map(({ key }) => key);

export class UpdateTenantRolePermissionsDto {
  @ApiProperty({
    description: 'Danh sách các mã quyền thuộc phạm vi nhà xe (tenant scope) cần gán',
    example: ['trip:create', 'trip:read', 'ticket:read'],
    isArray: true,
  })
  @IsDefined()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(TENANT_PERMISSION_KEYS.length)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @IsIn(TENANT_PERMISSION_KEYS, { each: true })
  permissionKeys!: string[];
}
