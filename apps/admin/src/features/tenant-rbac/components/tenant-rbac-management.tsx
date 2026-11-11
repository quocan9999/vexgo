'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  ResourceConfirmation,
  ResourceRefreshAction,
  ResourceState,
  ResourceNotice,
} from '@/components/admin/resource-ui';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminRbacPermissionMatrix } from '@/components/admin/rbac/admin-rbac-permission-matrix';
import { AdminRbacRoleSelector } from '@/components/admin/rbac/admin-rbac-role-selector';
import { Button } from '@/components/ui/action-button';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import {
  canReadTenantRbac,
  canWriteTenantRbac,
} from '@/features/admin-auth/services/admin-access';
import { reloadAdminSession } from '@/features/admin-auth/services/admin-auth';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useTranslations } from 'next-intl';
import {
  getTenantRolePermissions,
  replaceTenantRolePermissions,
  resetTenantRolePermissions,
} from '../services/tenant-rbac-service';
import {
  TENANT_RBAC_ROLE_NAMES,
  type TenantRbacConfig,
  type TenantRbacRole,
  type TenantRbacRoleName,
} from '../types/tenant-rbac';

type RoleDrafts = Partial<Record<TenantRbacRoleName, string[]>>;

type Confirmation = 'save' | 'reset' | null;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function hasSameKeys(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length && left.every((key) => right.includes(key))
  );
}

function getSelfLockoutWarning(
  config: TenantRbacConfig,
  role: TenantRbacRole,
  nextPermissionKeys: readonly string[],
  sessionRoles: readonly string[],
  tRbac: (key: string) => string,
): string | null {
  if (!sessionRoles.includes(role.roleName)) return null;

  const nextEffectivePermissions = new Set<string>();
  for (const currentRoleName of TENANT_RBAC_ROLE_NAMES) {
    if (!sessionRoles.includes(currentRoleName)) continue;
    const currentRole = config.roles.find(
      (candidate) => candidate.roleName === currentRoleName,
    );
    if (!currentRole) continue;
    const effectiveKeys =
      currentRole.roleName === role.roleName
        ? nextPermissionKeys
        : currentRole.effectivePermissionKeys;
    effectiveKeys.forEach((key) => nextEffectivePermissions.add(key));
  }

  const losesRead = !nextEffectivePermissions.has('role:read');
  const losesAssign = !nextEffectivePermissions.has('permission:assign');
  if (losesRead && losesAssign) {
    return tRbac('riskAllNotice');
  }
  if (losesRead) {
    return tRbac('riskPageNotice');
  }
  if (losesAssign) {
    return tRbac('riskEditNotice');
  }
  return tRbac('riskRoleNotice');
}

function PermissionKeyList({
  emptyLabel,
  permissionKeys,
  zeroPermissionsLabel,
  listAriaLabel,
}: {
  emptyLabel: string;
  permissionKeys: readonly string[] | null;
  zeroPermissionsLabel?: string;
  listAriaLabel?: string;
}) {
  if (permissionKeys === null) return <p>{emptyLabel}</p>;
  if (permissionKeys.length === 0) return <p>{zeroPermissionsLabel ?? '0 permissions'}</p>;

  return (
    <ul
      tabIndex={0}
      aria-label={listAriaLabel ?? 'Permission keys'}
      className="max-h-40 space-y-2 overflow-y-auto rounded-md text-xs focus-visible:outline-2 focus-visible:outline-ring"
    >
      {permissionKeys.map((key) => (
        <li key={key}>
          <code className="admin-data-mono break-all">{key}</code>
        </li>
      ))}
    </ul>
  );
}

export function TenantRbacManagement() {
  const tRbac = useTranslations('rbac');
  const authState = useAdminSession();
  const session =
    authState.status === 'authenticated' ? authState.session : null;
  const canRead = canReadTenantRbac(session);
  const canEdit = canWriteTenantRbac(session);
  const [config, setConfig] = useState<TenantRbacConfig | null>(null);
  const [drafts, setDrafts] = useState<RoleDrafts>({});
  const [selectedRoleName, setSelectedRoleName] =
    useState<TenantRbacRoleName>('NHA_XE_ADMIN');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void getTenantRolePermissions(controller.signal)
      .then((loadedConfig) => {
        if (controller.signal.aborted) return;
        setConfig(loadedConfig);
        setDrafts(
          Object.fromEntries(
            loadedConfig.roles.map((role) => [
              role.roleName,
              [...role.effectivePermissionKeys],
            ]),
          ),
        );
        setSelectedRoleName((current) =>
          loadedConfig.roles.some((role) => role.roleName === current)
            ? current
            : loadedConfig.roles[0].roleName,
        );
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(getErrorMessage(error, tRbac('cannotLoadPermissions')));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadAttempt]);

  function retryLoading() {
    setLoading(true);
    setLoadError(null);
    setLoadAttempt((attempt) => attempt + 1);
  }

  const selectedRole =
    config?.roles.find((role) => role.roleName === selectedRoleName) ?? null;
  const selectedDraft = selectedRole
    ? (drafts[selectedRole.roleName] ?? selectedRole.effectivePermissionKeys)
    : [];
  const isDirty = selectedRole
    ? !hasSameKeys(selectedRole.effectivePermissionKeys, selectedDraft)
    : false;
  const selectedSelfLockoutWarning =
    selectedRole && session
      ? getSelfLockoutWarning(
          config!,
          selectedRole,
          selectedDraft,
          session.roles,
          tRbac,
        )
      : null;
  const resetSelfLockoutWarning =
    selectedRole && session && config
      ? getSelfLockoutWarning(
          config,
          selectedRole,
          selectedRole.defaultPermissionKeys,
          session.roles,
          tRbac,
        )
      : null;

  function changePermission(permissionKey: string, checked: boolean) {
    if (!selectedRole || !config || !canEdit || savingRef.current) return;
    setDrafts((current) => {
      const currentKeys = new Set(
        current[selectedRole.roleName] ?? selectedRole.effectivePermissionKeys,
      );
      if (checked) currentKeys.add(permissionKey);
      else currentKeys.delete(permissionKey);
      return {
        ...current,
        [selectedRole.roleName]: config.permissions
          .filter((permission) => currentKeys.has(permission.key))
          .map(({ key }) => key),
      };
    });
  }

  function undoSelectedRole() {
    if (!selectedRole || !canEdit || savingRef.current) return;
    setDrafts((current) => ({
      ...current,
      [selectedRole.roleName]: [...selectedRole.effectivePermissionKeys],
    }));
  }

  function updateConfigRole(savedRole: TenantRbacRole) {
    setConfig((current) =>
      current
        ? {
            ...current,
            roles: current.roles.map((role) =>
              role.roleName === savedRole.roleName ? savedRole : role,
            ),
          }
        : current,
    );
    setDrafts((current) => ({
      ...current,
      [savedRole.roleName]: [...savedRole.effectivePermissionKeys],
    }));
  }

  async function syncTrustedSession() {
    try {
      await reloadAdminSession();
    } catch {
      toast.warning(tRbac('sessionSyncReloadNotice'));
    }
  }

  async function saveSelectedRole() {
    if (!selectedRole || !config || !isDirty || !canEdit || savingRef.current)
      return;
    savingRef.current = true;
    setSaving(true);
    const permissionKeys = config.permissions
      .filter((permission) => selectedDraft.includes(permission.key))
      .map(({ key }) => key);

    try {
      const savedRole = await replaceTenantRolePermissions(
        selectedRole,
        permissionKeys,
        config.permissions,
      );
      updateConfigRole(savedRole);
      setConfirmation(null);
      toast.success(
        permissionKeys.length === 0
          ? tRbac('overrideSavedEmpty', { role: savedRole.roleName })
          : tRbac('overrideSaved', { role: savedRole.roleName }),
      );
      await syncTrustedSession();
    } catch (error) {
      toast.error(getErrorMessage(error, tRbac('cannotSavePermissions')));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function restoreDefaultPermissions() {
    if (!selectedRole || !config || !canEdit || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const restoredRole = await resetTenantRolePermissions(
        selectedRole,
        config.permissions,
      );
      updateConfigRole(restoredRole);
      setConfirmation(null);
      toast.success(
        tRbac('restoreDefaultSuccess', { role: restoredRole.roleName }),
      );
      await syncTrustedSession();
    } catch (error) {
      toast.error(
        getErrorMessage(error, tRbac('cannotRestoreDefault')),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const dirtyRoleNames = new Set(
    config?.roles
      .filter(
        (role) =>
          !hasSameKeys(
            role.effectivePermissionKeys,
            drafts[role.roleName] ?? role.effectivePermissionKeys,
          ),
      )
      .map(({ roleName }) => roleName) ?? [],
  );
  const defaultRolePermissions = selectedRole
    ? selectedRole.defaultPermissionKeys
    : [];
  const overridePermissionKeys = selectedRole
    ? selectedRole.overridePermissionKeys
    : null;
  const effectivePermissionKeys = selectedRole
    ? selectedRole.effectivePermissionKeys
    : [];

  return (
    <SuperAdminLayout activeSection="tenant-rbac">
      <div
        aria-busy={loading || saving}
        className="admin-page-content admin-ui space-y-6"
      >
        <AdminPageHeader
          eyebrow={tRbac('eyebrowTenant')}
          title={tRbac('tenantRbacTitle')}
          titleId="tenant-rbac-title"
          actions={
            <ResourceRefreshAction
              loading={loading || saving}
              onClick={retryLoading}
            />
          }
        />

        {!canEdit && canRead && (
          <ResourceNotice kind="info">
            {tRbac('viewOnlyNotice')}
          </ResourceNotice>
        )}
        {loading && !config && (
          <Card>
            <ResourceState loading>{tRbac('loadingCatalog')}</ResourceState>
          </Card>
        )}
        {!loading && !config && loadError && (
          <Card>
            <ResourceState error>
              <h2 className="text-base font-semibold">
                {tRbac('loadErrorTitle')}
              </h2>
              <p>{loadError}</p>
              <Button onClick={retryLoading} variant="outline">
                {tRbac('reloadConfig')}
              </Button>
            </ResourceState>
          </Card>
        )}
        {config && loadError && (
          <ResourceNotice kind="error">
            {tRbac('keepPreviousConfigNotice', { error: loadError })}
          </ResourceNotice>
        )}

        {config && selectedRole && (
          <>
            <AdminRbacRoleSelector
              appearance="resource"
              disabled={saving}
              dirtyRoleNames={dirtyRoleNames}
              onSelect={(roleName) => {
                setSelectedRoleName(roleName);
              }}
              radioName="tenant-rbac-role"
              roles={config.roles}
              selectedRoleName={selectedRole.roleName}
              title={tRbac('selectRoleTitle')}
              titleId="tenant-rbac-roles-title"
            />

            <Card
              role="region"
              aria-label={tRbac('permissionConfigStatusAriaLabel')}
              className="min-w-0 gap-5 p-4 sm:p-5"
            >
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:break-all">
                <div>
                  <p className="eyebrow">{tRbac('scopeTenantBanner')}</p>
                  <h2 className="admin-data-mono">{selectedRole.roleName}</h2>
                </div>
                <Badge
                  variant={
                    selectedRole.source === 'global' ? 'secondary' : 'outline'
                  }
                >
                  {selectedRole.source === 'global'
                    ? tRbac('inheritsDefault')
                    : tRbac('overrideCustom')}
                </Badge>
              </div>
              <div className="grid min-w-0 gap-4 lg:grid-cols-3 [&>section]:min-w-0 [&>section]:space-y-3 [&>section]:rounded-lg [&>section]:border [&>section]:p-4 [&_h3]:text-[13px] [&_h3]:font-semibold [&_p]:text-xs [&_p]:text-muted-foreground">
                <section aria-labelledby="tenant-rbac-default-title">
                  <h3 id="tenant-rbac-default-title">{tRbac('defaultPermissions')}</h3>
                  <PermissionKeyList
                    emptyLabel={tRbac('roleHasNoDefaultPermissions')}
                    permissionKeys={defaultRolePermissions}
                    zeroPermissionsLabel={tRbac('zeroPermissions')}
                    listAriaLabel={tRbac('permissionListAriaLabel')}
                  />
                </section>
                <section aria-labelledby="tenant-rbac-override-title">
                  <h3 id="tenant-rbac-override-title">{tRbac('operatorOverrides')}</h3>
                  {overridePermissionKeys === null ? (
                    <p>{tRbac('noOverridesConfigured')}</p>
                  ) : (
                    <PermissionKeyList
                      emptyLabel=""
                      permissionKeys={overridePermissionKeys}
                      zeroPermissionsLabel={tRbac('zeroPermissions')}
                      listAriaLabel={tRbac('permissionListAriaLabel')}
                    />
                  )}
                </section>
                <section aria-labelledby="tenant-rbac-effective-title">
                  <h3 id="tenant-rbac-effective-title">{tRbac('effectivePermissions')}</h3>
                  <PermissionKeyList
                    emptyLabel={tRbac('roleHasNoEffectivePermissions')}
                    permissionKeys={effectivePermissionKeys}
                    zeroPermissionsLabel={tRbac('zeroPermissions')}
                    listAriaLabel={tRbac('permissionListAriaLabel')}
                  />
                </section>
              </div>
            </Card>

            <AdminRbacPermissionMatrix
              appearance="resource"
              actions={
                <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5 [&>div]:flex [&>div]:flex-wrap [&>div]:gap-3">
                  <p
                    aria-live="polite"
                    className="text-xs text-muted-foreground"
                  >
                    {isDirty
                      ? tRbac('hasUnsavedChanges', { role: selectedRole.roleName })
                      : tRbac('configSyncSaved')}
                  </p>
                  <div>
                    <Button
                      disabled={!canEdit || !isDirty || saving}
                      onClick={undoSelectedRole}
                      variant="outline"
                    >
                      <RotateCcw aria-hidden="true" size={16} />
                      {tRbac('undo')}
                    </Button>
                    {selectedRole.source === 'override' && (
                      <Button
                        disabled={!canEdit || saving}
                        onClick={() => {
                          setConfirmation('reset');
                        }}
                        variant="outline"
                      >
                        {tRbac('resetToDefault')}
                      </Button>
                    )}
                    <Button
                      disabled={!canEdit || !isDirty || saving}
                      onClick={() => {
                        setConfirmation('save');
                      }}
                    >
                      {tRbac('saveChanges')}
                    </Button>
                  </div>
                </div>
              }
              disabled={!canEdit || saving}
              isProtected={false}
              onPermissionChange={changePermission}
              permissions={config.permissions}
              roleName={selectedRole.roleName}
              scope="tenant"
              selectedKeys={selectedDraft}
            />
          </>
        )}

        {confirmation && selectedRole && config && (
          <ResourceConfirmation
            title={
              confirmation === 'save'
                ? tRbac('confirmReplaceTenantTitle')
                : tRbac('confirmResetDefaultTitle')
            }
            description={
              confirmation === 'save'
                ? tRbac('confirmReplaceTenantDesc', { role: selectedRole.roleName })
                : tRbac('confirmResetDefaultDesc', { role: selectedRole.roleName })
            }
            busy={saving}
            onClose={() => {
              if (!savingRef.current) setConfirmation(null);
            }}
          >
            {confirmation === 'save' && selectedDraft.length === 0 && (
              <ResourceNotice kind="info">
                {tRbac('emptyOverrideWarning')}
              </ResourceNotice>
            )}
            {((confirmation === 'save' && selectedSelfLockoutWarning) ||
              (confirmation === 'reset' && resetSelfLockoutWarning)) && (
              <ResourceNotice kind="info">
                {confirmation === 'save'
                  ? selectedSelfLockoutWarning
                  : resetSelfLockoutWarning}
              </ResourceNotice>
            )}
            <Button
              disabled={saving}
              aria-busy={saving}
              onClick={() =>
                void (confirmation === 'save'
                  ? saveSelectedRole()
                  : restoreDefaultPermissions())
              }
            >
              {saving
                ? tRbac('saving')
                : confirmation === 'save'
                  ? tRbac('confirmSaveAction')
                  : tRbac('confirmResetAction')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
