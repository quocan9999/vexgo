'use client';

import {
  Bus,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  LoaderCircle,
  Database,
  Headphones,
  LogOut,
  MapPinned,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Tag,
  ShieldCheck,
  Ticket,
  Truck,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/action-button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import '../admin-shell.css';
import headerStyles from './admin-header.module.css';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import {
  ADMIN_OPERATION_SECTIONS,
  canAccessSupportChat,
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
    | 'booking-management'
    | 'promotions'
    | 'shipments'
    | 'revenue-reports'
    | 'admin-accounts'
    | 'rbac'
    | 'tenant-rbac'
    | 'support-chat';
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
const ADMIN_SIDEBAR_COLLAPSED_CHANGE_EVENT =
  'vexgo-admin-sidebar-collapsed-change';
let sidebarCollapsedFallback = false;
let sidebarCollapsedStorageUnavailable = false;

function getSidebarCollapsedSnapshot() {
  if (sidebarCollapsedStorageUnavailable) return sidebarCollapsedFallback;

  try {
    return (
      window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY) ===
      'true'
    );
  } catch {
    sidebarCollapsedStorageUnavailable = true;
    return sidebarCollapsedFallback;
  }
}

function getServerSidebarCollapsedSnapshot() {
  return false;
}

function subscribeToSidebarCollapsed(onStoreChange: () => void) {
  function handleStorageChange(event: StorageEvent) {
    if (
      event.key !== null &&
      event.key !== ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY
    ) {
      return;
    }

    try {
      sidebarCollapsedFallback =
        window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY) ===
        'true';
      sidebarCollapsedStorageUnavailable = false;
    } catch {
      sidebarCollapsedStorageUnavailable = true;
    }
    onStoreChange();
  }

  window.addEventListener('storage', handleStorageChange);
  window.addEventListener(ADMIN_SIDEBAR_COLLAPSED_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener(
      ADMIN_SIDEBAR_COLLAPSED_CHANGE_EVENT,
      onStoreChange,
    );
  };
}

function setSidebarCollapsedPreference(collapsed: boolean) {
  sidebarCollapsedFallback = collapsed;
  try {
    window.localStorage.setItem(
      ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(collapsed),
    );
    sidebarCollapsedStorageUnavailable = false;
  } catch {
    sidebarCollapsedStorageUnavailable = true;
  }

  window.dispatchEvent(new Event(ADMIN_SIDEBAR_COLLAPSED_CHANGE_EVENT));
}

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
  'support-chat': {
    label: 'Chăm sóc khách hàng',
    icon: () => <Headphones size={18} />,
  },
  'booking-management': {
    label: 'Quản lý phiếu đặt vé & vé',
    icon: () => <Ticket size={18} />,
  },
  promotions: { label: 'Khuyến mãi', icon: () => <Tag size={18} /> },
  shipments: { label: 'Gửi hàng', icon: () => <Package size={18} /> },
  'revenue-reports': {
    label: 'Báo cáo doanh thu',
    icon: () => <ChartNoAxesCombined size={18} />,
  },
};

export function SuperAdminLayout({
  activeSection,
  children,
}: SuperAdminLayoutProps) {
  const router = useRouter();
  const authState = useAdminSession();
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getServerSidebarCollapsedSnapshot,
  );
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);

  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 701px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileNavigationOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
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
  const accessibleOperationSections = ADMIN_OPERATION_SECTIONS.filter(
    (item) => {
      if (item.section === 'support-chat') {
        return canAccessSupportChat(session);
      }
      return hasAdminPermission(session, item.readPermission);
    },
  );
  const firstAccessibleTenantPath = getFirstAccessibleAdminPath(session);
  const roleLabel = formatAdminRoleLabels(session.roles);
  const tenantBusCompanyName =
    session.employee?.busCompanyName?.trim() || 'NHÀ XE';
  const brandContextLines = platformScope
    ? ['Quản trị nền tảng']
    : [tenantBusCompanyName.toLocaleUpperCase('vi-VN'), roleLabel];
  function closeMobileNavigation() {
    setMobileNavigationOpen(false);
  }

  function toggleSidebar() {
    const nextCollapsed = !sidebarCollapsed;
    setSidebarCollapsedPreference(nextCollapsed);
  }

  async function logout() {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    try {
      await signOutAdmin();
      router.replace('/login');
    } catch (error) {
      toast.error(getAdminAuthErrorMessage(error));
      signingOutRef.current = false;
      setSigningOut(false);
    }
  }

  const sectionLabel =
    activeSection in OPERATION_NAVIGATION_DETAILS
      ? OPERATION_NAVIGATION_DETAILS[activeSection as AdminOperationSection]
          .label
      : (
          {
            overview: 'Tổng quan',
            'bus-companies': 'Nhà xe',
            'admin-accounts': 'Tài khoản Admin',
            rbac: 'Phân quyền',
            'tenant-rbac': 'Phân quyền',
          } as Record<string, string>
        )[activeSection];
  const sidebarContent = (
    <>
      <div className="sidebar-header">
        <Link
          aria-label={`VexGo ${brandContextLines.join(' ')}`}
          className="brand-lockup"
          href={tenantScope ? (firstAccessibleTenantPath ?? '/') : '/'}
          onClick={closeMobileNavigation}
        >
          <span className="brand-mark" aria-hidden="true">
            V
          </span>
          <span className="brand-copy">
            <strong>VexGo</strong>{' '}
            {brandContextLines.map((line, index) => (
              <small key={`${line}-${index}`}>{line}</small>
            ))}
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-controls="admin-navigation"
          aria-expanded={!sidebarCollapsed}
          aria-label={
            sidebarCollapsed
              ? 'Mở rộng thanh điều hướng'
              : 'Thu gọn thanh điều hướng'
          }
          className="sidebar-collapse-button"
          onClick={toggleSidebar}
          title={
            sidebarCollapsed
              ? 'Mở rộng thanh điều hướng'
              : 'Thu gọn thanh điều hướng'
          }
          type="button"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen aria-hidden="true" size={18} />
          ) : (
            <PanelLeftClose aria-hidden="true" size={18} />
          )}
        </Button>
      </div>
      <div aria-hidden="true" className="sidebar-divider" />
      <div
        className="sidebar-scroll"
        role="region"
        aria-label="Các mục điều hướng quản trị"
        tabIndex={0}
      >
        {(platformScope ||
          (tenantScope && accessibleOperationSections.length > 0)) && (
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
                        aria-current={
                          activeSection === item.section ? 'page' : undefined
                        }
                        className={`sidebar-link${activeSection === item.section ? ' is-active' : ''}`}
                        href={item.href}
                        key={item.section}
                        onClick={closeMobileNavigation}
                        title={label}
                      >
                        <span aria-hidden="true" className="sidebar-link-icon">
                          {icon()}
                        </span>
                        <span>{label}</span>
                      </Link>
                    );
                  })
                : platformScope && (
                    <>
                      <Link
                        aria-label="Tổng quan"
                        aria-current={
                          activeSection === 'overview' ? 'page' : undefined
                        }
                        className={`sidebar-link${activeSection === 'overview' ? ' is-active' : ''}`}
                        href="/"
                        onClick={closeMobileNavigation}
                        title="Tổng quan"
                      >
                        <span aria-hidden="true" className="sidebar-link-icon">
                          <Database size={18} />
                        </span>
                        <span>Tổng quan</span>
                      </Link>
                      {canReadBusCompanies && (
                        <Link
                          aria-label="Nhà xe"
                          aria-current={
                            activeSection === 'bus-companies'
                              ? 'page'
                              : undefined
                          }
                          className={`sidebar-link${activeSection === 'bus-companies' ? ' is-active' : ''}`}
                          href="/bus-companies"
                          onClick={closeMobileNavigation}
                          title="Nhà xe"
                        >
                          <span
                            aria-hidden="true"
                            className="sidebar-link-icon"
                          >
                            <Building2 size={18} />
                          </span>
                          <span>Nhà xe</span>
                        </Link>
                      )}
                      {canReadAdminAccounts && (
                        <Link
                          aria-label="Tài khoản Admin"
                          aria-current={
                            activeSection === 'admin-accounts'
                              ? 'page'
                              : undefined
                          }
                          className={`sidebar-link${activeSection === 'admin-accounts' ? ' is-active' : ''}`}
                          href="/admin-accounts"
                          onClick={closeMobileNavigation}
                          title="Tài khoản Admin"
                        >
                          <span
                            aria-hidden="true"
                            className="sidebar-link-icon"
                          >
                            <UsersRound size={18} />
                          </span>
                          <span>Tài khoản Admin</span>
                        </Link>
                      )}
                      {canManageRbac && (
                        <Link
                          aria-label="Phân quyền"
                          aria-current={
                            activeSection === 'rbac' ? 'page' : undefined
                          }
                          className={`sidebar-link${activeSection === 'rbac' ? ' is-active' : ''}`}
                          href="/rbac"
                          onClick={closeMobileNavigation}
                          title="Phân quyền"
                        >
                          <span
                            aria-hidden="true"
                            className="sidebar-link-icon"
                          >
                            <ShieldCheck size={18} />
                          </span>
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
                aria-current={
                  activeSection === 'tenant-rbac' ? 'page' : undefined
                }
                className={`sidebar-link${activeSection === 'tenant-rbac' ? ' is-active' : ''}`}
                href="/tenant-rbac"
                onClick={closeMobileNavigation}
                title="Phân quyền"
              >
                <span aria-hidden="true" className="sidebar-link-icon">
                  <ShieldCheck size={18} />
                </span>
                <span>Phân quyền</span>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div
      className={`admin-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}
    >
      <a className="admin-skip-link" href="#admin-content">
        Bỏ qua điều hướng
      </a>
      <aside
        aria-label="Điều hướng quản trị"
        className="admin-sidebar admin-ui"
        id="admin-navigation"
      >
        {sidebarContent}
      </aside>
      <Sheet open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
        <SheetContent
          side="left"
          className="admin-mobile-navigation"
          finalFocus={menuTriggerRef}
        >
          <SheetTitle className="sr-only">Điều hướng quản trị</SheetTitle>
          {sidebarContent}
        </SheetContent>
      </Sheet>
      <main className="admin-main" id={activeSection}>
        <header className={`admin-ui ${headerStyles.header}`}>
          <div className={headerStyles.inner}>
            <div className={headerStyles.navigation}>
              <Button
                ref={menuTriggerRef}
                aria-expanded={mobileNavigationOpen}
                aria-label="Mở menu"
                className={headerStyles.menu}
                variant="ghost"
                size="icon"
                onClick={() => setMobileNavigationOpen(true)}
              >
                <Menu aria-hidden="true" size={20} />
              </Button>
              <div className={headerStyles.context}>
                <span
                  className={headerStyles.workspace}
                  title={
                    tenantScope ? tenantBusCompanyName : 'Quản trị nền tảng'
                  }
                >
                  <Building2 aria-hidden="true" size={15} />
                  <span>
                    {tenantScope ? tenantBusCompanyName : 'Nền tảng VexGo'}
                  </span>
                </span>
                <nav
                  className={headerStyles.breadcrumb}
                  aria-label="Vị trí hiện tại"
                >
                  <span className={headerStyles.group}>
                    {tenantScope
                      ? activeSection === 'tenant-rbac'
                        ? 'Quản trị'
                        : 'Vận hành'
                      : 'Quản trị'}
                  </span>
                  <ChevronRight aria-hidden="true" size={14} />
                  <span className={headerStyles.current} aria-current="page">
                    {sectionLabel}
                  </span>
                </nav>
              </div>
            </div>
            <div className={headerStyles.account}>
              <span
                role="img"
                aria-label={`Tài khoản ${session.fullName}`}
                className={headerStyles.avatar}
              >
                {session.fullName.trim().charAt(0).toLocaleUpperCase('vi-VN') ||
                  'V'}
              </span>
              <div className={headerStyles.identity}>
                <span className={headerStyles.name} title={session.fullName}>
                  {session.fullName}
                </span>
                <span className={headerStyles.role} title={roleLabel}>
                  {roleLabel}
                </span>
              </div>
              <span className={headerStyles.divider} aria-hidden="true" />
              <Button
                aria-label="Đăng xuất"
                variant="ghost"
                disabled={signingOut}
                aria-busy={signingOut}
                className={headerStyles.logout}
                onClick={() => void logout()}
              >
                {signingOut ? (
                  <LoaderCircle
                    aria-hidden="true"
                    size={18}
                    className="motion-safe:animate-spin"
                  />
                ) : (
                  <LogOut aria-hidden="true" size={18} />
                )}
                <span>{signingOut ? 'Đang thoát…' : 'Đăng xuất'}</span>
              </Button>
            </div>
          </div>
        </header>
        <div id="admin-content" tabIndex={-1}>
          {children}
        </div>
      </main>
    </div>
  );
}
