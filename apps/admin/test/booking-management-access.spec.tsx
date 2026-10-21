// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
  pathname: '/booking-management',
  replace: vi.fn(),
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
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/admin-auth/services/admin-auth', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/features/admin-auth/services/admin-auth')
    >();
  return { ...actual, initializeAdminSession: vi.fn(async () => null) };
});

import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import {
  setAdminTestSession,
  setEmployeeAdminTestSession,
} from './admin-auth-test-session';

function setSuperAdminWithBookingPermission() {
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
}

describe('booking management direct-route access', () => {
  beforeEach(() => {
    navigation.pathname = '/booking-management';
    navigation.replace.mockReset();
  });

  afterEach(cleanup);

  it('mounts the page for a tenant principal with booking:read', () => {
    setEmployeeAdminTestSession(['booking:read']);
    render(
      <AdminSessionGuard>
        <p>Phiếu đặt vé tenant</p>
      </AdminSessionGuard>,
    );

    expect(screen.getByText('Phiếu đặt vé tenant')).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('blocks a tenant without booking:read and redirects to its first permitted page', async () => {
    setEmployeeAdminTestSession(['route:read']);
    render(
      <AdminSessionGuard>
        <p>Dữ liệu phiếu nhạy cảm</p>
      </AdminSessionGuard>,
    );

    expect(screen.queryByText('Dữ liệu phiếu nhạy cảm')).toBeNull();
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/routes'),
    );
  });

  it('blocks SUPER_ADMIN even when the session contains booking:read', async () => {
    setSuperAdminWithBookingPermission();
    render(
      <AdminSessionGuard>
        <p>Dữ liệu tenant phiếu</p>
      </AdminSessionGuard>,
    );

    expect(screen.queryByText('Dữ liệu tenant phiếu')).toBeNull();
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/'));
  });
});
