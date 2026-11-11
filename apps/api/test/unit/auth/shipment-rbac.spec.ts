import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_ROLE_DEFAULT_PERMISSION_KEYS,
  isPermissionAllowedForRole,
} from '../../../src/auth/permissions/permission-catalog.js';

describe('Shipment RBAC Foundation (Phase 01)', () => {
  const shipmentPermissions = ADMIN_PERMISSION_CATALOG.filter(({ key }) =>
    key.startsWith('shipment:'),
  );

  it('defines shipment:read and shipment:update in tenant scope with clear descriptions', () => {
    expect(shipmentPermissions).toEqual([
      {
        key: 'shipment:read',
        scope: 'tenant',
        description:
          'Xem danh sách và chi tiết phiếu gửi hàng trong phạm vi nhà xe.',
      },
      {
        key: 'shipment:update',
        scope: 'tenant',
        description:
          'Cập nhật trạng thái phiếu gửi hàng trong phạm vi nhà xe.',
      },
    ]);
  });

  it('assigns shipment permissions to NHA_XE_ADMIN and NHAN_VIEN_DIEU_HANH by default', () => {
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN).toContain(
      'shipment:read',
    );
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN).toContain(
      'shipment:update',
    );
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_DIEU_HANH).toContain(
      'shipment:read',
    );
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_DIEU_HANH).toContain(
      'shipment:update',
    );
  });

  it('denies shipment permissions to SUPER_ADMIN by default (platform scope only)', () => {
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.SUPER_ADMIN).not.toContain(
      'shipment:read',
    );
    expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.SUPER_ADMIN).not.toContain(
      'shipment:update',
    );
  });

  it('leaves other staff roles and customer without shipment default permissions', () => {
    const unprivilegedRoles = [
      'NHAN_VIEN_BAN_VE',
      'NHAN_VIEN_CSKH',
      'NHAN_VIEN_PHU_XE',
      'NHAN_VIEN_KINH_DOANH',
      'KHACH_HANG',
    ] as const;

    for (const role of unprivilegedRoles) {
      expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS[role]).not.toContain(
        'shipment:read',
      );
      expect(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS[role]).not.toContain(
        'shipment:update',
      );
    }
  });

  it('enforces role scope matching: platform roles cannot be assigned tenant shipment permissions', () => {
    expect(isPermissionAllowedForRole('SUPER_ADMIN', 'shipment:read')).toBe(
      false,
    );
    expect(isPermissionAllowedForRole('SUPER_ADMIN', 'shipment:update')).toBe(
      false,
    );
    expect(isPermissionAllowedForRole('NHA_XE_ADMIN', 'shipment:read')).toBe(
      true,
    );
    expect(isPermissionAllowedForRole('NHA_XE_ADMIN', 'shipment:update')).toBe(
      true,
    );
    expect(
      isPermissionAllowedForRole('NHAN_VIEN_DIEU_HANH', 'shipment:read'),
    ).toBe(true);
    expect(
      isPermissionAllowedForRole('NHAN_VIEN_DIEU_HANH', 'shipment:update'),
    ).toBe(true);
    expect(isPermissionAllowedForRole('KHACH_HANG', 'shipment:read')).toBe(
      false,
    );
  });
});
