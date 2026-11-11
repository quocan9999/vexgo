import { SetMetadata } from '@nestjs/common';
import type { AdminPermissionKey } from '../permissions/permission-catalog.js';

export const TENANT_PERMISSIONS_IF_AUTHENTICATED_KEY =
  'auth:tenant-permissions-if-authenticated';

export const RequireTenantPermissionsIfAuthenticated = (
  ...permissions: [AdminPermissionKey, ...AdminPermissionKey[]]
) => SetMetadata(TENANT_PERMISSIONS_IF_AUTHENTICATED_KEY, permissions);
