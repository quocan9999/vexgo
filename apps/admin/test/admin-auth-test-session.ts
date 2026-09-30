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
}));

vi.mock('@/features/admin-auth/hooks/use-admin-session', () => ({
  useAdminSession: () => mockAdminSession.state,
}));

export function resetAdminTestSession() {
  mockAdminSession.state = {
    status: 'authenticated',
    session: platformSession,
  };
}

export function setAdminTestSession(state: TestSessionState) {
  mockAdminSession.state = state;
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
