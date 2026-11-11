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

const PERMISSION_KEYS = ADMIN_PERMISSION_CATALOG.map(({ key }) => key);

export class UpdateDefaultRolePermissionsDto {
  @ApiProperty({
    description: 'Danh sách các mã quyền gán cho vai trò mặc định của hệ thống',
    example: ['trip:create', 'trip:read', 'trip:update'],
    isArray: true,
  })
  @IsDefined()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ADMIN_PERMISSION_CATALOG.length)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @IsIn(PERMISSION_KEYS, { each: true })
  permissionKeys!: string[];
}
