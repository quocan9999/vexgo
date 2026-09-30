import { describe, expect, it } from 'vitest';
import {
  getFirstAccessibleAdminPath,
  getRequiredAdminPermissions,
  hasAllAdminPermissions,
  hasAdminPermission,
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
    expect(getRequiredAdminPermissions('/vehicle-types-extra')).toBeNull();
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
