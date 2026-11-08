'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ResourceConfirmation,
  ResourceNotice,
  ResourceRefreshAction,
  ResourceState,
} from '@/components/admin/resource-ui';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminRbacPermissionMatrix } from '@/components/admin/rbac/admin-rbac-permission-matrix';
import { AdminRbacRoleSelector } from '@/components/admin/rbac/admin-rbac-role-selector';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useTranslations } from 'next-intl';
import { PlatformRbacScopeNavigation } from './platform-rbac-scope-navigation';
import {
  getDefaultRolePermissions,
  replaceDefaultRolePermissions,
} from '../services/platform-rbac-service';
import type {
  AdminRbacRoleName,
  DefaultAdminRbacConfig,
} from '../types/platform-rbac';
import { toast } from 'sonner';

type RoleDrafts = Partial<Record<AdminRbacRoleName, string[]>>;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function hasSameKeys(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((key) => right.includes(key))
  );
}

export function PlatformRbacManagement() {
  const tRbac = useTranslations('rbac');
  const tCommon = useTranslations('common');
  const [config, setConfig] = useState<DefaultAdminRbacConfig | null>(null);
  const [drafts, setDrafts] = useState<RoleDrafts>({});
  const [selectedRoleName, setSelectedRoleName] =
    useState<AdminRbacRoleName>('SUPER_ADMIN');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getDefaultRolePermissions(controller.signal)
      .then((loadedConfig) => {
        if (controller.signal.aborted) return;
        setConfig(loadedConfig);
        setDrafts(
          Object.fromEntries(
            loadedConfig.roles.map((role) => [
              role.roleName,
              [...role.permissionKeys],
            ]),
          ),
        );
        setSelectedRoleName((current) =>
          loadedConfig.roles.some((role) => role.roleName === current)
            ? current
            : loadedConfig.roles[0].roleName,
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(getErrorMessage(error, 'Không thể tải cấu hình quyền.'));
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
    ? drafts[selectedRole.roleName] ?? selectedRole.permissionKeys
    : [];
  const isDirty = selectedRole && !selectedRole.isProtected
    ? !hasSameKeys(selectedRole.permissionKeys, selectedDraft)
    : false;

  function changePermission(permissionKey: string, checked: boolean) {
    if (!selectedRole || selectedRole.isProtected) return;
    setDrafts((current) => {
      const currentKeys = new Set(
        current[selectedRole.roleName] ?? selectedRole.permissionKeys,
      );
      if (checked) currentKeys.add(permissionKey);
      else currentKeys.delete(permissionKey);
      return {
        ...current,
        [selectedRole.roleName]: config!.permissions
          .filter(
            (permission) =>
              permission.scope === selectedRole.scope &&
              currentKeys.has(permission.key),
          )
          .map(({ key }) => key),
      };
    });
  }

  function resetSelectedRole() {
    if (!selectedRole || selectedRole.isProtected) return;
    setDrafts((current) => ({
      ...current,
      [selectedRole.roleName]: [...selectedRole.permissionKeys],
    }));
    setSaveError(null);
  }

  async function saveSelectedRole() {
    if (
      !selectedRole ||
      selectedRole.isProtected ||
      !config ||
      !isDirty ||
      saving
    ) return;
    setSaving(true);
    setSaveError(null);

    const permissionKeys = config.permissions
      .filter(
        (permission) =>
          permission.scope === selectedRole.scope &&
          selectedDraft.includes(permission.key),
      )
      .map(({ key }) => key);

    try {
      const savedRole = await replaceDefaultRolePermissions(
        selectedRole,
        permissionKeys,
        config.permissions,
      );
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
        [savedRole.roleName]: [...savedRole.permissionKeys],
      }));
      setConfirmOpen(false);
      toast.success(tRbac('saveSuccessRole', { role: savedRole.roleName }));
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Không thể lưu cấu hình quyền.'));
    } finally {
      setSaving(false);
    }
  }

  const roleDraftsDirty = new Set(
    config?.roles
      .filter((role) =>
        !role.isProtected &&
        !hasSameKeys(role.permissionKeys, drafts[role.roleName] ?? role.permissionKeys),
      )
      .map(({ roleName }) => roleName) ?? [],
  );

  return (
    <SuperAdminLayout activeSection="rbac">
      <div
        aria-busy={loading || saving}
        className="admin-page-content admin-ui space-y-6 [&>nav]:mt-0"
      >
        <AdminPageHeader
          eyebrow={tRbac('eyebrowPlatform')}
          title={tRbac('rbacTitle')}
          titleId="platform-rbac-title"
          actions={
            <ResourceRefreshAction
              loading={loading || saving}
              onClick={retryLoading}
            />
          }
        />

        <PlatformRbacScopeNavigation activeScope="platform" />

        {loading && (
          <Card>
            <ResourceState loading>{tRbac('loadingCatalog')}</ResourceState>
          </Card>
        )}

        {!loading && loadError && (
          <Card>
            <ResourceState error>
              <div className="grid justify-items-center gap-3">
                <h2 className="text-base font-semibold">
                  {tRbac('loadErrorTitle')}
                </h2>
                <p>{loadError}</p>
                <Button onClick={retryLoading} variant="outline">
                  {tRbac('reloadConfig')}
                </Button>
              </div>
            </ResourceState>
          </Card>
        )}

        {!loading && !loadError && config && (
          <>
            <AdminRbacRoleSelector
              appearance="resource"
              disabled={saving}
              dirtyRoleNames={roleDraftsDirty}
              onSelect={setSelectedRoleName}
              radioName="platform-rbac-role"
              roles={config.roles}
              selectedRoleName={selectedRoleName}
              title={tRbac('selectRoleTitle')}
              titleId="rbac-roles-title"
            />

            {selectedRole && (
              <AdminRbacPermissionMatrix
                appearance="resource"
                actions={!selectedRole.isProtected && (
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5 [&>div]:flex [&>div]:flex-wrap [&>div]:gap-3">
                    <p
                      aria-live="polite"
                      className="text-xs text-muted-foreground"
                    >
                      {isDirty ? tRbac('hasUnsavedChanges') : tRbac('configSynced')}
                    </p>
                    <div>
                      <Button
                        disabled={!isDirty || saving}
                        onClick={resetSelectedRole}
                        variant="outline"
                      >
                        <RotateCcw aria-hidden="true" size={16} />
                        {tRbac('undo')}
                      </Button>
                      <Button
                        disabled={!isDirty || saving}
                        onClick={() => {
                          setSaveError(null);
                          setConfirmOpen(true);
                        }}
                      >
                        {tRbac('saveChanges')}
                      </Button>
                    </div>
                  </div>
                )}
                disabled={saving || selectedRole.isProtected}
                isProtected={selectedRole.isProtected}
                onPermissionChange={changePermission}
                permissions={config.permissions}
                roleName={selectedRole.roleName}
                scope={selectedRole.scope}
                selectedKeys={selectedDraft}
              />
            )}
          </>
        )}

        {confirmOpen && selectedRole && (
          <ResourceConfirmation
            title={tRbac('confirmPlatformTitle')}
            description={tRbac('confirmPlatformDesc', { role: selectedRole.roleName })}
            busy={saving}
            onClose={() => setConfirmOpen(false)}
          >
            {saveError && (
              <ResourceNotice kind="error">{saveError}</ResourceNotice>
            )}
            {selectedDraft.length === 0 && (
              <ResourceNotice kind="info">
                {tRbac('emptyPermissionsWarning')}
              </ResourceNotice>
            )}
            <Button
              aria-busy={saving}
              disabled={saving}
              onClick={() => void saveSelectedRole()}
            >
              {saving ? tRbac('saving') : tRbac('confirmSaveButton')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
