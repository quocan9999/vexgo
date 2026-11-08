// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, replace } = vi.hoisted(() => ({
  state: { pathname: '/ai-knowledge' },
  replace: vi.fn(),
}));

let memoryStore: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => memoryStore[key] ?? null,
  setItem: (key: string, value: string) => {
    memoryStore[key] = String(value);
  },
  removeItem: (key: string) => {
    delete memoryStore[key];
  },
  clear: () => {
    memoryStore = {};
  },
  get length() {
    return Object.keys(memoryStore).length;
  },
  key: (index: number) => Object.keys(memoryStore)[index] ?? null,
};
Object.defineProperty(window, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace }),
}));

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
import {
  resetAdminTestSession,
  setAdminTestSession,
} from './admin-auth-test-session';

function setTenantSession(permissions: string[]) {
  setAdminTestSession({
    status: 'authenticated',
    session: {
      accountId: 5,
      fullName: 'Nhân viên CSKH / Admin Nhà Xe',
      phoneNumber: '+84900000005',
      email: 'tenant@vexgo.test',
      roles: ['NHA_XE_ADMIN', 'NHAN_VIEN_CSKH'],
      permissions,
      employee: {
        employeeId: 5,
        busCompanyId: 12,
        busCompanyCode: 'THANHBUOI',
        busCompanyName: 'Thành Bưởi',
      },
      busCompanyId: 12,
    },
  });
}

function setPlatformSession() {
  setAdminTestSession({
    status: 'authenticated',
    session: {
      accountId: 1,
      fullName: 'Super Admin',
      phoneNumber: '+84900000001',
      email: 'admin@vexgo.test',
      roles: ['SUPER_ADMIN'],
      permissions: ['bus-company:read', 'admin-account:read'],
      employee: null,
      busCompanyId: null,
    },
  });
}

describe('AI Knowledge route guard and access control', () => {
  beforeEach(() => {
    resetAdminTestSession();
    state.pathname = '/ai-knowledge';
    replace.mockReset();
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it('allows access to /ai-knowledge for tenant session with chat:read permission (does not redirect to /vehicle-types)', () => {
    setTenantSession(['chat:read']);

    render(
      <AdminSessionGuard>
        <p>Nội dung Tri thức AI</p>
      </AdminSessionGuard>,
    );

    expect(screen.getByText('Nội dung Tri thức AI')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('allows access to /ai-knowledge for tenant session with chat:manage permission', () => {
    setTenantSession(['chat:manage']);

    render(
      <AdminSessionGuard>
        <p>Nội dung Tri thức AI</p>
      </AdminSessionGuard>,
    );

    expect(screen.getByText('Nội dung Tri thức AI')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('allows access to /ai-knowledge for platform Super Admin (does not redirect to /)', () => {
    setPlatformSession();

    render(
      <AdminSessionGuard>
        <p>Nội dung Tri thức AI Super Admin</p>
      </AdminSessionGuard>,
    );

    expect(screen.getByText('Nội dung Tri thức AI Super Admin')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects tenant session without chat permission to their landing page', async () => {
    setTenantSession(['vehicle:read']);

    render(
      <AdminSessionGuard>
        <p>Nội dung Tri thức AI</p>
      </AdminSessionGuard>,
    );

    expect(screen.queryByText('Nội dung Tri thức AI')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/vehicles'));
  });
});
