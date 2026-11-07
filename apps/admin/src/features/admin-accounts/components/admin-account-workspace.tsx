'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Pencil,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceConfirmation,
  ResourceRefreshAction,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasPlatformAdminPermission } from '@/features/admin-auth/services/admin-access';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  getAdminAccountById,
  updateAdminAccountStatus,
} from '../services/admin-account-service';
import type {
  AdminAccount,
  AdminAccountStatus,
} from '../types/admin-account';
import type { TenantRbacRoleName } from '@/features/tenant-rbac/types/tenant-rbac';
import { AdminAccountFormDialog } from './admin-account-form-dialog';
import { AdminAccountRolesDialog } from './admin-account-roles-dialog';

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function statusLabel(status: AdminAccountStatus) {
  switch (status) {
    case 'HOAT_DONG':
      return 'Hoạt động';
    case 'TAM_KHOA':
      return 'Tạm khóa';
  }
}

function roleLabel(role: TenantRbacRoleName) {
  switch (role) {
    case 'NHA_XE_ADMIN':
      return 'Quản trị nhà xe';
    case 'NHAN_VIEN_DIEU_HANH':
      return 'Nhân viên điều hành';
    case 'NHAN_VIEN_BAN_VE':
      return 'Nhân viên bán vé';
    case 'NHAN_VIEN_CSKH':
      return 'Nhân viên CSKH';
    case 'NHAN_VIEN_PHU_XE':
      return 'Nhân viên phụ xe';
    case 'NHAN_VIEN_KINH_DOANH':
      return 'Nhân viên kinh doanh';
  }
}

function RoleBadges({ roles }: { roles: TenantRbacRoleName[] }) {
  if (roles.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        Chưa được gán vai trò
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <ResourceStatusBadge key={role} tone="muted">
          {roleLabel(role)}
        </ResourceStatusBadge>
      ))}
    </div>
  );
}

function AccountStatusBadge({ status }: { status: AdminAccountStatus }) {
  return (
    <ResourceStatusBadge tone={status === 'HOAT_DONG' ? 'active' : 'muted'}>
      {statusLabel(status)}
    </ResourceStatusBadge>
  );
}

export type AdminAccountWorkspaceProps = {
  accountId: number;
  initialAccount?: AdminAccount;
  onClose?: () => void;
  onAccountUpdated?: (account: AdminAccount) => void;
  onNotFound?: () => void;
};

type AccountDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; account: AdminAccount };

export function AdminAccountWorkspace({
  accountId,
  initialAccount,
  onClose,
  onAccountUpdated,
  onNotFound,
}: AdminAccountWorkspaceProps) {
  const authState = useAdminSession();
  const session =
    authState.status === 'authenticated' ? authState.session : null;
  const canUpdate = hasPlatformAdminPermission(session, 'admin-account:update');

  const [detail, setDetail] = useState<AccountDetailState>(
    initialAccount
      ? { status: 'success', account: initialAccount }
      : { status: 'loading' },
  );
  const [retryCount, setRetryCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const statusSubmittingRef = useRef(false);
  const onNotFoundRef = useRef(onNotFound);

  useEffect(() => {
    onNotFoundRef.current = onNotFound;
  }, [onNotFound]);

  useEffect(() => {
    const controller = new AbortController();

    getAdminAccountById(accountId, controller.signal)
      .then((account) => {
        if (!controller.signal.aborted)
          setDetail({ status: 'success', account });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          const is404 =
            (error as { code?: string; status?: number })?.code ===
              'ADMIN_ACCOUNT_NOT_FOUND' ||
            (error as { status?: number })?.status === 404;
          if (is404) {
            onNotFoundRef.current?.();
          }
          setDetail({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Không thể tải thông tin tài khoản.',
          });
        }
      });

    return () => controller.abort();
  }, [accountId, retryCount]);

  async function handleConfirmStatusChange() {
    if (statusSubmittingRef.current || detail.status !== 'success') return;
    statusSubmittingRef.current = true;
    setStatusSubmitting(true);

    const nextStatus: AdminAccountStatus =
      detail.account.status === 'HOAT_DONG' ? 'TAM_KHOA' : 'HOAT_DONG';

    try {
      const updatedAccount = await updateAdminAccountStatus(
        detail.account.accountId,
        nextStatus,
      );
      setDetail({ status: 'success', account: updatedAccount });
      setStatusDialogOpen(false);
      toast.success(
        nextStatus === 'TAM_KHOA'
          ? 'Đã khóa tài khoản Admin.'
          : 'Đã mở khóa tài khoản Admin.',
      );
      onAccountUpdated?.(updatedAccount);
    } catch (requestError: unknown) {
      toast.error(
        requestError instanceof TypeError
          ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
          : requestError instanceof Error
            ? requestError.message
            : 'Không thể cập nhật trạng thái tài khoản.',
      );
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  const account = detail.status === 'success' ? detail.account : null;

  return (
    <SuperAdminLayout
      activeSection="admin-accounts"
      breadcrumbs={[
        { label: 'Hệ thống', href: '/admin-accounts' },
        { label: 'Tài khoản quản trị', href: '/admin-accounts' },
        { label: account ? account.fullName : `Tài khoản #${accountId}` },
      ]}
    >
      <div className="admin-ui admin-page-content grid gap-[var(--admin-space-section-gap)]">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                nativeButton={false}
                render={
                  <Link
                    href="/admin-accounts"
                    onClick={
                      onClose
                        ? (e) => {
                            e.preventDefault();
                            onClose();
                          }
                        : undefined
                    }
                  />
                }
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                Danh sách tài khoản
              </Button>

              {canUpdate && account && (
                <>
                  <Button
                    onClick={() => setRoleDialogOpen(true)}
                    variant="outline"
                  >
                    <ShieldCheck aria-hidden />
                    Gán vai trò
                  </Button>
                  <Button
                    onClick={() => setStatusDialogOpen(true)}
                    variant="outline"
                  >
                    {account.status === 'HOAT_DONG'
                      ? 'Khóa tài khoản'
                      : 'Mở khóa tài khoản'}
                  </Button>
                  <Button onClick={() => setEditOpen(true)}>
                    <Pencil aria-hidden />
                    Chỉnh sửa
                  </Button>
                </>
              )}

              <ResourceRefreshAction
                loading={detail.status === 'loading'}
                onClick={() => setRetryCount((c) => c + 1)}
              />
            </div>
          }
          title="Thông tin tài khoản"
          titleId="admin-account-workspace-title"
        />

        {detail.status === 'loading' && (
          <ResourceState loading>Đang tải thông tin tài khoản…</ResourceState>
        )}

        {detail.status === 'error' && (
          <ResourceState error>
            <p>{detail.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => setRetryCount((count) => count + 1)}
                variant="outline"
              >
                Thử lại
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/admin-accounts" />}
              >
                Về danh sách tài khoản
              </Button>
            </div>
          </ResourceState>
        )}

        {account && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary"
                  >
                    <UserRound size={28} />
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {account.fullName}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {account.email ?? account.phoneNumber}
                    </p>
                  </div>
                </div>
                <AccountStatusBadge status={account.status} />
              </div>
            </Card>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Thông tin định danh & nhân sự */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-base font-semibold">
                    Thông tin định danh
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>Số điện thoại</dt>
                      <dd>{account.phoneNumber}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{account.email ?? 'Chưa cập nhật'}</dd>
                    </div>
                    <div>
                      <dt>Chức vụ</dt>
                      <dd>{account.employee.position || 'Chưa cập nhật'}</dd>
                    </div>
                    <div>
                      <dt>Ngày vào làm</dt>
                      <dd>{formatDate(account.employee.joinedAt ?? null)}</dd>
                    </div>
                    <div>
                      <dt>Ngày sinh</dt>
                      <dd>{formatDate(account.dateOfBirth)}</dd>
                    </div>
                    <div>
                      <dt>CCCD</dt>
                      <dd className="admin-data-mono">
                        {account.citizenId ?? 'Chưa cập nhật'}
                      </dd>
                    </div>
                    <div>
                      <dt>Mã nhân viên</dt>
                      <dd className="admin-data-mono">
                        {account.employee.employeeCode}
                      </dd>
                    </div>
                    <div>
                      <dt>Trạng thái nhân viên</dt>
                      <dd>{account.employee.employmentStatus}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Phạm vi và vai trò */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-base font-semibold">
                    Phạm vi & Vai trò
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>Nhà xe</dt>
                      <dd className="flex items-center gap-2">
                        <Building2 aria-hidden className="size-4 text-muted-foreground" />
                        <span>{account.busCompany.name}</span>
                        <span>·</span>
                        <span className="admin-data-mono font-semibold">
                          {account.busCompany.code}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Vai trò phân quyền</dt>
                      <dd className="mt-1">
                        <RoleBadges roles={account.roles} />
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 3: Thông tin bảo mật & hệ thống */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-base font-semibold">
                    Bảo mật & Hệ thống
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>Xác minh số điện thoại</dt>
                      <dd>
                        {account.phoneVerified ? 'Đã xác minh' : 'Chưa xác minh'}
                      </dd>
                    </div>
                    <div>
                      <dt>Ngày tạo</dt>
                      <dd className="tabular-nums">
                        {formatTimestamp(account.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt>Cập nhật lần cuối</dt>
                      <dd className="tabular-nums">
                        {formatTimestamp(account.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Dialogs */}
        {editOpen && account && (
          <AdminAccountFormDialog
            account={account}
            onClose={() => setEditOpen(false)}
            onSaved={(updatedAccount) => {
              setDetail({ status: 'success', account: updatedAccount });
              setEditOpen(false);
              onAccountUpdated?.(updatedAccount);
            }}
          />
        )}

        {canUpdate && roleDialogOpen && account && (
          <AdminAccountRolesDialog
            account={account}
            onClose={() => setRoleDialogOpen(false)}
            onSaved={(updatedAccount) => {
              setDetail({ status: 'success', account: updatedAccount });
              setRoleDialogOpen(false);
              onAccountUpdated?.(updatedAccount);
            }}
          />
        )}

        {canUpdate && statusDialogOpen && account && (
          <ResourceConfirmation
            busy={statusSubmitting}
            description={
              account.status === 'HOAT_DONG'
                ? `Tài khoản "${account.fullName}" sẽ bị khóa và các phiên đăng nhập đang hoạt động sẽ bị thu hồi.`
                : `Tài khoản "${account.fullName}" sẽ được mở khóa (không tạo phiên đăng nhập mới).`
            }
            onClose={() => {
              if (!statusSubmittingRef.current) setStatusDialogOpen(false);
            }}
            title={
              account.status === 'HOAT_DONG'
                ? 'Khóa tài khoản này?'
                : 'Mở khóa tài khoản này?'
            }
          >
            <Button
              disabled={statusSubmitting}
              onClick={handleConfirmStatusChange}
              variant={account.status === 'HOAT_DONG' ? 'destructive' : 'default'}
            >
              {statusSubmitting
                ? 'Đang cập nhật…'
                : account.status === 'HOAT_DONG'
                  ? 'Khóa tài khoản'
                  : 'Mở khóa tài khoản'}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
