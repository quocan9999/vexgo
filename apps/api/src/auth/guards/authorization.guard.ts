import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ALLOW_ROLE_SCOPE_CONFLICT_KEY } from '../decorators/allow-role-scope-conflict.decorator.js';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';
import { REQUIRED_ROLES_KEY } from '../decorators/require-roles.decorator.js';
import type { AdminPermissionKey } from '../permissions/permission-catalog.js';
import type { AuthPrincipal } from '../tokens/auth-principal.js';

type AuthenticatedRequest = Request & { user?: AuthPrincipal };

const TENANT_EMPLOYEE_ROLES = new Set([
  'NHAN_VIEN_BAN_VE',
  'NHAN_VIEN_CSKH',
  'NHAN_VIEN_PHU_XE',
  'NHAN_VIEN_KINH_DOANH',
]);

const TENANT_ADMIN_ROLES = new Set(['NHA_XE_ADMIN', ...TENANT_EMPLOYEE_ROLES]);

function hasValidTenantIdentity(principal: AuthPrincipal): boolean {
  return (
    Number.isSafeInteger(principal.nhanVienId) &&
    (principal.nhanVienId ?? 0) > 0 &&
    Number.isSafeInteger(principal.nhaXeId) &&
    (principal.nhaXeId ?? 0) > 0
  );
}

function assertPrincipalScope(principal: AuthPrincipal): void {
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

  const hasTenantRole =
    roles.has('NHA_XE_ADMIN') ||
    [...roles].some((role) => TENANT_EMPLOYEE_ROLES.has(role));

  if (!hasTenantRole) {
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

  if ([...roles].some((role) => !TENANT_ADMIN_ROLES.has(role))) {
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

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPermissions = this.reflector.getAllAndOverride<
      AdminPermissionKey[]
    >(REQUIRED_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    const principal = request.user;
    if (!principal) {
      if (!requiredRoles?.length && !requiredPermissions?.length) return true;
      throw new UnauthorizedException({
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Cần đăng nhập để thực hiện thao tác này.',
      });
    }

    const allowRoleScopeConflict = this.reflector.getAllAndOverride<boolean>(
      ALLOW_ROLE_SCOPE_CONFLICT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowRoleScopeConflict) assertPrincipalScope(principal);

    if (
      requiredRoles?.length &&
      !requiredRoles.some((role) => principal.roles.includes(role))
    ) {
      throw new ForbiddenException({
        error: 'ROLE_FORBIDDEN',
        message: 'Tài khoản không có quyền thực hiện thao tác này.',
      });
    }

    if (
      requiredPermissions?.length &&
      !requiredPermissions.every((permission) =>
        principal.permissions?.includes(permission),
      )
    ) {
      throw new ForbiddenException({
        error: 'PERMISSION_FORBIDDEN',
        message: 'Tài khoản không có quyền thực hiện thao tác này.',
      });
    }

    return true;
  }
}
