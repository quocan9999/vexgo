import { ForbiddenException } from '@nestjs/common';
import type { AuthPrincipal } from './tokens/auth-principal.js';

export function requireNhaXeAdminTenant(
  principal: AuthPrincipal | undefined,
): number {
  if (!principal?.roles.includes('NHA_XE_ADMIN')) {
    throw new ForbiddenException({
      error: 'ROLE_FORBIDDEN',
      message: 'Chỉ quản trị viên nhà xe được quản lý dữ liệu vận hành.',
    });
  }

  const nhaXeId = principal.nhaXeId;
  if (
    typeof nhaXeId !== 'number' ||
    !Number.isInteger(nhaXeId) ||
    nhaXeId <= 0
  ) {
    throw new ForbiddenException({
      error: 'TENANT_SCOPE_REQUIRED',
      message: 'Tài khoản chưa được gán nhà xe hợp lệ.',
    });
  }

  return nhaXeId;
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
