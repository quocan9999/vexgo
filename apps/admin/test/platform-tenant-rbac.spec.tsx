// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { navigation, service } = vi.hoisted(() => ({
  navigation: { pathname: '/rbac/tenants', replace: vi.fn() },
  service: { getBusCompanyFilterOptions: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/features/bus-companies/services/bus-company-service', () => service);

vi.mock('@/features/admin-auth/services/admin-auth', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/features/admin-auth/services/admin-auth')
  >();
  return {
    ...actual,
    initializeAdminSession: vi.fn(async () => null),
  };
});

import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { PlatformTenantRbacPicker } from '@/features/platform-rbac/components/platform-tenant-rbac-picker';
import {
  resetAdminTestSession,
  setAdminTestSession,
  setEmployeeAdminTestSession,
} from './admin-auth-test-session';

function renderPicker() {
  return render(
    <AdminSessionGuard>
      <PlatformTenantRbacPicker />
    </AdminSessionGuard>,
  );
}

describe('platform tenant RBAC picker', () => {
  beforeEach(() => {
    resetAdminTestSession();
    navigation.pathname = '/rbac/tenants';
    navigation.replace.mockReset();
    service.getBusCompanyFilterOptions.mockReset().mockResolvedValue([
      { id: 12, label: 'Phương Trang (FUTA)' },
      { id: 23, label: 'Thành Bưởi (THANHBUOI)' },
    ]);
  });

  afterEach(cleanup);

  it('lets Super Admin choose a company without operational read permission', async () => {
    renderPicker();
    expect(await screen.findByRole('heading', { name: 'Phân quyền theo nhà xe' })).toBeTruthy();
    expect(
      screen.getByRole('navigation', { name: 'Phạm vi phân quyền' })
        .querySelector('a[aria-current="page"]')?.textContent,
    ).toContain('Theo nhà xe');
    expect(screen.queryByRole('navigation', { name: 'Vận hành' })).toBeNull();
    expect(
      screen.getByRole('link', { name: /Phương Trang \(FUTA\)/ }).getAttribute('href'),
    ).toBe('/rbac/tenants/12');
    expect(
      screen.getByRole('link', { name: /Thành Bưởi \(THANHBUOI\)/ }).getAttribute('href'),
    ).toBe('/rbac/tenants/23');
    expect(service.getBusCompanyFilterOptions).toHaveBeenCalledOnce();
  });

  it.each([
    ['tenant administrator', ['NHA_XE_ADMIN'], ['role:read', 'permission:assign']],
    ['employee', ['NHAN_VIEN_CSKH'], ['role:read', 'permission:assign']],
    ['mixed platform and tenant roles', ['SUPER_ADMIN', 'NHA_XE_ADMIN'], []],
  ])('does not mount picker content for a %s opening its direct URL', async (_label, roles, permissions) => {
    if (roles[0] === 'NHAN_VIEN_CSKH') {
      setEmployeeAdminTestSession(permissions);
    } else {
      setAdminTestSession({
        status: 'authenticated',
        session: {
          accountId: 10,
          fullName: 'Tài khoản kiểm thử',
          phoneNumber: '+84900000010',
          email: 'test@vexgo.test',
          roles,
          permissions,
          employee: roles.includes('NHA_XE_ADMIN')
            ? {
                employeeId: 10,
                busCompanyId: 12,
                busCompanyCode: 'FUTA',
                busCompanyName: 'Phương Trang',
              }
            : null,
          busCompanyId: roles.includes('NHA_XE_ADMIN') ? 12 : null,
        },
      });
    }

    renderPicker();

    expect(screen.queryByRole('heading', { name: 'Phân quyền theo nhà xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Phương Trang \(FUTA\)/ })).toBeNull();
    expect(service.getBusCompanyFilterOptions).not.toHaveBeenCalled();
  });
});
