import { describe, expect, it } from 'vitest';
import {
  canManagePlatformRbac,
  canReadTenantRbac,
  canWriteTenantRbac,
  getFirstAccessibleAdminPath,
  getRequiredAdminPermissions,
  getRequiredPlatformAdminPermissions,
  hasAllPlatformAdminPermissions,
  hasAllAdminPermissions,
  hasAdminPermission,
  hasPlatformAdminPermission,
  isPlatformRbacPath,
  isTenantRbacPath,
} from '@/features/admin-auth/services/admin-access';
import { getAdminAccessScope } from '@/features/admin-auth/services/admin-scope';
import type { AdminSession } from '@/features/admin-auth/services/admin-auth';

function makeTenantSession(
  roles: string[],
  permissions: string[] = [],
): AdminSession {
  return {
    accountId: 5,
    fullName: 'Nhân viên CSKH',
    phoneNumber: '+84900000005',
    email: 'cskh@vexgo.test',
    roles,
    permissions,
    employee: {
      employeeId: 5,
      busCompanyId: 12,
      busCompanyCode: 'THANHBUOI',
      busCompanyName: 'Thành Bưởi',
    },
    busCompanyId: 12,
  };
}

function makePlatformSession(permissions: string[] = []): AdminSession {
  return {
    accountId: 1,
    fullName: 'Super Admin',
    phoneNumber: '+84900000001',
    email: 'admin@vexgo.test',
    roles: ['SUPER_ADMIN'],
    permissions,
    employee: null,
    busCompanyId: null,
  };
}

describe('admin access scope and permissions', () => {
  it('accepts an employee-only account with matching tenant identity', () => {
    expect(
      getAdminAccessScope(makeTenantSession(['NHAN_VIEN_CSKH'])),
    ).toBe('tenant');
  });

  it('fails closed when an employee identity references another tenant', () => {
    const session = makeTenantSession(['NHAN_VIEN_CSKH']);
    session.employee = { ...session.employee!, busCompanyId: 15 };

    expect(getAdminAccessScope(session)).toBe('conflict');
  });

  it('requires every permission mapped to a route', () => {
    expect(getRequiredAdminPermissions('/vehicles/42/seats')).toEqual([
      'vehicle:read',
      'seat:read',
    ]);
    expect(getRequiredAdminPermissions('/vehicles')).toEqual(['vehicle:read']);
    expect(getRequiredAdminPermissions('/routes/123')).toEqual(['route:read']);
    expect(getRequiredAdminPermissions('/customers')).toEqual(['customer:read']);
    expect(getRequiredAdminPermissions('/vehicle-types-extra')).toBeNull();
  });

  it('maps platform company routes to the platform read permission', () => {
    expect(getRequiredPlatformAdminPermissions('/bus-companies')).toEqual([
      'bus-company:read',
    ]);
    expect(getRequiredPlatformAdminPermissions('/bus-companies/42')).toEqual([
      'bus-company:read',
    ]);
    expect(getRequiredPlatformAdminPermissions('/bus-companies-extra')).toBeNull();
  });

  it('maps admin account routes to the platform account read permission', () => {
    expect(getRequiredPlatformAdminPermissions('/admin-accounts')).toEqual([
      'admin-account:read',
    ]);
    expect(getRequiredPlatformAdminPermissions('/admin-accounts/42')).toEqual([
      'admin-account:read',
    ]);
    expect(getRequiredPlatformAdminPermissions('/admin-accounts-extra')).toBeNull();
  });

  it('allows only the exact SUPER_ADMIN principal to manage platform RBAC', () => {
    expect(canManagePlatformRbac(makePlatformSession())).toBe(true);
    expect(canManagePlatformRbac(null)).toBe(false);
    expect(
      canManagePlatformRbac(
        makeTenantSession(['NHAN_VIEN_CSKH'], ['rbac:manage']),
      ),
    ).toBe(false);
    expect(
      canManagePlatformRbac({
        ...makePlatformSession(),
        roles: ['SUPER_ADMIN', 'NHA_XE_ADMIN'],
        employee: {
          employeeId: 5,
          busCompanyId: 12,
          busCompanyCode: 'THANHBUOI',
          busCompanyName: 'Thành Bưởi',
        },
        busCompanyId: 12,
      }),
    ).toBe(false);
  });

  it('matches only the platform RBAC route and its descendants', () => {
    expect(isPlatformRbacPath('/rbac')).toBe(true);
    expect(isPlatformRbacPath('/rbac/roles')).toBe(true);
    expect(isPlatformRbacPath('/rbac-extra')).toBe(false);
  });

  it('allows tenant RBAC access only to a scoped NHA_XE_ADMIN with role:read', () => {
    const tenantAdmin = makeTenantSession(
      ['NHA_XE_ADMIN'],
      ['role:read', 'permission:assign'],
    );

    expect(canReadTenantRbac(tenantAdmin)).toBe(true);
    expect(canWriteTenantRbac(tenantAdmin)).toBe(true);
    expect(
      canReadTenantRbac(
        makeTenantSession(['NHA_XE_ADMIN'], ['permission:assign']),
      ),
    ).toBe(false);
    expect(
      canReadTenantRbac(
        makeTenantSession(
          ['NHAN_VIEN_CSKH'],
          ['role:read', 'permission:assign'],
        ),
      ),
    ).toBe(false);
    expect(
      canReadTenantRbac({
        ...tenantAdmin,
        roles: ['SUPER_ADMIN', 'NHA_XE_ADMIN'],
      }),
    ).toBe(false);
  });

  it('matches only the tenant RBAC route and its descendants', () => {
    expect(isTenantRbacPath('/tenant-rbac')).toBe(true);
    expect(isTenantRbacPath('/tenant-rbac/child')).toBe(true);
    expect(isTenantRbacPath('/tenant-rbac-extra')).toBe(false);
  });

  it('resolves platform permissions only for a valid platform principal', () => {
    const platform = makePlatformSession([
      'bus-company:read',
      'bus-company:create',
      'bus-company:update',
    ]);
    const tenant = makeTenantSession(['NHAN_VIEN_CSKH'], [
      'bus-company:read',
      'bus-company:create',
      'bus-company:update',
    ]);

    expect(hasPlatformAdminPermission(platform, 'bus-company:read')).toBe(true);
    expect(hasPlatformAdminPermission(platform, 'bus-company:create')).toBe(true);
    expect(hasPlatformAdminPermission(platform, 'bus-company:update')).toBe(true);
    expect(hasAllPlatformAdminPermissions(platform, ['bus-company:read'])).toBe(true);
    expect(hasPlatformAdminPermission(tenant, 'bus-company:read')).toBe(false);
    expect(hasAllPlatformAdminPermissions(tenant, ['bus-company:read'])).toBe(false);
    expect(hasPlatformAdminPermission(makePlatformSession(), 'bus-company:read')).toBe(false);
    expect(hasPlatformAdminPermission(null, 'bus-company:read')).toBe(false);
  });

  it('selects the first tenant page the session can read', () => {
    const session = makeTenantSession(
      ['NHAN_VIEN_CSKH'],
      ['route:read', 'fare-price:read'],
    );

    expect(getFirstAccessibleAdminPath(session)).toBe('/routes');
    expect(hasAdminPermission(session, 'fare-price:read')).toBe(true);
    expect(hasAdminPermission(session, 'vehicle:read')).toBe(false);
  });

  it('uses tenant RBAC as a fallback only for an authorized tenant admin', () => {
    const tenantAdmin = makeTenantSession(['NHA_XE_ADMIN'], ['role:read']);
    const employeeWithSameKeys = makeTenantSession(
      ['NHAN_VIEN_CSKH'],
      ['role:read', 'permission:assign'],
    );

    expect(getFirstAccessibleAdminPath(tenantAdmin)).toBe('/tenant-rbac');
    expect(getFirstAccessibleAdminPath(employeeWithSameKeys)).toBeNull();
    expect(
      getFirstAccessibleAdminPath(
        makeTenantSession(['NHA_XE_ADMIN'], ['permission:assign']),
      ),
    ).toBeNull();
  });

  it('fails closed for empty permission checks without an authenticated tenant session', () => {
    const platformSession: AdminSession = {
      accountId: 1,
      fullName: 'Super Admin',
      phoneNumber: '+84900000001',
      email: 'admin@vexgo.test',
      roles: ['SUPER_ADMIN'],
      permissions: [],
      employee: null,
      busCompanyId: null,
    };

    expect(hasAllAdminPermissions(null, [])).toBe(false);
    expect(hasAllAdminPermissions(platformSession, [])).toBe(false);
    expect(
      hasAllAdminPermissions(makeTenantSession(['NHAN_VIEN_CSKH']), []),
    ).toBe(true);
  });

  it('does not expose operational pages to a platform principal even if it has those keys', () => {
    const session: AdminSession = {
      accountId: 1,
      fullName: 'Super Admin',
      phoneNumber: '+84900000001',
      email: 'admin@vexgo.test',
      roles: ['SUPER_ADMIN'],
      permissions: ['route:read'],
      employee: null,
      busCompanyId: null,
    };

    expect(hasAdminPermission(session, 'route:read')).toBe(false);
    expect(getFirstAccessibleAdminPath(session)).toBeNull();
  });
});
