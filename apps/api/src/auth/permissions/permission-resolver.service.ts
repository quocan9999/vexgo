import { Injectable } from '@nestjs/common';
import { TENANT_PRINCIPAL_ROLES } from '../principal-scope.js';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_PERMISSION_SCOPE_BY_KEY,
  type AdminPermissionScope,
} from './permission-catalog.js';

export interface RolePermissionAssignment {
  roleName: string;
  permissions: readonly string[];
}

export interface PrincipalTenantIdentity {
  nhanVienId: number | null;
  nhaXeId: number | null;
}

const PLATFORM_ROLE = 'SUPER_ADMIN';
const TENANT_ROLE_SET = new Set<string>(TENANT_PRINCIPAL_ROLES);

@Injectable()
export class PermissionResolverService {
  resolve(
    roleAssignments: readonly RolePermissionAssignment[],
    identity: PrincipalTenantIdentity,
  ): string[] {
    const scope = this.resolvePrincipalScope(roleAssignments, identity);
    if (!scope) return [];

    const allowedKeys = new Set<string>();
    for (const assignment of roleAssignments) {
      const roleAllowedInScope =
        scope === 'platform'
          ? assignment.roleName === PLATFORM_ROLE
          : TENANT_ROLE_SET.has(assignment.roleName);
      if (!roleAllowedInScope) continue;

      for (const key of assignment.permissions) {
        if (ADMIN_PERMISSION_SCOPE_BY_KEY.get(key) === scope) {
          allowedKeys.add(key);
        }
      }
    }

    return ADMIN_PERMISSION_CATALOG.filter(({ key }) =>
      allowedKeys.has(key),
    ).map(({ key }) => key);
  }

  private resolvePrincipalScope(
    roleAssignments: readonly RolePermissionAssignment[],
    identity: PrincipalTenantIdentity,
  ): AdminPermissionScope | null {
    const roleNames = roleAssignments.map(({ roleName }) => roleName);
    if (
      roleNames.length === 1 &&
      roleNames[0] === PLATFORM_ROLE &&
      identity.nhanVienId === null &&
      identity.nhaXeId === null
    ) {
      return 'platform';
    }

    const hasTenantIdentity =
      Number.isSafeInteger(identity.nhanVienId) &&
      (identity.nhanVienId ?? 0) > 0 &&
      Number.isSafeInteger(identity.nhaXeId) &&
      (identity.nhaXeId ?? 0) > 0;
    if (
      roleNames.length > 0 &&
      hasTenantIdentity &&
      roleNames.every((roleName) => TENANT_ROLE_SET.has(roleName))
    ) {
      return 'tenant';
    }

    return null;
  }
}
