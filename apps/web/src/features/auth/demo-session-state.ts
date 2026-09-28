/* eslint-disable */
export type DemoUser = {
  fullName: string;
  phone: string;
  email: string;
};

export type DemoSessionState = {
  user: DemoUser | null;
  isAuthenticated: boolean;
};

export function createDemoUser(overrides: Partial<DemoUser> = {}): DemoUser {
  return {
    fullName: 'Nguyễn Văn Hùng',
    phone: '0912.345.678',
    email: 'hung@example.com',
    ...overrides,
  };
}

export function createDemoSessionStore() {
  let state: DemoSessionState = {
    user: createDemoUser(),
    isAuthenticated: true,
  };
  
  return {
    getState: () => state,
    signIn: (user: Partial<DemoUser> = {}) => {
      state = { user: createDemoUser(user), isAuthenticated: true };
    },
    signOut: () => {
      state = { user: null, isAuthenticated: false };
    },
  };
}
