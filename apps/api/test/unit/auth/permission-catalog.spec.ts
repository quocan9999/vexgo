import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_ROLE_DEFAULT_PERMISSION_KEYS,
} from '../../../src/auth/permissions/permission-catalog.js';

const permissionKeys = ADMIN_PERMISSION_CATALOG.map(({ key }) => key);

describe('Admin permission defaults', () => {
  it('keeps every current operational capability for NHA_XE_ADMIN', async () => {
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
      'bus-company:read',
      'bus-company:create',
      'bus-company:update',
      'admin-account:read',
      'admin-account:create',
      'admin-account:update',
    ]);
    expect(new Set(permissionKeys).size).toBe(permissionKeys.length);
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
});
