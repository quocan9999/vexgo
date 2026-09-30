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

const PERMISSION_KEYS = ADMIN_PERMISSION_CATALOG.map(({ key }) => key);

export class UpdateDefaultRolePermissionsDto {
  @IsDefined()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ADMIN_PERMISSION_CATALOG.length)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @IsIn(PERMISSION_KEYS, { each: true })
  permissionKeys!: string[];
}
