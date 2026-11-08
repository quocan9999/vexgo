'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/action-button';
import { toast } from 'sonner';
import { useAdminSession } from '../hooks/use-admin-session';
import {
  getAdminAuthErrorMessage,
  initializeAdminSession,
  signOutAdmin,
} from '../services/admin-auth';
import {
  canAccessTenantPath,
  canManagePlatformRbac,
  getFirstAccessibleAdminPath,
  getRequiredAdminPermissions,
  getRequiredPlatformAdminPermissions,
  hasAllPlatformAdminPermissions,
  isPlatformRbacPath,
  isTenantRbacPath,
  canReadTenantRbac,
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

function stripLocale(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  const match = pathname.match(/^\/(vi|en)(\/.*|$)/);
  if (match) return match[2] || '/';
  return pathname;
}

function getLocalePrefix(pathname: string | null | undefined): string {
  if (!pathname) return '';
  const match = pathname.match(/^\/(vi|en)(\/.*|$)/);
  return match ? `/${match[1]}` : '';
}

function RestrictedAccount({
  conflict,
  localePrefix = '',
}: {
  conflict: boolean;
  localePrefix?: string;
}) {
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const sessionState = useAdminSession();
  const [signingOut, setSigningOut] = useState(false);
  const session = sessionState.status === 'authenticated'
    ? sessionState.session
    : null;

  async function logout() {
    setSigningOut(true);
    try {
      await signOutAdmin();
      const loginTarget = localePrefix ? `${localePrefix}/login` : '/login';
      router.replace(loginTarget);
      setTimeout(() => {
        if (window.location.pathname !== loginTarget) {
          window.location.replace(loginTarget);
        }
      }, 300);
    } catch (error) {
      toast.error(getAdminAuthErrorMessage(error));
      setSigningOut(false);
    }
  }

  return (
    <main className="admin-ui session-error-page">
      <section className="session-error-card panel" aria-labelledby="admin-access-title">
        <p className="login-eyebrow">{tAuth('restrictedEyebrow')}</p>
        <h1 id="admin-access-title">{tAuth('restrictedTitle')}</h1>
        <p>
          {conflict
            ? tAuth('restrictedConflict')
            : tAuth('restrictedNoAccess')}
        </p>
        {session && <p>{tAuth('loggedInAs', { name: session.fullName })}</p>}
        <Button
          disabled={signingOut}
          aria-busy={signingOut}
          onClick={logout}
          type="button"
        >
          {signingOut ? tAuth('signingOut') : tAuth('signOut')}
        </Button>
      </section>
    </main>
  );
}

export function AdminSessionGuard({ children }: { children: ReactNode }) {
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const rawPathname = usePathname() || '/';
  const localePrefix = getLocalePrefix(rawPathname);
  const pathname = stripLocale(rawPathname);
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
  const platformRbacNeedsRedirect =
    isPlatformRbacPath(pathname) && !canManagePlatformRbac(session);
  const tenantRbacNeedsRedirect =
    isTenantRbacPath(pathname) && !canReadTenantRbac(session);
  const tenantNeedsRedirect =
    scope === 'tenant' &&
    !isTenantRbacPath(pathname) &&
    !canAccessTenantPath(session, pathname);
  const tenantLandingPath = session
    ? getFirstAccessibleAdminPath(session)
    : null;
  const redirectPath = platformRbacNeedsRedirect
    ? scope === 'tenant'
      ? tenantLandingPath
      : '/'
    : tenantRbacNeedsRedirect
      ? scope === 'tenant'
        ? tenantLandingPath
        : '/'
    : tenantNeedsRedirect
    ? tenantLandingPath
    : scope === 'platform' &&
        requiredPermissions !== null &&
        !pathname.startsWith('/reviews') &&
        !pathname.startsWith('/ai-knowledge')
      ? '/'
      : scope === 'platform' &&
          requiredPlatformPermissions !== null &&
          !hasAllPlatformAdminPermissions(session, requiredPlatformPermissions)
        ? '/'
        : null;
  const tenantHasNoAccessiblePage =
    (tenantNeedsRedirect || tenantRbacNeedsRedirect) && !tenantLandingPath;

  useEffect(() => {
    if (authState.status === 'anonymous') {
      const loginTarget = localePrefix ? `${localePrefix}/login` : '/login';
      router.replace(loginTarget);
      const timer = setTimeout(() => {
        if (window.location.pathname !== loginTarget) {
          window.location.replace(loginTarget);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    if (authState.status !== 'authenticated') return;

    if (redirectPath && redirectPath !== pathname) {
      const target = localePrefix
        ? `${localePrefix}${redirectPath === '/' ? '' : redirectPath}` || '/'
        : redirectPath;
      router.replace(target);
      const timer = setTimeout(() => {
        if (window.location.pathname !== target) {
          window.location.replace(target);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [authState.status, localePrefix, pathname, redirectPath, router]);

  if (authState.status === 'checking') {
    return <LoadingStatus message={tAuth('checkingSession')} />;
  }

  if (authState.status === 'error') {
    return (
      <main className="admin-ui session-error-page">
        <section
          className="session-error-card panel"
          aria-labelledby="session-error-title"
        >
          <span className="session-error-card__icon" aria-hidden="true">
            <CircleAlert size={22} strokeWidth={1.75} />
          </span>
          <p className="session-error-card__eyebrow">
            {tAuth('errorEyebrow')}
          </p>
          <h1 id="session-error-title">
            {tAuth('errorTitle')}
          </h1>
          <p className="session-error-card__message" role="alert">
            {tAuth('errorMessage')}
          </p>
          <Button
            className="session-error-card__retry"
            onClick={() => void initializeAdminSession().catch(() => undefined)}
            type="button"
          >
            {tAuth('retry')}
          </Button>
          <details className="session-error-card__details">
            <summary>{tAuth('technicalDetails')}</summary>
            <p>{authState.message}</p>
          </details>
        </section>
      </main>
    );
  }

  if (authState.status === 'anonymous') {
    return <LoadingStatus message={tAuth('redirectingLogin')} />;
  }

  if (
    scope === 'conflict' ||
    scope === 'restricted' ||
    tenantHasNoAccessiblePage
  ) {
    return (
      <RestrictedAccount
        conflict={scope === 'conflict'}
        localePrefix={localePrefix}
      />
    );
  }

  if (redirectPath) {
    return <LoadingStatus message={tAuth('redirectingArea')} />;
  }

  return children;
}
