import { ForbiddenException } from '@nestjs/common';
import {
  assertPrincipalScope,
  hasTenantRole,
} from './principal-scope.js';
import type { AuthPrincipal } from './tokens/auth-principal.js';

export function requireTenantPrincipal(
  principal: AuthPrincipal | undefined,
): number {
  if (!principal) {
    throw new ForbiddenException({
      error: 'ROLE_FORBIDDEN',
      message: 'Tài khoản không có quyền quản lý dữ liệu nhà xe.',
    });
  }

  assertPrincipalScope(principal);
  if (!hasTenantRole(principal.roles)) {
    throw new ForbiddenException({
      error: 'ROLE_FORBIDDEN',
      message: 'Tài khoản không có quyền quản lý dữ liệu nhà xe.',
    });
  }

  return principal.nhaXeId!;
}

export function tenantIdForOptionalRead(
  principal: AuthPrincipal | undefined,
): number | undefined {
  if (!principal) return undefined;

  if (hasTenantRole(principal.roles)) {
    return requireTenantPrincipal(principal);
  }

  assertPrincipalScope(principal);
  return undefined;
}

export function assertTenantScope(
  requestedNhaXeId: number,
  trustedNhaXeId: number,
): void {
  if (requestedNhaXeId !== trustedNhaXeId) {
    throw new ForbiddenException({
      error: 'TENANT_SCOPE_VIOLATION',
      message: 'Không được truy cập dữ liệu của nhà xe khác.',
    });
  }
}
