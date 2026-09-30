'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAdminSession } from '../hooks/use-admin-session';
import {
  getAdminAuthErrorMessage,
  initializeAdminSession,
  signOutAdmin,
} from '../services/admin-auth';
import {
  getFirstAccessibleAdminPath,
  getRequiredAdminPermissions,
  getRequiredPlatformAdminPermissions,
  hasAllAdminPermissions,
  hasAllPlatformAdminPermissions,
} from '../services/admin-access';
import { getAdminAccessScope } from '../services/admin-scope';

function LoadingStatus({ message }: { message: string }) {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <span className="auth-loading-mark" aria-hidden="true">V</span>
      <span>{message}</span>
    </div>
  );
}

function RestrictedAccount({ conflict }: { conflict: boolean }) {
  const router = useRouter();
  const sessionState = useAdminSession();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const session = sessionState.status === 'authenticated'
    ? sessionState.session
    : null;

  async function logout() {
    setSigningOut(true);
    setLogoutError(null);
    try {
      await signOutAdmin();
      router.replace('/login');
    } catch (error) {
      setLogoutError(getAdminAuthErrorMessage(error));
      setSigningOut(false);
    }
  }

  return (
    <main className="admin-page-content panel" aria-labelledby="admin-access-title">
      <p className="login-eyebrow">VEXGO · TÀI KHOẢN QUẢN TRỊ</p>
      <h1 id="admin-access-title">Tài khoản chưa có chức năng quản trị khả dụng</h1>
      <p>
        {conflict
          ? 'Phạm vi vai trò của tài khoản chưa hợp lệ. Hãy liên hệ Super Admin để kiểm tra cấu hình.'
          : 'Tài khoản đã đăng nhập nhưng hiện chưa được cấp chức năng trong Admin Web.'}
      </p>
      {session && <p>Đang đăng nhập: {session.fullName}</p>}
      {logoutError && <p className="login-error" role="alert">{logoutError}</p>}
      <button
        className="login-submit-button"
        disabled={signingOut}
        onClick={logout}
        type="button"
      >
        {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </button>
    </main>
  );
}

export function AdminSessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authState = useAdminSession();
  const session = authState.status === 'authenticated'
    ? authState.session
    : null;
  const requiredPermissions = getRequiredAdminPermissions(pathname);

  useEffect(() => {
    void initializeAdminSession().catch(() => undefined);
  }, []);

  const scope = session ? getAdminAccessScope(session) : null;
  const requiredPlatformPermissions =
    getRequiredPlatformAdminPermissions(pathname);
  const tenantNeedsRedirect = scope === 'tenant' && (
    requiredPermissions === null ||
    !hasAllAdminPermissions(session, requiredPermissions)
  );
  const tenantLandingPath = session
    ? getFirstAccessibleAdminPath(session)
    : null;
  const redirectPath = tenantNeedsRedirect
    ? tenantLandingPath
    : scope === 'platform' && requiredPermissions !== null
      ? '/'
      : scope === 'platform' &&
          requiredPlatformPermissions !== null &&
          !hasAllPlatformAdminPermissions(session, requiredPlatformPermissions)
        ? '/'
        : null;
  const tenantHasNoAccessiblePage = tenantNeedsRedirect && !tenantLandingPath;

  useEffect(() => {
    if (authState.status === 'anonymous') {
      router.replace('/login');
      return;
    }
    if (authState.status !== 'authenticated') return;

    if (redirectPath && redirectPath !== pathname) {
      router.replace(redirectPath);
    }
  }, [authState.status, pathname, redirectPath, router]);

  if (authState.status === 'checking') {
    return <LoadingStatus message="Đang kiểm tra phiên quản trị…" />;
  }

  if (authState.status === 'error') {
    return (
      <main className="admin-page-content panel" aria-labelledby="session-error-title">
        <h1 id="session-error-title">Không thể kiểm tra phiên đăng nhập</h1>
        <p className="login-error" role="alert">{authState.message}</p>
        <button
          className="login-submit-button"
          onClick={() => void initializeAdminSession().catch(() => undefined)}
          type="button"
        >
          Thử lại
        </button>
      </main>
    );
  }

  if (authState.status === 'anonymous') {
    return <LoadingStatus message="Đang chuyển đến đăng nhập…" />;
  }

  if (
    scope === 'conflict' ||
    scope === 'restricted' ||
    tenantHasNoAccessiblePage
  ) {
    return <RestrictedAccount conflict={scope === 'conflict'} />;
  }

  if (redirectPath) {
    return <LoadingStatus message="Đang mở khu vực phù hợp với tài khoản…" />;
  }

  return children;
}
