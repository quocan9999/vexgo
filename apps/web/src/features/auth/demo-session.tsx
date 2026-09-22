'use client';

import { createContext, useContext, useMemo, useState } from 'react';

export type DemoUser = {
  fullName: string;
  phone: string;
  email: string;
};

type DemoSessionContextValue = {
  user: DemoUser | null;
  signIn: (user?: Partial<DemoUser>) => void;
  signOut: () => void;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const value = useMemo(
    () => ({
      user,
      signIn: (nextUser: Partial<DemoUser> = {}) => setUser({ fullName: 'Nguyễn Văn Hùng', phone: '0912 345 678', email: 'hung@example.com', ...nextUser }),
      signOut: () => setUser(null),
    }),
    [user],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession() {
  const context = useContext(DemoSessionContext);
  if (!context) throw new Error('useDemoSession must be used inside DemoSessionProvider');
  return context;
}
