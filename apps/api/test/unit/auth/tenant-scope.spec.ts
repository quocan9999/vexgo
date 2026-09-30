import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  requireNhaXeAdminTenant,
  requireTenantPrincipal,
  tenantIdForOptionalRead,
} from '../../../src/auth/tenant-scope.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

function principal(overrides: Partial<AuthPrincipal> = {}): AuthPrincipal {
  return {
    taiKhoanId: 10,
    sessionId: 'tenant-scope-test',
    roles: ['NHA_XE_ADMIN'],
    permissions: [],
    nhanVienId: 20,
    nhaXeId: 7,
    ...overrides,
  };
}

function expectForbiddenCode(action: () => unknown, code: string) {
  let error: unknown;
  try {
    action();
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(ForbiddenException);
  expect((error as ForbiddenException).getResponse()).toMatchObject({
    error: code,
  });
}

describe('tenant principal scope helpers', () => {
  it.each([
    ['NHA_XE_ADMIN'],
    ['NHAN_VIEN_BAN_VE'],
    ['NHAN_VIEN_CSKH'],
    ['NHAN_VIEN_PHU_XE'],
    ['NHAN_VIEN_KINH_DOANH'],
  ])('returns the trusted tenant for role %s', (...roles: string[]) => {
    expect(requireTenantPrincipal(principal({ roles }))).toBe(7);
  });

  it('accepts multiple compatible tenant roles for one principal', () => {
    expect(
      requireTenantPrincipal(
        principal({ roles: ['NHA_XE_ADMIN', 'NHAN_VIEN_CSKH'] }),
      ),
    ).toBe(7);
  });

  it.each(['nhanVienId', 'nhaXeId'] as const)(
    'rejects missing or unsafe %s values before any service query',
    (field) => {
      for (const value of [null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        expectForbiddenCode(
          () =>
            requireTenantPrincipal(
              principal({ [field]: value as number | null }),
            ),
          'TENANT_SCOPE_REQUIRED',
        );
      }
    },
  );

  it('rejects a missing principal when tenant identity is required', () => {
    expectForbiddenCode(
      () => requireTenantPrincipal(undefined),
      'ROLE_FORBIDDEN',
    );
  });

  it.each([
    ['SUPER_ADMIN', null, null],
    ['KHACH_HANG', null, null],
    ['UNKNOWN_ROLE', null, null],
  ])(
    'does not let non-tenant role %s use a required tenant scope',
    (role, nhanVienId, nhaXeId) => {
      expectForbiddenCode(
        () =>
          requireTenantPrincipal(
            principal({
              roles: [role],
              nhanVienId,
              nhaXeId,
            }),
          ),
        'ROLE_FORBIDDEN',
      );
    },
  );

  it.each([
    ['tenant and customer', ['NHA_XE_ADMIN', 'KHACH_HANG']],
    ['platform and tenant', ['SUPER_ADMIN', 'NHAN_VIEN_PHU_XE']],
    ['tenant and unknown', ['NHAN_VIEN_KINH_DOANH', 'UNKNOWN_ROLE']],
  ])('fails closed for a %s role conflict', (_label, roles) => {
    expectForbiddenCode(
      () => requireTenantPrincipal(principal({ roles })),
      'ROLE_SCOPE_CONFLICT',
    );
  });

  it('uses tenant identity for authenticated tenant public reads', () => {
    expect(tenantIdForOptionalRead(principal())).toBe(7);
    expect(
      tenantIdForOptionalRead(
        principal({ roles: ['NHAN_VIEN_CSKH'] }),
      ),
    ).toBe(7);
  });

  it('preserves public reads for anonymous and valid non-tenant principals', () => {
    expect(tenantIdForOptionalRead(undefined)).toBeUndefined();
    expect(
      tenantIdForOptionalRead(
        principal({
          roles: ['KHACH_HANG'],
          nhanVienId: null,
          nhaXeId: null,
        }),
      ),
    ).toBeUndefined();
    expect(
      tenantIdForOptionalRead(
        principal({
          roles: ['SUPER_ADMIN'],
          nhanVienId: null,
          nhaXeId: null,
        }),
      ),
    ).toBeUndefined();
  });

  it('keeps the legacy helper strict until each service is migrated', () => {
    expect(requireNhaXeAdminTenant(principal())).toBe(7);
    expectForbiddenCode(
      () =>
        requireNhaXeAdminTenant(
          principal({ roles: ['NHAN_VIEN_CSKH'] }),
        ),
      'ROLE_FORBIDDEN',
    );
  });
});
