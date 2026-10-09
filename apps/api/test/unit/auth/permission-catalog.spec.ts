import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME,
  ADMIN_ROLE_DEFAULT_PERMISSION_KEYS,
  isPermissionAllowedForRole,
} from '../../../src/auth/permissions/permission-catalog.js';

const permissionKeys = ADMIN_PERMISSION_CATALOG.map(({ key }) => key);

describe('Admin permission defaults', () => {
  it('keeps operational and RBAC-management capabilities for NHA_XE_ADMIN', () => {
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN).toEqual([
      'vehicle-type:read',
      'vehicle-type:create',
      'vehicle-type:update',
      'vehicle:read',
      'vehicle:create',
      'vehicle:update',
      'seat:read',
      'seat:create',
      'seat:update',
      'seat:delete',
      'route:read',
      'route:create',
      'route:update',
      'fare-price:read',
      'fare-price:create',
      'fare-price:update',
      'trip:read',
      'trip:create',
      'trip:update',
      'trip:cancel',
      'role:read',
      'permission:assign',
      'customer:read',
      'booking:read',
    ]);
  });

  it('assigns operational capabilities to NHAN_VIEN_DIEU_HANH by default', () => {
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_DIEU_HANH).toEqual([
      'vehicle-type:read',
      'vehicle-type:create',
      'vehicle-type:update',
      'vehicle:read',
      'vehicle:create',
      'vehicle:update',
      'seat:read',
      'seat:create',
      'seat:update',
      'seat:delete',
      'route:read',
      'route:create',
      'route:update',
      'fare-price:read',
      'fare-price:create',
      'fare-price:update',
      'trip:read',
      'trip:create',
      'trip:update',
      'trip:cancel',
    ]);
  });

  it('defines unique permissions for the current operational and platform APIs', () => {
    expect(permissionKeys).toEqual([
      'vehicle-type:read',
      'vehicle-type:create',
      'vehicle-type:update',
      'vehicle:read',
      'vehicle:create',
      'vehicle:update',
      'seat:read',
      'seat:create',
      'seat:update',
      'seat:delete',
      'route:read',
      'route:create',
      'route:update',
      'fare-price:read',
      'fare-price:create',
      'fare-price:update',
      'trip:read',
      'trip:create',
      'trip:update',
      'trip:cancel',
      'role:read',
      'permission:assign',
      'customer:read',
      'booking:read',
      'bus-company:read',
      'bus-company:create',
      'bus-company:update',
      'admin-account:read',
      'admin-account:create',
      'admin-account:update',
    ]);
    expect(new Set(permissionKeys).size).toBe(permissionKeys.length);
  });

  it('labels each permission with exactly one authorization scope', () => {
    const tenantPermissionKeys = [
      'vehicle-type:read',
      'vehicle-type:create',
      'vehicle-type:update',
      'vehicle:read',
      'vehicle:create',
      'vehicle:update',
      'seat:read',
      'seat:create',
      'seat:update',
      'seat:delete',
      'route:read',
      'route:create',
      'route:update',
      'fare-price:read',
      'fare-price:create',
      'fare-price:update',
      'trip:read',
      'trip:create',
      'trip:update',
      'trip:cancel',
      'role:read',
      'permission:assign',
      'customer:read',
      'booking:read',
    ];
    const platformPermissionKeys = [
      'bus-company:read',
      'bus-company:create',
      'bus-company:update',
      'admin-account:read',
      'admin-account:create',
      'admin-account:update',
    ];

    expect(
      ADMIN_PERMISSION_CATALOG.filter(({ scope }) => scope === 'tenant').map(
        ({ key }) => key,
      ),
    ).toEqual(tenantPermissionKeys);
    expect(
      ADMIN_PERMISSION_CATALOG.filter(({ scope }) => scope === 'platform').map(
        ({ key }) => key,
      ),
    ).toEqual(platformPermissionKeys);
    expect(
      ADMIN_PERMISSION_CATALOG.every(
        ({ scope }) => scope === 'platform' || scope === 'tenant',
      ),
    ).toBe(true);
  });

  it('assigns SUPER_ADMIN only current platform capabilities', () => {
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.SUPER_ADMIN).toEqual([
      'bus-company:read',
      'bus-company:create',
      'bus-company:update',
      'admin-account:read',
      'admin-account:create',
      'admin-account:update',
    ]);
  });

  it('leaves employee and customer roles without default permissions', () => {
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_BAN_VE).toEqual([]);
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_CSKH).toEqual([]);
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_PHU_XE).toEqual([]);
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_KINH_DOANH).toEqual([]);
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.KHACH_HANG).toEqual([]);
  });

  it('references only permissions defined in the catalog', () => {
    const permissionKeySet = new Set(permissionKeys);
    const missingPermissionKeys = Object.values(
      ADMIN_ROLE_DEFAULT_PERMISSION_KEYS,
    )
      .flat()
      .filter((key) => !permissionKeySet.has(key));

    expect(missingPermissionKeys).toEqual([]);
  });

  it('allows only permissions matching each managed role scope', () => {
    expect(ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME).toEqual({
      SUPER_ADMIN: 'platform',
      NHA_XE_ADMIN: 'tenant',
      NHAN_VIEN_DIEU_HANH: 'tenant',
      NHAN_VIEN_BAN_VE: 'tenant',
      NHAN_VIEN_CSKH: 'tenant',
      NHAN_VIEN_PHU_XE: 'tenant',
      NHAN_VIEN_KINH_DOANH: 'tenant',
    });
    expect(isPermissionAllowedForRole('SUPER_ADMIN', 'bus-company:read')).toBe(
      true,
    );
    expect(isPermissionAllowedForRole('SUPER_ADMIN', 'vehicle:read')).toBe(
      false,
    );
    expect(isPermissionAllowedForRole('NHA_XE_ADMIN', 'vehicle:read')).toBe(
      true,
    );
    expect(isPermissionAllowedForRole('NHA_XE_ADMIN', 'booking:read')).toBe(
      true,
    );
    expect(isPermissionAllowedForRole('NHA_XE_ADMIN', 'role:read')).toBe(true);
    expect(
      isPermissionAllowedForRole('NHA_XE_ADMIN', 'permission:assign'),
    ).toBe(true);
    expect(isPermissionAllowedForRole('SUPER_ADMIN', 'role:read')).toBe(false);
    expect(isPermissionAllowedForRole('SUPER_ADMIN', 'booking:read')).toBe(
      false,
    );
    expect(
      isPermissionAllowedForRole('NHAN_VIEN_CSKH', 'permission:assign'),
    ).toBe(true);
    expect(
      isPermissionAllowedForRole('NHAN_VIEN_CSKH', 'admin-account:read'),
    ).toBe(false);
    expect(isPermissionAllowedForRole('KHACH_HANG', 'vehicle:read')).toBe(
      false,
    );
    expect(isPermissionAllowedForRole('UNKNOWN_ROLE', 'vehicle:read')).toBe(
      false,
    );
    expect(isPermissionAllowedForRole('NHA_XE_ADMIN', 'unknown:read')).toBe(
      false,
    );
  });
});
