import { describe, expect, it } from 'vitest';
import { PermissionResolverService } from '../../../src/auth/permissions/permission-resolver.service.js';

const resolver = new PermissionResolverService();

function role(roleName: string, ...permissions: string[]) {
  return { roleName, permissions };
}

describe('PermissionResolverService', () => {
  it('keeps SUPER_ADMIN platform-only even when global mapping contains tenant permissions', () => {
    const permissions = resolver.resolve(
      [role('SUPER_ADMIN', 'admin-account:read', 'vehicle:read')],
      { nhanVienId: null, nhaXeId: null },
    );

    expect(permissions).toEqual(['admin-account:read']);
  });

  it('keeps tenant roles tenant-only even when global mapping contains platform permissions', () => {
    const permissions = resolver.resolve(
      [role('NHA_XE_ADMIN', 'vehicle:read', 'admin-account:update')],
      { nhanVienId: 71, nhaXeId: 14 },
    );

    expect(permissions).toEqual(['vehicle:read']);
  });

  it('resolves booking:read for a tenant role and never for SUPER_ADMIN', () => {
    const tenantPermissions = resolver.resolve(
      [role('NHA_XE_ADMIN', 'booking:read')],
      { nhanVienId: 71, nhaXeId: 14 },
    );
    const platformPermissions = resolver.resolve(
      [role('SUPER_ADMIN', 'booking:read')],
      { nhanVienId: null, nhaXeId: null },
    );

    expect(tenantPermissions).toEqual(['booking:read']);
    expect(platformPermissions).toEqual([]);
  });

  it('unions permissions from multiple valid tenant roles and ignores unknown keys', () => {
    const permissions = resolver.resolve(
      [
        role('NHAN_VIEN_CSKH', 'route:read', 'unknown:permission'),
        role('NHAN_VIEN_KINH_DOANH', 'fare-price:read', 'route:read'),
      ],
      { nhanVienId: 71, nhaXeId: 14 },
    );

    expect(permissions).toEqual(['route:read', 'fare-price:read']);
  });

  it('returns no permissions for tenant role assignments without trusted tenant identity', () => {
    expect(
      resolver.resolve([role('NHAN_VIEN_CSKH', 'route:read')], {
        nhanVienId: null,
        nhaXeId: null,
      }),
    ).toEqual([]);
  });

  it('returns no permissions for mixed platform and tenant roles', () => {
    expect(
      resolver.resolve(
        [
          role('SUPER_ADMIN', 'admin-account:read'),
          role('NHAN_VIEN_CSKH', 'route:read'),
        ],
        { nhanVienId: 71, nhaXeId: 14 },
      ),
    ).toEqual([]);
  });

  it('does not resolve Admin permissions for customer or unknown roles', () => {
    expect(
      resolver.resolve([role('KHACH_HANG', 'vehicle:read')], {
        nhanVienId: null,
        nhaXeId: null,
      }),
    ).toEqual([]);
    expect(
      resolver.resolve([role('UNKNOWN_ROLE', 'bus-company:read')], {
        nhanVienId: null,
        nhaXeId: null,
      }),
    ).toEqual([]);
  });
});
