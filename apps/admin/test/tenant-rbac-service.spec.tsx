// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTenantRolePermissions,
  getPlatformTenantRolePermissions,
  replaceTenantRolePermissions,
  replacePlatformTenantRolePermissions,
  resetTenantRolePermissions,
  resetPlatformTenantRolePermissions,
} from '@/features/tenant-rbac/services/tenant-rbac-service';
import type {
  TenantRbacConfig,
  TenantRbacPermission,
  TenantRbacRole,
} from '@/features/tenant-rbac/types/tenant-rbac';

const permissions: TenantRbacPermission[] = [
  { key: 'role:read', scope: 'tenant', description: 'Xem vai trò.' },
  {
    key: 'permission:assign',
    scope: 'tenant',
    description: 'Gán quyền tenant.',
  },
  { key: 'route:read', scope: 'tenant', description: 'Xem tuyến xe.' },
];

const tenantRoles = [
  'NHA_XE_ADMIN',
  'NHAN_VIEN_BAN_VE',
  'NHAN_VIEN_CSKH',
  'NHAN_VIEN_PHU_XE',
  'NHAN_VIEN_KINH_DOANH',
] as const;

const config: TenantRbacConfig = {
  permissions,
  roles: tenantRoles.map((roleName, index) => ({
    roleName,
    description: `Vai trò ${roleName}`,
    scope: 'tenant',
    isProtected: false,
    defaultPermissionKeys: index === 0 ? ['role:read', 'permission:assign'] : [],
    overridePermissionKeys: null,
    effectivePermissionKeys:
      index === 0 ? ['role:read', 'permission:assign'] : [],
    source: 'global',
  })),
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('tenant RBAC API service', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads all tenant roles through the self endpoint without sending a tenant id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: config }));

    await expect(getTenantRolePermissions()).resolves.toEqual(config);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://localhost:4000/api/v1/admin-rbac/tenant-role-permissions',
    );
    expect(init?.credentials).toBe('include');
    expect(init?.cache).toBe('no-store');
    expect(String(url)).not.toContain('nhaXeId');
    expect(String(init?.body ?? '')).not.toContain('nhaXeId');
  });

  it('preserves the difference between inherited and an intentional empty override', async () => {
    const emptyOverride = {
      ...config.roles[2],
      overridePermissionKeys: [],
      effectivePermissionKeys: [],
      source: 'override',
    } satisfies TenantRbacRole;
    const responseConfig = {
      ...config,
      roles: config.roles.map((role) =>
        role.roleName === emptyOverride.roleName ? emptyOverride : role,
      ),
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: responseConfig }),
    );

    const loaded = await getTenantRolePermissions();

    expect(loaded.roles[1].overridePermissionKeys).toBeNull();
    expect(loaded.roles[2].overridePermissionKeys).toEqual([]);
    expect(loaded.roles[2].source).toBe('override');
  });

  it('rejects malformed role sets, permission keys and source/effective mismatches', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: { ...config, roles: [] } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            ...config,
            roles: config.roles.map((role, index) =>
              index === 0
                ? { ...role, defaultPermissionKeys: ['platform:read'] }
                : role,
            ),
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            ...config,
            roles: config.roles.map((role, index) =>
              index === 0
                ? { ...role, effectivePermissionKeys: [] }
                : role,
            ),
          },
        }),
      );

    await expect(getTenantRolePermissions()).rejects.toMatchObject({
      code: 'INVALID_TENANT_RBAC_RESPONSE',
    });
    await expect(getTenantRolePermissions()).rejects.toMatchObject({
      code: 'INVALID_TENANT_RBAC_RESPONSE',
    });
    await expect(getTenantRolePermissions()).rejects.toMatchObject({
      code: 'INVALID_TENANT_RBAC_RESPONSE',
    });
  });

  it('sends a full replacement without tenant identity and validates the response', async () => {
    const sourceRole = config.roles[0];
    const savedRole: TenantRbacRole = {
      ...sourceRole,
      overridePermissionKeys: ['route:read'],
      effectivePermissionKeys: ['route:read'],
      source: 'override',
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: savedRole }));

    await expect(
      replaceTenantRolePermissions(sourceRole, ['route:read'], permissions),
    ).resolves.toEqual(savedRole);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://localhost:4000/api/v1/admin-rbac/tenant-role-permissions/NHA_XE_ADMIN',
    );
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      permissionKeys: ['route:read'],
    });
    expect(String(init?.body)).not.toContain('nhaXeId');
  });

  it('uses DELETE only to reset inheritance and preserves API errors', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ data: config.roles[0] }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { error: 'PERMISSION_FORBIDDEN', message: 'Không đủ quyền.' },
          403,
        ),
      );

    await expect(
      resetTenantRolePermissions(config.roles[0], permissions),
    ).resolves.toEqual(config.roles[0]);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://localhost:4000/api/v1/admin-rbac/tenant-role-permissions/NHA_XE_ADMIN',
    );
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();

    await expect(
      resetTenantRolePermissions(config.roles[0], permissions),
    ).rejects.toMatchObject({
      code: 'PERMISSION_FORBIDDEN',
      message: 'Không đủ quyền.',
    });
  });

  it('loads a selected tenant through the platform target endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: config }));

    await expect(getPlatformTenantRolePermissions(42)).resolves.toEqual(config);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://localhost:4000/api/v1/admin-rbac/tenants/42/role-permissions',
    );
    expect(init?.credentials).toBe('include');
    expect(init?.cache).toBe('no-store');
    expect(init?.method).toBeUndefined();
  });

  it('rejects invalid target ids before making a request', async () => {
    for (const invalidId of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        getPlatformTenantRolePermissions(invalidId),
      ).rejects.toMatchObject({ code: 'INVALID_TENANT_ID' });
    }

    expect(fetch).not.toHaveBeenCalled();
  });

  it('replaces and resets a selected tenant role using tenant-scoped endpoints', async () => {
    const role = config.roles[2];
    const savedRole: TenantRbacRole = {
      ...role,
      overridePermissionKeys: ['route:read'],
      effectivePermissionKeys: ['route:read'],
      source: 'override',
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: savedRole }))
      .mockResolvedValueOnce(jsonResponse({ data: role }));

    await expect(
      replacePlatformTenantRolePermissions(42, role, ['route:read'], permissions),
    ).resolves.toEqual(savedRole);
    await expect(
      resetPlatformTenantRolePermissions(42, role, permissions),
    ).resolves.toEqual(role);

    const [putUrl, putInit] = vi.mocked(fetch).mock.calls[0];
    expect(putUrl).toBe(
      'http://localhost:4000/api/v1/admin-rbac/tenants/42/role-permissions/NHAN_VIEN_CSKH',
    );
    expect(putInit?.method).toBe('PUT');
    expect(JSON.parse(String(putInit?.body))).toEqual({
      permissionKeys: ['route:read'],
    });

    const [deleteUrl, deleteInit] = vi.mocked(fetch).mock.calls[1];
    expect(deleteUrl).toBe(putUrl);
    expect(deleteInit?.method).toBe('DELETE');
    expect(deleteInit?.body).toBeUndefined();
  });
});
