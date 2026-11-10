'use client';

import { useTranslations } from 'next-intl';
import { Armchair, ArrowLeft, BusFront, Layers3, LoaderCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  ResourceConfirmation,
  ResourceNotice,
  ResourceModalDialog,
  ResourceState,
} from '@/components/admin/resource-ui';
import { ResourceModalForm } from '@/components/admin/resource-modal-form';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/action-button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { SeatLayoutEditor } from './seat-layout-editor';
import {
  normalizeVehicleSeatLayout,
  toVehicleSeatLayoutUpdate,
  type SeatLayoutItem,
} from './seat-layout-utils';
import {
  createVehicleSeat,
  deleteVehicleSeat,
  deleteVehicleSeatFloor,
  getVehicleById,
  getVehicleSeats,
  updateVehicleSeat,
  updateVehicleSeatLayout,
} from '../services/vehicle-service';
import type {
  VehicleDetail,
  VehicleSeat,
  VehicleSeatInput,
} from '../types/vehicle';

type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; vehicle: VehicleDetail; seats: VehicleSeat[] };

function VehicleSeatEditDialog({
  vehicleId,
  seat,
  onClose,
  onSaved,
}: {
  vehicleId: number;
  seat: VehicleSeat;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const tVehicles = useTranslations('vehicles');
  const tCommon = useTranslations('common');
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [seatNumber, setSeatNumber] = useState(seat.seatNumber);
  const [position, setPosition] = useState(seat.position ?? '');
  const [seatNumberError, setSeatNumberError] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idPrefix = 'edit-vehicle-seat-' + seat.seatId;

  function closeDialog() {
    if (!submittingRef.current) onClose();
  }

  function focusFirstInvalid() {
    requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus(),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const cleanSeatNumber = seatNumber.trim();
    const cleanPosition = position.trim();
    const nextSeatNumberError = !cleanSeatNumber
      ? tVehicles('errors.seatNumberRequired')
      : cleanSeatNumber.length > 10
        ? tVehicles('errors.seatNumberMaxLength')
        : null;
    const nextPositionError = cleanPosition.length > 50
      ? tVehicles('errors.positionMaxLength')
      : null;
    setSeatNumberError(nextSeatNumberError);
    setPositionError(nextPositionError);
    setFormError(null);

    if (nextSeatNumberError || nextPositionError) {
      focusFirstInvalid();
      return;
    }

    const input: VehicleSeatInput = {
      seatNumber: cleanSeatNumber,
      position: cleanPosition || null,
    };
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await updateVehicleSeat(vehicleId, seat.seatId, input);
      await onSaved();
    } catch (error: unknown) {
      setFormError(
        error instanceof TypeError
          ? tVehicles('networkError')
          : error instanceof Error
            ? error.message
            : tVehicles('updateSeatError'),
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ResourceModalDialog
      busy={submitting}
      description={tVehicles('editSeatDesc')}
      onClose={closeDialog}
      preventDismiss={submitting}
      title={`${tVehicles('editSeat')} ${seat.seatNumber}`}
      size="md"
    >
      <ResourceModalForm
        ref={formRef}
        noValidate
        onSubmit={submit}
        footer={
          <div className="-mx-5 -mb-5 flex shrink-0 justify-end gap-2 border-t bg-slate-50/80 dark:bg-slate-900/60 px-5 py-3.5 sm:-mx-6 sm:-mb-6 sm:px-6">
            <Button
              disabled={submitting}
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              {tCommon('cancel')}
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {submitting ? tVehicles('saving') : tCommon('saveChanges')}
            </Button>
          </div>
        }
      >
        <Field data-invalid={Boolean(seatNumberError)}>
          <FieldLabel htmlFor={idPrefix + '-number'}>
            {tVehicles('seatNumberLabel')} <span aria-hidden="true">*</span>
          </FieldLabel>
          <Input
            autoComplete="off"
            autoFocus
            aria-describedby={
              seatNumberError ? idPrefix + '-number-error' : undefined
            }
            aria-invalid={Boolean(seatNumberError)}
            disabled={submitting}
            id={idPrefix + '-number'}
            maxLength={10}
            onChange={(event) => {
              setSeatNumber(event.target.value);
              setSeatNumberError(null);
            }}
            required
            value={seatNumber}
          />
          <FieldError id={idPrefix + '-number-error'}>
            {seatNumberError}
          </FieldError>
        </Field>
        <Field data-invalid={Boolean(positionError)}>
          <FieldLabel htmlFor={idPrefix + '-position'}>
            {tVehicles('positionLabel')}
          </FieldLabel>
          <Input
            autoComplete="off"
            aria-describedby={
              positionError ? idPrefix + '-position-error' : undefined
            }
            aria-invalid={Boolean(positionError)}
            disabled={submitting}
            id={idPrefix + '-position'}
            maxLength={50}
            onChange={(event) => {
              setPosition(event.target.value);
              setPositionError(null);
            }}
            placeholder={tVehicles('positionPlaceholder')}
            value={position}
          />
          <FieldError id={idPrefix + '-position-error'}>
            {positionError}
          </FieldError>
        </Field>
        {formError && <ResourceNotice kind="error">{formError}</ResourceNotice>}
      </ResourceModalForm>
    </ResourceModalDialog>
  );
}

function VehicleSummary({
  vehicle,
  seatCount,
  floorCount,
}: {
  vehicle: VehicleDetail;
  seatCount: number;
  floorCount: number;
}) {
  const tVehicles = useTranslations('vehicles');

  return (
    <section aria-label={tVehicles('summaryAriaLabel')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card className="h-auto gap-0 border-primary/20 bg-primary/5 py-0">
        <CardContent className="flex min-h-28 items-start gap-4 p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <BusFront aria-hidden="true" size={19} />
          </span>
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{tVehicles('configuringVehicle')}</p>
            <p className="m-0 break-all font-mono text-lg font-semibold leading-snug text-foreground">
              {vehicle.licensePlate}
            </p>
            <p className="mt-1 mb-0 text-xs text-muted-foreground">
              {tVehicles('vehicleCodeLabel')} <span className="font-mono">#{vehicle.vehicleId}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="h-auto gap-0 py-0">
        <CardContent className="flex min-h-28 items-start gap-4 p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Layers3 aria-hidden="true" size={19} />
          </span>
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{tVehicles('vehicleType')}</p>
            <p className="m-0 break-words text-lg font-semibold leading-snug text-foreground">
              {vehicle.vehicleType.name}
            </p>
            <p className="mt-1 mb-0 text-xs text-muted-foreground">{tVehicles('vehicleCategoryLabel')}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="h-auto gap-0 border-primary bg-primary py-0 text-primary-foreground sm:col-span-2 xl:col-span-1">
        <CardContent className="flex min-h-28 items-start gap-4 p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/15 text-white">
            <Armchair aria-hidden="true" size={19} />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-white/75">{tVehicles('totalSeatsLabel')}</p>
            <p className="m-0 text-3xl font-semibold leading-none text-white">
              {seatCount.toLocaleString()}
            </p>
            <p className="mt-2 mb-0 text-xs text-white/75">
              {tVehicles('decksWithSeats', { count: floorCount })}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function VehicleSeatsLoading() {
  const tVehicles = useTranslations('vehicles');

  return (
    <div aria-busy="true" aria-label={tVehicles('loadingSeats')} className="space-y-4" role="status">
      <span className="sr-only">{tVehicles('loadingSeats')}</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card className="h-auto gap-3 py-4" key={index}>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="h-auto gap-4 py-5">
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton className="h-16" key={index} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function VehicleSeatsManagement({ vehicleId }: { vehicleId: number }) {
  const tVehicles = useTranslations('vehicles');
  const { can } = useAdminPermissions();
  const canCreate = can('seat:create');
  const canUpdate = can('seat:update');
  const canDelete = can('seat:delete');
  const validVehicleId = Number.isSafeInteger(vehicleId) && vehicleId > 0;
  const [workspace, setWorkspace] = useState<WorkspaceState>({ status: 'loading' });
  const [layoutDraft, setLayoutDraft] = useState<SeatLayoutItem[]>([]);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const [editingSeat, setEditingSeat] = useState<VehicleSeat | null>(null);
  const [deletingSeat, setDeletingSeat] = useState<VehicleSeat | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const deleteSubmittingRef = useRef(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!validVehicleId) return;
    const controller = new AbortController();
    let current = true;
    Promise.all([
      getVehicleById(vehicleId, controller.signal),
      getVehicleSeats(vehicleId, controller.signal),
    ])
      .then(([vehicle, seats]) => {
        if (current) {
          setWorkspace({ status: 'success', vehicle, seats });
          setLayoutDraft(normalizeVehicleSeatLayout(seats));
          setLayoutDirty(false);
          setLayoutError(null);
        }
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setWorkspace({
            status: 'error',
            message:
              error instanceof TypeError
                ? tVehicles('networkError')
                : error instanceof Error
                  ? error.message
                  : tVehicles('loadSeatsError'),
          });
        }
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [refreshCount, retryCount, validVehicleId, vehicleId, tVehicles]);

  function retry() {
    setWorkspace({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  async function handleSeatUpdated() {
    setEditingSeat(null);
    toast.success(tVehicles('updateSeatSuccess'));
    setWorkspace({ status: 'loading' });
    setRefreshCount((count) => count + 1);
  }

  async function addSeatToLayout(seat: SeatLayoutItem) {
    const savedSeat = await createVehicleSeat(vehicleId, {
      seatNumber: seat.seatNumber,
      position: seat.position,
      floor: seat.floor,
      x: seat.x,
      y: seat.y,
    });
    setWorkspace((current) =>
      current.status === 'success'
        ? { ...current, seats: [...current.seats, savedSeat] }
        : current,
    );
    return {
      seatId: savedSeat.seatId,
      seatNumber: savedSeat.seatNumber,
      position: savedSeat.position,
      floor: savedSeat.floor,
      x: savedSeat.x ?? seat.x,
      y: savedSeat.y ?? seat.y,
    };
  }

  async function saveSeatLayout() {
    if (!canUpdate || layoutSaving || !layoutDirty) return;
    setLayoutSaving(true);
    setLayoutError(null);
    try {
      const savedSeats = await updateVehicleSeatLayout(
        vehicleId,
        toVehicleSeatLayoutUpdate(layoutDraft),
      );
      setLayoutDraft(normalizeVehicleSeatLayout(savedSeats));
      setLayoutDirty(false);
      setWorkspace((current) =>
        current.status === 'success'
          ? { ...current, seats: savedSeats }
          : current,
      );
      toast.success(tVehicles('saveLayoutSuccess'));
    } catch (error: unknown) {
      const message =
        error instanceof TypeError
          ? tVehicles('networkError')
          : error instanceof Error
            ? error.message
            : tVehicles('saveLayoutError');
      setLayoutError(message);
      toast.error(message);
    } finally {
      setLayoutSaving(false);
    }
  }

  async function deleteUpperFloor() {
    if (!canDelete) throw new Error(tVehicles('noDeckDeletePermission'));
    try {
      const deletedSeatCount = await deleteVehicleSeatFloor(vehicleId, 2);
      setWorkspace((current) =>
        current.status === 'success'
          ? {
              ...current,
              seats: current.seats.filter((seat) => seat.floor !== 2),
            }
          : current,
      );
      setLayoutDraft((current) => current.filter((seat) => seat.floor !== 2));
      setLayoutDirty(false);
      setLayoutError(null);
      setRefreshCount((count) => count + 1);
      toast.success(
        deletedSeatCount > 0
          ? tVehicles('deletedUpperDeckWithSeats', { count: deletedSeatCount })
          : tVehicles('deletedUpperDeck'),
      );
    } catch (error: unknown) {
      const message =
        error instanceof TypeError
          ? tVehicles('networkError')
          : error instanceof Error
            ? error.message
            : tVehicles('cannotRemoveUpperDeck');
      toast.error(message);
      throw new Error(message);
    }
  }

  async function confirmDeleteSeat() {
    if (!canDelete || !deletingSeat || deleteSubmittingRef.current) return;
    deleteSubmittingRef.current = true;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteVehicleSeat(vehicleId, deletingSeat.seatId);
      setDeletingSeat(null);
      setWorkspace((current) =>
        current.status === 'success'
          ? {
              ...current,
              seats: current.seats.filter(
                (seat) => seat.seatId !== deletingSeat.seatId,
              ),
            }
          : current,
      );
      setLayoutDraft((current) =>
        current.filter((seat) => seat.seatId !== deletingSeat.seatId),
      );
      setLayoutDirty(false);
      setLayoutError(null);
      setRefreshCount((count) => count + 1);
      toast.success(tVehicles('deleteSeatSuccess', { seatNumber: deletingSeat.seatNumber }));
    } catch (error: unknown) {
      setDeleteError(
        error instanceof TypeError
          ? tVehicles('networkError')
          : error instanceof Error
            ? error.message
            : tVehicles('deleteSeatError'),
      );
    } finally {
      deleteSubmittingRef.current = false;
      setDeleteSubmitting(false);
    }
  }

  const floorCount =
    workspace.status === 'success'
      ? Math.max(1, new Set(workspace.seats.map((seat) => seat.floor)).size)
      : 1;

  return (
    <SuperAdminLayout
      activeSection="vehicles"
      breadcrumbs={[
        { label: tVehicles('vehiclesTitle'), href: '/vehicles' },
        { label: tVehicles('manageSeats') },
      ]}
    >
      <div className="admin-page-content admin-ui space-y-6 vehicle-seats-page">
        <AdminPageHeader
          actions={
            <Button
              nativeButton={false}
              render={<Link href="/vehicles" />}
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" />
              {tVehicles('backToVehicles')}
            </Button>
          }
          eyebrow={tVehicles('eyebrow')}
          title={tVehicles('manageSeats')}
          titleId="vehicle-seats-title"
        />

        {validVehicleId && workspace.status === 'loading' && <VehicleSeatsLoading />}
        {(!validVehicleId || workspace.status === 'error') && (
          <ResourceState error>
            <p>
              {validVehicleId && workspace.status === 'error'
                ? workspace.message
                : tVehicles('invalidVehicleId')}
            </p>
            {validVehicleId && (
              <Button onClick={retry} variant="outline">
                <RefreshCw aria-hidden="true" />
                {tVehicles('retryFilterOptions')}
              </Button>
            )}
          </ResourceState>
        )}

        {workspace.status === 'success' && (
          <>
            <VehicleSummary
              floorCount={floorCount}
              seatCount={workspace.seats.length}
              vehicle={workspace.vehicle}
            />

            <SeatLayoutEditor
              key={vehicleId}
              canAdd={canCreate}
              canEditSelected={canUpdate && !layoutDirty}
              canDeleteSelected={canDelete && !layoutDirty}
              deletingSeat={deleteSubmitting}
              disabled={!canUpdate}
              dirty={layoutDirty}
              error={layoutError}
              onAddSeat={canCreate ? addSeatToLayout : undefined}
              onChange={(nextSeats) => {
                setLayoutDraft(nextSeats);
                setLayoutDirty(true);
                setLayoutError(null);
              }}
              onDeleteUpperFloor={canDelete ? deleteUpperFloor : undefined}
              onRequestEditSeat={(selectedSeat) => {
                if (selectedSeat.seatId === undefined || !canUpdate) return;
                const persistedSeat = workspace.seats.find(
                  (seat) => seat.seatId === selectedSeat.seatId,
                );
                if (persistedSeat) setEditingSeat(persistedSeat);
              }}
              onRequestDeleteSeat={(selectedSeat) => {
                if (selectedSeat.seatId === undefined || !canDelete) return;
                const persistedSeat = workspace.seats.find(
                  (seat) => seat.seatId === selectedSeat.seatId,
                );
                if (!persistedSeat) return;
                setDeleteError(null);
                setDeletingSeat(persistedSeat);
              }}
              onSave={canUpdate ? () => void saveSeatLayout() : undefined}
              saving={layoutSaving}
              seats={layoutDraft}
            />

            {layoutDirty && (
              <ResourceNotice kind="info">
                {tVehicles('dirtyLayoutNotice')}
              </ResourceNotice>
            )}
          </>
        )}
      </div>

      {workspace.status === 'success' && editingSeat && canUpdate && (
        <VehicleSeatEditDialog
          onClose={() => setEditingSeat(null)}
          onSaved={handleSeatUpdated}
          seat={editingSeat}
          vehicleId={vehicleId}
        />
      )}
      {deletingSeat && canDelete && (
        <ResourceConfirmation
          busy={deleteSubmitting}
          description={tVehicles('deleteSeatConfirmDesc', { seatNumber: deletingSeat.seatNumber })}
          onClose={() => {
            if (!deleteSubmittingRef.current) {
              setDeletingSeat(null);
              setDeleteError(null);
            }
          }}
          title={tVehicles('deleteSeatConfirmTitle', { seatNumber: deletingSeat.seatNumber })}
        >
          {deleteError && <ResourceNotice kind="error">{deleteError}</ResourceNotice>}
          <Button
            aria-busy={deleteSubmitting}
            disabled={deleteSubmitting}
            onClick={() => void confirmDeleteSeat()}
            variant="destructive"
          >
            {deleteSubmitting && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {deleteSubmitting ? tVehicles('deletingSeat') : tVehicles('removeSeat')}
          </Button>
        </ResourceConfirmation>
      )}
    </SuperAdminLayout>
  );
}
