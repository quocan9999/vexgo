'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth,
  type AuthState,
  type AuthUser,
} from './auth-session-state';
import { authApi } from './services/auth.api';
import { runWithAuthRetry, type TokenPair } from './services/auth-retry';

export type { AuthState, AuthUser } from './auth-session-state';

type AuthSessionContextValue = AuthState & {
  signIn: (data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => void;
  signOut: () => void;
  refreshSession: () => Promise<string | null>;
  executeWithAuth: <T>(action: (token: string) => Promise<T>) => Promise<T>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isHydrated: false,
  });
  const current = useRef(state);
  const generation = useRef(0);
  const refreshInFlight = useRef<Promise<TokenPair> | null>(null);
  const invalidatePending = useCallback(() => {
    generation.current++;
    refreshInFlight.current = null;
  }, []);
  const updateState = useCallback((next: AuthState) => {
    current.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) updateState(readStoredAuth(window.localStorage));
    });
    return () => {
      active = false;
      invalidatePending();
    };
  }, [updateState, invalidatePending]);

  const signIn = useCallback(
    (data: { user: AuthUser; accessToken: string; refreshToken: string }) => {
      const nextState = {
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isHydrated: true,
      };
      generation.current++;
      refreshInFlight.current = null;
      updateState(nextState);
      try {
        writeStoredAuth(window.localStorage, data);
      } catch {}
    },
    [updateState],
  );

  const signOut = useCallback(() => {
    const currentToken = current.current.accessToken;
    const currentRefreshToken = current.current.refreshToken;
    const nextState = {
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: true,
    };
    void authApi.logout(currentRefreshToken, currentToken);
    generation.current++;
    refreshInFlight.current = null;
    updateState(nextState);
    try {
      clearStoredAuth(window.localStorage);
    } catch {}
  }, [updateState]);

  const refreshTokens = useCallback(
    async (epoch: number, previousRefresh?: string): Promise<TokenPair> => {
      if (epoch !== generation.current)
        throw new Error('Phiên đăng nhập đã thay đổi.');
      const snapshot = current.current;
      if (
        previousRefresh &&
        snapshot.refreshToken !== previousRefresh &&
        snapshot.accessToken &&
        snapshot.refreshToken
      ) {
        return {
          accessToken: snapshot.accessToken,
          refreshToken: snapshot.refreshToken,
        };
      }
      if (refreshInFlight.current) return refreshInFlight.current;
      if (!snapshot.refreshToken || !snapshot.user)
        throw new Error('Chưa đăng nhập');
      const operation = (async () => {
        const { data } = await authApi.refresh(snapshot.refreshToken!);
        if (epoch !== generation.current)
          throw new Error('Phiên đăng nhập đã thay đổi.');
        updateState({
          ...snapshot,
          ...data,
          isAuthenticated: true,
          isHydrated: true,
        });
        try {
          writeStoredAuth(window.localStorage, {
            user: snapshot.user!,
            ...data,
          });
        } catch {}
        return data;
      })();
      refreshInFlight.current = operation;
      try {
        return await operation;
      } finally {
        if (refreshInFlight.current === operation)
          refreshInFlight.current = null;
      }
    },
    [updateState],
  );

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const epoch = generation.current;
    try {
      return (await refreshTokens(epoch)).accessToken;
    } catch {
      if (epoch === generation.current) signOut();
      return null;
    }
  }, [refreshTokens, signOut]);

  const executeWithAuth = useCallback(
    async <T,>(action: (token: string) => Promise<T>): Promise<T> => {
      const epoch = generation.current;
      const ensureCurrent = () => {
        if (epoch !== generation.current)
          throw new Error('Phiên đăng nhập đã thay đổi.');
      };
      return runWithAuthRetry(
        async (token) => {
          ensureCurrent();
          const result = await action(token);
          ensureCurrent();
          return result;
        },
        {
          getTokens: () => ({
            accessToken: current.current.accessToken,
            refreshToken: current.current.refreshToken,
          }),
          onRefresh: () => {}, // The shared refresh operation publishes tokens once, before any retry.
          onAuthFailed: () => {
            if (epoch === generation.current) signOut();
          },
          refreshFn: async (rt) => ({ data: await refreshTokens(epoch, rt) }),
        },
      );
    },
    [refreshTokens, signOut],
  );

  const value = useMemo(
    () => ({
      ...state,
      signIn,
      signOut,
      refreshSession,
      executeWithAuth,
    }),
    [state, signIn, signOut, refreshSession, executeWithAuth],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context)
    throw new Error('useAuthSession must be used inside AuthSessionProvider');
  return context;
}
