'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Armchair,
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  LoaderCircle,
  Pencil,
  Trash2,
  Truck,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasAdminPermission } from '@/features/admin-auth/services/admin-access';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useVehicleFilterOptions } from '../hooks/use-vehicle-filter-options';
import {
  deleteVehicle,
  getVehicleById,
  updateVehicleStatus,
} from '../services/vehicle-service';
import type {
  VehicleDetail,
  VehicleStatus,
} from '../types/vehicle';
import { VehicleFormDialog } from './vehicle-form-dialog';

interface VehicleWorkspaceProps {
  vehicleId: number;
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; vehicle: VehicleDetail };

function statusTone(status: VehicleStatus) {
  return status === 'HOAT_DONG' ? 'active' : 'muted';
}

function statusLabel(status: VehicleStatus) {
  return status === 'HOAT_DONG' ? 'Đang hoạt động' : 'Bảo trì';
}

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

export function VehicleWorkspace({ vehicleId }: VehicleWorkspaceProps) {
  const router = useRouter();
  const authState = useAdminSession();
  const session = authState.status === 'authenticated' ? authState.session : null;

  const canUpdate = hasAdminPermission(session, 'vehicle:update');
  const canDelete = hasAdminPermission(session, 'vehicle:delete');
  const canConfigureSeats =
    hasAdminPermission(session, 'vehicle:read') &&
    hasAdminPermission(session, 'seat:read');

  const options = useVehicleFilterOptions();

  const [detailState, setDetailState] = useState<DetailState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const statusSubmittingRef = useRef(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const deleteSubmittingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    getVehicleById(vehicleId, controller.signal)
      .then((vehicle) => {
        if (current) setDetailState({ status: 'success', vehicle });
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
                  : 'Không thể tải thông tin xe.',
          });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [retryCount, vehicleId]);

  function retry() {
    setDetailState({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  function handleVehicleSaved(vehicle: VehicleDetail) {
    setDetailState({ status: 'success', vehicle });
    setEditDialogOpen(false);
    toast.success('Cập nhật thông tin xe thành công.');
  }

  async function confirmStatusChange() {
    if (
      detailState.status !== 'success' ||
      !nextStatus ||
      statusSubmittingRef.current
    ) {
      return;
    }

    statusSubmittingRef.current = true;
    setStatusSubmitting(true);

    try {
      const updatedVehicle = await updateVehicleStatus(vehicleId, nextStatus);
      setDetailState({ status: 'success', vehicle: updatedVehicle });
      setStatusDialogOpen(false);
      toast.success(
        nextStatus === 'BAO_TRI'
          ? 'Đã chuyển trạng thái xe sang Bảo trì.'
          : 'Đã đưa xe vào trạng thái Đang hoạt động.',
      );
    } catch (requestError: unknown) {
      toast.error(
        requestError instanceof TypeError
          ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
          : requestError instanceof Error
            ? requestError.message
            : 'Không thể cập nhật trạng thái xe. Vui lòng thử lại.',
      );
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  async function confirmVehicleDelete() {
    if (detailState.status !== 'success' || deleteSubmittingRef.current) {
      return;
    }

    deleteSubmittingRef.current = true;
    setDeleteSubmitting(true);

    try {
      await deleteVehicle(vehicleId);
      setDeleteDialogOpen(false);
      toast.success('Xóa xe thành công.');
      router.push('/vehicles');
    } catch (requestError: unknown) {
      toast.error(
        requestError instanceof TypeError
          ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
          : requestError instanceof Error
            ? requestError.message
            : 'Không thể xóa xe. Vui lòng thử lại.',
      );
    } finally {
      deleteSubmittingRef.current = false;
      setDeleteSubmitting(false);
    }
  }

  const nextStatus: VehicleStatus | null =
    detailState.status === 'success'
      ? detailState.vehicle.status === 'HOAT_DONG'
        ? 'BAO_TRI'
        : 'HOAT_DONG'
      : null;

  const vehicle = detailState.status === 'success' ? detailState.vehicle : null;

  return (
    <SuperAdminLayout
      activeSection="vehicles"
      breadcrumbs={[
        { label: 'Danh sách xe', href: '/vehicles' },
        { label: vehicle ? vehicle.licensePlate : 'Chi tiết xe' },
      ]}
    >
      <div className="admin-page-content space-y-6">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                nativeButton={false}
                render={<Link href="/vehicles" />}
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                Quay lại danh sách
              </Button>
              {canConfigureSeats && vehicle && (
                <Button
                  nativeButton={false}
                  render={<Link href={`/vehicles/${vehicle.vehicleId}/seats`} />}
                  variant="outline"
                >
                  <Armchair aria-hidden="true" />
                  Cấu hình ghế
                </Button>
              )}
              {canUpdate && vehicle && nextStatus && (
                <Button
                  onClick={() => setStatusDialogOpen(true)}
                  variant="outline"
                >
                  {vehicle.status === 'HOAT_DONG'
                    ? 'Chuyển sang bảo trì'
                    : 'Đưa vào hoạt động'}
                </Button>
              )}
              {canUpdate && vehicle && (
                <Button onClick={() => setEditDialogOpen(true)}>
                  <Pencil aria-hidden="true" />
                  Chỉnh sửa
                </Button>
              )}
              {canDelete && vehicle && (
                <Button
                  onClick={() => setDeleteDialogOpen(true)}
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                  Xóa xe
                </Button>
              )}
              <ResourceRefreshAction
                loading={detailState.status === 'loading'}
                onClick={retry}
              />
            </div>
          }
          eyebrow="QUẢN LÝ PHƯƠNG TIỆN"
          title={vehicle ? `Chi tiết xe ${vehicle.licensePlate}` : 'Chi tiết xe'}
          titleId="vehicle-workspace-title"
        />

        {detailState.status === 'loading' && (
          <ResourceState loading>Đang tải thông tin xe…</ResourceState>
        )}

        {detailState.status === 'error' && (
          <ResourceState error>
            <p>{detailState.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={retry} variant="outline">
                Thử lại
              </Button>
              <Button nativeButton={false} render={<Link href="/vehicles" />}>
                Về danh sách xe
              </Button>
            </div>
          </ResourceState>
        )}

        {detailState.status === 'success' && vehicle && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary"
                  >
                    <Truck size={28} />
                  </span>
                  <div>
                    <h2 className="admin-data-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {vehicle.licensePlate}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Mã phương tiện:{' '}
                      <strong className="admin-data-mono">
                        #{vehicle.vehicleId}
                      </strong>
                    </p>
                  </div>
                </div>
                <ResourceStatusBadge tone={statusTone(vehicle.status)}>
                  {statusLabel(vehicle.status)}
                </ResourceStatusBadge>
              </div>
            </Card>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Đơn vị và loại xe */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Đơn vị & Loại xe
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>Nhà xe vận hành</dt>
                      <dd className="font-medium text-foreground">
                        {vehicle.busCompany.name}
                      </dd>
                    </div>
                    <div>
                      <dt>Mã định danh nhà xe</dt>
                      <dd className="admin-data-mono font-medium">
                        {vehicle.busCompany.code}
                      </dd>
                    </div>
                    <div>
                      <dt>Phân loại phương tiện</dt>
                      <dd className="font-medium text-foreground">
                        {vehicle.vehicleType.name}
                      </dd>
                    </div>
                    <div>
                      <dt>Mô tả quy cách loại xe</dt>
                      <dd className="text-muted-foreground">
                        {vehicle.vehicleType.description || 'Chưa có mô tả'}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Sơ đồ ghế & Cấu hình */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Armchair className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Bố trí sơ đồ ghế
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  <CardDescription className="text-xs">
                    Xem và tinh chỉnh ma trận ghế ngồi, vị trí hàng ghế và tầng xe phục vụ xếp chỗ khách hàng.
                  </CardDescription>
                  {canConfigureSeats ? (
                    <Button
                      className="w-full"
                      nativeButton={false}
                      render={<Link href={`/vehicles/${vehicle.vehicleId}/seats`} />}
                      variant="outline"
                    >
                      <Armchair aria-hidden="true" />
                      Mở sơ đồ ghế chi tiết
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Bạn không có quyền quản lý sơ đồ ghế xe này.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Card 3: Thông tin hồ sơ & Thời gian */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Thông tin hồ sơ
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Ngày tạo hồ sơ
                      </dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {timestampFormat(vehicle.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Cập nhật lần cuối
                      </dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {timestampFormat(vehicle.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Dialogs */}
        {editDialogOpen && canUpdate && vehicle && (
          <VehicleFormDialog
            busCompanies={options.busCompanies}
            onClose={() => setEditDialogOpen(false)}
            onRetryOptions={options.retry}
            onSaved={handleVehicleSaved}
            vehicle={vehicle}
            vehicleTypes={options.vehicleTypes}
          />
        )}

        {statusDialogOpen && canUpdate && vehicle && nextStatus && (
          <ResourceConfirmation
            busy={statusSubmitting}
            onClose={() => setStatusDialogOpen(false)}
            title={
              nextStatus === 'BAO_TRI'
                ? 'Chuyển xe sang bảo trì?'
                : 'Đưa xe vào hoạt động?'
            }
            description={
              nextStatus === 'BAO_TRI'
                ? 'Xe sẽ được chuyển sang trạng thái Bảo trì. Thao tác này không xóa dữ liệu và có thể đưa xe hoạt động lại sau.'
                : 'Xe sẽ được chuyển sang trạng thái Đang hoạt động.'
            }
          >
            <Button
              aria-busy={statusSubmitting}
              disabled={statusSubmitting}
              onClick={confirmStatusChange}
            >
              {statusSubmitting && (
                <LoaderCircle
                  aria-hidden
                  className="motion-safe:animate-spin"
                />
              )}
              {statusSubmitting
                ? 'Đang cập nhật…'
                : nextStatus === 'BAO_TRI'
                  ? 'Chuyển sang bảo trì'
                  : 'Đưa vào hoạt động'}
            </Button>
          </ResourceConfirmation>
        )}

        {deleteDialogOpen && canDelete && vehicle && (
          <ResourceConfirmation
            busy={deleteSubmitting}
            onClose={() => setDeleteDialogOpen(false)}
            title={`Xóa xe ${vehicle.licensePlate}?`}
            description="Xe cùng sơ đồ ghế sẽ bị xóa vĩnh viễn. Chỉ xe chưa từng gắn với chuyến nào mới xóa được; xe đã có chuyến, kể cả chuyến đã hủy, sẽ được giữ lại."
          >
            <Button
              aria-busy={deleteSubmitting}
              disabled={deleteSubmitting}
              onClick={confirmVehicleDelete}
              variant="destructive"
            >
              {deleteSubmitting ? (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              ) : (
                <Trash2 aria-hidden />
              )}
              {deleteSubmitting ? 'Đang xóa…' : 'Xóa xe'}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
