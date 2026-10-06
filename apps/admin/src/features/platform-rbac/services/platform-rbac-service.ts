import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import {
  ADMIN_RBAC_ROLE_SCOPES,
  type AdminRbacPermission,
  type AdminRbacRole,
  type AdminRbacRoleName,
  type AdminRbacScope,
  type DefaultAdminRbacConfig,
} from '../types/platform-rbac';

function getDefaultRolePermissionsUrl(): string {
  return `${getApiBaseUrl()}/api/v1/admin-rbac/default-role-permissions`;
}
const ROLE_NAMES = Object.keys(
  ADMIN_RBAC_ROLE_SCOPES,
) as AdminRbacRoleName[];

export class AdminRbacApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AdminRbacApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScope(value: unknown): value is AdminRbacScope {
  return value === 'platform' || value === 'tenant';
}

function parseApiError(body: unknown, status: number): AdminRbacApiError {
  const message =
    isRecord(body) && typeof body.message === 'string'
      ? body.message
      : `Không thể cấu hình quyền quản trị (HTTP ${status}).`;
  const code =
    isRecord(body) && typeof body.error === 'string' ? body.error : undefined;
  return new AdminRbacApiError(message, code);
}

function invalidResponse(): never {
  throw new AdminRbacApiError(
    'API trả về cấu hình quyền quản trị không hợp lệ.',
    'INVALID_RBAC_RESPONSE',
  );
}

function parsePermission(value: unknown): AdminRbacPermission {
  if (
    !isRecord(value) ||
    typeof value.key !== 'string' ||
    value.key.trim().length === 0 ||
    !isScope(value.scope) ||
    typeof value.description !== 'string'
  ) {
    return invalidResponse();
  }

  return {
    key: value.key,
    scope: value.scope,
    description: value.description,
  };
}

function parseRole(
  value: unknown,
  permissions: ReadonlyMap<string, AdminRbacPermission>,
): AdminRbacRole {
  if (
    !isRecord(value) ||
    typeof value.roleName !== 'string' ||
    !Object.hasOwn(ADMIN_RBAC_ROLE_SCOPES, value.roleName) ||
    !(value.description === null || typeof value.description === 'string') ||
    !isScope(value.scope) ||
    typeof value.isProtected !== 'boolean' ||
    !Array.isArray(value.permissionKeys) ||
    !value.permissionKeys.every((key) => typeof key === 'string')
  ) {
    return invalidResponse();
  }

  const roleName = value.roleName as AdminRbacRoleName;
  const scope = ADMIN_RBAC_ROLE_SCOPES[roleName];
  const permissionKeys = value.permissionKeys as string[];

  if (
    value.scope !== scope ||
    value.isProtected !== (roleName === 'SUPER_ADMIN') ||
    new Set(permissionKeys).size !== permissionKeys.length ||
    permissionKeys.some((key) => permissions.get(key)?.scope !== scope)
  ) {
    return invalidResponse();
  }

  return {
    roleName,
    description: value.description,
    scope,
    isProtected: roleName === 'SUPER_ADMIN',
    permissionKeys: [...permissionKeys],
  };
}

function parseConfig(value: unknown): DefaultAdminRbacConfig {
  if (
    !isRecord(value) ||
    !Array.isArray(value.permissions) ||
    !Array.isArray(value.roles)
  ) {
    return invalidResponse();
  }

  const permissions = value.permissions.map(parsePermission);
  const permissionsByKey = new Map(permissions.map((item) => [item.key, item]));
  if (permissionsByKey.size !== permissions.length) return invalidResponse();

  const roles = value.roles.map((role) => parseRole(role, permissionsByKey));
  const roleNames = new Set(roles.map(({ roleName }) => roleName));
  if (
    roles.length !== ROLE_NAMES.length ||
    roleNames.size !== ROLE_NAMES.length ||
    ROLE_NAMES.some((roleName) => !roleNames.has(roleName))
  ) {
    return invalidResponse();
  }

  return { permissions, roles };
}

function parseUpdatedRole(
  value: unknown,
  expectedRole: AdminRbacRole,
  catalog: readonly AdminRbacPermission[],
): AdminRbacRole {
  const permissionsByKey = new Map(catalog.map((item) => [item.key, item]));
  const role = parseRole(value, permissionsByKey);
  if (
    role.roleName !== expectedRole.roleName ||
    role.scope !== expectedRole.scope
  ) {
    return invalidResponse();
  }
  return role;
}

export async function getDefaultRolePermissions(
  signal?: AbortSignal,
): Promise<DefaultAdminRbacConfig> {
  const response = await adminApiFetch(getDefaultRolePermissionsUrl(), {
    cache: 'no-store',
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw parseApiError(body, response.status);
  if (!isRecord(body) || !('data' in body)) return invalidResponse();
  return parseConfig(body.data);
}

export async function replaceDefaultRolePermissions(
  role: AdminRbacRole,
  permissionKeys: readonly string[],
  catalog: readonly AdminRbacPermission[],
): Promise<AdminRbacRole> {
  if (role.roleName === 'SUPER_ADMIN' || role.isProtected) {
    throw new AdminRbacApiError(
      'Không thể thay đổi quyền của vai trò SUPER_ADMIN.',
      'SUPER_ADMIN_PERMISSION_IMMUTABLE',
    );
  }

  const permissionsByKey = new Map(catalog.map((item) => [item.key, item]));
  if (
    role.scope !== ADMIN_RBAC_ROLE_SCOPES[role.roleName] ||
    new Set(permissionKeys).size !== permissionKeys.length ||
    permissionKeys.some((key) => permissionsByKey.get(key)?.scope !== role.scope)
  ) {
    throw new AdminRbacApiError(
      'Danh sách quyền không hợp lệ với vai trò đã chọn.',
      'INVALID_PERMISSION_LIST',
    );
  }

  const response = await adminApiFetch(
    `${getDefaultRolePermissionsUrl()}/${encodeURIComponent(role.roleName)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionKeys: [...permissionKeys] }),
      cache: 'no-store',
    },
  );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw parseApiError(body, response.status);
  if (!isRecord(body) || !('data' in body)) return invalidResponse();
  return parseUpdatedRole(body.data, role, catalog);
}
