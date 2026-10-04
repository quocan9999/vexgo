// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, replace } = vi.hoisted(() => ({
  state: { pathname: '/admin-accounts' },
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) =>
    function MockIcon({
      className,
      size,
      ...props
    }: React.SVGProps<SVGSVGElement> & { size?: number }) {
      return (
        <svg
          {...props}
          aria-hidden="true"
          className={`lucide lucide-${name}${className ? ` ${className}` : ''}`}
          height={size}
          width={size}
        />
      );
    };

  return {
    Bus: icon('bus'),
    Building2: icon('building-2'),
    Database: icon('database'),
    LogOut: icon('log-out'),
    MapPinned: icon('map-pinned'),
    Menu: icon('menu'),
    PanelLeftClose: icon('panel-left-close'),
    PanelLeftOpen: icon('panel-left-open'),
    ShieldCheck: icon('shield-check'),
    Ticket: icon('ticket'),
    Truck: icon('truck'),
    UsersRound: icon('users-round'),
    X: icon('x'),
  };
});

vi.mock('@/features/admin-auth/services/admin-auth', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/features/admin-auth/services/admin-auth')
    >();

  return {
    ...actual,
    initializeAdminSession: vi.fn(async () => null),
    signOutAdmin: vi.fn(async () => undefined),
  };
});

import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  resetAdminTestSession,
  setAdminTestSession,
  setEmployeeAdminTestSession,
} from './admin-auth-test-session';

function setPlatformPermissions(permissions: string[]) {
  setAdminTestSession({
    status: 'authenticated',
    session: {
      accountId: 1,
      fullName: 'Super Admin',
      phoneNumber: '+84900000001',
      email: 'admin@vexgo.test',
      roles: ['SUPER_ADMIN'],
      permissions,
      employee: null,
      busCompanyId: null,
    },
  });
}

describe('Admin account management access', () => {
  beforeEach(() => {
    resetAdminTestSession();
    state.pathname = '/admin-accounts';
    replace.mockReset();
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it('shows the account menu only to a platform principal with read permission', () => {
    setPlatformPermissions(['admin-account:read']);
    const { rerender } = render(
      <SuperAdminLayout activeSection="admin-accounts">
        <p>Nội dung tài khoản</p>
      </SuperAdminLayout>,
    );

    expect(
      screen
        .getByRole('link', { name: 'Tài khoản Admin' })
        .getAttribute('href'),
    ).toBe('/admin-accounts');

    setPlatformPermissions([]);
    rerender(
      <SuperAdminLayout activeSection="admin-accounts">
        <p>Nội dung tài khoản</p>
      </SuperAdminLayout>,
    );
    expect(screen.queryByRole('link', { name: 'Tài khoản Admin' })).toBeNull();

    setEmployeeAdminTestSession(['admin-account:read']);
    rerender(
      <SuperAdminLayout activeSection="admin-accounts">
        <p>Nội dung tài khoản</p>
      </SuperAdminLayout>,
    );
    expect(screen.queryByRole('link', { name: 'Tài khoản Admin' })).toBeNull();
  });

  it('restores and persists the sidebar collapse preference', () => {
    window.localStorage.setItem('vexgo-admin-sidebar-collapsed', 'true');
    setPlatformPermissions([]);

    const { container } = render(
      <SuperAdminLayout activeSection="admin-accounts">
        <p>Nội dung tài khoản</p>
      </SuperAdminLayout>,
    );

    expect(
      container
        .querySelector('.admin-shell')
        ?.classList.contains('is-sidebar-collapsed'),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' }));

    expect(
      container
        .querySelector('.admin-shell')
        ?.classList.contains('is-sidebar-collapsed'),
    ).toBe(false);
    expect(window.localStorage.getItem('vexgo-admin-sidebar-collapsed')).toBe('false');
  });

  it('blocks direct account-page access without platform read permission', async () => {
    setPlatformPermissions([]);

    render(
      <AdminSessionGuard>
        <p>Nội dung nhạy cảm</p>
      </AdminSessionGuard>,
    );

    expect(screen.queryByText('Nội dung nhạy cảm')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('allows direct account-page access with platform read permission', () => {
    setPlatformPermissions(['admin-account:read']);

    render(
      <AdminSessionGuard>
        <p>Nội dung tài khoản</p>
      </AdminSessionGuard>,
    );

    expect(screen.getByText('Nội dung tài khoản')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
