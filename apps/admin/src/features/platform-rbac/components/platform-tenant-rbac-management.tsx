'use client';

import { ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ResourceConfirmation,
  ResourceNotice,
  ResourceRefreshAction,
  ResourceState,
} from '@/components/admin/resource-ui';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminRbacPermissionMatrix } from '@/components/admin/rbac/admin-rbac-permission-matrix';
import { AdminRbacRoleSelector } from '@/components/admin/rbac/admin-rbac-role-selector';
import { Button, buttonVariants } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/status-badge';
import { Card } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { PlatformRbacScopeNavigation } from './platform-rbac-scope-navigation';

type RoleDrafts = Partial<Record<TenantRbacRoleName, string[]>>;
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
    <ul
      aria-label="Danh sách mã quyền"
      className="max-h-40 space-y-2 overflow-y-auto rounded-md text-xs focus-visible:outline-2 focus-visible:outline-ring"
      tabIndex={0}
    >
      {permissionKeys.map((key) => (
        <li key={key}>
          <code className="admin-data-mono break-all">{key}</code>
        </li>
      ))}
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
    nhaXeId ? 'Nhà xe' : 'Nhà xe không hợp lệ',
  );
  const [tenantCode, setTenantCode] = useState(
    nhaXeId === null ? '' : String(nhaXeId),
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
  const savingRef = useRef(false);

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
          setTenantName(company.name);
          setTenantCode(company.code);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [loadAttempt, nhaXeId]);

  function retryLoading() {
    if (nhaXeId === null) return;
    setLoading(true);
    setLoadError(null);
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
    if (!selectedRole || !config || savingRef.current) return;
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
    if (!selectedRole || savingRef.current) return;
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

  async function saveSelectedRole() {
    if (!nhaXeId || !selectedRole || !config || !isDirty || savingRef.current)
      return;
    savingRef.current = true;
    setSaving(true);
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
      toast.success(
        permissionKeys.length === 0
          ? `Đã lưu override rỗng cho ${savedRole.roleName}.`
          : `Đã lưu override cho ${savedRole.roleName}.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể lưu cấu hình quyền.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function restoreDefaultPermissions() {
    if (!nhaXeId || !selectedRole || !config || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const restoredRole = await resetPlatformTenantRolePermissions(
        nhaXeId,
        selectedRole,
        config.permissions,
      );
      updateConfigRole(restoredRole);
      setConfirmation(null);
      toast.success(
        `Đã khôi phục quyền mặc định cho ${restoredRole.roleName}.`,
      );
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
      <div
        aria-busy={loading || saving}
        className="admin-page-content admin-ui space-y-6"
      >
        <AdminPageHeader
          eyebrow="QUẢN TRỊ NỀN TẢNG"
          title="Phân quyền vai trò"
          titleId="platform-tenant-rbac-title"
          actions={(
            <ResourceRefreshAction
              loading={loading || saving || nhaXeId === null}
              onClick={retryLoading}
            />
          )}
        />

        <PlatformRbacScopeNavigation
          activeScope="tenant"
        />

        <Link
          className={buttonVariants({
            variant: 'outline',
            className: 'w-fit',
          })}
          href="/rbac/tenants"
        >
          <ArrowLeft aria-hidden="true" />
          Chọn nhà xe khác
        </Link>

        <ResourceNotice kind="info">
          Cấu hình chỉ áp dụng cho{' '}
          <strong>
            {tenantName}
            {tenantCode && (
              <> (<span className="admin-data-mono">{tenantCode}</span>)</>
            )}
          </strong>. Quyền mặc định toàn hệ thống và cấu hình nhà xe khác không
          bị thay đổi.
        </ResourceNotice>

        {loading && !config && (
          <Card>
            <ResourceState loading>Đang tải cấu hình phân quyền…</ResourceState>
          </Card>
        )}

        {!loading && !config && loadError && (
          <Card>
            <ResourceState error>
              <h2 className="text-base font-semibold">
                {nhaXeId === null
                  ? 'Mã nhà xe không hợp lệ'
                  : 'Không thể tải cấu hình quyền'}
              </h2>
              <p>{loadError}</p>
              {nhaXeId !== null && (
                <Button onClick={retryLoading} variant="outline">
                  Thử tải lại
                </Button>
              )}
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
              onSelect={setSelectedRoleName}
              radioName="platform-tenant-rbac-role"
              roles={config.roles}
              selectedRoleName={selectedRole.roleName}
              title="Chọn vai trò cần cấu hình"
              titleId="platform-tenant-rbac-roles-title"
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
                <section aria-labelledby="platform-tenant-rbac-default-title">
                  <h3 id="platform-tenant-rbac-default-title">
                    Quyền mặc định
                  </h3>
                  <PermissionKeyList
                    emptyLabel="Vai trò chưa có quyền mặc định."
                    permissionKeys={selectedRole.defaultPermissionKeys}
                  />
                </section>
                <section aria-labelledby="platform-tenant-rbac-override-title">
                  <h3 id="platform-tenant-rbac-override-title">
                    Override của nhà xe
                  </h3>
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
                  <h3 id="platform-tenant-rbac-effective-title">
                    Quyền đang áp dụng
                  </h3>
                  <PermissionKeyList
                    emptyLabel="Vai trò hiện không có quyền."
                    permissionKeys={selectedRole.effectivePermissionKeys}
                  />
                </section>
              </div>
            </Card>

            <AdminRbacPermissionMatrix
              appearance="resource"
              actions={(
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
                      disabled={!isDirty || saving}
                      onClick={undoSelectedRole}
                      variant="outline"
                    >
                      <RotateCcw aria-hidden="true" />
                      Hoàn tác
                    </Button>
                    {selectedRole.source === 'override' && (
                      <Button
                        disabled={saving}
                        onClick={() => setConfirmation('reset')}
                        variant="outline"
                      >
                        Khôi phục mặc định
                      </Button>
                    )}
                    <Button
                      disabled={!isDirty || saving}
                      onClick={() => setConfirmation('save')}
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
          <ResourceConfirmation
            title={
              confirmation === 'save'
                ? 'Xác nhận thay thế quyền tenant'
                : 'Xác nhận khôi phục quyền mặc định'
            }
            description={
              confirmation === 'save'
                ? `Bạn sắp thay thế toàn bộ quyền của vai trò ${selectedRole.roleName} trong ${tenantName}${tenantCode ? ` (${tenantCode})` : ''}. Thay đổi không ảnh hưởng nhà xe khác hoặc quyền mặc định toàn hệ thống.`
                : `Cấu hình riêng của vai trò ${selectedRole.roleName} trong ${tenantName}${tenantCode ? ` (${tenantCode})` : ''} sẽ bị xóa để vai trò này kế thừa quyền mặc định toàn hệ thống.`
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
