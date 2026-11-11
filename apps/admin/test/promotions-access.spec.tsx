import { describe, expect, it } from 'vitest';
import type { AdminSession } from '@/features/admin-auth/services/admin-auth';
import {
  getFirstAccessibleAdminPath,
  getRequiredAdminPermissions,
} from '@/features/admin-auth/services/admin-access';

const promotionReader: AdminSession = {
  accountId: 71,
  fullName: 'Quản lý FUTA',
  phoneNumber: '+84900000071',
  email: 'promotion-reader@vexgo.test',
  roles: ['NHA_XE_ADMIN'],
  permissions: ['promotion:read'],
  employee: {
    employeeId: 71,
    busCompanyId: 10,
    busCompanyCode: 'FUTA',
    busCompanyName: 'FUTA',
  },
  busCompanyId: 10,
};

describe('Promotion admin route access', () => {
  it('requires promotion:read for the page and its nested paths', () => {
    expect(getRequiredAdminPermissions('/promotions')).toEqual([
      'promotion:read',
    ]);
    expect(getRequiredAdminPermissions('/promotions/15')).toEqual([
      'promotion:read',
    ]);
  });

  it('uses the promotions page as the landing path for a promotion-only tenant', () => {
    expect(getFirstAccessibleAdminPath(promotionReader)).toBe('/promotions');
  });
});
