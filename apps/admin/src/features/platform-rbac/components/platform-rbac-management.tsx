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
import { reloadAdminSession } from '@/features/admin-auth/services/admin-auth';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  getDefaultRolePermissions,
  replaceDefaultRolePermissions,
} from '../services/platform-rbac-service';
import type {
  AdminRbacRoleName,
  DefaultAdminRbacConfig,
} from '../types/platform-rbac';
import styles from './platform-rbac-management.module.css';

type RoleDrafts = Partial<Record<AdminRbacRoleName, string[]>>;
type Feedback = { type: 'success' | 'warning'; message: string };

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
  const [feedback, setFeedback] = useState<Feedback | null>(null);

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
    ? drafts[selectedRole.roleName] ?? selectedRole.permissionKeys
    : [];
  const isDirty = selectedRole
    ? !hasSameKeys(selectedRole.permissionKeys, selectedDraft)
    : false;

  function changePermission(permissionKey: string, checked: boolean) {
    if (!selectedRole) return;
    setFeedback(null);
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
    if (!selectedRole) return;
    setDrafts((current) => ({
      ...current,
      [selectedRole.roleName]: [...selectedRole.permissionKeys],
    }));
    setSaveError(null);
    setFeedback(null);
  }

  async function saveSelectedRole() {
    if (!selectedRole || !config || !isDirty || saving) return;
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
      setFeedback({
        type: 'success',
        message: `Quyền mặc định của ${savedRole.roleName} đã được lưu.`,
      });

      if (savedRole.roleName === 'SUPER_ADMIN') {
        try {
          await reloadAdminSession();
        } catch {
          setFeedback({
            type: 'warning',
            message:
              'Quyền đã lưu nhưng phiên chưa được làm mới. Hãy tải lại trang để đồng bộ quyền mới.',
          });
        }
      }
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Không thể lưu cấu hình quyền.'));
    } finally {
      setSaving(false);
    }
  }

  const roleDraftsDirty = new Set(
    config?.roles
      .filter((role) =>
        !hasSameKeys(role.permissionKeys, drafts[role.roleName] ?? role.permissionKeys),
      )
      .map(({ roleName }) => roleName) ?? [],
  );

  return (
    <SuperAdminLayout activeSection="rbac">
      <div className="admin-page-content">
        <AdminPageHeader
          eyebrow="QUẢN TRỊ NỀN TẢNG"
          title="Phân quyền vai trò"
          titleId="platform-rbac-title"
          actions={
            <AdminRefreshAction
              loading={loading}
              onClick={retryLoading}
            />
          }
        />

        <section aria-label="Phạm vi cấu hình quyền" className={styles.scopeNotice}>
          <ShieldCheck aria-hidden="true" size={20} />
          <p>
            Đây là quyền mặc định toàn hệ thống của vai trò. Thay đổi áp dụng cho
            các tài khoản mang vai trò này; không phải cấu hình riêng cho một nhà xe.
          </p>
        </section>

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

        {loading && (
          <div aria-live="polite" className={styles.loading} role="status">
            <LoaderCircle aria-hidden="true" className={styles.spinner} size={20} />
            Đang tải danh mục quyền…
          </div>
        )}

        {!loading && loadError && (
          <section aria-labelledby="rbac-load-error-title" className={styles.errorPanel}>
            <h2 id="rbac-load-error-title">Không thể tải cấu hình quyền</h2>
            <p role="alert">{loadError}</p>
            <Button
              onClick={retryLoading}
              variant="secondary"
            >
              Thử tải lại
            </Button>
          </section>
        )}

        {!loading && !loadError && config && (
          <>
            <AdminRbacRoleSelector
              dirtyRoleNames={roleDraftsDirty}
              onSelect={setSelectedRoleName}
              radioName="platform-rbac-role"
              roles={config.roles}
              selectedRoleName={selectedRoleName}
              title="Chọn vai trò cần cấu hình"
              titleId="rbac-roles-title"
            />

            {selectedRole && (
              <AdminRbacPermissionMatrix
                actions={(
                  <div className={styles.formActions}>
                    <p aria-live="polite" className={styles.draftStatus}>
                      {isDirty ? 'Có thay đổi chưa lưu cho vai trò này.' : 'Cấu hình đã đồng bộ.'}
                    </p>
                    <div>
                      <Button
                        disabled={!isDirty || saving}
                        onClick={resetSelectedRole}
                        variant="secondary"
                      >
                        <RotateCcw aria-hidden="true" size={16} />
                        Hoàn tác
                      </Button>
                      <Button
                        disabled={!isDirty || saving}
                        onClick={() => {
                          setSaveError(null);
                          setConfirmOpen(true);
                        }}
                      >
                        Lưu thay đổi
                      </Button>
                    </div>
                  </div>
                )}
                disabled={saving}
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
          <AdminConfirmDialog
            ariaDescribedBy="rbac-confirm-description"
            ariaLabelledBy="rbac-confirm-title"
            ariaBusy={saving}
            onClose={() => setConfirmOpen(false)}
            preventDismiss={saving}
          >
            <div className={styles.confirmContent}>
              <span className={styles.confirmIcon} aria-hidden="true">
                <AlertTriangle size={19} />
              </span>
              <h2 id="rbac-confirm-title">Xác nhận thay thế quyền mặc định</h2>
              <p id="rbac-confirm-description">
                Bạn sắp thay thế toàn bộ quyền mặc định của vai trò{' '}
                <strong>{selectedRole.roleName}</strong>. Thay đổi sẽ áp dụng cho
                mọi tài khoản mang vai trò này, trên toàn hệ thống; thao tác này
                không tạo cấu hình riêng cho từng nhà xe.
              </p>
              {selectedDraft.length === 0 && (
                <p className={styles.emptyReplacementWarning}>
                  Vai trò sẽ không còn quyền nào sau khi lưu.
                </p>
              )}
              {saveError && <p className={styles.dialogError} role="alert">{saveError}</p>}
              <div className={styles.confirmActions}>
                <Button
                  disabled={saving}
                  onClick={() => setConfirmOpen(false)}
                  variant="secondary"
                >
                  Hủy
                </Button>
                <Button disabled={saving} onClick={() => void saveSelectedRole()}>
                  {saving ? 'Đang lưu…' : 'Xác nhận lưu'}
                </Button>
              </div>
            </div>
          </AdminConfirmDialog>
        )}
      </div>
    </SuperAdminLayout>
  );
}
