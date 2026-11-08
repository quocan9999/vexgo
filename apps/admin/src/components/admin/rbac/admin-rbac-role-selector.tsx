'use client';

import { useTranslations } from 'next-intl';

import { LabeledSelectFilter } from '@/components/data-filters/labeled-select-filter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/status-badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export type AdminRbacRoleOption<RoleName extends string = string> = {
  roleName: RoleName;
  description: string | null;
  scope: 'platform' | 'tenant';
  isProtected: boolean;
};

type AdminRbacRoleSelectorProps<RoleName extends string> = {
  appearance?: 'resource';
  disabled?: boolean;
  dirtyRoleNames?: ReadonlySet<string>;
  onSelect: (roleName: RoleName) => void;
  radioName: string;
  roles: readonly AdminRbacRoleOption<RoleName>[];
  selectedRoleName: RoleName;
  title: string;
  titleId: string;
};


const ROLE_DESC_KEYS: Record<string, string> = {
  SUPER_ADMIN: 'roleDesc_SUPER_ADMIN',
  NHA_XE_ADMIN: 'roleDesc_NHA_XE_ADMIN',
  NHAN_VIEN_DIEU_HANH: 'roleDesc_NHAN_VIEN_DIEU_HANH',
  NHAN_VIEN_BAN_VE: 'roleDesc_NHAN_VIEN_BAN_VE',
  NHAN_VIEN_CSKH: 'roleDesc_NHAN_VIEN_CSKH',
  NHAN_VIEN_PHU_XE: 'roleDesc_NHAN_VIEN_PHU_XE',
  NHAN_VIEN_KINH_DOANH: 'roleDesc_NHAN_VIEN_KINH_DOANH',
};

export function AdminRbacRoleSelector<RoleName extends string>({
  // hook

  disabled = false,
  dirtyRoleNames = new Set<string>(),
  onSelect,
  radioName,
  roles,
  selectedRoleName,
  title,
  titleId,
}: AdminRbacRoleSelectorProps<RoleName>) {
  const tRbac = useTranslations('rbac');
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
          label={tRbac('roleLabel')}
          value={selectedRoleName}
          disabled={disabled}
          options={roles.map((role) => {
            const roleDesc = ROLE_DESC_KEYS[role.roleName]
              ? tRbac(ROLE_DESC_KEYS[role.roleName] as any)
              : (role.description ?? tRbac('noRoleDescription'));
            return {
              value: role.roleName,
              label: `${roleDesc}${dirtyRoleNames.has(role.roleName) ? ` · ${tRbac('dirtyRoleSuffix')}` : ''}`,
            };
          })}
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
                {ROLE_DESC_KEYS[role.roleName]
                  ? tRbac(ROLE_DESC_KEYS[role.roleName] as any)
                  : (role.description ?? tRbac('noRoleDescription'))}
              </span>
              <span className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {role.scope === 'platform' ? 'Platform' : tRbac('scopeOperator')}
                </Badge>
                {role.isProtected && (
                  <Badge variant="secondary">{tRbac('protectedRole')}</Badge>
                )}
                {dirtyRoleNames.has(role.roleName) && (
                  <Badge variant="warning">{tRbac('unsaved')}</Badge>
                )}
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </Card>
  );
}
