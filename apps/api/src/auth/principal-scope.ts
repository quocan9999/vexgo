import { ForbiddenException } from '@nestjs/common';
import type { AuthPrincipal } from './tokens/auth-principal.js';

export const TENANT_EMPLOYEE_ROLES = [
  'NHAN_VIEN_DIEU_HANH',
  'NHAN_VIEN_BAN_VE',
  'NHAN_VIEN_CSKH',
  'NHAN_VIEN_PHU_XE',
  'NHAN_VIEN_KINH_DOANH',
] as const;

export const TENANT_PRINCIPAL_ROLES = [
  'NHA_XE_ADMIN',
  ...TENANT_EMPLOYEE_ROLES,
] as const;

const tenantEmployeeRoleSet = new Set<string>(TENANT_EMPLOYEE_ROLES);
const tenantPrincipalRoleSet = new Set<string>(TENANT_PRINCIPAL_ROLES);

export function hasTenantRole(roles: readonly string[]): boolean {
  return roles.some((role) => tenantPrincipalRoleSet.has(role));
}

function hasValidTenantIdentity(principal: AuthPrincipal): boolean {
  return (
    Number.isSafeInteger(principal.nhanVienId) &&
    (principal.nhanVienId ?? 0) > 0 &&
    Number.isSafeInteger(principal.nhaXeId) &&
    (principal.nhaXeId ?? 0) > 0
  );
}

export function assertPrincipalScope(principal: AuthPrincipal): void {
  const roles = new Set(principal.roles);

  if (roles.has('SUPER_ADMIN')) {
    if (
      roles.size !== 1 ||
      principal.nhanVienId !== null ||
      principal.nhaXeId !== null
    ) {
      throw new ForbiddenException({
        error: 'ROLE_SCOPE_CONFLICT',
        message: 'Tài khoản có phạm vi quản trị không hợp lệ.',
      });
    }
    return;
  }

  const hasTenantPrincipalRole =
    roles.has('NHA_XE_ADMIN') ||
    [...roles].some((role) => tenantEmployeeRoleSet.has(role));

  if (!hasTenantPrincipalRole) {
    if (
      roles.has('KHACH_HANG') &&
      (principal.nhanVienId !== null || principal.nhaXeId !== null)
    ) {
      throw new ForbiddenException({
        error: 'ROLE_SCOPE_CONFLICT',
        message: 'Tài khoản có phạm vi quản trị không hợp lệ.',
      });
    }
    return;
  }

  if ([...roles].some((role) => !tenantPrincipalRoleSet.has(role))) {
    throw new ForbiddenException({
      error: 'ROLE_SCOPE_CONFLICT',
      message: 'Tài khoản có phạm vi quản trị không hợp lệ.',
    });
  }

  if (!hasValidTenantIdentity(principal)) {
    throw new ForbiddenException({
      error: 'TENANT_SCOPE_REQUIRED',
      message: 'Tài khoản chưa được gán nhà xe hợp lệ.',
    });
  }
}
