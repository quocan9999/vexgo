import type { AdminSession } from './admin-auth';
import { getAdminAccessScope } from './admin-scope';

export const ADMIN_OPERATION_SECTIONS = [
  {
    section: 'vehicle-types',
    href: '/vehicle-types',
    readPermission: 'vehicle-type:read',
  },
  {
    section: 'vehicles',
    href: '/vehicles',
    readPermission: 'vehicle:read',
  },
  {
    section: 'routes',
    href: '/routes',
    readPermission: 'route:read',
  },
  {
    section: 'stations',
    href: '/stations',
    readPermission: 'route:read',
  },
  {
    section: 'fare-prices',
    href: '/fare-prices',
    readPermission: 'fare-price:read',
  },
  {
    section: 'trips',
    href: '/trips',
    readPermission: 'trip:read',
  },
  {
    section: 'customers',
    href: '/customers',
    readPermission: 'customer:read',
  },
  {
    section: 'support-chat',
    href: '/support-chat',
    readPermission: 'chat:read',
  },
  {
    section: 'reviews',
    href: '/reviews',
    readPermission: 'review:read',
  },
  {
    section: 'booking-management',
    href: '/booking-management',
    readPermission: 'booking:read',
  },
  {
    section: 'promotions',
    href: '/promotions',
    readPermission: 'promotion:read',
  },
  {
    section: 'shipments',
    href: '/shipments',
    readPermission: 'shipment:read',
  },
  {
    section: 'revenue-reports',
    href: '/revenue-reports',
    readPermission: 'revenue:read',
  },
  {
    section: 'ai-knowledge',
    href: '/ai-knowledge',
    readPermission: 'chat:read',
  },
] as const;

export type AdminPermission =
  | 'vehicle-type:read'
  | 'vehicle-type:create'
  | 'vehicle-type:update'
  | 'vehicle:read'
  | 'vehicle:create'
  | 'vehicle:update'
  | 'vehicle:delete'
  | 'seat:read'
  | 'seat:create'
  | 'seat:update'
  | 'seat:delete'
  | 'route:read'
  | 'route:create'
  | 'route:update'
  | 'fare-price:read'
  | 'fare-price:create'
  | 'fare-price:update'
  | 'trip:read'
  | 'trip:create'
  | 'trip:update'
  | 'trip:cancel'
  | 'trip:delete'
  | 'customer:read'
  | 'customer:update_status'
  | 'booking:read'
  | 'promotion:read'
  | 'promotion:create'
  | 'promotion:update'
  | 'shipment:read'
  | 'shipment:update'
  | 'revenue:read'
  | 'role:read'
  | 'permission:assign'
  | 'chat:read'
  | 'chat:manage'
  | 'review:read'
  | 'review:moderate';

export type PlatformAdminPermission =
  | 'bus-company:read'
  | 'bus-company:create'
  | 'bus-company:update'
  | 'admin-account:read'
  | 'admin-account:create'
  | 'admin-account:update';

export type AdminOperationSection =
  (typeof ADMIN_OPERATION_SECTIONS)[number]['section'];

export function canManagePlatformRbac(session: AdminSession | null): boolean {
  return (
    session !== null &&
    session.roles.length === 1 &&
    session.roles[0] === 'SUPER_ADMIN' &&
    getAdminAccessScope(session) === 'platform'
  );
}

export function isPlatformRbacPath(pathname: string): boolean {
  return matchesPath(pathname, '/rbac');
}

export function isTenantRbacPath(pathname: string): boolean {
  return matchesPath(pathname, '/tenant-rbac');
}

export function canReadTenantRbac(session: AdminSession | null): boolean {
  return (
    session !== null &&
    getAdminAccessScope(session) === 'tenant' &&
    session.roles.includes('NHA_XE_ADMIN') &&
    session.permissions.includes('role:read')
  );
}

export function canWriteTenantRbac(session: AdminSession | null): boolean {
  return (
    session !== null &&
    canReadTenantRbac(session) &&
    session.permissions.includes('permission:assign')
  );
}

export function hasPlatformAdminPermission(
  session: AdminSession | null,
  permission: PlatformAdminPermission,
): boolean {
  return (
    session !== null &&
    getAdminAccessScope(session) === 'platform' &&
    session.permissions.includes(permission)
  );
}

export function hasAllPlatformAdminPermissions(
  session: AdminSession | null,
  permissions: readonly PlatformAdminPermission[],
): boolean {
  if (session === null || getAdminAccessScope(session) !== 'platform') {
    return false;
  }

  return permissions.every((permission) =>
    session.permissions.includes(permission),
  );
}

export function hasAdminPermission(
  session: AdminSession | null,
  permission: AdminPermission,
): boolean {
  return (
    session !== null &&
    getAdminAccessScope(session) === 'tenant' &&
    session.permissions.includes(permission)
  );
}

export function hasAllAdminPermissions(
  session: AdminSession | null,
  permissions: readonly AdminPermission[],
): boolean {
  if (session === null || getAdminAccessScope(session) !== 'tenant') {
    return false;
  }

  return permissions.every((permission) =>
    session.permissions.includes(permission),
  );
}

export function canAccessSupportChat(session: AdminSession | null): boolean {
  return (
    session !== null &&
    getAdminAccessScope(session) === 'tenant' &&
    (session.permissions.includes('chat:read') ||
      session.permissions.includes('chat:manage'))
  );
}

export function canAccessAiKnowledge(session: AdminSession | null): boolean {
  if (session === null) return false;
  const scope = getAdminAccessScope(session);
  if (scope === 'platform') return true;
  if (scope === 'tenant') {
    return (
      session.permissions.includes('chat:read') ||
      session.permissions.includes('chat:manage')
    );
  }
  return false;
}

export function canAccessShipmentRates(session: AdminSession | null): boolean {
  return (
    session !== null &&
    getAdminAccessScope(session) === 'tenant' &&
    (session.permissions.includes('shipment:read') ||
      session.permissions.includes('fare-price:read'))
  );
}

export function canAccessTenantDashboard(session: AdminSession | null): boolean {
  return (
    session !== null &&
    getAdminAccessScope(session) === 'tenant' &&
    getFirstAccessibleAdminPath(session) !== null
  );
}

export function canAccessTenantPath(
  session: AdminSession | null,
  pathname: string,
): boolean {
  if (pathname === '/' || pathname === '') {
    return canAccessTenantDashboard(session);
  }
  if (matchesPath(pathname, '/support-chat')) {
    return canAccessSupportChat(session);
  }
  if (matchesPath(pathname, '/ai-knowledge')) {
    return canAccessAiKnowledge(session);
  }
  if (matchesPath(pathname, '/shipments/rates')) {
    return canAccessShipmentRates(session);
  }
  const requiredPermissions = getRequiredAdminPermissions(pathname);
  if (requiredPermissions === null) return false;
  return hasAllAdminPermissions(session, requiredPermissions);
}

function matchesPath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function getRequiredPlatformAdminPermissions(
  pathname: string,
): readonly PlatformAdminPermission[] | null {
  if (matchesPath(pathname, '/bus-companies')) return ['bus-company:read'];
  if (matchesPath(pathname, '/admin-accounts')) return ['admin-account:read'];
  return null;
}

export function getRequiredAdminPermissions(
  pathname: string,
): readonly AdminPermission[] | null {
  if (/^\/vehicles\/[^/]+\/seats(?:\/|$)/.test(pathname)) {
    return ['vehicle:read', 'seat:read'];
  }
  if (matchesPath(pathname, '/vehicle-types')) return ['vehicle-type:read'];
  if (matchesPath(pathname, '/vehicles')) return ['vehicle:read'];
  if (matchesPath(pathname, '/routes')) return ['route:read'];
  if (matchesPath(pathname, '/stations')) return ['route:read'];
  if (matchesPath(pathname, '/fare-prices')) return ['fare-price:read'];
  if (matchesPath(pathname, '/trips')) return ['trip:read'];
  if (matchesPath(pathname, '/customers')) return ['customer:read'];
  if (matchesPath(pathname, '/support-chat')) return ['chat:read'];
  if (matchesPath(pathname, '/booking-management')) return ['booking:read'];
  if (matchesPath(pathname, '/promotions')) return ['promotion:read'];
  if (matchesPath(pathname, '/shipments')) return ['shipment:read'];
  if (matchesPath(pathname, '/revenue-reports')) return ['revenue:read'];
  if (matchesPath(pathname, '/reviews')) return ['review:read'];
  if (matchesPath(pathname, '/ai-knowledge')) return ['chat:read'];
  return null;
}

export function getFirstAccessibleAdminPath(
  session: AdminSession,
): string | null {
  if (getAdminAccessScope(session) !== 'tenant') return null;

  return (
    ADMIN_OPERATION_SECTIONS.find((item) => {
      if (item.section === 'support-chat') {
        return canAccessSupportChat(session);
      }
      if (item.section === 'ai-knowledge') {
        return canAccessAiKnowledge(session);
      }
      return hasAdminPermission(session, item.readPermission);
    })?.href ?? (canReadTenantRbac(session) ? '/tenant-rbac' : null)
  );
}
