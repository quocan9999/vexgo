// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { setAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  usePathname: () => '/fare-prices',
  useRouter: () => ({ replace: vi.fn() }),
}));

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

afterEach(cleanup);

describe('Super Admin navigation for fare prices', () => {
  it('shows the active fare-price link and header account control', () => {
    setAdminTestSession({
      status: 'authenticated',
      session: {
        accountId: 2,
        fullName: 'Quản lý FUTA',
        phoneNumber: '+84900000002',
        email: 'futa@vexgo.test',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['fare-price:read'],
        employee: {
          employeeId: 1,
          busCompanyId: 10,
          busCompanyCode: 'FUTA',
          busCompanyName: 'FUTA',
        },
        busCompanyId: 10,
      },
    });
    render(
      <SuperAdminLayout activeSection="fare-prices">
        <h1>Quản lý bảng giá vé</h1>
      </SuperAdminLayout>,
    );

    const link = screen.getByRole('link', { name: 'Bảng giá vé' });
    expect(link.getAttribute('href')).toBe('/fare-prices');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /VexGo/ })).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Tài khoản Quản lý FUTA' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeTruthy();
    expect(document.querySelector('.breadcrumb')).toBeNull();
  });

  it('shows booking management only to a tenant with booking:read', () => {
    setAdminTestSession({
      status: 'authenticated',
      session: {
        accountId: 2,
        fullName: 'Nhân viên CSKH',
        phoneNumber: '+84900000002',
        email: 'cskh@vexgo.test',
        roles: ['NHAN_VIEN_CSKH'],
        permissions: ['booking:read'],
        employee: {
          employeeId: 1,
          busCompanyId: 10,
          busCompanyCode: 'FUTA',
          busCompanyName: 'FUTA',
        },
        busCompanyId: 10,
      },
    });
    const { rerender } = render(
      <SuperAdminLayout activeSection="booking-management">
        <h1>Quản lý phiếu đặt vé &amp; vé</h1>
      </SuperAdminLayout>,
    );

    expect(
      screen
        .getByRole('link', { name: 'Quản lý phiếu đặt vé & vé' })
        .getAttribute('href'),
    ).toBe('/booking-management');

    setAdminTestSession({
      status: 'authenticated',
      session: {
        accountId: 1,
        fullName: 'Super Admin',
        phoneNumber: '+84900000001',
        email: 'admin@vexgo.test',
        roles: ['SUPER_ADMIN'],
        permissions: ['booking:read'],
        employee: null,
        busCompanyId: null,
      },
    });
    rerender(
      <SuperAdminLayout activeSection="overview">
        <h1>Tổng quan</h1>
      </SuperAdminLayout>,
    );
    expect(
      screen.queryByRole('link', { name: 'Quản lý phiếu đặt vé & vé' }),
    ).toBeNull();
  });
});
