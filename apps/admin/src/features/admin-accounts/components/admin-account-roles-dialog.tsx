'use client';

import { ResourceSheetForm } from '@/components/admin/resource-sheet-form';

import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  ResourceConfirmation,
  ResourceNotice,
  ResourceSheet,
  ResourceState,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import {
  FieldLabel,
  FieldLegend,
  FieldSet,
  Field,
} from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { getDefaultRolePermissions } from '@/features/platform-rbac/services/platform-rbac-service';
import {
  TENANT_RBAC_ROLE_NAMES,
  type TenantRbacRoleName,
} from '@/features/tenant-rbac/types/tenant-rbac';
import {
  AdminAccountApiError,
  replaceAdminAccountRoles,
} from '../services/admin-account-service';
import type { AdminAccount } from '../types/admin-account';
import type { AdminRbacRole } from '@/features/platform-rbac/types/platform-rbac';

type TenantRoleOption = {
  roleName: TenantRbacRoleName;
  label: string;
};

type RoleOptionsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; roles: TenantRoleOption[] };

const TENANT_ROLE_SET = new Set<string>(TENANT_RBAC_ROLE_NAMES);

function tenantRoleOptions(catalogRoles: AdminRbacRole[]): TenantRoleOption[] {
  return catalogRoles.flatMap((role) =>
    role.scope === 'tenant' &&
    TENANT_ROLE_SET.has(role.roleName) &&
    TENANT_RBAC_ROLE_NAMES.includes(role.roleName as TenantRbacRoleName)
      ? [
          {
            roleName: role.roleName as TenantRbacRoleName,
            label: role.description ?? role.roleName,
          },
        ]
      : [],
  );
}

function sameRoleSet(
  left: readonly TenantRbacRoleName[],
  right: readonly TenantRbacRoleName[],
): boolean {
  return (
    left.length === right.length && left.every((role) => right.includes(role))
  );
}

function requestErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.';
  }
  if (error instanceof AdminAccountApiError || error instanceof Error) {
    return error.message;
  }
  return 'Không thể cập nhật vai trò tài khoản.';
}

export function AdminAccountRolesDialog({
  account,
  onClose,
  onSaved,
}: {
  account: AdminAccount;
  onClose: () => void;
  onSaved: (account: AdminAccount) => void;
}) {
  const submittingRef = useRef(false);
  const [roles, setRoles] = useState<RoleOptionsState>({ status: 'loading' });
  const [selectedRoleNames, setSelectedRoleNames] = useState<
    TenantRbacRoleName[]
  >(() => account.roles.filter((role) => TENANT_ROLE_SET.has(role)));
  const [retryCount, setRetryCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokeConfirmationOpen, setRevokeConfirmationOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getDefaultRolePermissions(controller.signal)
      .then((catalog) => {
        if (controller.signal.aborted) return;
        setRoles({
          status: 'success',
          roles: tenantRoleOptions(catalog.roles),
        });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setRoles({
          status: 'error',
          message: requestErrorMessage(requestError),
        });
      });

    return () => controller.abort();
  }, [retryCount]);

  const hasTenantOnlySelection =
    roles.status === 'success' &&
    selectedRoleNames.every((name) =>
      roles.roles.some((role) => role.roleName === name),
    );
  const isDirty = !sameRoleSet(account.roles, selectedRoleNames);
  const canSubmit =
    roles.status === 'success' &&
    hasTenantOnlySelection &&
    isDirty &&
    !submitting;

  function toggleRole(roleName: TenantRbacRoleName) {
    setSelectedRoleNames((current) =>
      current.includes(roleName)
        ? current.filter((role) => role !== roleName)
        : [...current, roleName],
    );
    setError(null);
  }

  async function saveRoles(roleNames: readonly TenantRbacRoleName[]) {
    if (submittingRef.current || roles.status !== 'success') return;
    if (
      roleNames.some(
        (roleName) => !roles.roles.some((role) => role.roleName === roleName),
      )
    ) {
      setError(
        'Danh sách vai trò không còn hợp lệ. Vui lòng tải lại danh mục.',
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const updatedAccount = await replaceAdminAccountRoles(
        account.accountId,
        roleNames,
      );
      toast.success(
        roleNames.length === 0
          ? 'Đã thu hồi toàn bộ vai trò tài khoản.'
          : 'Đã cập nhật vai trò tài khoản.',
      );
      onSaved(updatedAccount);
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    if (selectedRoleNames.length === 0) {
      setRevokeConfirmationOpen(true);
      return;
    }

    void saveRoles(selectedRoleNames);
  }

  return (
    <>
      <ResourceSheet
        busy={submitting || roles.status === 'loading'}
        description={`Chọn các vai trò nhà xe từ danh mục hiện tại cho ${account.fullName}.`}
        preventDismiss={submitting}
        title="Gán vai trò tài khoản"
        onClose={onClose}
      >
          <ResourceSheetForm
            noValidate
            onSubmit={handleSubmit}
            footer={
              <div className="-mx-4 flex justify-end gap-3 border-t bg-popover px-4 py-4 sm:-mx-6 sm:px-6 shrink-0">
                <Button
                  disabled={submitting}
                  onClick={onClose}
                  type="button"
                  variant="outline"
                >
                  Hủy
                </Button>
                <Button disabled={!canSubmit} type="submit">
                  {submitting && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="motion-safe:animate-spin"
                      size={16}
                    />
                  )}
                  {submitting ? 'Đang lưu…' : 'Lưu vai trò'}
                </Button>
              </div>
            }
          >
            {error && <ResourceNotice kind="error">{error}</ResourceNotice>}
            {roles.status === 'loading' && (
              <ResourceState loading>Đang tải danh mục vai trò…</ResourceState>
            )}
            <FieldSet
              className="gap-3"
              disabled={submitting}
            >
              <FieldLegend>Vai trò nhà xe</FieldLegend>
              <div className="grid gap-2">
                {roles.status === 'success' &&
                  roles.roles.map((role) => {
                    const checkboxId = `admin-account-role-${account.accountId}-${role.roleName}`;
                    return (
                      <Field
                        className="items-center rounded-lg border p-3"
                        key={role.roleName}
                        orientation="horizontal"
                      >
                        <Checkbox
                          checked={selectedRoleNames.includes(role.roleName)}
                          id={checkboxId}
                          onCheckedChange={() => toggleRole(role.roleName)}
                          value={role.roleName}
                        />
                        <FieldLabel
                          className="cursor-pointer"
                          htmlFor={checkboxId}
                        >
                          {role.label}
                        </FieldLabel>
                      </Field>
                    );
                  })}
                {roles.status === 'success' && roles.roles.length === 0 && (
                  <ResourceNotice kind="error">
                    Danh mục hiện không có vai trò nhà xe hợp lệ.
                  </ResourceNotice>
                )}
              {roles.status === 'error' && (
                <ResourceNotice kind="error">
                  <p>{roles.message}</p>
                  <Button
                    onClick={() => {
                      setRoles({ status: 'loading' });
                      setRetryCount((count) => count + 1);
                    }}
                    type="button"
                    variant="outline"
                  >
                    Tải lại danh mục
                  </Button>
                </ResourceNotice>
              )}
              </div>
            </FieldSet>
          </ResourceSheetForm>
      </ResourceSheet>

      {revokeConfirmationOpen && (
        <ResourceConfirmation
          busy={submitting}
          onClose={() => {
            if (!submittingRef.current) setRevokeConfirmationOpen(false);
          }}
          title="Thu hồi toàn bộ vai trò?"
          description="Sau thao tác này, tài khoản sẽ không còn quyền quản trị và có thể không đăng nhập được vào Admin cho đến khi được gán lại vai trò."
        >
            {error && (
              <ResourceNotice kind="error">{error}</ResourceNotice>
            )}
            <Button
              aria-busy={submitting}
              disabled={submitting}
              onClick={() => void saveRoles([])}
              type="button"
            >
                {submitting && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                    size={15}
                  />
                )}
                {submitting ? 'Đang thu hồi…' : 'Thu hồi vai trò'}
            </Button>
        </ResourceConfirmation>
      )}
    </>
  );
}
