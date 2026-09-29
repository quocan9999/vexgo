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

beforeEach(resetAdminTestSession);
