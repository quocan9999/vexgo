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

type DemoSessionStorage = Pick<Storage, 'getItem' | 'setItem'>;

const DEMO_SESSION_STORAGE_KEY = 'vexgo:demo-session';

export function createDemoUser(overrides: Partial<DemoUser> = {}): DemoUser {
  return {
    fullName: 'Nguyễn Văn Hùng',
    phone: '0912.345.678',
    email: 'hung@example.com',
    ...overrides,
  };
}

function createAuthenticatedDemoSession(): DemoSessionState {
  return {
    user: createDemoUser(),
    isAuthenticated: true,
  };
}

function readStoredSession(storage?: DemoSessionStorage): DemoSessionState {
  if (!storage) return createAuthenticatedDemoSession();

  try {
    const storedValue = storage.getItem(DEMO_SESSION_STORAGE_KEY);
    if (!storedValue) return createAuthenticatedDemoSession();

    const parsed = JSON.parse(storedValue) as DemoSessionState;
    if (parsed.isAuthenticated === false && parsed.user === null) return parsed;
    if (
      parsed.isAuthenticated === true
      && parsed.user
      && typeof parsed.user.fullName === 'string'
      && typeof parsed.user.phone === 'string'
      && typeof parsed.user.email === 'string'
    ) {
      return parsed;
    }
  } catch {
    // Invalid or unavailable demo storage falls back to the demo account.
  }

  return createAuthenticatedDemoSession();
}

export function createDemoSessionStore(storage?: DemoSessionStorage) {
  let state = readStoredSession(storage);

  const updateState = (nextState: DemoSessionState) => {
    state = nextState;
    try {
      storage?.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // Keep the in-memory demo session usable when browser storage is unavailable.
    }
  };

  return {
    getState: () => state,
    signIn: (user: Partial<DemoUser> = {}) => {
      updateState({ user: createDemoUser(user), isAuthenticated: true });
    },
    signOut: () => {
      updateState({ user: null, isAuthenticated: false });
    },
  };
}
