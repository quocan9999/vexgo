export type AuthUser = {
  accountId: number;
  customerId: number | null;
  fullName: string;
  phoneNumber: string;
  roles: string[];
};

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
};

type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type StoredAuth = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export const AUTH_STORAGE_KEY = 'vexgo:auth';

const UNAUTHENTICATED_STATE: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: true,
};

export function readStoredAuth(storage?: AuthStorage): AuthState {
  if (!storage) return UNAUTHENTICATED_STATE;

  try {
    const stored = storage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return UNAUTHENTICATED_STATE;

    const parsed = JSON.parse(stored) as Partial<StoredAuth>;
    if (typeof parsed.accessToken !== 'string' || !parsed.user) {
      return UNAUTHENTICATED_STATE;
    }

    return {
      user: parsed.user,
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      isAuthenticated: true,
      isHydrated: true,
    };
  } catch {
    return UNAUTHENTICATED_STATE;
  }
}

export function writeStoredAuth(storage: AuthStorage, auth: StoredAuth): void {
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth(storage: AuthStorage): void {
  storage.removeItem(AUTH_STORAGE_KEY);
}
