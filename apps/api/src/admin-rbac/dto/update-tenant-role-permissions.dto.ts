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
  @IsDefined()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(TENANT_PERMISSION_KEYS.length)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @IsIn(TENANT_PERMISSION_KEYS, { each: true })
  permissionKeys!: string[];
}
