// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminRbacApiError,
  getDefaultRolePermissions,
  replaceDefaultRolePermissions,
} from '@/features/platform-rbac/services/platform-rbac-service';
import type {
  AdminRbacPermission,
  AdminRbacRole,
  DefaultAdminRbacConfig,
} from '@/features/platform-rbac/types/platform-rbac';

const permissions: AdminRbacPermission[] = [
  {
    key: 'bus-company:read',
    scope: 'platform',
    description: 'Xem danh sách nhà xe trên nền tảng.',
  },
  {
    key: 'bus-company:create',
    scope: 'platform',
    description: 'Tạo nhà xe trên nền tảng.',
  },
  {
    key: 'vehicle:read',
    scope: 'tenant',
    description: 'Xem xe trong phạm vi nhà xe.',
  },
];

const roles: AdminRbacRole[] = [
  {
    roleName: 'SUPER_ADMIN',
    description: 'Quản trị nền tảng',
    scope: 'platform',
    isProtected: true,
    permissionKeys: ['bus-company:read'],
  },
  {
    roleName: 'NHA_XE_ADMIN',
    description: 'Quản trị nhà xe',
    scope: 'tenant',
    isProtected: false,
    permissionKeys: ['vehicle:read'],
  },
  ...(['NHAN_VIEN_BAN_VE', 'NHAN_VIEN_CSKH', 'NHAN_VIEN_PHU_XE', 'NHAN_VIEN_KINH_DOANH'] as const).map(
    (roleName) => ({
      roleName,
      description: null,
      scope: 'tenant' as const,
      isProtected: false,
      permissionKeys: [],
    }),
  ),
];

const config: DefaultAdminRbacConfig = { permissions, roles };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('platform RBAC API service', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads and validates the catalog and default mappings through the authenticated API client', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: config }));

    await expect(getDefaultRolePermissions()).resolves.toEqual(config);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/v1/admin-rbac/default-role-permissions');
    expect(init?.credentials).toBe('include');
    expect(init?.cache).toBe('no-store');
  });

  it('sends one complete replacement payload for an editable role without tenant identifiers', async () => {
    const responseRole: AdminRbacRole = {
      ...roles[1],
      permissionKeys: [],
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: responseRole }));

    await expect(
      replaceDefaultRolePermissions(roles[1], [], permissions),
    ).resolves.toEqual(responseRole);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://localhost:4000/api/v1/admin-rbac/default-role-permissions/NHA_XE_ADMIN',
    );
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      permissionKeys: [],
    });
    expect(String(init?.body)).not.toContain('nhaXeId');
  });

  it('rejects protected role replacements before sending a request', async () => {
    for (const permissionKeys of [[], ['bus-company:read']]) {
      await expect(
        replaceDefaultRolePermissions(roles[0], permissionKeys, permissions),
      ).rejects.toMatchObject({ code: 'SUPER_ADMIN_PERMISSION_IMMUTABLE' });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects unknown or cross-scope keys before sending a request', async () => {
    await expect(
      replaceDefaultRolePermissions(roles[1], ['bus-company:read'], permissions),
    ).rejects.toMatchObject({ code: 'INVALID_PERMISSION_LIST' });
    await expect(
      replaceDefaultRolePermissions(roles[1], ['unknown:delete'], permissions),
    ).rejects.toMatchObject({ code: 'INVALID_PERMISSION_LIST' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves API errors and rejects a malformed response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(
          { error: 'PERMISSION_FORBIDDEN', message: 'Không đủ quyền.' },
          403,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { roles: [] } }));

    await expect(getDefaultRolePermissions()).rejects.toMatchObject({
      code: 'PERMISSION_FORBIDDEN',
      message: 'Không đủ quyền.',
    });
    await expect(getDefaultRolePermissions()).rejects.toBeInstanceOf(
      AdminRbacApiError,
    );
  });
});
