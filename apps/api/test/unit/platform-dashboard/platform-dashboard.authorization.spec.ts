import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AuthorizationGuard } from '../../../src/auth/guards/authorization.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { PlatformDashboardController } from '../../../src/platform-dashboard/platform-dashboard.controller.js';

const platformAdmin: AuthPrincipal = {
  taiKhoanId: 1,
  sessionId: 'unit',
  roles: ['SUPER_ADMIN'],
  permissions: ['bus-company:read', 'admin-account:read'],
  nhanVienId: null,
  nhaXeId: null,
};

function authorize(user?: AuthPrincipal) {
  return new AuthorizationGuard(new Reflector()).canActivate({
    getType: () => 'http',
    getHandler: () => PlatformDashboardController.prototype.getOverview,
    getClass: () => PlatformDashboardController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never);
}

describe('platform dashboard authorization', () => {
  it('requires authentication and allows a pure Super Admin with both permissions', () => {
    expect(() => authorize()).toThrow(UnauthorizedException);
    expect(authorize(platformAdmin)).toBe(true);
  });

  it.each([[], ['bus-company:read'], ['admin-account:read']])(
    'rejects incomplete permissions %j',
    (...permissions) => {
      expect(() => authorize({ ...platformAdmin, permissions })).toThrow(
        ForbiddenException,
      );
    },
  );

  it.each<Partial<AuthPrincipal>>([
    { roles: ['NHA_XE_ADMIN'], nhanVienId: 2, nhaXeId: 17 },
    { roles: ['NHAN_VIEN_DIEU_HANH'], nhanVienId: 2, nhaXeId: 17 },
    { roles: ['KHACH_HANG'] },
    { roles: ['SUPER_ADMIN', 'NHA_XE_ADMIN'] },
    { roles: ['SUPER_ADMIN', 'KHACH_HANG'] },
    { nhanVienId: 2 },
    { nhaXeId: 17 },
  ])(
    'rejects non-platform or conflicting principal even with both permissions: %j',
    (overrides) => {
      expect(() => authorize({ ...platformAdmin, ...overrides })).toThrow(
        ForbiddenException,
      );
    },
  );
});
