import { beforeEach, vi } from 'vitest';

type TestSessionState =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'error'; message: string }
  | { status: 'authenticated'; session: Record<string, unknown> };

const platformSession = {
  accountId: 1,
  fullName: 'Super Admin',
  phoneNumber: '+84900000001',
  email: 'admin@vexgo.test',
  roles: ['SUPER_ADMIN'],
  permissions: [],
  employee: null,
  busCompanyId: null,
};

const mockAdminSession = vi.hoisted(() => ({
  state: null as TestSessionState | null,
  listeners: new Set<() => void>(),
}));

vi.mock('@/features/admin-auth/hooks/use-admin-session', async () => {
  const { useSyncExternalStore } = await vi.importActual<typeof import('react')>(
    'react',
  );

  return {
    useAdminSession: () =>
      useSyncExternalStore(
        (listener) => {
          mockAdminSession.listeners.add(listener);
          return () => mockAdminSession.listeners.delete(listener);
        },
        () => mockAdminSession.state,
        () => mockAdminSession.state,
      ),
  };
});

function publishAdminTestSession(state: TestSessionState) {
  mockAdminSession.state = state;
  mockAdminSession.listeners.forEach((listener) => listener());
}

export function resetAdminTestSession() {
  publishAdminTestSession({
    status: 'authenticated',
    session: platformSession,
  });
}

export function setAdminTestSession(state: TestSessionState) {
  publishAdminTestSession(state);
}

export function setEmployeeAdminTestSession(permissions: string[]) {
  setAdminTestSession({
    status: 'authenticated',
    session: {
      accountId: 2,
      fullName: 'Nhân viên CSKH',
      phoneNumber: '+84900000002',
      email: 'cskh@vexgo.test',
      roles: ['NHAN_VIEN_CSKH'],
      permissions,
      employee: {
        employeeId: 2,
        busCompanyId: 10,
        busCompanyCode: 'FUTA',
        busCompanyName: 'Phương Trang',
      },
      busCompanyId: 10,
    },
  });
}

beforeEach(resetAdminTestSession);
