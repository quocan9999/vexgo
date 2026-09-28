'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { DemoUser, DemoSessionState, createDemoUser } from './demo-session-state';

type DemoSessionContextValue = DemoSessionState & {
  signIn: (user?: Partial<DemoUser>) => void;
  signOut: () => void;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoSessionState>({
    user: createDemoUser(),
    isAuthenticated: true,
  });

  const value = useMemo(
    () => ({
      ...state,
      signIn: (nextUser: Partial<DemoUser> = {}) => setState({ user: createDemoUser(nextUser), isAuthenticated: true }),
      signOut: () => setState({ user: null, isAuthenticated: false }),
    }),
    [state],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession() {
  const context = useContext(DemoSessionContext);
  if (!context) throw new Error('useDemoSession must be used inside DemoSessionProvider');
  return context;
}
