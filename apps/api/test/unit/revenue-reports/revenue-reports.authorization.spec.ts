import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_ROLE_DEFAULT_PERMISSION_KEYS,
} from '../../../src/auth/permissions/permission-catalog.js';
import { PermissionResolverService } from '../../../src/auth/permissions/permission-resolver.service.js';
import { AuthorizationGuard } from '../../../src/auth/guards/authorization.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { RevenueReportsController } from '../../../src/revenue-reports/revenue-reports.controller.js';

function principal(overrides: Partial<AuthPrincipal> = {}): AuthPrincipal {
  return {
    taiKhoanId: 1,
    sessionId: 'session-1',
    roles: ['NHA_XE_ADMIN'],
    permissions: ['revenue:read'],
    nhanVienId: 2,
    nhaXeId: 17,
    ...overrides,
  };
}

function authorize(user?: AuthPrincipal): boolean {
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => RevenueReportsController.prototype.getReport,
    getClass: () => RevenueReportsController,
  };
  return new AuthorizationGuard(new Reflector()).canActivate(context as never);
}

describe('revenue:read RBAC', () => {
  it('is tenant-scoped and defaults only to NHA_XE_ADMIN', () => {
    expect(
      ADMIN_PERMISSION_CATALOG.find(({ key }) => key === 'revenue:read')?.scope,
    ).toBe('tenant');
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN).toContain(
      'revenue:read',
    );
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.SUPER_ADMIN).not.toContain(
      'revenue:read',
    );
    for (const role of [
      'NHAN_VIEN_DIEU_HANH',
      'NHAN_VIEN_BAN_VE',
      'NHAN_VIEN_CSKH',
      'NHAN_VIEN_PHU_XE',
      'NHAN_VIEN_KINH_DOANH',
    ] as const) {
      expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS[role]).not.toContain(
        'revenue:read',
      );
    }
  });

  it('allows tenant role overrides to grant the catalog permission', () => {
    expect(
      new PermissionResolverService().resolve(
        [
          {
            roleName: 'NHAN_VIEN_DIEU_HANH',
            permissions: ['revenue:read'],
          },
        ],
        { nhanVienId: 22, nhaXeId: 17 },
      ),
    ).toContain('revenue:read');
    expect(
      new PermissionResolverService().resolve(
        [{ roleName: 'SUPER_ADMIN', permissions: ['revenue:read'] }],
        { nhanVienId: null, nhaXeId: null },
      ),
    ).not.toContain('revenue:read');
  });

  it('requires authentication, a tenant role, tenant identity, and the effective permission', () => {
    expect(() => authorize()).toThrow(UnauthorizedException);
    expect(() =>
      authorize(
        principal({
          roles: ['KHACH_HANG'],
          permissions: ['revenue:read'],
          nhanVienId: null,
          nhaXeId: null,
        }),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      authorize(
        principal({
          roles: ['SUPER_ADMIN'],
          permissions: ['revenue:read'],
          nhanVienId: null,
          nhaXeId: null,
        }),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      authorize(
        principal({
          roles: ['NHAN_VIEN_BAN_VE'],
          permissions: [],
        }),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      authorize(
        principal({
          roles: ['NHA_XE_ADMIN'],
          permissions: ['revenue:read'],
          nhanVienId: null,
          nhaXeId: null,
        }),
      ),
    ).toThrow(ForbiddenException);

    expect(authorize(principal())).toBe(true);
    expect(
      authorize(
        principal({
          roles: ['NHAN_VIEN_DIEU_HANH'],
          permissions: ['revenue:read'],
        }),
      ),
    ).toBe(true);
  });
});
