'use client';

import {
  Building2,
  Bus,
  Database,
  LogOut,
  Menu,
  Truck,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { signOutDemoAdmin } from '@/features/admin-auth/services/demo-auth';

type SuperAdminLayoutProps = {
  activeSection: 'overview' | 'bus-companies' | 'vehicle-types' | 'vehicles';
  apiMode: boolean;
  children: ReactNode;
};

export function SuperAdminLayout({
  activeSection,
  apiMode,
  children,
}: SuperAdminLayoutProps) {
  const router = useRouter();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  function closeMobileNavigation() {
    setMobileNavigationOpen(false);
  }

  function logout() {
    signOutDemoAdmin();
    router.replace('/login');
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
          aria-label="VexGo Super Admin, về tổng quan"
          className="brand-lockup"
          href="/"
          onClick={closeMobileNavigation}
        >
          <span className="brand-mark" aria-hidden="true">
            V
          </span>
          <span className="brand-copy">
            <strong>VexGo</strong>
            <small>SUPER ADMIN</small>
          </span>
        </Link>

        <div className="sidebar-nav-group">
          <p className="sidebar-label">KHÔNG GIAN QUẢN TRỊ</p>
          <nav aria-label="Các khu vực">
            <Link
              aria-label="Tổng quan"
              aria-current={activeSection === 'overview' ? 'page' : undefined}
              className={`sidebar-link${activeSection === 'overview' ? ' is-active' : ''}`}
              href="/"
              onClick={closeMobileNavigation}
            >
              <span className="sidebar-link-icon">
                <Database size={18} />
              </span>
              <span>Tổng quan</span>
            </Link>
            <Link
              aria-label="Tài khoản"
              className="sidebar-link"
              href={activeSection === 'overview' ? '#accounts' : '/#accounts'}
              onClick={closeMobileNavigation}
            >
              <span className="sidebar-link-icon">
                <UsersRound size={18} />
              </span>
              <span>Tài khoản</span>
            </Link>
            <Link
              aria-label="Nhà xe"
              aria-current={
                activeSection === 'bus-companies' ? 'page' : undefined
              }
              className={`sidebar-link${activeSection === 'bus-companies' ? ' is-active' : ''}`}
              href="/bus-companies"
              onClick={closeMobileNavigation}
            >
              <span className="sidebar-link-icon">
                <Building2 size={18} />
              </span>
              <span>Nhà xe</span>
            </Link>
            <Link
              aria-label="Loại xe"
              aria-current={
                activeSection === 'vehicle-types' ? 'page' : undefined
              }
              className={`sidebar-link${activeSection === 'vehicle-types' ? ' is-active' : ''}`}
              href="/vehicle-types"
              onClick={closeMobileNavigation}
            >
              <span className="sidebar-link-icon">
                <Bus size={18} />
              </span>
              <span>Loại xe</span>
            </Link>
            <Link
              aria-label="Xe"
              aria-current={activeSection === 'vehicles' ? 'page' : undefined}
              className={`sidebar-link${activeSection === 'vehicles' ? ' is-active' : ''}`}
              href="/vehicles"
              onClick={closeMobileNavigation}
            >
              <span className="sidebar-link-icon">
                <Truck size={18} />
              </span>
              <span>Xe</span>
            </Link>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="platform-card">
            <span className="platform-pulse" aria-hidden="true" />
            <div>
              <span className="platform-label">PHẠM VI DỮ LIỆU</span>
              <strong>Toàn hệ thống</strong>
            </div>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">SA</span>
            <span className="profile-copy">
              <strong>Super Admin</strong>
              <small>Quản trị nền tảng</small>
            </span>
            <button
              aria-label="Đăng xuất tài khoản Super Admin"
              className="sidebar-logout-button"
              onClick={logout}
              title="Đăng xuất"
              type="button"
            >
              <LogOut aria-hidden="true" size={15} />
              <span className="sidebar-logout-label">Đăng xuất</span>
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
              <strong>Quản trị nền tảng</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <span className={`environment-badge${apiMode ? ' is-api' : ''}`}>
              <span className="environment-dot" />
              {apiMode ? 'Kết nối API' : 'Dữ liệu minh họa'}
            </span>
            <span aria-hidden="true" className="topbar-avatar">
              SA
            </span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
