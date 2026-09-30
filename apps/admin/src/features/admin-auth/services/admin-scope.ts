import type { AdminSession } from './admin-auth';

export type AdminAccessScope =
  'platform' | 'tenant' | 'restricted' | 'conflict';

const TENANT_ADMIN_ROLES = new Set([
  'NHA_XE_ADMIN',
  'NHAN_VIEN_BAN_VE',
  'NHAN_VIEN_CSKH',
  'NHAN_VIEN_PHU_XE',
  'NHAN_VIEN_KINH_DOANH',
]);

const EMPLOYEE_ROLES = new Set([
  'NHAN_VIEN_BAN_VE',
  'NHAN_VIEN_CSKH',
  'NHAN_VIEN_PHU_XE',
  'NHAN_VIEN_KINH_DOANH',
]);

export function getAdminAccessScope(session: AdminSession): AdminAccessScope {
  const roles = new Set(session.roles);

  if (roles.has('SUPER_ADMIN')) {
    return roles.size === 1 &&
      session.employee === null &&
      session.busCompanyId === null
      ? 'platform'
      : 'conflict';
  }

  if (roles.has('NHA_XE_ADMIN')) {
    return [...roles].every((role) => TENANT_ADMIN_ROLES.has(role)) &&
      session.employee !== null &&
      Number.isSafeInteger(session.employee.employeeId) &&
      session.employee.employeeId > 0 &&
      Number.isSafeInteger(session.busCompanyId) &&
      session.busCompanyId !== null &&
      session.busCompanyId > 0 &&
      session.employee.busCompanyId === session.busCompanyId
      ? 'tenant'
      : 'conflict';
  }

  if (
    roles.has('KHACH_HANG') &&
    ([...roles].some((role) => EMPLOYEE_ROLES.has(role)) ||
      session.employee !== null ||
      session.busCompanyId !== null)
  ) {
    return 'conflict';
  }

  return 'restricted';
}
