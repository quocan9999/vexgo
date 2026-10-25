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
    return 'Thay đổi này có thể làm mất quyền mở trang phân quyền nhà xe và quyền sửa cấu hình. Hãy bảo đảm còn tài khoản quản trị khác có thể khôi phục quyền.';
  }
  if (losesRead) {
    return 'Thay đổi này có thể làm mất quyền mở trang phân quyền nhà xe của tài khoản hiện tại. Hãy bảo đảm còn tài khoản quản trị khác có thể khôi phục quyền.';
  }
  if (losesAssign) {
    return 'Thay đổi này có thể khiến tài khoản hiện tại chỉ xem được cấu hình phân quyền.';
  }
  return 'Đây là vai trò đang gắn với tài khoản hiện tại; thay đổi sẽ ảnh hưởng quyền của phiên sau khi đồng bộ.';
}

function PermissionKeyList({
  emptyLabel,
  permissionKeys,
}: {
  emptyLabel: string;
  permissionKeys: readonly string[] | null;
}) {
  if (permissionKeys === null) return <p>{emptyLabel}</p>;
  if (permissionKeys.length === 0) return <p>0 quyền</p>;

  return (
    <ul
      tabIndex={0}
      aria-label="Danh sách mã quyền"
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
        )
      : null;
  const resetSelfLockoutWarning =
    selectedRole && session && config
      ? getSelfLockoutWarning(
          config,
          selectedRole,
          selectedRole.defaultPermissionKeys,
          session.roles,
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
      toast.warning(
        'Thay đổi đã được lưu nhưng phiên chưa đồng bộ. Hãy tải lại trang để cập nhật quyền đang dùng.',
      );
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
          ? `Đã lưu override rỗng cho ${savedRole.roleName}.`
          : `Đã lưu override cho ${savedRole.roleName}.`,
      );
      await syncTrustedSession();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể lưu cấu hình quyền.'));
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
        `Đã khôi phục quyền mặc định cho ${restoredRole.roleName}.`,
      );
      await syncTrustedSession();
    } catch (error) {
      toast.error(
        getErrorMessage(error, 'Không thể khôi phục quyền mặc định.'),
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
          eyebrow="QUẢN TRỊ NHÀ XE"
          title="Phân quyền vai trò"
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
            Tài khoản hiện chỉ có quyền xem; cần quyền{' '}
            <code className="admin-data-mono">permission:assign</code> để lưu
            hoặc khôi phục cấu hình.
          </ResourceNotice>
        )}
        {loading && !config && (
          <Card>
            <ResourceState loading>Đang tải cấu hình phân quyền…</ResourceState>
          </Card>
        )}
        {!loading && !config && loadError && (
          <Card>
            <ResourceState error>
              <h2 className="text-base font-semibold">
                Không thể tải cấu hình quyền
              </h2>
              <p>{loadError}</p>
              <Button onClick={retryLoading} variant="outline">
                Thử tải lại
              </Button>
            </ResourceState>
          </Card>
        )}
        {config && loadError && (
          <ResourceNotice kind="error">
            Không thể làm mới; đang giữ cấu hình đã tải trước đó. {loadError}
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
              title="Chọn vai trò cần cấu hình"
              titleId="tenant-rbac-roles-title"
            />

            <Card
              role="region"
              aria-label="Trạng thái cấu hình quyền"
              className="min-w-0 gap-5 p-4 sm:p-5"
            >
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:break-all">
                <div>
                  <p className="eyebrow">PHẠM VI NHÀ XE</p>
                  <h2 className="admin-data-mono">{selectedRole.roleName}</h2>
                </div>
                <Badge
                  variant={
                    selectedRole.source === 'global' ? 'secondary' : 'outline'
                  }
                >
                  {selectedRole.source === 'global'
                    ? 'Kế thừa mặc định'
                    : 'Override riêng'}
                </Badge>
              </div>
              <div className="grid min-w-0 gap-4 lg:grid-cols-3 [&>section]:min-w-0 [&>section]:space-y-3 [&>section]:rounded-lg [&>section]:border [&>section]:p-4 [&_h3]:text-[13px] [&_h3]:font-semibold [&_p]:text-xs [&_p]:text-muted-foreground">
                <section aria-labelledby="tenant-rbac-default-title">
                  <h3 id="tenant-rbac-default-title">Quyền mặc định</h3>
                  <PermissionKeyList
                    emptyLabel="Vai trò chưa có quyền mặc định."
                    permissionKeys={defaultRolePermissions}
                  />
                </section>
                <section aria-labelledby="tenant-rbac-override-title">
                  <h3 id="tenant-rbac-override-title">Override của nhà xe</h3>
                  {overridePermissionKeys === null ? (
                    <p>Chưa cấu hình override</p>
                  ) : (
                    <PermissionKeyList
                      emptyLabel=""
                      permissionKeys={overridePermissionKeys}
                    />
                  )}
                </section>
                <section aria-labelledby="tenant-rbac-effective-title">
                  <h3 id="tenant-rbac-effective-title">Quyền đang áp dụng</h3>
                  <PermissionKeyList
                    emptyLabel="Vai trò hiện không có quyền."
                    permissionKeys={effectivePermissionKeys}
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
                      ? `Có thay đổi chưa lưu cho ${selectedRole.roleName}.`
                      : 'Cấu hình đã đồng bộ.'}
                  </p>
                  <div>
                    <Button
                      disabled={!canEdit || !isDirty || saving}
                      onClick={undoSelectedRole}
                      variant="outline"
                    >
                      <RotateCcw aria-hidden="true" size={16} />
                      Hoàn tác
                    </Button>
                    {selectedRole.source === 'override' && (
                      <Button
                        disabled={!canEdit || saving}
                        onClick={() => {
                          setConfirmation('reset');
                        }}
                        variant="outline"
                      >
                        Khôi phục mặc định
                      </Button>
                    )}
                    <Button
                      disabled={!canEdit || !isDirty || saving}
                      onClick={() => {
                        setConfirmation('save');
                      }}
                    >
                      Lưu thay đổi
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
                ? 'Xác nhận thay thế quyền tenant'
                : 'Xác nhận khôi phục quyền mặc định'
            }
            description={
              confirmation === 'save'
                ? `Bạn sắp thay thế toàn bộ quyền áp dụng cho vai trò ${selectedRole.roleName} trong nhà xe này. Thay đổi không ảnh hưởng nhà xe khác hoặc quyền mặc định toàn hệ thống.`
                : `Cấu hình riêng của vai trò ${selectedRole.roleName} sẽ bị xóa để vai trò này kế thừa quyền mặc định toàn hệ thống.`
            }
            busy={saving}
            onClose={() => {
              if (!savingRef.current) setConfirmation(null);
            }}
          >
            {confirmation === 'save' && selectedDraft.length === 0 && (
              <ResourceNotice kind="info">
                Vai trò sẽ có override rỗng, không nhận quyền nào trong nhà xe
                này.
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
                ? 'Đang lưu…'
                : confirmation === 'save'
                  ? 'Xác nhận lưu'
                  : 'Xác nhận khôi phục'}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
