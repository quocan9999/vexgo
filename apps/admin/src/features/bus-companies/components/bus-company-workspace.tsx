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
                : 'Không thể tải thông tin nhà xe.',
          });
        }
      });

    return () => controller.abort();
  }, [companyId, retryCount]);

  function handleCompanyUpdated(updatedCompany: BusCompany) {
    setDetailState({ status: 'success', company: updatedCompany });
    setEditDialogOpen(false);
    onUpdated?.(updatedCompany);
    toast.success(`Đã cập nhật nhà xe ${updatedCompany.name}.`);
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
          ? `Đã kích hoạt lại nhà xe ${updatedCompany.name}.`
          : `Đã tạm ngưng nhà xe ${updatedCompany.name}.`,
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
        { label: 'Hệ thống', href: '/bus-companies' },
        { label: 'Nhà xe', href: '/bus-companies' },
        { label: company ? company.name : `Nhà xe #${companyId}` },
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
                Danh sách nhà xe
              </Button>

              {canUpdate && company && (
                <>
                  <Button
                    onClick={() => setStatusDialogOpen(true)}
                    variant="outline"
                  >
                    {company.status === 'HOAT_DONG'
                      ? 'Tạm ngưng nhà xe'
                      : 'Kích hoạt lại'}
                  </Button>
                  <Button onClick={() => setEditDialogOpen(true)}>
                    <Pencil aria-hidden="true" />
                    Chỉnh sửa
                  </Button>
                </>
              )}

              <ResourceRefreshAction
                loading={detailState.status === 'loading'}
                onClick={() => setRetryCount((c) => c + 1)}
              />
            </div>
          }
          title="Thông tin nhà xe"
          titleId="bus-company-workspace-title"
        />

        {detailState.status === 'loading' && (
          <ResourceState loading>Đang tải thông tin nhà xe…</ResourceState>
        )}

        {detailState.status === 'error' && (
          <ResourceState error>
            <p>{detailState.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => setRetryCount((count) => count + 1)}
                variant="outline"
              >
                Thử lại
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/bus-companies" />}
              >
                Về danh sách nhà xe
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
                      Mã nhà xe: <span className="font-semibold text-foreground">{company.code}</span>
                    </p>
                  </div>
                </div>
                <ResourceStatusBadge
                  tone={company.status === 'HOAT_DONG' ? 'active' : 'muted'}
                >
                  {statusLabel(company.status)}
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
                      Thông tin liên hệ
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-foreground">
                    <div>
                      <dt>Đầu mối liên hệ</dt>
                      <dd className="break-words">
                        {company.contactInfo || 'Chưa cập nhật'}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Thông tin hệ thống */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Thông tin hồ sơ hệ thống
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Ngày tạo</dt>
                      <dd className="mt-1 font-medium text-foreground tabular-nums">
                        {timestampFormat(company.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Cập nhật lần cuối</dt>
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
                ? `Nhà xe "${company.name}" sẽ tạm ngưng hoạt động. Các tuyến xe và chuyến xe liên quan có thể bị ảnh hưởng.`
                : `Nhà xe "${company.name}" sẽ được kích hoạt lại trạng thái hoạt động bình thường.`
            }
            onClose={() => {
              if (!statusSubmittingRef.current) setStatusDialogOpen(false);
            }}
            title={
              company.status === 'HOAT_DONG'
                ? 'Tạm ngưng nhà xe này?'
                : 'Kích hoạt lại nhà xe này?'
            }
          >
            <Button
              disabled={statusSubmitting}
              onClick={confirmStatusChange}
              variant={company.status === 'HOAT_DONG' ? 'destructive' : 'default'}
            >
              {statusSubmitting
                ? 'Đang cập nhật…'
                : company.status === 'HOAT_DONG'
                  ? 'Tạm ngưng nhà xe'
                  : 'Kích hoạt lại'}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
