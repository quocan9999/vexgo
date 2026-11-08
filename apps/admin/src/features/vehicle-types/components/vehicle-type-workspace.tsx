'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  Bus,
  Calendar,
  Clock,
  FileText,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceRefreshAction,
  ResourceState,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasAdminPermission } from '@/features/admin-auth/services/admin-access';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getVehicleTypeById } from '../services/vehicle-type-service';
import type { VehicleType } from '../types/vehicle-type';
import { VehicleTypeFormDialog } from './vehicle-type-form-dialog';

interface VehicleTypeWorkspaceProps {
  vehicleTypeId: number;
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; vehicleType: VehicleType };

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(value))
    .replaceAll('/', '-');
}

export function VehicleTypeWorkspace({
  vehicleTypeId,
}: VehicleTypeWorkspaceProps) {
  const authState = useAdminSession();
  const session = authState.status === 'authenticated' ? authState.session : null;
  const canUpdate = hasAdminPermission(session, 'vehicle-type:update');

  const [detailState, setDetailState] = useState<DetailState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    getVehicleTypeById(vehicleTypeId, controller.signal)
      .then((vehicleType) => {
        if (current) setDetailState({ status: 'success', vehicleType });
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setDetailState({
            status: 'error',
            message:
              error instanceof TypeError
                ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
                : error instanceof Error
                  ? error.message
                  : 'Không thể tải thông tin loại xe.',
          });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [retryCount, vehicleTypeId]);

  function retry() {
    setDetailState({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  function handleVehicleTypeUpdated(vehicleType: VehicleType) {
    setDetailState({ status: 'success', vehicleType });
    setEditDialogOpen(false);
    toast.success('Cập nhật loại xe thành công.');
  }

  const vehicleType =
    detailState.status === 'success' ? detailState.vehicleType : null;

  return (
    <SuperAdminLayout
      activeSection="vehicle-types"
      breadcrumbs={[
        { label: 'Quản lý loại xe', href: '/vehicle-types' },
        { label: vehicleType ? vehicleType.name : 'Chi tiết loại xe' },
      ]}
    >
      <div className="admin-page-content space-y-6">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                nativeButton={false}
                render={<Link href="/vehicle-types" />}
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                Quay lại danh sách
              </Button>
              {canUpdate && vehicleType && (
                <Button onClick={() => setEditDialogOpen(true)}>
                  <Pencil aria-hidden="true" />
                  Chỉnh sửa
                </Button>
              )}
              <ResourceRefreshAction
                loading={detailState.status === 'loading'}
                onClick={retry}
              />
            </div>
          }
          eyebrow="DANH MỤC PHƯƠNG TIỆN"
          title={
            vehicleType
              ? `Chi tiết loại xe ${vehicleType.name}`
              : 'Chi tiết loại xe'
          }
          titleId="vehicle-type-workspace-title"
        />

        {detailState.status === 'loading' && (
          <ResourceState loading>Đang tải thông tin loại xe…</ResourceState>
        )}

        {detailState.status === 'error' && (
          <ResourceState error>
            <p>{detailState.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={retry} variant="outline">
                Thử lại
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/vehicle-types" />}
              >
                Về danh sách loại xe
              </Button>
            </div>
          </ResourceState>
        )}

        {detailState.status === 'success' && vehicleType && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary"
                >
                  <Bus size={28} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {vehicleType.name}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mã loại xe:{' '}
                    <strong className="admin-data-mono">
                      #{vehicleType.vehicleTypeId}
                    </strong>
                  </p>
                </div>
              </div>
            </Card>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Card 1: Sức chứa hàng mặc định */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Boxes className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Sức chứa hàng mặc định
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid grid-cols-3 gap-3 rounded-[var(--admin-radius-panel)] border bg-muted/40 p-4">
                    {(
                      [
                        ['Xe máy', vehicleType.motorbikeCapacityDefault],
                        ['Hàng cồng kềnh', vehicleType.bulkyCargoCapacityDefault],
                        ['Hàng nhẹ', vehicleType.lightCargoCapacityDefault],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label}>
                        <dt className="mb-2 text-xs text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="text-xl font-bold tabular-nums text-foreground">
                          {value.toLocaleString('vi-VN')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Thông tin mô tả & Hồ sơ */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Mô tả & Thời gian
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>Mô tả quy cách</dt>
                      <dd className="whitespace-pre-wrap text-foreground">
                        {vehicleType.description || 'Chưa có mô tả'}
                      </dd>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t pt-3">
                      <div>
                        <dt className="flex items-center gap-1.5">
                          <Calendar className="size-3.5" />
                          Ngày tạo
                        </dt>
                        <dd className="text-muted-foreground tabular-nums">
                          {timestampFormat(vehicleType.createdAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="flex items-center gap-1.5">
                          <Clock className="size-3.5" />
                          Cập nhật lần cuối
                        </dt>
                        <dd className="text-muted-foreground tabular-nums">
                          {timestampFormat(vehicleType.updatedAt)}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        {editDialogOpen && canUpdate && vehicleType && (
          <VehicleTypeFormDialog
            key={vehicleTypeId}
            onClose={() => setEditDialogOpen(false)}
            onSaved={handleVehicleTypeUpdated}
            vehicleType={vehicleType}
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}
