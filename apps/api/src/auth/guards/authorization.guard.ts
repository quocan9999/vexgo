import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRED_ROLES_KEY } from '../decorators/require-roles.decorator.js';
import type { AuthPrincipal } from '../tokens/auth-principal.js';

type AuthenticatedRequest = Request & { user?: AuthPrincipal };

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const principal = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().user;
    if (!principal) {
      throw new UnauthorizedException({
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Cần đăng nhập để thực hiện thao tác này.',
      });
    }
    if (!requiredRoles.some((role) => principal.roles.includes(role))) {
      throw new ForbiddenException({
        error: 'ROLE_FORBIDDEN',
        message: 'Tài khoản không có quyền thực hiện thao tác này.',
      });
    }
    return true;
  }
}
