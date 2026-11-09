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
import { useTranslations } from 'next-intl';
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

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function getRoleLabel(role: TenantRbacRoleName, t: (key: string) => string) {
  switch (role) {
    case 'NHA_XE_ADMIN':
      return t('roleOperatorAdmin');
    case 'NHAN_VIEN_DIEU_HANH':
      return t('roleDispatcher');
    case 'NHAN_VIEN_BAN_VE':
      return t('roleTicketClerk');
    case 'NHAN_VIEN_CSKH':
      return t('roleSupportAgent');
    case 'NHAN_VIEN_PHU_XE':
      return t('roleDriverAssistant');
    case 'NHAN_VIEN_KINH_DOANH':
      return t('roleSales');
  }
}

function RoleBadges({ roles, t }: { roles: TenantRbacRoleName[]; t: (key: string) => string }) {
  if (roles.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {t('noRolesAssigned')}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <ResourceStatusBadge key={role} tone="muted">
          {getRoleLabel(role, t)}
        </ResourceStatusBadge>
      ))}
    </div>
  );
}

function AccountStatusBadge({ status, t }: { status: AdminAccountStatus; t: (key: string) => string }) {
  return (
    <ResourceStatusBadge tone={status === 'HOAT_DONG' ? 'active' : 'muted'}>
      {status === 'HOAT_DONG' ? t('statusActive') : t('statusLocked')}
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
  const tAccounts = useTranslations('adminAccounts');
  const tCommon = useTranslations('common');
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
    if (initialAccount && retryCount === 0) return;
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
                : tAccounts('loadErrorTitle'),
          });
        }
      });

    return () => controller.abort();
  }, [accountId, retryCount, initialAccount]);

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
          ? tAccounts('lockSuccess')
          : tAccounts('unlockSuccess'),
      );
      onAccountUpdated?.(updatedAccount);
    } catch (requestError: unknown) {
      toast.error(
        requestError instanceof TypeError
          ? tAccounts('networkError')
          : requestError instanceof Error
            ? requestError.message
            : tAccounts('cannotUpdateStatus'),
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
        { label: tCommon('system'), href: '/admin-accounts' },
        { label: tAccounts('adminAccountsTitle'), href: '/admin-accounts' },
        { label: account ? account.fullName : tAccounts('accountNumber', { id: accountId }) },
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
                {tAccounts('backToList')}
              </Button>

              {canUpdate && account && (
                <>
                  <Button
                    onClick={() => setRoleDialogOpen(true)}
                    variant="outline"
                  >
                    <ShieldCheck aria-hidden />
                    {tAccounts('assignRolesButton')}
                  </Button>
                  <Button
                    onClick={() => setStatusDialogOpen(true)}
                    variant="outline"
                  >
                    {account.status === 'HOAT_DONG'
                      ? tAccounts('lockButton')
                      : tAccounts('unlockButton')}
                  </Button>
                  <Button onClick={() => setEditOpen(true)}>
                    <Pencil aria-hidden />
                    {tCommon('edit')}
                  </Button>
                </>
              )}

              <ResourceRefreshAction
                loading={detail.status === 'loading'}
                onClick={() => setRetryCount((c) => c + 1)}
              />
            </div>
          }
          title={tAccounts('accountInfo')}
          titleId="admin-account-workspace-title"
        />

        {detail.status === 'loading' && (
          <ResourceState loading>{tCommon('loading')}</ResourceState>
        )}

        {detail.status === 'error' && (
          <ResourceState error>
            <p>{detail.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => setRetryCount((count) => count + 1)}
                variant="outline"
              >
                {tCommon('retry')}
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/admin-accounts" />}
              >
                {tAccounts('backToList')}
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
                <AccountStatusBadge status={account.status} t={tAccounts} />
              </div>
            </Card>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Identity & Staff Info */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-base font-semibold">
                    {tAccounts('identityInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>{tAccounts('accountPhone')}</dt>
                      <dd>{account.phoneNumber}</dd>
                    </div>
                    <div>
                      <dt>{tAccounts('accountEmail')}</dt>
                      <dd>{account.email ?? tAccounts('notUpdated')}</dd>
                    </div>
                    <div>
                      <dt>{tAccounts('position')}</dt>
                      <dd>{account.employee.position || tAccounts('notUpdated')}</dd>
                    </div>
                    <div>
                      <dt>{tAccounts('joinedAt')}</dt>
                      <dd>{formatDate(account.employee.joinedAt ?? null, tAccounts('notUpdated'))}</dd>
                    </div>
                    <div>
                      <dt>{tAccounts('dateOfBirth')}</dt>
                      <dd>{formatDate(account.dateOfBirth, tAccounts('notUpdated'))}</dd>
                    </div>
                    <div>
                      <dt>{tAccounts('citizenId')}</dt>
                      <dd className="admin-data-mono">
                        {account.citizenId ?? tAccounts('notUpdated')}
                      </dd>
                    </div>
                    <div>
                      <dt>{tAccounts('employeeCode')}</dt>
                      <dd className="admin-data-mono">
                        {account.employee.employeeCode}
                      </dd>
                    </div>
                    <div>
                      <dt>{tAccounts('employmentStatus')}</dt>
                      <dd>{account.employee.employmentStatus}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Scope & Roles */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-base font-semibold">
                    {tAccounts('scopeAndRoles')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>{tAccounts('colCompany')}</dt>
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
                      <dt>{tAccounts('assignedRole')}</dt>
                      <dd className="mt-1">
                        <RoleBadges roles={account.roles} t={tAccounts} />
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 3: Security & System Info */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-base font-semibold">
                    {tAccounts('securityAndSystem')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>{tAccounts('phoneVerified')}</dt>
                      <dd>
                        {account.phoneVerified ? tAccounts('verified') : tAccounts('unverified')}
                      </dd>
                    </div>
                    <div>
                      <dt>{tAccounts('colCreatedAt')}</dt>
                      <dd className="tabular-nums">
                        {formatTimestamp(account.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt>{tCommon('updatedAt')}</dt>
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
                ? tAccounts('confirmLockDesc', { name: account.fullName })
                : tAccounts('confirmUnlockDesc', { name: account.fullName })
            }
            onClose={() => {
              if (!statusSubmittingRef.current) setStatusDialogOpen(false);
            }}
            title={
              account.status === 'HOAT_DONG'
                ? tAccounts('confirmLockTitle')
                : tAccounts('confirmUnlockTitle')
            }
          >
            <Button
              disabled={statusSubmitting}
              onClick={handleConfirmStatusChange}
              variant={account.status === 'HOAT_DONG' ? 'destructive' : 'default'}
            >
              {statusSubmitting
                ? tAccounts('savingRoles')
                : account.status === 'HOAT_DONG'
                  ? tAccounts('lockAccountAction')
                  : tAccounts('unlockAccountAction')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
