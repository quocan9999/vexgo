'use client';

import { useTranslations } from 'next-intl';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceState,
  ResourceConfirmation,
  ResourceStatusBadge,
  ResourceRefreshAction,
} from '@/components/admin/resource-ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/action-button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useVehicleFilterOptions } from '../hooks/use-vehicle-filter-options';
import {
  deleteVehicle,
  getVehicleById,
  updateVehicleStatus,
} from '../services/vehicle-service';
import type { VehicleDetail, VehicleStatus } from '../types/vehicle';
import { VehicleFormDialog } from './vehicle-form-dialog';

type VehicleWorkspaceProps = {
  vehicleId: number;
};

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; vehicle: VehicleDetail };

function statusTone(status: VehicleStatus) {
  return status === 'HOAT_DONG' ? 'active' : 'muted';
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
  const tVehicles = useTranslations('vehicles');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { can } = useAdminPermissions();

  const canUpdate = can('vehicle:update');
  const canDelete = can('vehicle:delete');
  const canConfigureSeats = can('vehicle:read') && can('seat:read');

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

  function getStatusLabel(status: VehicleStatus) {
    return status === 'HOAT_DONG'
      ? tVehicles('statusActive')
      : tVehicles('statusMaintenance');
  }

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
                ? tVehicles('networkError')
                : error instanceof Error
                  ? error.message
                  : tVehicles('loadDetailsError'),
          });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [retryCount, vehicleId, tVehicles]);

  function retry() {
    setDetailState({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  function handleVehicleSaved(vehicle: VehicleDetail) {
    setDetailState({ status: 'success', vehicle });
    setEditDialogOpen(false);
    toast.success(tVehicles('updateVehicleSuccess'));
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
          ? tVehicles('statusChangedToMaintenance')
          : tVehicles('statusChangedToActive'),
      );
    } catch (requestError: unknown) {
      toast.error(
        requestError instanceof TypeError
          ? tVehicles('networkError')
          : requestError instanceof Error
            ? requestError.message
            : tVehicles('saveError'),
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
      toast.success(tVehicles('deleteVehicleSuccess'));
      router.push('/vehicles');
    } catch (requestError: unknown) {
      toast.error(
        requestError instanceof TypeError
          ? tVehicles('networkError')
          : requestError instanceof Error
            ? requestError.message
            : tVehicles('deleteError'),
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
        { label: tVehicles('vehiclesTitle'), href: '/vehicles' },
        { label: vehicle ? vehicle.licensePlate : tVehicles('vehicleDetails') },
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
                {tVehicles('backToVehicles')}
              </Button>
              {canConfigureSeats && vehicle && (
                <Button
                  nativeButton={false}
                  render={<Link href={`/vehicles/${vehicle.vehicleId}/seats`} />}
                  variant="outline"
                >
                  <Armchair aria-hidden="true" />
                  {tVehicles('manageSeats')}
                </Button>
              )}
              {canUpdate && vehicle && nextStatus && (
                <Button
                  onClick={() => setStatusDialogOpen(true)}
                  variant="outline"
                >
                  {vehicle.status === 'HOAT_DONG'
                    ? tVehicles('switchToMaintenance')
                    : tVehicles('switchToActive')}
                </Button>
              )}
              {canUpdate && vehicle && (
                <Button onClick={() => setEditDialogOpen(true)}>
                  <Pencil aria-hidden="true" />
                  {tCommon('edit')}
                </Button>
              )}
              {canDelete && vehicle && (
                <Button
                  onClick={() => setDeleteDialogOpen(true)}
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                  {tVehicles('deleteVehicle')}
                </Button>
              )}
              <ResourceRefreshAction
                loading={detailState.status === 'loading'}
                onClick={retry}
              />
            </div>
          }
          eyebrow={tVehicles('eyebrow')}
          title={
            vehicle
              ? tVehicles('vehicleDetailsTitle', { plate: vehicle.licensePlate })
              : tVehicles('vehicleDetails')
          }
          titleId="vehicle-workspace-title"
        />

        {detailState.status === 'loading' && (
          <ResourceState loading>{tVehicles('loadingDetails')}</ResourceState>
        )}

        {detailState.status === 'error' && (
          <ResourceState error>
            <p>{detailState.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={retry} variant="outline">
                {tCommon('retry')}
              </Button>
              <Button nativeButton={false} render={<Link href="/vehicles" />}>
                {tVehicles('backToVehicles')}
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
                      {tVehicles('vehicleCodeLabel')}:{' '}
                      <strong className="admin-data-mono">
                        #{vehicle.vehicleId}
                      </strong>
                    </p>
                  </div>
                </div>
                <ResourceStatusBadge tone={statusTone(vehicle.status)}>
                  {getStatusLabel(vehicle.status)}
                </ResourceStatusBadge>
              </div>
            </Card>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Operator and vehicle type */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tVehicles('operatorAndType')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>{tVehicles('colOperator')}</dt>
                      <dd className="font-medium text-foreground">
                        {vehicle.busCompany.name}
                      </dd>
                    </div>
                    <div>
                      <dt>{tVehicles('operatorCodeLabel')}</dt>
                      <dd className="admin-data-mono font-medium">
                        {vehicle.busCompany.code}
                      </dd>
                    </div>
                    <div>
                      <dt>{tVehicles('vehicleType')}</dt>
                      <dd className="font-medium text-foreground">
                        {vehicle.vehicleType.name}
                      </dd>
                    </div>
                    <div>
                      <dt>{tVehicles('typeDescriptionLabel')}</dt>
                      <dd className="text-muted-foreground">
                        {vehicle.vehicleType.description || tVehicles('noDescription')}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Seat layout and configuration */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Armchair className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tVehicles('visualSeatLayout')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  <CardDescription className="text-xs">
                    {tVehicles('visualSeatLayoutDesc')}
                  </CardDescription>
                  {canConfigureSeats ? (
                    <Button
                      className="w-full"
                      nativeButton={false}
                      render={<Link href={`/vehicles/${vehicle.vehicleId}/seats`} />}
                      variant="outline"
                    >
                      <Armchair aria-hidden="true" />
                      {tVehicles('manageSeats')}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {tVehicles('noSeatManagePermission')}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Card 3: Record and timeline info */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tVehicles('timelineInfo')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {tVehicles('createdAtLabel')}
                      </dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {timestampFormat(vehicle.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {tVehicles('updatedAtLabel')}
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
                ? tVehicles('confirmMaintenanceTitle')
                : tVehicles('confirmActiveTitle')
            }
            description={
              nextStatus === 'BAO_TRI'
                ? tVehicles('confirmMaintenanceDesc')
                : tVehicles('confirmActiveDesc')
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
                ? tVehicles('updatingStatus')
                : nextStatus === 'BAO_TRI'
                  ? tVehicles('switchToMaintenance')
                  : tVehicles('switchToActive')}
            </Button>
          </ResourceConfirmation>
        )}

        {deleteDialogOpen && canDelete && vehicle && (
          <ResourceConfirmation
            busy={deleteSubmitting}
            onClose={() => setDeleteDialogOpen(false)}
            title={tVehicles('deleteVehicleConfirmTitle', { plate: vehicle.licensePlate })}
            description={tVehicles('deleteVehicleConfirmDesc')}
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
              {deleteSubmitting ? tVehicles('deletingVehicle') : tVehicles('deleteVehicle')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
