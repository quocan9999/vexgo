'use client';

import {
  AlertTriangle,
  Check,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminRefreshAction } from '@/components/admin/admin-page-actions';
import { AdminRbacPermissionMatrix } from '@/components/admin/rbac/admin-rbac-permission-matrix';
import { AdminRbacRoleSelector } from '@/components/admin/rbac/admin-rbac-role-selector';
import { Button } from '@/components/ui/button';
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
import styles from './tenant-rbac-management.module.css';

type RoleDrafts = Partial<Record<TenantRbacRoleName, string[]>>;
type Feedback = { type: 'success' | 'warning'; message: string };
type Confirmation = 'save' | 'reset' | null;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function hasSameKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key) => right.includes(key));
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
    const effectiveKeys = currentRole.roleName === role.roleName
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
    <ul>
      {permissionKeys.map((key) => <li key={key}><code>{key}</code></li>)}
    </ul>
  );
}

export function TenantRbacManagement() {
  const authState = useAdminSession();
  const session = authState.status === 'authenticated'
    ? authState.session
    : null;
  const canRead = canReadTenantRbac(session);
  const canEdit = canWriteTenantRbac(session);
  const [config, setConfig] = useState<TenantRbacConfig | null>(null);
  const [drafts, setDrafts] = useState<RoleDrafts>({});
  const [selectedRoleName, setSelectedRoleName] = useState<TenantRbacRoleName>(
    'NHA_XE_ADMIN',
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

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
        setFeedback(null);
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
    setFeedback(null);
    setLoadAttempt((attempt) => attempt + 1);
  }

  const selectedRole =
    config?.roles.find((role) => role.roleName === selectedRoleName) ?? null;
  const selectedDraft = selectedRole
    ? drafts[selectedRole.roleName] ?? selectedRole.effectivePermissionKeys
    : [];
  const isDirty = selectedRole
    ? !hasSameKeys(selectedRole.effectivePermissionKeys, selectedDraft)
    : false;
  const selectedSelfLockoutWarning = selectedRole && session
    ? getSelfLockoutWarning(
        config!,
        selectedRole,
        selectedDraft,
        session.roles,
      )
    : null;
  const resetSelfLockoutWarning = selectedRole && session && config
    ? getSelfLockoutWarning(
        config,
        selectedRole,
        selectedRole.defaultPermissionKeys,
        session.roles,
      )
    : null;

  function changePermission(permissionKey: string, checked: boolean) {
    if (!selectedRole || !config || !canEdit || saving) return;
    setFeedback(null);
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
    if (!selectedRole || !canEdit || saving) return;
    setDrafts((current) => ({
      ...current,
      [selectedRole.roleName]: [...selectedRole.effectivePermissionKeys],
    }));
    setSaveError(null);
    setFeedback(null);
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
      setFeedback({
        type: 'warning',
        message:
          'Thay đổi đã được lưu nhưng phiên chưa đồng bộ. Hãy tải lại trang để cập nhật quyền đang dùng.',
      });
    }
  }

  async function saveSelectedRole() {
    if (!selectedRole || !config || !isDirty || !canEdit || saving) return;
    setSaving(true);
    setSaveError(null);
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
      setFeedback({
        type: 'success',
        message: permissionKeys.length === 0
          ? `Đã lưu override rỗng cho ${savedRole.roleName}.`
          : `Đã lưu override cho ${savedRole.roleName}.`,
      });
      await syncTrustedSession();
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Không thể lưu cấu hình quyền.'));
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefaultPermissions() {
    if (!selectedRole || !config || !canEdit || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const restoredRole = await resetTenantRolePermissions(
        selectedRole,
        config.permissions,
      );
      updateConfigRole(restoredRole);
      setConfirmation(null);
      setFeedback({
        type: 'success',
        message: `Đã khôi phục quyền mặc định cho ${restoredRole.roleName}.`,
      });
      await syncTrustedSession();
    } catch (error) {
      setSaveError(
        getErrorMessage(error, 'Không thể khôi phục quyền mặc định.'),
      );
    } finally {
      setSaving(false);
    }
  }

  const dirtyRoleNames = new Set(
    config?.roles
      .filter((role) =>
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
      <div aria-busy={loading || saving} className="admin-page-content">
        <AdminPageHeader
          eyebrow="QUẢN TRỊ NHÀ XE"
          title="Phân quyền vai trò"
          titleId="tenant-rbac-title"
          actions={(
            <AdminRefreshAction
              loading={loading || saving}
              onClick={retryLoading}
            />
          )}
        />

        <section aria-label="Phạm vi cấu hình quyền" className={styles.scopeNotice}>
          <ShieldCheck aria-hidden="true" size={20} />
          <p>
            Cấu hình này chỉ áp dụng cho nhà xe{' '}
            <strong>{session?.employee?.busCompanyName || 'đang đăng nhập'}</strong>.
            Quyền mặc định toàn hệ thống không bị thay đổi.
          </p>
        </section>

        {!canEdit && canRead && (
          <p className={styles.readOnlyNotice} role="status">
            Tài khoản hiện chỉ có quyền xem; cần quyền <code>permission:assign</code>{' '}
            để lưu hoặc khôi phục cấu hình.
          </p>
        )}

        {feedback?.type === 'success' && (
          <p className={styles.successMessage} role="status">
            <Check aria-hidden="true" size={16} />
            {feedback.message}
          </p>
        )}
        {feedback?.type === 'warning' && (
          <p className={styles.warningMessage} role="alert">
            <AlertTriangle aria-hidden="true" size={17} />
            {feedback.message}
          </p>
        )}

        {loading && !config && (
          <div className={styles.loading} role="status" aria-live="polite">
            <LoaderCircle aria-hidden="true" className={styles.spinner} size={20} />
            Đang tải cấu hình phân quyền…
          </div>
        )}

        {!loading && !config && loadError && (
          <section aria-labelledby="tenant-rbac-load-error-title" className={styles.errorPanel}>
            <h2 id="tenant-rbac-load-error-title">Không thể tải cấu hình quyền</h2>
            <p role="alert">{loadError}</p>
            <Button onClick={retryLoading} variant="secondary">Thử tải lại</Button>
          </section>
        )}

        {config && loadError && (
          <p className={styles.warningMessage} role="alert">
            <AlertTriangle aria-hidden="true" size={17} />
            Không thể làm mới; đang giữ cấu hình đã tải trước đó. {loadError}
          </p>
        )}

        {config && selectedRole && (
          <>
            <AdminRbacRoleSelector
              dirtyRoleNames={dirtyRoleNames}
              onSelect={(roleName) => {
                setSelectedRoleName(roleName);
                setSaveError(null);
                setFeedback(null);
              }}
              radioName="tenant-rbac-role"
              roles={config.roles}
              selectedRoleName={selectedRole.roleName}
              title="Chọn vai trò cần cấu hình"
              titleId="tenant-rbac-roles-title"
            />

            <section aria-label="Trạng thái cấu hình quyền" className={styles.configurationSummary}>
              <div className={styles.summaryHeader}>
                <div>
                  <p className="eyebrow">PHẠM VI NHÀ XE</p>
                  <h2>{selectedRole.roleName}</h2>
                </div>
                <span className={selectedRole.source === 'global' ? styles.inheritedBadge : styles.overrideBadge}>
                  {selectedRole.source === 'global' ? 'Kế thừa mặc định' : 'Override riêng'}
                </span>
              </div>
              <div className={styles.summaryGrid}>
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
            </section>

            <AdminRbacPermissionMatrix
              actions={(
                <div className={styles.formActions}>
                  <p aria-live="polite" className={styles.draftStatus}>
                    {isDirty
                      ? `Có thay đổi chưa lưu cho ${selectedRole.roleName}.`
                      : 'Cấu hình đã đồng bộ.'}
                  </p>
                  <div>
                    <Button
                      disabled={!canEdit || !isDirty || saving}
                      onClick={undoSelectedRole}
                      variant="secondary"
                    >
                      <RotateCcw aria-hidden="true" size={16} />
                      Hoàn tác
                    </Button>
                    {selectedRole.source === 'override' && (
                      <Button
                        disabled={!canEdit || saving}
                        onClick={() => {
                          setSaveError(null);
                          setConfirmation('reset');
                        }}
                        variant="secondary"
                      >
                        Khôi phục mặc định
                      </Button>
                    )}
                    <Button
                      disabled={!canEdit || !isDirty || saving}
                      onClick={() => {
                        setSaveError(null);
                        setConfirmation('save');
                      }}
                    >
                      Lưu thay đổi
                    </Button>
                  </div>
                </div>
              )}
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
          <AdminConfirmDialog
            ariaDescribedBy="tenant-rbac-confirm-description"
            ariaLabelledBy="tenant-rbac-confirm-title"
            ariaBusy={saving}
            onClose={() => setConfirmation(null)}
            preventDismiss={saving}
          >
            <div className={styles.confirmContent}>
              <span className={styles.confirmIcon} aria-hidden="true">
                <AlertTriangle size={19} />
              </span>
              <h2 id="tenant-rbac-confirm-title">
                {confirmation === 'save'
                  ? 'Xác nhận thay thế quyền tenant'
                  : 'Xác nhận khôi phục quyền mặc định'}
              </h2>
              <p id="tenant-rbac-confirm-description">
                {confirmation === 'save'
                  ? <>Bạn sắp thay thế toàn bộ quyền áp dụng cho vai trò <strong>{selectedRole.roleName}</strong> trong nhà xe này. Thay đổi không ảnh hưởng nhà xe khác hoặc quyền mặc định toàn hệ thống.</>
                  : <>Cấu hình riêng của vai trò <strong>{selectedRole.roleName}</strong> sẽ bị xóa để vai trò này kế thừa quyền mặc định toàn hệ thống.</>}
              </p>
              {confirmation === 'save' && selectedDraft.length === 0 && (
                <p className={styles.emptyReplacementWarning}>
                  Vai trò sẽ có override rỗng, không nhận quyền nào trong nhà xe này.
                </p>
              )}
              {((confirmation === 'save' && selectedSelfLockoutWarning) ||
                (confirmation === 'reset' && resetSelfLockoutWarning)) && (
                <p className={styles.selfLockoutWarning} role="note">
                  {confirmation === 'save'
                    ? selectedSelfLockoutWarning
                    : resetSelfLockoutWarning}
                </p>
              )}
              {saveError && <p className={styles.dialogError} role="alert">{saveError}</p>}
              <div className={styles.confirmActions}>
                <Button
                  disabled={saving}
                  onClick={() => setConfirmation(null)}
                  variant="secondary"
                >
                  Hủy
                </Button>
                <Button
                  disabled={saving}
                  onClick={() => void (confirmation === 'save'
                    ? saveSelectedRole()
                    : restoreDefaultPermissions())}
                >
                  {saving
                    ? 'Đang lưu…'
                    : confirmation === 'save'
                      ? 'Xác nhận lưu'
                      : 'Xác nhận khôi phục'}
                </Button>
              </div>
            </div>
          </AdminConfirmDialog>
        )}
      </div>
    </SuperAdminLayout>
  );
}
