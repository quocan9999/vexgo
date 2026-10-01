'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
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
import styles from './admin-accounts-management.module.css';

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
  const dialogRef = useRef<HTMLDialogElement>(null);
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
      dialogRef.current?.close();
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
      <AdminFormDialog
        ariaBusy={submitting || roles.status === 'loading'}
        ariaDescribedBy="admin-account-roles-description"
        ariaLabelledBy="admin-account-roles-title"
        dialogRef={dialogRef}
        onClose={onClose}
        preventDismiss={submitting}
      >
        <>
          <div className="admin-dialog-header">
            <div className="admin-dialog-header__copy">
              <p className="eyebrow">QUẢN LÝ TÀI KHOẢN ADMIN</p>
              <h2 id="admin-account-roles-title">Gán vai trò tài khoản</h2>
              <p id="admin-account-roles-description">
                Chọn các vai trò nhà xe từ danh mục hiện tại cho{' '}
                <strong>{account.fullName}</strong>.
              </p>
            </div>
            <Button
              aria-label="Đóng quản lý vai trò"
              className={`${styles.roleDialogClose} icon-button`}
              disabled={submitting}
              onClick={() => dialogRef.current?.close()}
              type="button"
              variant="secondary"
            >
              <X aria-hidden="true" size={19} />
            </Button>
          </div>

          <form className="admin-crud-form" noValidate onSubmit={handleSubmit}>
            {error && (
              <p className="admin-crud-form-error" role="alert">
                {error}
              </p>
            )}
            <fieldset className={styles.roleOptions} disabled={submitting}>
              <legend>Vai trò nhà xe</legend>
              {roles.status === 'loading' && (
                <p aria-live="polite" role="status">
                  Đang tải danh mục vai trò…
                </p>
              )}
              {roles.status === 'success' &&
                roles.roles.map((role) => (
                  <label className={styles.roleOption} key={role.roleName}>
                    <input
                      checked={selectedRoleNames.includes(role.roleName)}
                      onChange={() => toggleRole(role.roleName)}
                      type="checkbox"
                      value={role.roleName}
                    />
                    <span>{role.label}</span>
                  </label>
                ))}
              {roles.status === 'success' && roles.roles.length === 0 && (
                <p className="admin-crud-form-error" role="alert">
                  Danh mục hiện không có vai trò nhà xe hợp lệ.
                </p>
              )}
              {roles.status === 'error' && (
                <div className="admin-crud-form-error" role="alert">
                  <p>{roles.message}</p>
                  <Button
                    onClick={() => {
                      setRoles({ status: 'loading' });
                      setRetryCount((count) => count + 1);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Tải lại danh mục
                  </Button>
                </div>
              )}
            </fieldset>

            <div
              className={`${styles.roleDialogActions} admin-crud-form-actions`}
            >
              <Button
                disabled={submitting}
                onClick={() => dialogRef.current?.close()}
                type="button"
                variant="secondary"
              >
                Hủy
              </Button>
              <Button disabled={!canSubmit} type="submit">
                {submitting && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="admin-crud-form-spinner"
                    size={16}
                  />
                )}
                {submitting ? 'Đang lưu…' : 'Lưu vai trò'}
              </Button>
            </div>
          </form>
        </>
      </AdminFormDialog>

      {revokeConfirmationOpen && (
        <AdminConfirmDialog
          ariaBusy={submitting}
          ariaDescribedBy="admin-account-revoke-roles-description"
          ariaLabelledBy="admin-account-revoke-roles-title"
          onClose={() => {
            if (!submittingRef.current) setRevokeConfirmationOpen(false);
          }}
          preventDismiss={submitting}
        >
          <>
            <h2 id="admin-account-revoke-roles-title">
              Thu hồi toàn bộ vai trò?
            </h2>
            <p id="admin-account-revoke-roles-description">
              Sau thao tác này, tài khoản sẽ không còn quyền quản trị và có thể
              không đăng nhập được vào Admin cho đến khi được gán lại vai trò.
            </p>
            {error && (
              <p className="admin-confirm-dialog__error" role="alert">
                {error}
              </p>
            )}
            <div
              className={`${styles.roleDialogActions} admin-confirm-dialog__actions`}
            >
              <Button
                disabled={submitting}
                onClick={() => setRevokeConfirmationOpen(false)}
                type="button"
                variant="secondary"
              >
                Hủy
              </Button>
              <Button
                disabled={submitting}
                onClick={() => void saveRoles([])}
                type="button"
              >
                {submitting && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="admin-crud-form-spinner"
                    size={15}
                  />
                )}
                {submitting ? 'Đang thu hồi…' : 'Thu hồi vai trò'}
              </Button>
            </div>
          </>
        </AdminConfirmDialog>
      )}
    </>
  );
}
