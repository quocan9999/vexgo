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
  @IsDefined()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn([...TENANT_PRINCIPAL_ROLES], { each: true })
  roleNames!: TenantPrincipalRole[];
}
