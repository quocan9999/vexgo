'use client';

import {
  Bus,
  Building2,
  Database,
  LogOut,
  MapPinned,
  Menu,
  Ticket,
  Truck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import {
  getAdminAuthErrorMessage,
  signOutAdmin,
} from '@/features/admin-auth/services/admin-auth';
import { getAdminAccessScope } from '@/features/admin-auth/services/admin-scope';

type SuperAdminLayoutProps = {
  activeSection:
    | 'overview'
    | 'bus-companies'
    | 'vehicle-types'
    | 'vehicles'
    | 'routes'
    | 'fare-prices';
  children: ReactNode;
};

export function SuperAdminLayout({
  activeSection,
  children,
}: SuperAdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const authState = useAdminSession();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  if (authState.status !== 'authenticated') return null;

  const session = authState.session;
  const scope = getAdminAccessScope(session);
  const tenantScope = scope === 'tenant';
  const platformScope = scope === 'platform';
  const sectionLabel =
    pathname === '/'
      ? 'Tổng quan'
      : pathname.startsWith('/bus-companies')
        ? 'Nhà xe'
        : pathname.startsWith('/vehicle-types')
          ? 'Loại xe'
          : pathname.startsWith('/vehicles')
            ? 'Xe'
            : pathname.startsWith('/routes')
              ? 'Tuyến xe'
              : pathname.startsWith('/fare-prices')
                ? 'Bảng giá vé'
                : 'Quản trị';

  function closeMobileNavigation() {
    setMobileNavigationOpen(false);
  }

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
    <div className="admin-shell">
      {mobileNavigationOpen && (
        <button
          aria-label="Đóng điều hướng"
          className="mobile-nav-backdrop"
          onClick={closeMobileNavigation}
          type="button"
        />
      )}
      <aside
        aria-label="Điều hướng quản trị"
        className={`admin-sidebar${mobileNavigationOpen ? ' is-open' : ''}`}
        id="admin-navigation"
      >
        <Link
          className="brand-lockup"
          href={tenantScope ? '/vehicle-types' : '/'}
          onClick={closeMobileNavigation}
        >
          <span className="brand-mark" aria-hidden="true">V</span>
          <span className="brand-copy">
            <strong>VexGo</strong>{' '}
            <small>
              {tenantScope
                ? session.employee?.busCompanyName ?? 'NHÀ XE'
                : 'SUPER ADMIN'}
            </small>
          </span>
        </Link>
        <div aria-hidden="true" className="sidebar-divider" />

        <div className="sidebar-nav-group">
          <p className="sidebar-label">
            {tenantScope ? 'VẬN HÀNH' : 'QUẢN TRỊ NỀN TẢNG'}
          </p>
          <nav aria-label={tenantScope ? 'Vận hành' : 'Quản trị nền tảng'}>
            {tenantScope ? (
              <>
                <Link
                  aria-current={activeSection === 'vehicle-types' ? 'page' : undefined}
                  className={`sidebar-link${activeSection === 'vehicle-types' ? ' is-active' : ''}`}
                  href="/vehicle-types"
                  onClick={closeMobileNavigation}
                >
                  <span className="sidebar-link-icon"><Bus size={18} /></span>
                  <span>Loại xe</span>
                </Link>
                <Link
                  aria-current={activeSection === 'vehicles' ? 'page' : undefined}
                  className={`sidebar-link${activeSection === 'vehicles' ? ' is-active' : ''}`}
                  href="/vehicles"
                  onClick={closeMobileNavigation}
                >
                  <span className="sidebar-link-icon"><Truck size={18} /></span>
                  <span>Xe</span>
                </Link>
                <Link
                  aria-current={activeSection === 'routes' ? 'page' : undefined}
                  className={`sidebar-link${activeSection === 'routes' ? ' is-active' : ''}`}
                  href="/routes"
                  onClick={closeMobileNavigation}
                >
                  <span className="sidebar-link-icon"><MapPinned size={18} /></span>
                  <span>Tuyến xe</span>
                </Link>
                <Link
                  aria-current={activeSection === 'fare-prices' ? 'page' : undefined}
                  className={`sidebar-link${activeSection === 'fare-prices' ? ' is-active' : ''}`}
                  href="/fare-prices"
                  onClick={closeMobileNavigation}
                >
                  <span className="sidebar-link-icon"><Ticket size={18} /></span>
                  <span>Bảng giá vé</span>
                </Link>
              </>
            ) : platformScope ? (
              <>
                <Link
                  aria-current={activeSection === 'overview' ? 'page' : undefined}
                  className={`sidebar-link${activeSection === 'overview' ? ' is-active' : ''}`}
                  href="/"
                  onClick={closeMobileNavigation}
                >
                  <span className="sidebar-link-icon"><Database size={18} /></span>
                  <span>Tổng quan</span>
                </Link>
                <Link
                  aria-current={activeSection === 'bus-companies' ? 'page' : undefined}
                  className={`sidebar-link${activeSection === 'bus-companies' ? ' is-active' : ''}`}
                  href="/bus-companies"
                  onClick={closeMobileNavigation}
                >
                  <span className="sidebar-link-icon"><Building2 size={18} /></span>
                  <span>Nhà xe</span>
                </Link>
              </>
            ) : null}
          </nav>
        </div>

        <div className="sidebar-bottom">
          {logoutError && (
            <p className="login-error" role="alert">{logoutError}</p>
          )}
          <div className="sidebar-profile">
            <span className="profile-avatar" aria-hidden="true">
              {tenantScope ? 'NX' : 'SA'}
            </span>
            <span className="profile-copy">
              <strong>{session.fullName}</strong>
              <small>
                {tenantScope
                  ? session.employee?.busCompanyName ?? 'Nhà xe'
                  : 'Quản trị nền tảng'}
              </small>
            </span>
            <button
              aria-label="Đăng xuất"
              className="sidebar-logout-button"
              disabled={signingOut}
              onClick={() => void logout()}
              title="Đăng xuất"
              type="button"
            >
              <LogOut aria-hidden="true" size={15} />
              <span className="sidebar-logout-label">
                {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
              </span>
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main" id={activeSection}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              aria-controls="admin-navigation"
              aria-expanded={mobileNavigationOpen}
              aria-label={mobileNavigationOpen ? 'Đóng menu' : 'Mở menu'}
              className="icon-button mobile-menu-button"
              onClick={() => setMobileNavigationOpen((open) => !open)}
              type="button"
            >
              {mobileNavigationOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="breadcrumb">
              <span>VexGo</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{sectionLabel}</strong>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
