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
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { AdminDialogPrimitive } from '@/components/admin/admin-dialog-primitive';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import {
  ADMIN_OPERATION_SECTIONS,
  getFirstAccessibleAdminPath,
  hasAdminPermission,
  type AdminOperationSection,
} from '@/features/admin-auth/services/admin-access';
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

const ADMIN_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'SUPER ADMIN',
  NHA_XE_ADMIN: 'QUẢN TRỊ NHÀ XE',
  NHAN_VIEN_BAN_VE: 'NHÂN VIÊN BÁN VÉ',
  NHAN_VIEN_CSKH: 'NHÂN VIÊN CSKH',
  NHAN_VIEN_PHU_XE: 'NHÂN VIÊN PHỤ XE',
  NHAN_VIEN_KINH_DOANH: 'NHÂN VIÊN KINH DOANH',
};

function formatAdminRoleLabels(roles: string[]) {
  const labels = roles.map(
    (role) => ADMIN_ROLE_LABELS[role] ?? role.replaceAll('_', ' '),
  );
  return labels.length > 0
    ? labels.join(' · ').toLocaleUpperCase('vi-VN')
    : 'TÀI KHOẢN ADMIN';
}

const OPERATION_NAVIGATION_DETAILS: Record<
  AdminOperationSection,
  { label: string; icon: () => ReactNode }
> = {
  'vehicle-types': { label: 'Loại xe', icon: () => <Bus size={18} /> },
  vehicles: { label: 'Xe', icon: () => <Truck size={18} /> },
  routes: { label: 'Tuyến xe', icon: () => <MapPinned size={18} /> },
  'fare-prices': { label: 'Bảng giá vé', icon: () => <Ticket size={18} /> },
};

export function SuperAdminLayout({
  activeSection,
  children,
}: SuperAdminLayoutProps) {
  const router = useRouter();
  const authState = useAdminSession();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  if (authState.status !== 'authenticated') return null;

  const session = authState.session;
  const scope = getAdminAccessScope(session);
  const tenantScope = scope === 'tenant';
  const platformScope = scope === 'platform';
  const accessibleOperationSections = ADMIN_OPERATION_SECTIONS.filter((item) =>
    hasAdminPermission(session, item.readPermission),
  );
  const firstAccessibleTenantPath = getFirstAccessibleAdminPath(session);
  const roleLabel = formatAdminRoleLabels(session.roles);
  const tenantBusCompanyName =
    session.employee?.busCompanyName?.trim() || 'NHÀ XE';
  const brandContextLines = platformScope
    ? ['SUPER ADMIN', 'NHÀ XE: NONE']
    : [
        tenantBusCompanyName.toLocaleUpperCase('vi-VN'),
        roleLabel,
      ];
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
          href={tenantScope ? firstAccessibleTenantPath ?? '/' : '/'}
          onClick={closeMobileNavigation}
        >
          <span className="brand-mark" aria-hidden="true">V</span>
          <span className="brand-copy">
            <strong>VexGo</strong>{' '}
            {brandContextLines.map((line, index) => (
              <small key={`${line}-${index}`}>{line}</small>
            ))}
          </span>
        </Link>
        <div aria-hidden="true" className="sidebar-divider" />

        {(platformScope || (tenantScope && accessibleOperationSections.length > 0)) && (
          <div className="sidebar-nav-group">
            <p className="sidebar-label">
              {tenantScope ? 'VẬN HÀNH' : 'QUẢN TRỊ NỀN TẢNG'}
            </p>
            <nav aria-label={tenantScope ? 'Vận hành' : 'Quản trị nền tảng'}>
              {tenantScope
                  ? accessibleOperationSections.map((item) => {
                    const { icon, label } =
                      OPERATION_NAVIGATION_DETAILS[item.section];
                    return (
                      <Link
                        aria-current={activeSection === item.section ? 'page' : undefined}
                        className={`sidebar-link${activeSection === item.section ? ' is-active' : ''}`}
                        href={item.href}
                        key={item.section}
                        onClick={closeMobileNavigation}
                      >
                        <span className="sidebar-link-icon">{icon()}</span>
                        <span>{label}</span>
                      </Link>
                    );
                  })
                : platformScope && (
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
                  )}
            </nav>
          </div>
        )}
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
          </div>
          <div className="topbar-account">
            <span
              aria-label={`Tài khoản ${session.fullName}`}
              className="topbar-profile-avatar"
              role="img"
            >
              {session.fullName.trim().charAt(0).toLocaleUpperCase('vi-VN') ||
                'V'}
            </span>
            <button
              aria-label="Đăng xuất"
              className="topbar-profile-logout"
              onClick={() => setLogoutConfirmOpen(true)}
              title={signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
              type="button"
            >
              <LogOut aria-hidden="true" size={18} />
            </button>
            {logoutError && (
              <p className="topbar-profile-error" role="alert">
                {logoutError}
              </p>
            )}
          </div>
        </header>
        {logoutConfirmOpen && (
          <AdminDialogPrimitive
            ariaLabelledBy="logout-confirm-title"
            className="admin-dialog logout-confirm-dialog"
            contentClassName="logout-confirm-dialog__panel"
            onClose={() => setLogoutConfirmOpen(false)}
            preventDismiss={signingOut}
          >
            <div className="logout-confirm-dialog__content">
              <span aria-hidden="true" className="logout-confirm-dialog__icon">
                <LogOut size={20} />
              </span>
              <h2 id="logout-confirm-title">Xác nhận đăng xuất</h2>
              <p>Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này không?</p>
              <div className="logout-confirm-dialog__actions">
                <button
                  className="logout-confirm-dialog__cancel"
                  disabled={signingOut}
                  onClick={() => setLogoutConfirmOpen(false)}
                  type="button"
                >
                  Hủy
                </button>
                <button
                  className="logout-confirm-dialog__confirm"
                  disabled={signingOut}
                  onClick={() => void logout()}
                  type="button"
                >
                  {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                </button>
              </div>
            </div>
          </AdminDialogPrimitive>
        )}
        {children}
      </main>
    </div>
  );
}
