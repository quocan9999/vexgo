'use client';

import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ResourceNotice, ResourceState } from '@/components/admin/resource-ui';
import type { ReactNode } from 'react';

export type AdminRbacPermissionOption = {
  key: string;
  scope: 'platform' | 'tenant';
  description: string;
};

type AdminRbacPermissionMatrixProps = {
  appearance?: 'resource';
  actions?: ReactNode;
  disabled: boolean;
  isProtected: boolean;
  onPermissionChange: (permissionKey: string, checked: boolean) => void;
  permissions: readonly AdminRbacPermissionOption[];
  roleName: string;
  scope: 'platform' | 'tenant';
  selectedKeys: readonly string[];
};

const RESOURCE_LABELS: Record<string, string> = {
  'admin-account': 'Tài khoản quản trị',
  'bus-company': 'Nhà xe',
  'fare-price': 'Bảng giá vé',
  permission: 'Quyền',
  role: 'Vai trò',
  route: 'Tuyến xe',
  seat: 'Ghế',
  vehicle: 'Xe',
  'vehicle-type': 'Loại xe',
  trip: 'Chuyến xe',
  customer: 'Khách hàng',
  booking: 'Phiếu đặt vé',
  revenue: 'Báo cáo doanh thu',
  promotion: 'Khuyến mãi',
  shipment: 'Gửi hàng',
  chat: 'Chăm sóc khách hàng',
};

const ACTION_LABELS: Record<string, string> = {
  assign: 'Gán',
  create: 'Tạo',
  delete: 'Xóa',
  read: 'Xem',
  update: 'Cập nhật',
  cancel: 'Hủy',
  manage: 'Quản lý',
};

function getPermissionGroups(
  permissions: readonly AdminRbacPermissionOption[],
) {
  const groups = new Map<string, AdminRbacPermissionOption[]>();
  for (const permission of permissions) {
    const [resource] = permission.key.split(':');
    const group = groups.get(resource) ?? [];
    group.push(permission);
    groups.set(resource, group);
  }

  return [...groups].map(([resource, items]) => ({
    resource,
    label: RESOURCE_LABELS[resource] ?? resource,
    permissions: items,
  }));
}

function getPermissionActionLabel(permissionKey: string): string {
  const action = permissionKey.split(':')[1];
  return ACTION_LABELS[action] ?? action ?? permissionKey;
}

export function AdminRbacPermissionMatrix({
  actions,
  disabled,
  isProtected,
  onPermissionChange,
  permissions,
  roleName,
  scope,
  selectedKeys,
}: AdminRbacPermissionMatrixProps) {
  const permissionGroups = getPermissionGroups(
    permissions.filter((permission) => permission.scope === scope),
  );

  return (
    <Card
      role="region"
      aria-labelledby="rbac-permissions-title"
      className="min-w-0 gap-5 p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {scope === 'platform' ? 'PLATFORM' : 'PHẠM VI NHÀ XE'}
          </p>
          <h2
            id="rbac-permissions-title"
            className="text-base font-semibold break-words"
          >
            Quyền của <span className="admin-data-mono">{roleName}</span>
          </h2>
        </div>
        {isProtected && (
          <ResourceNotice kind="info">
            Vai trò hệ thống được bảo vệ
          </ResourceNotice>
        )}
      </div>
      {isProtected && (
        <ResourceNotice kind="info">
          Không thể chỉnh sửa quyền của vai trò hệ thống này.
        </ResourceNotice>
      )}
      {permissionGroups.length === 0 ? (
        <ResourceState>Danh mục chưa có quyền thuộc scope này.</ResourceState>
      ) : (
        <div className="grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {permissionGroups.map((group) => (
            <section
              key={group.resource}
              aria-labelledby={`rbac-group-${group.resource}`}
              className="min-w-0 rounded-lg border"
            >
              <h3
                id={`rbac-group-${group.resource}`}
                className="border-b bg-muted/30 px-4 py-3 text-[13px] font-semibold"
              >
                {group.label}
              </h3>
              <div className="divide-y">
                {group.permissions.map((permission) => (
                  <label
                    key={permission.key}
                    className="flex min-h-11 min-w-0 cursor-pointer items-start gap-3 p-4 hover:bg-muted/30 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60"
                  >
                    <Checkbox
                      className="mt-0.5"
                      aria-label={`Gán quyền ${permission.key} cho ${roleName}`}
                      checked={selectedKeys.includes(permission.key)}
                      disabled={disabled || isProtected}
                      onCheckedChange={(checked) =>
                        onPermissionChange(permission.key, checked)
                      }
                    />
                    <span className="grid min-w-0 gap-1 text-[13px]">
                      <strong className="font-medium">
                        {getPermissionActionLabel(permission.key)}
                      </strong>
                      <code className="admin-data-mono break-all text-xs text-muted-foreground">
                        {permission.key}
                      </code>
                      <span className="text-xs text-muted-foreground">
                        {permission.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {actions}
    </Card>
  );
}
