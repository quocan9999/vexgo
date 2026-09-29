import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLES_KEY = 'auth:required-roles';

export const RequireRoles = (...roles: string[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);
