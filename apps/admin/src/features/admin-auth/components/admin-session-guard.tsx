'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useDemoAdminSession } from '../hooks/use-demo-admin-session';

export function AdminSessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const sessionStatus = useDemoAdminSession();

  useEffect(() => {
    if (sessionStatus === 'anonymous') {
      router.replace('/login');
    }
  }, [router, sessionStatus]);

  if (sessionStatus !== 'authenticated') {
    return (
      <div className="auth-loading" role="status">
        <span className="auth-loading-mark" aria-hidden="true">
          V
        </span>
        <span>Đang kiểm tra phiên quản trị…</span>
      </div>
    );
  }

  return children;
}
