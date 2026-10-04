'use client';

import {
  Bus,
  Building2,
  CalendarDays,
  Database,
  LogOut,
  MapPinned,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Ticket,
  Truck,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AdminDialogPrimitive } from '@/components/admin/admin-dialog-primitive';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import {
  ADMIN_OPERATION_SECTIONS,
  canReadTenantRbac,
  getFirstAccessibleAdminPath,
  hasAdminPermission,
  canManagePlatformRbac,
  hasPlatformAdminPermission,
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
    | 'fare-prices'
    | 'trips'
    | 'customers'
    | 'admin-accounts'
    | 'rbac'
    | 'tenant-rbac';
  children: ReactNode;
};

const ADMIN_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'SUPER ADMIN',
  NHA_XE_ADMIN: 'QUẢN TRỊ NHÀ XE',
  NHAN_VIEN_BAN_VE: 'NHÂN VIÊN BÁN VÉ',
  NHAN_VIEN_CSKH: 'NHÂN VIÊN CSKH',
  NHAN_VIEN_PHU_XE: 'NHÂN VIÊN PHỤ XE',
  NHAN_VIEN_KINH_DOANH: 'NHÂN VIÊN KINH DOANH',
  NHAN_VIEN_DIEU_HANH: 'NHÂN VIÊN ĐIỀU HÀNH',
};

const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = 'vexgo-admin-sidebar-collapsed';

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
  trips: { label: 'Chuyến xe', icon: () => <CalendarDays size={18} /> },
  customers: { label: 'Khách hàng', icon: () => <UsersRound size={18} /> },
};

export function SuperAdminLayout({
  activeSection,
  children,
}: SuperAdminLayoutProps) {
  const router = useRouter();
  const authState = useAdminSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(
        window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY) ===
          'true',
      );
    } catch {
      // The collapse control still works for this session when storage is unavailable.
    }
  }, []);

  if (authState.status !== 'authenticated') return null;

  const session = authState.session;
  const scope = getAdminAccessScope(session);
  const tenantScope = scope === 'tenant';
  const platformScope = scope === 'platform';
  const canManageRbac = canManagePlatformRbac(session);
  const canReadTenantRolePermissions = canReadTenantRbac(session);
  const canReadBusCompanies = hasPlatformAdminPermission(
    session,
    'bus-company:read',
  );
  const canReadAdminAccounts = hasPlatformAdminPermission(
    session,
    'admin-account:read',
  );
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

  function toggleSidebar() {
    const nextCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(nextCollapsed);
    try {
      window.localStorage.setItem(
        ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
        String(nextCollapsed),
      );
    } catch {
      // The collapse control still works for this session when storage is unavailable.
    }
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
    <div className={`admin-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
        className={`admin-sidebar${sidebarCollapsed ? ' is-collapsed' : ''}${mobileNavigationOpen ? ' is-open' : ''}`}
        id="admin-navigation"
      >
        <div className="sidebar-header">
          <Link
            aria-label={`VexGo ${brandContextLines.join(' ')}`}
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
          <button
            aria-controls="admin-navigation"
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            className="icon-button sidebar-collapse-button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            type="button"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" size={18} />
            ) : (
              <PanelLeftClose aria-hidden="true" size={18} />
            )}
          </button>
        </div>
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
                        aria-label={label}
                        aria-current={activeSection === item.section ? 'page' : undefined}
                        className={`sidebar-link${activeSection === item.section ? ' is-active' : ''}`}
                        href={item.href}
                        key={item.section}
                        onClick={closeMobileNavigation}
                        title={label}
                      >
                        <span className="sidebar-link-icon">{icon()}</span>
                        <span>{label}</span>
                      </Link>
                    );
                  })
                : platformScope && (
                    <>
                      <Link
                        aria-label="Tổng quan"
                        aria-current={activeSection === 'overview' ? 'page' : undefined}
                        className={`sidebar-link${activeSection === 'overview' ? ' is-active' : ''}`}
                        href="/"
                        onClick={closeMobileNavigation}
                        title="Tổng quan"
                      >
                        <span className="sidebar-link-icon"><Database size={18} /></span>
                        <span>Tổng quan</span>
                      </Link>
                      {canReadBusCompanies && (
                        <Link
                          aria-label="Nhà xe"
                          aria-current={activeSection === 'bus-companies' ? 'page' : undefined}
                          className={`sidebar-link${activeSection === 'bus-companies' ? ' is-active' : ''}`}
                          href="/bus-companies"
                          onClick={closeMobileNavigation}
                          title="Nhà xe"
                        >
                          <span className="sidebar-link-icon"><Building2 size={18} /></span>
                          <span>Nhà xe</span>
                        </Link>
                      )}
                      {canReadAdminAccounts && (
                        <Link
                          aria-label="Tài khoản Admin"
                          aria-current={activeSection === 'admin-accounts' ? 'page' : undefined}
                          className={`sidebar-link${activeSection === 'admin-accounts' ? ' is-active' : ''}`}
                          href="/admin-accounts"
                          onClick={closeMobileNavigation}
                          title="Tài khoản Admin"
                        >
                          <span className="sidebar-link-icon"><UsersRound size={18} /></span>
                          <span>Tài khoản Admin</span>
                        </Link>
                      )}
                      {canManageRbac && (
                        <Link
                          aria-label="Phân quyền"
                          aria-current={activeSection === 'rbac' ? 'page' : undefined}
                          className={`sidebar-link${activeSection === 'rbac' ? ' is-active' : ''}`}
                          href="/rbac"
                          onClick={closeMobileNavigation}
                          title="Phân quyền"
                        >
                          <span className="sidebar-link-icon"><ShieldCheck size={18} /></span>
                          <span>Phân quyền</span>
                        </Link>
                      )}
                    </>
                  )}
            </nav>
          </div>
        )}
        {tenantScope && canReadTenantRolePermissions && (
        <div className="sidebar-nav-group">
          <p className="sidebar-label">QUẢN TRỊ NHÀ XE</p>
          <nav aria-label="Quản trị nhà xe">
            <Link
              aria-label="Phân quyền"
              aria-current={activeSection === 'tenant-rbac' ? 'page' : undefined}
              className={`sidebar-link${activeSection === 'tenant-rbac' ? ' is-active' : ''}`}
              href="/tenant-rbac"
              onClick={closeMobileNavigation}
              title="Phân quyền"
            >
              <span className="sidebar-link-icon"><ShieldCheck size={18} /></span>
              <span>Phân quyền</span>
            </Link>
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
