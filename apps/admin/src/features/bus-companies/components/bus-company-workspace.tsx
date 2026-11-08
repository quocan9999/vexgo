'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Pencil } from 'lucide-react';
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
  getBusCompanyById,
  updateBusCompanyStatus,
} from '../services/bus-company-service';
import type { BusCompany, BusCompanyStatus } from '../types/bus-company';
import { EditBusCompanyDialog } from './edit-bus-company-dialog';

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function initials(value: string) {
  return value
    .replace(/^Nhà xe\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('vi');
}

function statusLabel(status: BusCompanyStatus) {
  switch (status) {
    case 'HOAT_DONG':
      return 'Đang hoạt động';
    case 'TAM_NGUNG':
      return 'Tạm ngưng';
  }
}

function CompanyMark({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-12 shrink-0 place-items-center rounded-xl border bg-muted text-sm font-bold text-foreground"
    >
      {initials(name)}
    </span>
  );
}

export type BusCompanyWorkspaceProps = {
  companyId: number;
  initialCompany?: BusCompany;
  onClose?: () => void;
  onUpdated?: (company: BusCompany) => void;
  onNotFound?: () => void;
};

type CompanyDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; company: BusCompany };

export function BusCompanyWorkspace({
  companyId,
  initialCompany,
  onClose,
  onUpdated,
  onNotFound,
}: BusCompanyWorkspaceProps) {
  const tCompanies = useTranslations('busCompanies');
  const tCommon = useTranslations('common');
  const authState = useAdminSession();
  const session =
    authState.status === 'authenticated' ? authState.session : null;
  const canUpdate = hasPlatformAdminPermission(session, 'bus-company:update');

  const [detailState, setDetailState] = useState<CompanyDetailState>(
    initialCompany
      ? { status: 'success', company: initialCompany }
      : { status: 'loading' },
  );
  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const statusSubmittingRef = useRef(false);
  const onNotFoundRef = useRef(onNotFound);

  useEffect(() => {
    onNotFoundRef.current = onNotFound;
  }, [onNotFound]);

  useEffect(() => {
    const controller = new AbortController();

    getBusCompanyById(companyId, controller.signal)
      .then((company) => {
        if (!controller.signal.aborted) {
          setDetailState({ status: 'success', company });
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          const is404 =
            (requestError as { code?: string; status?: number })?.code ===
              'BUS_COMPANY_NOT_FOUND' ||
            (requestError as { status?: number })?.status === 404;
          if (is404) {
            onNotFoundRef.current?.();
          }
          setDetailState({
            status: 'error',
            message:
              requestError instanceof Error
                ? requestError.message
                : tCompanies('detailsTitle'),
          });
        }
      });

    return () => controller.abort();
  }, [companyId, retryCount, tCompanies]);

  function handleCompanyUpdated(updatedCompany: BusCompany) {
    setDetailState({ status: 'success', company: updatedCompany });
    setEditDialogOpen(false);
    onUpdated?.(updatedCompany);
    toast.success(tCompanies('updatedSuccess'));
  }

  async function confirmStatusChange() {
    if (
      !canUpdate ||
      detailState.status !== 'success' ||
      statusSubmittingRef.current
    ) {
      return;
    }

    const targetStatus: BusCompanyStatus =
      detailState.company.status === 'HOAT_DONG' ? 'TAM_NGUNG' : 'HOAT_DONG';
    statusSubmittingRef.current = true;
    setStatusSubmitting(true);

    try {
      const updatedCompany = await updateBusCompanyStatus(
        companyId,
        targetStatus,
      );
      setDetailState({ status: 'success', company: updatedCompany });
      setStatusDialogOpen(false);
      onUpdated?.(updatedCompany);
      toast.success(
        targetStatus === 'HOAT_DONG'
          ? tCompanies('reactivateSuccess', { name: updatedCompany.name })
          : tCompanies('suspendSuccess', { name: updatedCompany.name }),
      );
    } catch (requestError: unknown) {
      toast.error(
        requestError instanceof TypeError
          ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
          : requestError instanceof Error
            ? requestError.message
            : 'Không thể cập nhật trạng thái nhà xe.',
      );
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  const company = detailState.status === 'success' ? detailState.company : null;

  return (
    <SuperAdminLayout
      activeSection="bus-companies"
      breadcrumbs={[
        { label: tCommon('system'), href: '/bus-companies' },
        { label: tCompanies('busCompaniesTitle'), href: '/bus-companies' },
        { label: company ? company.name : tCompanies('companyNumber', { id: companyId }) },
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
                    href="/bus-companies"
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
                {tCompanies('backToList')}
              </Button>

              {canUpdate && company && (
                <>
                  <Button
                    onClick={() => setStatusDialogOpen(true)}
                    variant="outline"
                  >
                    {company.status === 'HOAT_DONG'
                      ? tCompanies('suspendCompany')
                      : tCompanies('reactivateCompany')}
                  </Button>
                  <Button onClick={() => setEditDialogOpen(true)}>
                    <Pencil aria-hidden="true" />
                    {tCommon('edit')}
                  </Button>
                </>
              )}

              <ResourceRefreshAction
                loading={detailState.status === 'loading'}
                onClick={() => setRetryCount((c) => c + 1)}
              />
            </div>
          }
          title={tCompanies('companyDetailsTitle')}
          titleId="bus-company-workspace-title"
        />

        {detailState.status === 'loading' && (
          <ResourceState loading>{tCommon('loading')}</ResourceState>
        )}

        {detailState.status === 'error' && (
          <ResourceState error>
            <p>{detailState.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => setRetryCount((count) => count + 1)}
                variant="outline"
              >
                {tCommon('retry')}
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/bus-companies" />}
              >
                {tCompanies('backToList')}
              </Button>
            </div>
          </ResourceState>
        )}

        {company && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <CompanyMark name={company.name} />
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {company.name}
                    </h2>
                    <p className="admin-data-mono mt-1 text-sm text-muted-foreground">
                      {tCompanies('companyCodePrefix')} <span className="font-semibold text-foreground">{company.code}</span>
                    </p>
                  </div>
                </div>
                <ResourceStatusBadge
                  tone={company.status === 'HOAT_DONG' ? 'active' : 'muted'}
                >
                  {company.status === 'HOAT_DONG' ? tCompanies('statusActive') : tCompanies('statusSuspended')}
                </ResourceStatusBadge>
              </div>
            </Card>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Card 1: Thông tin liên hệ */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tCompanies('contactInfo')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>{tCompanies('contactLead')}</dt>
                      <dd className="break-words">
                        {company.contactInfo || tCompanies('noContactInfo')}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Thông tin hệ thống */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    {tCompanies('systemRecordTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">{tCommon('createdAt')}</dt>
                      <dd className="mt-1 font-medium text-foreground tabular-nums">
                        {timestampFormat(company.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{tCommon('updatedAt')}</dt>
                      <dd className="mt-1 font-medium text-foreground tabular-nums">
                        {timestampFormat(company.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Dialogs */}
        {canUpdate && editDialogOpen && company && (
          <EditBusCompanyDialog
            company={company}
            onClose={() => setEditDialogOpen(false)}
            onUpdated={handleCompanyUpdated}
          />
        )}

        {canUpdate && statusDialogOpen && company && (
          <ResourceConfirmation
            busy={statusSubmitting}
            description={
              company.status === 'HOAT_DONG'
                ? tCompanies('confirmSuspendDesc', { name: company.name })
                : tCompanies('confirmReactivateDesc', { name: company.name })
            }
            onClose={() => {
              if (!statusSubmittingRef.current) setStatusDialogOpen(false);
            }}
            title={
              company.status === 'HOAT_DONG'
                ? tCompanies('confirmSuspendTitle')
                : tCompanies('confirmReactivateTitle')
            }
          >
            <Button
              disabled={statusSubmitting}
              onClick={confirmStatusChange}
              variant={company.status === 'HOAT_DONG' ? 'destructive' : 'default'}
            >
              {statusSubmitting
                ? tCommon('loading')
                : company.status === 'HOAT_DONG'
                  ? tCompanies('suspendCompany')
                  : tCompanies('reactivateCompany')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
