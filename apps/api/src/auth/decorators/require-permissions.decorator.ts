import { SetMetadata } from '@nestjs/common';
import type { AdminPermissionKey } from '../permissions/permission-catalog.js';

export const REQUIRED_PERMISSIONS_KEY = 'auth:required-permissions';

export const RequirePermissions = (
  ...permissions: [AdminPermissionKey, ...AdminPermissionKey[]]
) => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
