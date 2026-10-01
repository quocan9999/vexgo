import styles from './admin-rbac-presentation.module.css';

export type AdminRbacRoleOption<RoleName extends string = string> = {
  roleName: RoleName;
  description: string | null;
  scope: 'platform' | 'tenant';
  isProtected: boolean;
};

type AdminRbacRoleSelectorProps<RoleName extends string> = {
  dirtyRoleNames?: ReadonlySet<string>;
  onSelect: (roleName: RoleName) => void;
  radioName: string;
  roles: readonly AdminRbacRoleOption<RoleName>[];
  selectedRoleName: RoleName;
  title: string;
  titleId: string;
};

export function AdminRbacRoleSelector<RoleName extends string>({
  dirtyRoleNames = new Set<string>(),
  onSelect,
  radioName,
  roles,
  selectedRoleName,
  title,
  titleId,
}: AdminRbacRoleSelectorProps<RoleName>) {
  return (
    <section aria-labelledby={titleId} className={styles.roleSection}>
      <h2 id={titleId}>{title}</h2>
      <div
        aria-labelledby={titleId}
        className={styles.roleGrid}
        role="radiogroup"
      >
        {roles.map((role) => (
          <label
            className={`${styles.roleOption}${selectedRoleName === role.roleName ? ` ${styles.roleOptionSelected}` : ''}`}
            key={role.roleName}
          >
            <input
              checked={selectedRoleName === role.roleName}
              name={radioName}
              onChange={() => onSelect(role.roleName)}
              type="radio"
              value={role.roleName}
            />
            <span className={styles.roleCopy}>
              <strong>{role.roleName}</strong>
              <small>{role.description ?? 'Chưa có mô tả vai trò.'}</small>
            </span>
            <span className={styles.roleBadges}>
              <span className={styles.scopeBadge}>
                {role.scope === 'platform' ? 'Platform' : 'Nhà xe'}
              </span>
              {role.isProtected && (
                <span className={styles.protectedBadge}>
                  Vai trò hệ thống · Được bảo vệ
                </span>
              )}
              {dirtyRoleNames.has(role.roleName) && (
                <span className={styles.dirtyBadge}>Chưa lưu</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
