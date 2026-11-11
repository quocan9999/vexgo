// @vitest-environment jsdom
import { cleanup } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canAccessTenantDashboard,
  canAccessTenantPath,
} from '../src/features/admin-auth/services/admin-access';
import type { AdminSession } from '../src/features/admin-auth/services/admin-auth';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Tenant Dashboard Routing & Access Authorization', () => {
  afterEach(() => {
    cleanup();
  });

  const validTenantSession: AdminSession = {
    accountId: 10,
    fullName: 'Điều độ viên Phương Trang',
    phoneNumber: '+84900000010',
    email: 'dispatcher@futa.vn',
    roles: ['NHAN_VIEN_DIEU_HANH'],
    permissions: ['trip:read', 'booking:read', 'shipment:read'],
    employee: {
      employeeId: 100,
      busCompanyId: 5,
      busCompanyCode: 'FUTA',
      busCompanyName: 'Phương Trang',
    },
    busCompanyId: 5,
  };

  const restrictedTenantSession: AdminSession = {
    accountId: 99,
    fullName: 'Nhân viên chưa cấp quyền',
    phoneNumber: '+84900000099',
    email: 'restricted@futa.vn',
    roles: ['NHAN_VIEN_CSKH'],
    permissions: [],
    employee: {
      employeeId: 199,
      busCompanyId: 5,
      busCompanyCode: 'FUTA',
      busCompanyName: 'Phương Trang',
    },
    busCompanyId: 5,
  };

  const superAdminSession: AdminSession = {
    accountId: 1,
    fullName: 'Super Administrator',
    phoneNumber: '+84900000001',
    email: 'admin@vexgo.com',
    roles: ['SUPER_ADMIN'],
    permissions: ['bus-company:read', 'admin-account:read'],
    employee: null,
    busCompanyId: null,
  };

  it('authorizes valid tenant sessions to access dashboard at /', () => {
    expect(canAccessTenantDashboard(validTenantSession)).toBe(true);
    expect(canAccessTenantPath(validTenantSession, '/')).toBe(true);
  });

  it('denies access to tenant dashboard for tenant sessions without any operational permissions', () => {
    expect(canAccessTenantDashboard(restrictedTenantSession)).toBe(false);
    expect(canAccessTenantPath(restrictedTenantSession, '/')).toBe(false);
  });

  it('denies tenant dashboard access to platform Super Admin sessions', () => {
    expect(canAccessTenantDashboard(superAdminSession)).toBe(false);
    expect(canAccessTenantPath(superAdminSession, '/')).toBe(false);
  });
});
