import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './admin-rbac-presentation.module.css';

export type AdminRbacPermissionOption = {
  key: string;
  scope: 'platform' | 'tenant';
  description: string;
};

type AdminRbacPermissionMatrixProps = {
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
};

const ACTION_LABELS: Record<string, string> = {
  assign: 'Gán',
  create: 'Tạo',
  delete: 'Xóa',
  read: 'Xem',
  update: 'Cập nhật',
};

function getPermissionGroups(permissions: readonly AdminRbacPermissionOption[]) {
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
    <section
      aria-labelledby="rbac-permissions-title"
      className={styles.permissionSection}
    >
      <div className={styles.permissionHeader}>
        <div>
          <p className="eyebrow">{scope === 'platform' ? 'PLATFORM' : 'TENANT'}</p>
          <h2 id="rbac-permissions-title">Quyền của {roleName}</h2>
        </div>
        {isProtected && (
          <span className={styles.protectedSummary}>
            <ShieldCheck aria-hidden="true" size={16} />
            Vai trò hệ thống được bảo vệ
          </span>
        )}
      </div>

      {isProtected && (
        <p className={styles.protectedNotice}>
          Không thể xóa, đổi tên, vô hiệu hóa hoặc gỡ bảo vệ vai trò này.
          Ma trận bên dưới chỉ cấu hình quyền mặc định của vai trò.
        </p>
      )}

      {permissionGroups.length === 0 ? (
        <p className={styles.emptyState}>Danh mục chưa có quyền thuộc scope này.</p>
      ) : (
        <div className={styles.permissionGrid}>
          {permissionGroups.map((group) => (
            <section
              aria-labelledby={`rbac-group-${group.resource}`}
              className={styles.permissionGroup}
              key={group.resource}
            >
              <h3 id={`rbac-group-${group.resource}`}>{group.label}</h3>
              <div className={styles.permissionList}>
                {group.permissions.map((permission) => (
                  <label
                    className={styles.permissionOption}
                    key={permission.key}
                  >
                    <input
                      aria-label={`Gán quyền ${permission.key} cho ${roleName}`}
                      checked={selectedKeys.includes(permission.key)}
                      disabled={disabled}
                      onChange={(event) =>
                        onPermissionChange(
                          permission.key,
                          event.currentTarget.checked,
                        )
                      }
                      type="checkbox"
                    />
                    <span className={styles.permissionCopy}>
                      <strong>
                        {getPermissionActionLabel(permission.key)}
                      </strong>
                      <code>{permission.key}</code>
                      <small>{permission.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {actions}
    </section>
  );
}
