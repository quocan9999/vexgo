'use client';

import { LabeledSelectFilter } from '@/components/data-filters/labeled-select-filter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/status-badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import styles from './admin-rbac-presentation.module.css';

export type AdminRbacRoleOption<RoleName extends string = string> = {
  roleName: RoleName;
  description: string | null;
  scope: 'platform' | 'tenant';
  isProtected: boolean;
};

type AdminRbacRoleSelectorProps<RoleName extends string> = {
  appearance?: 'legacy' | 'resource';
  disabled?: boolean;
  dirtyRoleNames?: ReadonlySet<string>;
  onSelect: (roleName: RoleName) => void;
  radioName: string;
  roles: readonly AdminRbacRoleOption<RoleName>[];
  selectedRoleName: RoleName;
  title: string;
  titleId: string;
};

export function AdminRbacRoleSelector<RoleName extends string>({
  appearance = 'legacy',
  disabled = false,
  dirtyRoleNames = new Set<string>(),
  onSelect,
  radioName,
  roles,
  selectedRoleName,
  title,
  titleId,
}: AdminRbacRoleSelectorProps<RoleName>) {
  if (appearance === 'resource')
    return (
      <Card
        role="region"
        aria-labelledby={titleId}
        className="gap-4 p-4 sm:p-5"
      >
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <div className="sm:hidden">
          <LabeledSelectFilter
            appearance="resource"
            label="Vai trò"
            value={selectedRoleName}
            disabled={disabled}
            options={roles.map((role) => ({
              value: role.roleName,
              label: `${role.description ?? role.roleName}${dirtyRoleNames.has(role.roleName) ? ' · Chưa lưu' : ''}`,
            }))}
            onChange={(value) => {
              const role = roles.find(
                (candidate) => candidate.roleName === value,
              );
              if (role) onSelect(role.roleName);
            }}
          />
        </div>
        <RadioGroup
          name={radioName}
          value={selectedRoleName}
          disabled={disabled}
          onValueChange={(value) => {
            const role = roles.find(
              (candidate) => candidate.roleName === value,
            );
            if (role) onSelect(role.roleName);
          }}
          aria-labelledby={titleId}
          className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-3"
        >
          {roles.map((role) => (
            <label
              key={role.roleName}
              className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring ${selectedRoleName === role.roleName ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'} ${disabled ? 'pointer-events-none opacity-60' : ''}`}
            >
              <RadioGroupItem value={role.roleName} className="mt-0.5" />
              <span className="grid min-w-0 gap-2">
                <strong className="admin-data-mono break-all text-[13px]">
                  {role.roleName}
                </strong>
                <span className="text-xs text-muted-foreground">
                  {role.description ?? 'Chưa có mô tả vai trò.'}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {role.scope === 'platform' ? 'Platform' : 'Nhà xe'}
                  </Badge>
                  {role.isProtected && (
                    <Badge variant="secondary">Vai trò được bảo vệ</Badge>
                  )}
                  {dirtyRoleNames.has(role.roleName) && (
                    <Badge variant="warning">Chưa lưu</Badge>
                  )}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </Card>
    );
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
