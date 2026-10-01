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
import {
  assertPrincipalScope,
  hasTenantRole,
} from '../principal-scope.js';
import { TENANT_PERMISSIONS_IF_AUTHENTICATED_KEY } from '../decorators/require-tenant-permissions-if-authenticated.decorator.js';
import type { AdminPermissionKey } from '../permissions/permission-catalog.js';
import type { AuthPrincipal } from '../tokens/auth-principal.js';

type AuthenticatedRequest = Request & { user?: AuthPrincipal };

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
    const tenantPermissionsIfAuthenticated = this.reflector.getAllAndOverride<
      AdminPermissionKey[]
    >(TENANT_PERMISSIONS_IF_AUTHENTICATED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
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

    if (
      tenantPermissionsIfAuthenticated?.length &&
      hasTenantRole(principal.roles) &&
      !tenantPermissionsIfAuthenticated.every((permission) =>
        principal.permissions.includes(permission),
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
