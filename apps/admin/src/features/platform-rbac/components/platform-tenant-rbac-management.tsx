'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminRefreshAction } from '@/components/admin/admin-page-actions';
import { AdminRbacPermissionMatrix } from '@/components/admin/rbac/admin-rbac-permission-matrix';
import { AdminRbacRoleSelector } from '@/components/admin/rbac/admin-rbac-role-selector';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getBusCompanyById } from '@/features/bus-companies/services/bus-company-service';
import {
  getPlatformTenantRolePermissions,
  replacePlatformTenantRolePermissions,
  resetPlatformTenantRolePermissions,
} from '@/features/tenant-rbac/services/tenant-rbac-service';
import {
  type TenantRbacConfig,
  type TenantRbacRole,
  type TenantRbacRoleName,
} from '@/features/tenant-rbac/types/tenant-rbac';
import { PlatformRbacScopeNavigation } from './platform-rbac-scope-navigation';
import styles from './platform-tenant-rbac-management.module.css';

type RoleDrafts = Partial<Record<TenantRbacRoleName, string[]>>;
type Feedback = { type: 'success'; message: string };
type Confirmation = 'save' | 'reset' | null;

function parseTenantId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const tenantId = Number(value);
  return Number.isSafeInteger(tenantId) ? tenantId : null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function hasSameKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key) => right.includes(key));
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

export function PlatformTenantRbacManagement({
  nhaXeIdParam,
}: {
  nhaXeIdParam: string;
}) {
  const nhaXeId = parseTenantId(nhaXeIdParam);
  const [tenantName, setTenantName] = useState(
    nhaXeId ? `Nhà xe #${nhaXeId}` : 'Nhà xe không hợp lệ',
  );
  const [config, setConfig] = useState<TenantRbacConfig | null>(null);
  const [drafts, setDrafts] = useState<RoleDrafts>({});
  const [selectedRoleName, setSelectedRoleName] =
    useState<TenantRbacRoleName>('NHA_XE_ADMIN');
  const [loading, setLoading] = useState(nhaXeId !== null);
  const [loadError, setLoadError] = useState<string | null>(
    nhaXeId === null ? 'Mã nhà xe không hợp lệ.' : null,
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (nhaXeId === null) return;

    const controller = new AbortController();

    void getPlatformTenantRolePermissions(nhaXeId, controller.signal)
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
        if (!controller.signal.aborted) {
          setLoadError(getErrorMessage(error, 'Không thể tải cấu hình quyền.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    // The lookup only labels the page; its failure must not block tenant RBAC.
    void getBusCompanyById(nhaXeId, controller.signal)
      .then((company) => {
        if (!controller.signal.aborted) {
          setTenantName(`${company.name} (${company.code})`);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [loadAttempt, nhaXeId]);

  function retryLoading() {
    if (nhaXeId === null) return;
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

  function changePermission(permissionKey: string, checked: boolean) {
    if (!selectedRole || !config || saving) return;
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
    if (!selectedRole || saving) return;
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

  async function saveSelectedRole() {
    if (!nhaXeId || !selectedRole || !config || !isDirty || saving) return;
    setSaving(true);
    setSaveError(null);
    const permissionKeys = config.permissions
      .filter((permission) => selectedDraft.includes(permission.key))
      .map(({ key }) => key);

    try {
      const savedRole = await replacePlatformTenantRolePermissions(
        nhaXeId,
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
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Không thể lưu cấu hình quyền.'));
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefaultPermissions() {
    if (!nhaXeId || !selectedRole || !config || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const restoredRole = await resetPlatformTenantRolePermissions(
        nhaXeId,
        selectedRole,
        config.permissions,
      );
      updateConfigRole(restoredRole);
      setConfirmation(null);
      setFeedback({
        type: 'success',
        message: `Đã khôi phục quyền mặc định cho ${restoredRole.roleName}.`,
      });
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Không thể khôi phục quyền mặc định.'));
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

  return (
    <SuperAdminLayout activeSection="rbac">
      <div aria-busy={loading || saving} className="admin-page-content">
        <AdminPageHeader
          eyebrow="QUẢN TRỊ NỀN TẢNG"
          title="Phân quyền vai trò"
          titleId="platform-tenant-rbac-title"
          actions={(
            <div className={styles.pageActions}>
              <AdminRefreshAction
                loading={loading || saving || nhaXeId === null}
                onClick={retryLoading}
              />
            </div>
          )}
        />

        <div className={styles.scopeNavigation}>
          <PlatformRbacScopeNavigation activeScope="tenant" />
        </div>

        <Link className={styles.backLink} href="/rbac/tenants">
          <ArrowLeft aria-hidden="true" size={16} />
          Chọn nhà xe khác
        </Link>

        <section aria-label="Phạm vi cấu hình quyền" className={styles.scopeNotice}>
          <ShieldCheck aria-hidden="true" size={20} />
          <p>
            Cấu hình chỉ áp dụng cho <strong>{tenantName}</strong>. Quyền mặc định
            toàn hệ thống và cấu hình nhà xe khác không bị thay đổi.
          </p>
        </section>

        {feedback && (
          <p className={styles.successMessage} role="status">
            <Check aria-hidden="true" size={16} />
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
          <section aria-labelledby="platform-tenant-rbac-error-title" className={styles.errorPanel}>
            <h2 id="platform-tenant-rbac-error-title">
              {nhaXeId === null ? 'Mã nhà xe không hợp lệ' : 'Không thể tải cấu hình quyền'}
            </h2>
            <p role="alert">{loadError}</p>
            {nhaXeId !== null && (
              <Button onClick={retryLoading} variant="secondary">Thử tải lại</Button>
            )}
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
              radioName="platform-tenant-rbac-role"
              roles={config.roles}
              selectedRoleName={selectedRole.roleName}
              title="Chọn vai trò cần cấu hình"
              titleId="platform-tenant-rbac-roles-title"
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
                <section aria-labelledby="platform-tenant-rbac-default-title">
                  <h3 id="platform-tenant-rbac-default-title">Quyền mặc định</h3>
                  <PermissionKeyList
                    emptyLabel="Vai trò chưa có quyền mặc định."
                    permissionKeys={selectedRole.defaultPermissionKeys}
                  />
                </section>
                <section aria-labelledby="platform-tenant-rbac-override-title">
                  <h3 id="platform-tenant-rbac-override-title">Override của nhà xe</h3>
                  {selectedRole.overridePermissionKeys === null ? (
                    <p>Chưa cấu hình override</p>
                  ) : (
                    <PermissionKeyList
                      emptyLabel=""
                      permissionKeys={selectedRole.overridePermissionKeys}
                    />
                  )}
                </section>
                <section aria-labelledby="platform-tenant-rbac-effective-title">
                  <h3 id="platform-tenant-rbac-effective-title">Quyền đang áp dụng</h3>
                  <PermissionKeyList
                    emptyLabel="Vai trò hiện không có quyền."
                    permissionKeys={selectedRole.effectivePermissionKeys}
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
                      disabled={!isDirty || saving}
                      onClick={undoSelectedRole}
                      variant="secondary"
                    >
                      <RotateCcw aria-hidden="true" size={16} />
                      Hoàn tác
                    </Button>
                    {selectedRole.source === 'override' && (
                      <Button
                        disabled={saving}
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
                      disabled={!isDirty || saving}
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
              disabled={saving}
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
            ariaDescribedBy="platform-tenant-rbac-confirm-description"
            ariaLabelledBy="platform-tenant-rbac-confirm-title"
            ariaBusy={saving}
            onClose={() => setConfirmation(null)}
            preventDismiss={saving}
          >
            <div className={styles.confirmContent}>
              <span className={styles.confirmIcon} aria-hidden="true">
                <AlertTriangle size={19} />
              </span>
              <h2 id="platform-tenant-rbac-confirm-title">
                {confirmation === 'save'
                  ? 'Xác nhận thay thế quyền tenant'
                  : 'Xác nhận khôi phục quyền mặc định'}
              </h2>
              <p id="platform-tenant-rbac-confirm-description">
                {confirmation === 'save'
                  ? <>Bạn sắp thay thế toàn bộ quyền của vai trò <strong>{selectedRole.roleName}</strong> trong <strong>{tenantName}</strong>. Thay đổi không ảnh hưởng nhà xe khác hoặc quyền mặc định toàn hệ thống.</>
                  : <>Cấu hình riêng của vai trò <strong>{selectedRole.roleName}</strong> trong <strong>{tenantName}</strong> sẽ bị xóa để vai trò này kế thừa quyền mặc định toàn hệ thống.</>}
              </p>
              {confirmation === 'save' && selectedDraft.length === 0 && (
                <p className={styles.emptyReplacementWarning}>
                  Vai trò sẽ có override rỗng, không nhận quyền nào trong nhà xe này.
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
