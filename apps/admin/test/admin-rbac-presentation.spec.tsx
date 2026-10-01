// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminRbacPermissionMatrix } from '@/components/admin/rbac/admin-rbac-permission-matrix';
import { AdminRbacRoleSelector } from '@/components/admin/rbac/admin-rbac-role-selector';

vi.mock('lucide-react', () => ({
  ShieldCheck: () => null,
}));

afterEach(() => cleanup());

const roles = [
  {
    roleName: 'SUPER_ADMIN',
    description: 'Quản trị hệ thống',
    scope: 'platform' as const,
    isProtected: true,
  },
  {
    roleName: 'NHA_XE_ADMIN',
    description: 'Quản trị nhà xe',
    scope: 'tenant' as const,
    isProtected: false,
  },
];

const permissions = [
  {
    key: 'vehicle:read',
    scope: 'tenant' as const,
    description: 'Xem danh sách xe',
  },
  {
    key: 'vehicle:update',
    scope: 'tenant' as const,
    description: 'Cập nhật xe',
  },
];

describe('Admin RBAC shared presentation', () => {
  it('announces the selected role and invokes selection for another role', () => {
    const onSelect = vi.fn();
    render(
      <AdminRbacRoleSelector
        dirtyRoleNames={new Set(['NHA_XE_ADMIN'])}
        onSelect={onSelect}
        radioName="admin-rbac-role"
        roles={roles}
        selectedRoleName="SUPER_ADMIN"
        title="Chọn vai trò cần cấu hình"
        titleId="rbac-roles-title"
      />,
    );

    expect(screen.getByRole('radio', { name: /SUPER_ADMIN/ })).toHaveProperty(
      'checked',
      true,
    );
    expect(screen.getByText('Chưa lưu')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /NHA_XE_ADMIN/ }));
    expect(onSelect).toHaveBeenCalledWith('NHA_XE_ADMIN');
  });

  it('groups permissions and reports checkbox changes with the selected role', () => {
    const onPermissionChange = vi.fn();
    render(
      <AdminRbacPermissionMatrix
        disabled={false}
        isProtected={false}
        onPermissionChange={onPermissionChange}
        permissions={permissions}
        roleName="NHA_XE_ADMIN"
        scope="tenant"
        selectedKeys={['vehicle:read']}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Quyền của NHA_XE_ADMIN' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Xe' })).toBeTruthy();
    expect(
      screen.getByRole('checkbox', {
        name: 'Gán quyền vehicle:read cho NHA_XE_ADMIN',
      }),
    ).toHaveProperty('checked', true);

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Gán quyền vehicle:update cho NHA_XE_ADMIN',
      }),
    );
    expect(onPermissionChange).toHaveBeenCalledWith('vehicle:update', true);
  });

  it('keeps protected-role guidance visible in the shared matrix', () => {
    render(
      <AdminRbacPermissionMatrix
        disabled={false}
        isProtected
        onPermissionChange={vi.fn()}
        permissions={[]}
        roleName="SUPER_ADMIN"
        scope="platform"
        selectedKeys={[]}
      />,
    );

    expect(screen.getByText(/Vai trò hệ thống được bảo vệ/)).toBeTruthy();
    expect(screen.getByText(/Không thể xóa, đổi tên, vô hiệu hóa/)).toBeTruthy();
  });
});
