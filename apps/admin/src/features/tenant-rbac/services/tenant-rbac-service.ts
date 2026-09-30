import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import {
  TENANT_RBAC_ROLE_NAMES,
  type TenantRbacConfig,
  type TenantRbacPermission,
  type TenantRbacRole,
} from '../types/tenant-rbac';

function getTenantRolePermissionsUrl(): string {
  return `${getApiBaseUrl()}/api/v1/admin-rbac/tenant-role-permissions`;
}

function getPlatformTenantRolePermissionsUrl(nhaXeId: number): string {
  if (!Number.isSafeInteger(nhaXeId) || nhaXeId <= 0) {
    throw new AdminTenantRbacApiError(
      'Mã nhà xe không hợp lệ.',
      'INVALID_TENANT_ID',
    );
  }
  return `${getApiBaseUrl()}/api/v1/admin-rbac/tenants/${nhaXeId}/role-permissions`;
}

export class AdminTenantRbacApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AdminTenantRbacApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTenantRoleName(value: unknown): value is TenantRbacRole['roleName'] {
  return (
    typeof value === 'string' &&
    (TENANT_RBAC_ROLE_NAMES as readonly string[]).includes(value)
  );
}

function parseApiError(body: unknown, status: number): AdminTenantRbacApiError {
  const message =
    isRecord(body) && typeof body.message === 'string'
      ? body.message
      : `Không thể tải cấu hình phân quyền nhà xe (HTTP ${status}).`;
  const code =
    isRecord(body) && typeof body.error === 'string' ? body.error : undefined;
  return new AdminTenantRbacApiError(message, code);
}

function invalidResponse(): never {
  throw new AdminTenantRbacApiError(
    'API trả về cấu hình phân quyền nhà xe không hợp lệ.',
    'INVALID_TENANT_RBAC_RESPONSE',
  );
}

function parsePermission(value: unknown): TenantRbacPermission {
  if (
    !isRecord(value) ||
    typeof value.key !== 'string' ||
    value.key.trim().length === 0 ||
    value.scope !== 'tenant' ||
    typeof value.description !== 'string'
  ) {
    return invalidResponse();
  }

  return {
    key: value.key,
    scope: 'tenant',
    description: value.description,
  };
}

function parsePermissionKeys(
  value: unknown,
  catalog: ReadonlyMap<string, TenantRbacPermission>,
): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((key) => typeof key === 'string') ||
    new Set(value).size !== value.length ||
    value.some((key) => !catalog.has(key))
  ) {
    return invalidResponse();
  }
  return [...value];
}

function hasSameKeys(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((key) => right.includes(key))
  );
}

function parseRole(
  value: unknown,
  catalog: ReadonlyMap<string, TenantRbacPermission>,
): TenantRbacRole {
  if (
    !isRecord(value) ||
    !isTenantRoleName(value.roleName) ||
    !(value.description === null || typeof value.description === 'string') ||
    value.scope !== 'tenant' ||
    value.isProtected !== false ||
    !(value.source === 'global' || value.source === 'override')
  ) {
    return invalidResponse();
  }

  const defaultPermissionKeys = parsePermissionKeys(
    value.defaultPermissionKeys,
    catalog,
  );
  const effectivePermissionKeys = parsePermissionKeys(
    value.effectivePermissionKeys,
    catalog,
  );
  const overridePermissionKeys = value.overridePermissionKeys === null
    ? null
    : parsePermissionKeys(value.overridePermissionKeys, catalog);
  const isInherited = value.source === 'global';
  const expectedEffectiveKeys = isInherited
    ? defaultPermissionKeys
    : overridePermissionKeys;

  if (
    (isInherited && overridePermissionKeys !== null) ||
    (!isInherited && overridePermissionKeys === null) ||
    expectedEffectiveKeys === null ||
    !hasSameKeys(effectivePermissionKeys, expectedEffectiveKeys)
  ) {
    return invalidResponse();
  }

  return {
    roleName: value.roleName,
    description: value.description,
    scope: 'tenant',
    isProtected: false,
    defaultPermissionKeys,
    overridePermissionKeys,
    effectivePermissionKeys,
    source: value.source,
  };
}

function parseConfig(value: unknown): TenantRbacConfig {
  if (
    !isRecord(value) ||
    !Array.isArray(value.permissions) ||
    !Array.isArray(value.roles)
  ) {
    return invalidResponse();
  }

  const permissions = value.permissions.map(parsePermission);
  const catalog = new Map(permissions.map((permission) => [permission.key, permission]));
  if (catalog.size !== permissions.length) return invalidResponse();

  const roles = value.roles.map((role) => parseRole(role, catalog));
  const roleNames = new Set(roles.map(({ roleName }) => roleName));
  if (
    roles.length !== TENANT_RBAC_ROLE_NAMES.length ||
    roleNames.size !== TENANT_RBAC_ROLE_NAMES.length ||
    TENANT_RBAC_ROLE_NAMES.some((roleName) => !roleNames.has(roleName))
  ) {
    return invalidResponse();
  }

  return { permissions, roles };
}

function parseUpdatedRole(
  value: unknown,
  expectedRole: TenantRbacRole,
  permissions: readonly TenantRbacPermission[],
): TenantRbacRole {
  const catalog = new Map(permissions.map((permission) => [permission.key, permission]));
  const role = parseRole(value, catalog);
  if (role.roleName !== expectedRole.roleName) return invalidResponse();
  return role;
}

async function readResponse(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw parseApiError(body, response.status);
  if (!isRecord(body) || !('data' in body)) return invalidResponse();
  return body.data;
}

export async function getTenantRolePermissions(
  signal?: AbortSignal,
): Promise<TenantRbacConfig> {
  const response = await adminApiFetch(getTenantRolePermissionsUrl(), {
    cache: 'no-store',
    signal,
  });
  return parseConfig(await readResponse(response));
}

export async function getPlatformTenantRolePermissions(
  nhaXeId: number,
  signal?: AbortSignal,
): Promise<TenantRbacConfig> {
  const response = await adminApiFetch(
    getPlatformTenantRolePermissionsUrl(nhaXeId),
    { cache: 'no-store', signal },
  );
  return parseConfig(await readResponse(response));
}

export async function replaceTenantRolePermissions(
  role: TenantRbacRole,
  permissionKeys: readonly string[],
  permissions: readonly TenantRbacPermission[],
): Promise<TenantRbacRole> {
  const catalog = new Map(permissions.map((permission) => [permission.key, permission]));
  if (
    role.scope !== 'tenant' ||
    role.isProtected ||
    new Set(permissionKeys).size !== permissionKeys.length ||
    permissionKeys.some((key) => !catalog.has(key))
  ) {
    throw new AdminTenantRbacApiError(
      'Danh sách quyền không hợp lệ với vai trò đã chọn.',
      'INVALID_PERMISSION_LIST',
    );
  }

  const response = await adminApiFetch(
    `${getTenantRolePermissionsUrl()}/${encodeURIComponent(role.roleName)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionKeys: [...permissionKeys] }),
      cache: 'no-store',
    },
  );
  return parseUpdatedRole(await readResponse(response), role, permissions);
}

export async function replacePlatformTenantRolePermissions(
  nhaXeId: number,
  role: TenantRbacRole,
  permissionKeys: readonly string[],
  permissions: readonly TenantRbacPermission[],
): Promise<TenantRbacRole> {
  const url = getPlatformTenantRolePermissionsUrl(nhaXeId);
  const catalog = new Map(permissions.map((permission) => [permission.key, permission]));
  if (
    role.scope !== 'tenant' ||
    role.isProtected ||
    new Set(permissionKeys).size !== permissionKeys.length ||
    permissionKeys.some((key) => !catalog.has(key))
  ) {
    throw new AdminTenantRbacApiError(
      'Danh sách quyền không hợp lệ với vai trò đã chọn.',
      'INVALID_PERMISSION_LIST',
    );
  }

  const response = await adminApiFetch(
    `${url}/${encodeURIComponent(role.roleName)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionKeys: [...permissionKeys] }),
      cache: 'no-store',
    },
  );
  return parseUpdatedRole(await readResponse(response), role, permissions);
}

export async function resetTenantRolePermissions(
  role: TenantRbacRole,
  permissions: readonly TenantRbacPermission[],
): Promise<TenantRbacRole> {
  if (role.scope !== 'tenant' || role.isProtected) {
    throw new AdminTenantRbacApiError(
      'Không thể khôi phục cấu hình cho vai trò này.',
      'ROLE_NOT_MANAGEABLE',
    );
  }

  const response = await adminApiFetch(
    `${getTenantRolePermissionsUrl()}/${encodeURIComponent(role.roleName)}`,
    { method: 'DELETE', cache: 'no-store' },
  );
  return parseUpdatedRole(await readResponse(response), role, permissions);
}

export async function resetPlatformTenantRolePermissions(
  nhaXeId: number,
  role: TenantRbacRole,
  permissions: readonly TenantRbacPermission[],
): Promise<TenantRbacRole> {
  const url = getPlatformTenantRolePermissionsUrl(nhaXeId);
  if (role.scope !== 'tenant' || role.isProtected) {
    throw new AdminTenantRbacApiError(
      'Không thể khôi phục cấu hình cho vai trò này.',
      'ROLE_NOT_MANAGEABLE',
    );
  }

  const response = await adminApiFetch(
    `${url}/${encodeURIComponent(role.roleName)}`,
    { method: 'DELETE', cache: 'no-store' },
  );
  return parseUpdatedRole(await readResponse(response), role, permissions);
}
