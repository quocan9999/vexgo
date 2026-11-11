// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, replace } = vi.hoisted(() => ({
  state: {
    pathname: '/en/vehicle-types',
  },
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace }),
}));

import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import {
  resetAdminTestSession,
  setAdminTestSession,
} from './admin-auth-test-session';

vi.mock('@/features/admin-auth/services/admin-auth', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/features/admin-auth/services/admin-auth')
    >();
  return {
    ...actual,
    initializeAdminSession: vi.fn(async () => null),
  };
});

function setTenantSession(permissions: string[] = ['vehicle-type:read']) {
  setAdminTestSession({
    status: 'authenticated',
    session: {
      accountId: 2,
      fullName: 'Quản lý FUTA',
      phoneNumber: '+84900000002',
      email: 'futa@vexgo.test',
      roles: ['NHA_XE_ADMIN'],
      permissions,
      employee: {
        employeeId: 1,
        busCompanyId: 10,
        busCompanyCode: 'FUTA',
        busCompanyName: 'FUTA',
      },
      busCompanyId: 10,
    },
  });
}

function setPlatformSession(permissions: string[] = ['bus-company:read', 'admin-account:read']) {
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

describe('AdminSessionGuard with locale prefixes', () => {
  beforeEach(() => {
    cleanup();
    replace.mockReset();
    resetAdminTestSession();
  });

  afterEach(() => {
    cleanup();
  });

  it('allows access to /en/vehicle-types when tenant has vehicle-type:read without redirect loop', () => {
    state.pathname = '/en/vehicle-types';
    setTenantSession(['vehicle-type:read']);

    render(
      <AdminSessionGuard>
        <div data-testid="protected-content">Vehicle Types Content</div>
      </AdminSessionGuard>,
    );

    expect(screen.getByTestId('protected-content')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(
      screen.queryByText('Đang mở khu vực phù hợp với tài khoản…'),
    ).toBeNull();
  });

  it('redirects to /en/routes preserving locale when tenant lacks permission for /en/vehicle-types', async () => {
    state.pathname = '/en/vehicle-types';
    setTenantSession(['route:read']);

    render(
      <AdminSessionGuard>
        <div data-testid="protected-content">Vehicle Types Content</div>
      </AdminSessionGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en/routes');
    });
  });

  it('redirects anonymous user from /en/vehicle-types to /en/login', async () => {
    state.pathname = '/en/vehicle-types';
    setAdminTestSession({ status: 'anonymous' });

    render(
      <AdminSessionGuard>
        <div data-testid="protected-content">Vehicle Types Content</div>
      </AdminSessionGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en/login');
    });
  });

  it('redirects platform admin from /en/vehicle-types to platform root /en', async () => {
    state.pathname = '/en/vehicle-types';
    setPlatformSession(['bus-company:read', 'admin-account:read']);

    render(
      <AdminSessionGuard>
        <div data-testid="protected-content">Vehicle Types Content</div>
      </AdminSessionGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en');
    });
  });
});
