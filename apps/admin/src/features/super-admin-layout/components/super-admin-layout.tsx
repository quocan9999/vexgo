'use client';

import {
  Bus,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  Database,
  Headphones,
  LayoutDashboard,
  MapPinned,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Tag,
  ShieldCheck,
  Sparkles,
  Star,
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
import { AdminSidebarLink } from '@/components/admin/admin-sidebar-link';
import { AdminAccountPopover } from '@/components/admin/admin-account-popover';
import { AdminLanguageSwitcher } from '@/components/admin/admin-language-switcher';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import '../admin-shell.css';
import headerStyles from './admin-header.module.css';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import {
  ADMIN_OPERATION_SECTIONS,
  canAccessAiKnowledge,
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

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type SuperAdminLayoutProps = {
  activeSection:
    | 'overview'
    | 'bus-companies'
    | 'vehicle-types'
    | 'vehicles'
    | 'routes' | 'stations'
    | 'fare-prices'
    | 'trips'
    | 'customers'
    | 'booking-management'
    | 'promotions'
    | 'shipments'
    | 'revenue-reports'
    | 'reviews'
    | 'ai-knowledge'
    | 'admin-accounts'
    | 'rbac'
    | 'tenant-rbac'
    | 'support-chat';
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
};

const BREADCRUMB_SECTION_LABELS: Record<string, string> = {
  overview: 'Tổng quan hệ thống',
  'bus-companies': 'Quản lý nhà xe',
  'admin-accounts': 'Quản lý tài khoản Admin',
  rbac: 'Phân quyền nền tảng',
  'tenant-rbac': 'Phân quyền nội bộ',
  'vehicle-types': 'Quản lý loại xe',
  vehicles: 'Danh sách xe',
  routes: 'Quản lý tuyến xe',
  stations: 'Bến bãi & Điểm đón trả',
  'fare-prices': 'Bảng giá vé',
  trips: 'Quản lý chuyến xe',
  customers: 'Quản lý khách hàng',
  'support-chat': 'Hỗ trợ khách hàng',
  reviews: 'Đánh giá & Phản hồi',
  'ai-knowledge': 'Quản lý Tri thức AI',
  'booking-management': 'Quản lý đặt vé & vé',
  promotions: 'Quản lý khuyến mãi',
  shipments: 'Danh sách phiếu gửi hàng',
  'revenue-reports': 'Báo cáo doanh thu',
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

const SIDEBAR_TABLET_QUERY = '(min-width: 701px) and (max-width: 1180px)';
const SIDEBAR_DESKTOP_QUERY = '(min-width: 1181px)';

function getSidebarViewportSnapshot() {
  if (window.matchMedia(SIDEBAR_TABLET_QUERY).matches) return 'rail';
  if (window.matchMedia(SIDEBAR_DESKTOP_QUERY).matches) return 'desktop';
  return 'mobile';
}

function getServerSidebarViewportSnapshot() {
  return 'mobile';
}

function subscribeToSidebarViewport(onStoreChange: () => void) {
  const queries = [SIDEBAR_TABLET_QUERY, SIDEBAR_DESKTOP_QUERY].map((query) =>
    window.matchMedia(query),
  );
  queries.forEach((query) => query.addEventListener('change', onStoreChange));
  return () => {
    queries.forEach((query) => query.removeEventListener('change', onStoreChange));
  };
}

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
  stations: { label: 'Bến bãi & Điểm đón trả', icon: () => <Building2 size={18} /> },
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
  reviews: {
    label: 'Đánh giá & Phản hồi',
    icon: () => <Star size={18} />,
  },
  'ai-knowledge': {
    label: 'Tri thức AI (RAG)',
    icon: () => <Sparkles size={18} />,
  },
};

type NavClusterKey = 'operations' | 'fleet' | 'commercial' | 'customer';

interface NavCluster {
  key: NavClusterKey;
  label: string;
  sections: AdminOperationSection[];
}

const OPERATION_CLUSTERS: NavCluster[] = [
  {
    key: 'operations',
    label: 'Điều độ & Bán vé',
    sections: ['trips', 'booking-management', 'shipments'],
  },
  {
    key: 'fleet',
    label: 'Đội xe & Tuyến đường',
    sections: ['routes', 'stations', 'vehicles', 'vehicle-types'],
  },
  {
    key: 'commercial',
    label: 'Kinh doanh & Bảng giá',
    sections: ['fare-prices', 'promotions', 'revenue-reports'],
  },
  {
    key: 'customer',
    label: 'Khách hàng & Dịch vụ',
    sections: ['customers', 'support-chat', 'reviews', 'ai-knowledge'],
  },
];

const SECTION_TRANSLATION_KEYS: Record<string, string> = {
  overview: 'overview',
  'bus-companies': 'busCompanies',
  'admin-accounts': 'adminAccounts',
  rbac: 'platformRbac',
  'tenant-rbac': 'tenantRbac',
  'vehicle-types': 'vehicleTypes',
  vehicles: 'vehicles',
  routes: 'routes',
  stations: 'stations',
  'fare-prices': 'farePrices',
  trips: 'trips',
  customers: 'customers',
  'support-chat': 'supportChat',
  reviews: 'reviews',
  'booking-management': 'bookingManagement',
  promotions: 'promotions',
  shipments: 'shipments',
  'revenue-reports': 'revenueReports',
};

const CLUSTER_TRANSLATION_KEYS: Record<NavClusterKey, string> = {
  operations: 'clusterOperations',
  fleet: 'clusterFleet',
  commercial: 'clusterCommercial',
  customer: 'clusterCustomer',
};

export function SuperAdminLayout({
  activeSection,
  breadcrumbs,
  children,
}: SuperAdminLayoutProps) {
  const router = useRouter();
  const authState = useAdminSession();
  const tNav = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');

  function getTranslatedSectionLabel(section: string): string {
    const key = SECTION_TRANSLATION_KEYS[section];
    if (key) {
      try {
        return tNav(key);
      } catch {
        return BREADCRUMB_SECTION_LABELS[section] ?? section;
      }
    }
    return BREADCRUMB_SECTION_LABELS[section] ?? section;
  }
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getServerSidebarCollapsedSnapshot,
  );
  const sidebarViewport = useSyncExternalStore(
    subscribeToSidebarViewport,
    getSidebarViewportSnapshot,
    getServerSidebarViewportSnapshot,
  );
  const sidebarTooltipEnabled =
    sidebarViewport === 'rail' ||
    (sidebarViewport === 'desktop' && sidebarCollapsed);
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
      if (item.section === 'ai-knowledge') {
        return canAccessAiKnowledge(session);
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
    <TooltipProvider>
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
              {tenantScope ? tNav('operationsHeader') : tNav('platformHeader')}
            </p>
            <nav aria-label={tenantScope ? tNav('operationsHeader') : tNav('platformHeader')}>
              {tenantScope ? (
                <>
                  <div className="sidebar-cluster-links mb-2">
                    <AdminSidebarLink
                      active={activeSection === 'overview'}
                      href="/"
                      icon={<LayoutDashboard size={18} />}
                      label={tNav('overview')}
                      onClick={closeMobileNavigation}
                      tooltipEnabled={sidebarTooltipEnabled}
                    />
                  </div>
                  {OPERATION_CLUSTERS.map((cluster) => {
                    const clusterItems = accessibleOperationSections.filter(
                      (item) => cluster.sections.includes(item.section),
                    );
                    if (clusterItems.length === 0) return null;

                    const clusterLabel = tNav(CLUSTER_TRANSLATION_KEYS[cluster.key] ?? cluster.key);

                    return (
                      <div key={cluster.key} className="sidebar-nav-cluster">
                        <p className="sidebar-cluster-label">
                          {clusterLabel}
                        </p>
                        <div className="sidebar-cluster-links">
                          {clusterItems.map((item) => {
                            const { icon } =
                              OPERATION_NAVIGATION_DETAILS[item.section];
                            return (
                              <AdminSidebarLink
                                active={activeSection === item.section}
                                href={item.href}
                                icon={icon()}
                                key={item.section}
                                label={getTranslatedSectionLabel(item.section)}
                                onClick={closeMobileNavigation}
                                tooltipEnabled={sidebarTooltipEnabled}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : platformScope && (
                    <>
                      <AdminSidebarLink
                        active={activeSection === 'overview'}
                        href="/"
                        icon={<Database size={18} />}
                        label={tNav('overview')}
                        onClick={closeMobileNavigation}
                        tooltipEnabled={sidebarTooltipEnabled}
                      />
                      {canReadBusCompanies && (
                        <AdminSidebarLink
                          active={activeSection === 'bus-companies'}
                          href="/bus-companies"
                          icon={<Building2 size={18} />}
                          label={tNav('busCompanies')}
                          onClick={closeMobileNavigation}
                          tooltipEnabled={sidebarTooltipEnabled}
                        />
                      )}
                      {canReadAdminAccounts && (
                        <AdminSidebarLink
                          active={activeSection === 'admin-accounts'}
                          href="/admin-accounts"
                          icon={<UsersRound size={18} />}
                          label={tNav('adminAccounts')}
                          onClick={closeMobileNavigation}
                          tooltipEnabled={sidebarTooltipEnabled}
                        />
                      )}
                      {canManageRbac && (
                        <AdminSidebarLink
                          active={activeSection === 'rbac'}
                          href="/rbac"
                          icon={<ShieldCheck size={18} />}
                          label={tNav('platformRbac')}
                          onClick={closeMobileNavigation}
                          tooltipEnabled={sidebarTooltipEnabled}
                        />
                      )}
                      <AdminSidebarLink
                        active={activeSection === 'reviews'}
                        href="/reviews"
                        icon={<Star size={18} />}
                        label={tNav('reviews')}
                        onClick={closeMobileNavigation}
                        tooltipEnabled={sidebarTooltipEnabled}
                      />
                      <AdminSidebarLink
                        active={activeSection === 'ai-knowledge'}
                        href="/ai-knowledge"
                        icon={<Sparkles size={18} />}
                        label="Tri thức AI (RAG)"
                        onClick={closeMobileNavigation}
                        tooltipEnabled={sidebarTooltipEnabled}
                      />
                    </>
                  )}
            </nav>
          </div>
        )}
        {tenantScope && canReadTenantRolePermissions && (
          <div className="sidebar-nav-group">
            <p className="sidebar-label">{tNav('tenantHeader')}</p>
            <nav aria-label={tNav('tenantHeader')}>
              <AdminSidebarLink
                active={activeSection === 'tenant-rbac'}
                href="/tenant-rbac"
                icon={<ShieldCheck size={18} />}
                label={tNav('tenantRbac')}
                onClick={closeMobileNavigation}
                tooltipEnabled={sidebarTooltipEnabled}
              />
            </nav>
          </div>
        )}
      </div>
    </TooltipProvider>
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
                <Link
                  className={headerStyles.workspace}
                  href={tenantScope ? (firstAccessibleTenantPath ?? '/') : '/'}
                  aria-label={
                    tenantScope
                      ? `Nhà xe ${tenantBusCompanyName}`
                      : 'Khu vực quản trị nền tảng'
                  }
                  title={
                    tenantScope ? tenantBusCompanyName : 'Quản trị nền tảng'
                  }
                >
                  <Building2 aria-hidden="true" size={15} />
                  <span>
                    {tenantScope ? tenantBusCompanyName : tCommon('vexgoPlatform')}
                  </span>
                </Link>
                <nav
                  className={headerStyles.breadcrumb}
                  aria-label={tCommon('currentLocation')}
                >
                  <span className={headerStyles.group}>
                    {tenantScope
                      ? activeSection === 'tenant-rbac'
                        ? tCommon('administration')
                        : tCommon('operations')
                      : tCommon('administration')}
                  </span>
                  <ChevronRight aria-hidden="true" size={14} className={headerStyles.separator} />
                  {breadcrumbs && breadcrumbs.length > 0 ? (
                    breadcrumbs.map((crumb, idx) => {
                      const isLast = idx === breadcrumbs.length - 1;
                      return (
                        <span key={`${crumb.label}-${idx}`} className="inline-flex items-center gap-2">
                          {idx > 0 && (
                            <ChevronRight aria-hidden="true" size={14} className={headerStyles.separator} />
                          )}
                          {crumb.href && !isLast ? (
                            <Link href={crumb.href} className={headerStyles.breadcrumbLink}>
                              {crumb.label}
                            </Link>
                          ) : (
                            <span className={headerStyles.current} aria-current={isLast ? 'page' : undefined}>
                              {crumb.label}
                            </span>
                          )}
                        </span>
                      );
                    })
                  ) : (
                    <span className={headerStyles.current} aria-current="page">
                      {activeSection === 'overview'
                        ? tenantScope
                          ? tNav('tenantOverview')
                          : tNav('systemOverview')
                        : getTranslatedSectionLabel(activeSection)}
                    </span>
                  )}
                </nav>
              </div>
            </div>
            <div className={headerStyles.account}>
              <AdminLanguageSwitcher />
              <AdminAccountPopover
                fullName={session.fullName}
                roleLabel={roleLabel}
                email={session.email}
                phoneNumber={session.phoneNumber}
                onLogout={() => void logout()}
                signingOut={signingOut}
              />
              <button
                type="button"
                className="sr-only"
                aria-label={tAuth('signOut')}
                disabled={signingOut}
                aria-busy={signingOut}
                onClick={() => void logout()}
              >
                {signingOut ? tAuth('signingOut') : tAuth('signOut')}
              </button>
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
