'use client';

import {
  Armchair,
  ArrowLeft,
  BusFront,
  Layers3,
  List,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  ResourceConfirmation,
  ResourceNotice,
  ResourceSheet,
  ResourceState,
} from '@/components/admin/resource-ui';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/action-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  createVehicleSeat,
  deleteVehicleSeat,
  getVehicleById,
  getVehicleSeats,
  updateVehicleSeat,
  VehicleApiError,
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

type SeatView = 'list' | 'groups';

function requestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.';
  }
  return error instanceof Error ? error.message : fallback;
}

function VehicleSeatFormDialog({
  vehicleId,
  seat,
  onClose,
  onSaved,
}: {
  vehicleId: number;
  seat?: VehicleSeat;
  onClose: () => void;
  onSaved: (action: 'created' | 'updated') => Promise<void>;
}) {
  const editing = seat !== undefined;
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [seatNumber, setSeatNumber] = useState(seat?.seatNumber ?? '');
  const [position, setPosition] = useState(seat?.position ?? '');
  const [seatNumberError, setSeatNumberError] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idPrefix = editing
    ? `edit-vehicle-seat-${seat.seatId}`
    : 'create-vehicle-seat';

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
      ? 'Vui lòng nhập số ghế.'
      : cleanSeatNumber.length > 10
        ? 'Số ghế không được vượt quá 10 ký tự.'
        : null;
    const nextPositionError = cleanPosition.length > 50
      ? 'Vị trí không được vượt quá 50 ký tự.'
      : null;
    setSeatNumberError(nextSeatNumberError);
    setPositionError(nextPositionError);

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
      if (seat) await updateVehicleSeat(vehicleId, seat.seatId, input);
      else await createVehicleSeat(vehicleId, input);
      await onSaved(editing ? 'updated' : 'created');
    } catch (error: unknown) {
      if (
        error instanceof VehicleApiError &&
        error.code === 'VEHICLE_SEAT_NUMBER_EXISTS'
      ) {
        setSeatNumberError(error.message);
        focusFirstInvalid();
      } else {
        toast.error(requestErrorMessage(error, 'Không thể lưu thông tin ghế.'));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ResourceSheet
      busy={submitting}
      description={
        editing
          ? 'Cập nhật số ghế và nhóm vị trí đã lưu cho xe.'
          : 'Thêm số ghế và nhóm vị trí đã lưu cho xe.'
      }
      onClose={closeDialog}
      preventDismiss={submitting}
      title={editing ? 'Chỉnh sửa ghế' : 'Thêm ghế'}
    >
      <form
        ref={formRef}
        className="flex min-h-full flex-col gap-5"
        noValidate
        onSubmit={submit}
      >
        <Field data-invalid={Boolean(seatNumberError)}>
          <FieldLabel htmlFor={`${idPrefix}-number`}>
            Số ghế <span aria-hidden="true">*</span>
          </FieldLabel>
          <Input
            autoComplete="off"
            autoFocus
            aria-describedby={
              seatNumberError ? `${idPrefix}-number-error` : undefined
            }
            aria-invalid={Boolean(seatNumberError)}
            disabled={submitting}
            id={`${idPrefix}-number`}
            maxLength={10}
            onChange={(event) => {
              setSeatNumber(event.target.value);
              setSeatNumberError(null);
            }}
            required
            value={seatNumber}
          />
          <FieldError id={`${idPrefix}-number-error`}>
            {seatNumberError}
          </FieldError>
        </Field>
        <Field data-invalid={Boolean(positionError)}>
          <FieldLabel htmlFor={`${idPrefix}-position`}>Nhóm vị trí</FieldLabel>
          <Input
            autoComplete="off"
            aria-describedby={
              positionError ? `${idPrefix}-position-error` : undefined
            }
            aria-invalid={Boolean(positionError)}
            disabled={submitting}
            id={`${idPrefix}-position`}
            maxLength={50}
            onChange={(event) => {
              setPosition(event.target.value);
              setPositionError(null);
            }}
            placeholder="Ví dụ: Tầng dưới, Dãy trái"
            value={position}
          />
          <FieldError id={`${idPrefix}-position-error`}>
            {positionError}
          </FieldError>
        </Field>
        <p className="m-0 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          Nhóm vị trí chỉ dùng để phân loại danh sách. Xe chưa lưu sơ đồ hàng và
          cột ghế.
        </p>
        <div className="sticky bottom-0 mt-auto flex justify-end gap-2 border-t bg-background/95 px-4 py-4 sm:px-6">
          <Button
            disabled={submitting}
            onClick={closeDialog}
            type="button"
            variant="outline"
          >
            Hủy
          </Button>
          <Button disabled={submitting} type="submit">
            {submitting && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {submitting ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm ghế'}
          </Button>
        </div>
      </form>
    </ResourceSheet>
  );
}

function SeatActions({
  seat,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  compact = false,
}: {
  seat: VehicleSeat;
  onEdit: (seat: VehicleSeat) => void;
  onDelete: (seat: VehicleSeat) => void;
  canEdit: boolean;
  canDelete: boolean;
  compact?: boolean;
}) {
  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {canEdit && (
        <Button
          aria-label={`Chỉnh sửa ghế ${seat.seatNumber}`}
          onClick={() => onEdit(seat)}
          size={compact ? 'icon-sm' : 'sm'}
          type="button"
          variant={compact ? 'ghost' : 'outline'}
        >
          <PencilLine aria-hidden="true" />
          {!compact && <span>Chỉnh sửa</span>}
        </Button>
      )}
      {canDelete && (
        <Button
          aria-label={`Xóa ghế ${seat.seatNumber}`}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(seat)}
          size={compact ? 'icon-sm' : 'sm'}
          type="button"
          variant={compact ? 'ghost' : 'outline'}
        >
          <Trash2 aria-hidden="true" />
          {!compact && <span>Xóa</span>}
        </Button>
      )}
    </div>
  );
}

function SeatListCard({
  seat,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  seat: VehicleSeat;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (seat: VehicleSeat) => void;
  onDelete: (seat: VehicleSeat) => void;
}) {
  return (
    <Card className="h-auto gap-0 py-0">
      <CardContent className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Armchair aria-hidden="true" size={19} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 break-all font-mono text-sm font-semibold text-foreground">
              {seat.seatNumber}
            </h3>
            <p className="mt-1 mb-0 break-words text-xs text-muted-foreground">
              {seat.position?.trim() || 'Chưa xác định vị trí'}
            </p>
          </div>
        </div>
        <SeatActions
          canDelete={canDelete}
          canEdit={canEdit}
          onDelete={onDelete}
          onEdit={onEdit}
          seat={seat}
        />
      </CardContent>
    </Card>
  );
}

function VehicleSummary({
  vehicle,
  seatCount,
  groupCount,
}: {
  vehicle: VehicleDetail;
  seatCount: number;
  groupCount: number;
}) {
  return (
    <section aria-label="Tóm tắt xe và cấu hình ghế" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card className="h-auto gap-0 border-primary/20 bg-primary/5 py-0">
        <CardContent className="flex min-h-28 items-start gap-4 p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <BusFront aria-hidden="true" size={19} />
          </span>
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Xe đang cấu hình</p>
            <p className="m-0 break-all font-mono text-lg font-semibold leading-snug text-foreground">
              {vehicle.licensePlate}
            </p>
            <p className="mt-1 mb-0 text-xs text-muted-foreground">
              Mã xe <span className="font-mono">#{vehicle.vehicleId}</span>
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
            <p className="mb-2 text-xs font-medium text-muted-foreground">Loại xe</p>
            <p className="m-0 break-words text-lg font-semibold leading-snug text-foreground">
              {vehicle.vehicleType.name}
            </p>
            <p className="mt-1 mb-0 text-xs text-muted-foreground">Danh mục phương tiện</p>
          </div>
        </CardContent>
      </Card>
      <Card className="h-auto gap-0 border-primary bg-primary py-0 text-primary-foreground sm:col-span-2 xl:col-span-1">
        <CardContent className="flex min-h-28 items-start gap-4 p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/15 text-white">
            <Armchair aria-hidden="true" size={19} />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-white/75">Tổng số ghế</p>
            <p className="m-0 text-3xl font-semibold leading-none text-white">
              {seatCount.toLocaleString('vi-VN')}
            </p>
            <p className="mt-2 mb-0 text-xs text-white/75">
              {groupCount.toLocaleString('vi-VN')} nhóm vị trí đã lưu
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function VehicleSeatsLoading() {
  return (
    <div aria-busy="true" aria-label="Đang tải cấu hình ghế xe" className="space-y-4" role="status">
      <span className="sr-only">Đang tải thông tin xe và danh sách ghế…</span>
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
  const { can } = useAdminPermissions();
  const canCreate = can('seat:create');
  const canUpdate = can('seat:update');
  const canDelete = can('seat:delete');
  const validVehicleId = Number.isSafeInteger(vehicleId) && vehicleId > 0;
  const [workspace, setWorkspace] = useState<WorkspaceState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const [view, setView] = useState<SeatView>('list');
  const [editingSeat, setEditingSeat] = useState<VehicleSeat | null>(null);
  const [creatingSeat, setCreatingSeat] = useState(false);
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
        if (current) setWorkspace({ status: 'success', vehicle, seats });
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setWorkspace({
            status: 'error',
            message: requestErrorMessage(error, 'Không thể tải cấu hình ghế.'),
          });
        }
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [refreshCount, retryCount, validVehicleId, vehicleId]);

  function retry() {
    setWorkspace({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  async function handleSeatSaved(action: 'created' | 'updated') {
    setCreatingSeat(false);
    setEditingSeat(null);
    toast.success(action === 'created' ? 'Đã thêm ghế.' : 'Đã cập nhật ghế.');
    setWorkspace({ status: 'loading' });
    setRefreshCount((count) => count + 1);
  }

  async function confirmDelete() {
    if (!canDelete || !deletingSeat || deleteSubmittingRef.current) return;
    deleteSubmittingRef.current = true;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteVehicleSeat(vehicleId, deletingSeat.seatId);
      setDeletingSeat(null);
      toast.success(`Đã xóa ghế ${deletingSeat.seatNumber}.`);
      setWorkspace({ status: 'loading' });
      setRefreshCount((count) => count + 1);
    } catch (error: unknown) {
      setDeleteError(requestErrorMessage(error, 'Không thể xóa ghế.'));
    } finally {
      deleteSubmittingRef.current = false;
      setDeleteSubmitting(false);
    }
  }

  const seatGroups =
    workspace.status === 'success'
      ? workspace.seats.reduce<Map<string, VehicleSeat[]>>((groups, seat) => {
          const groupName = seat.position?.trim() || 'Chưa xác định vị trí';
          const group = groups.get(groupName) ?? [];
          group.push(seat);
          groups.set(groupName, group);
          return groups;
        }, new Map())
      : new Map<string, VehicleSeat[]>();

  function renderSeatActions(seat: VehicleSeat, compact = false) {
    return (
      <SeatActions
        canDelete={canDelete}
        canEdit={canUpdate}
        compact={compact}
        onDelete={(selectedSeat) => {
          setDeleteError(null);
          setDeletingSeat(selectedSeat);
        }}
        onEdit={setEditingSeat}
        seat={seat}
      />
    );
  }

  return (
    <SuperAdminLayout activeSection="vehicles">
      <div className="admin-page-content admin-ui space-y-6 vehicle-seats-page">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                render={<Link href="/vehicles" />}
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                Danh sách xe
              </Button>
              {canCreate && (
                <Button
                  disabled={workspace.status !== 'success'}
                  onClick={() => setCreatingSeat(true)}
                >
                  <Plus aria-hidden="true" />
                  Thêm ghế
                </Button>
              )}
            </div>
          }
          eyebrow="QUẢN LÝ PHƯƠNG TIỆN"
          title="Cấu hình ghế xe"
          titleId="vehicle-seats-title"
        />

        {validVehicleId && workspace.status === 'loading' && <VehicleSeatsLoading />}
        {(!validVehicleId || workspace.status === 'error') && (
          <ResourceState error>
            <p>
              {validVehicleId && workspace.status === 'error'
                ? workspace.message
                : 'ID xe không hợp lệ.'}
            </p>
            {validVehicleId && (
              <Button onClick={retry} variant="outline">
                <RefreshCw aria-hidden="true" />
                Thử tải lại
              </Button>
            )}
          </ResourceState>
        )}

        {workspace.status === 'success' && (
          <>
            <VehicleSummary
              groupCount={seatGroups.size}
              seatCount={workspace.seats.length}
              vehicle={workspace.vehicle}
            />

            <Tabs
              className="min-w-0 gap-4"
              onValueChange={(value) => {
                if (value === 'list' || value === 'groups') setView(value);
              }}
              value={view}
            >
              {workspace.seats.length > 0 && (
                <TabsList
                  activateOnFocus
                  aria-label="Kiểu hiển thị danh sách ghế"
                  className="grid w-full grid-cols-2 sm:w-fit"
                >
                  <TabsTrigger value="list">
                    <List aria-hidden="true" />
                    Danh sách
                  </TabsTrigger>
                  <TabsTrigger value="groups">
                    <Layers3 aria-hidden="true" />
                    Nhóm vị trí
                  </TabsTrigger>
                </TabsList>
              )}

              <Card className="h-auto gap-0 py-0">
                <CardHeader className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">
                      Danh sách ghế của xe
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-xs leading-relaxed">
                      Nhóm theo trường vị trí đã lưu. Dữ liệu hiện tại không có
                      tọa độ hàng và cột ghế.
                    </CardDescription>
                  </div>
                  <Badge className="shrink-0" variant="outline">
                    {workspace.seats.length.toLocaleString('vi-VN')} ghế
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 sm:p-5">
                  {workspace.seats.length === 0 ? (
                    <div className="grid min-h-64 place-content-center justify-items-center gap-4 rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                      <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Armchair aria-hidden="true" size={22} />
                      </span>
                      <div className="space-y-1">
                        <h3 className="m-0 text-sm font-semibold text-foreground">
                          Chưa có ghế trong cấu hình xe
                        </h3>
                        <p className="m-0 max-w-sm text-xs leading-relaxed text-muted-foreground">
                          Thêm các ghế gốc để hệ thống có thể dùng chúng khi tạo
                          chuyến xe.
                        </p>
                      </div>
                      {canCreate && (
                        <Button onClick={() => setCreatingSeat(true)}>
                          <Plus aria-hidden="true" />
                          Thêm ghế đầu tiên
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <TabsContent className="min-w-0 space-y-2" value="list">
                        {workspace.seats.map((seat) => (
                          <SeatListCard
                            canDelete={canDelete}
                            canEdit={canUpdate}
                            key={seat.seatId}
                            onDelete={(selectedSeat) => {
                              setDeleteError(null);
                              setDeletingSeat(selectedSeat);
                            }}
                            onEdit={setEditingSeat}
                            seat={seat}
                          />
                        ))}
                      </TabsContent>
                      <TabsContent className="min-w-0 space-y-4" value="groups">
                        {[...seatGroups.entries()].map(([groupName, seats]) => (
                          <section
                            aria-label={`${groupName}, ${seats.length} ghế`}
                            className="rounded-xl border bg-muted/20 p-3 sm:p-4"
                            key={groupName}
                          >
                            <header className="mb-3 flex min-w-0 items-center justify-between gap-3">
                              <h3 className="m-0 break-words text-sm font-semibold text-foreground">
                                {groupName}
                              </h3>
                              <Badge className="shrink-0" variant="secondary">
                                {seats.length.toLocaleString('vi-VN')} ghế
                              </Badge>
                            </header>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                              {seats.map((seat) => (
                                <article
                                  className="flex min-w-0 items-center justify-between gap-1 rounded-lg border bg-card px-2 py-2 sm:px-3"
                                  key={seat.seatId}
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <Armchair
                                      aria-hidden="true"
                                      className="shrink-0 text-muted-foreground"
                                      size={15}
                                    />
                                    <strong className="min-w-0 break-all font-mono text-xs font-semibold text-foreground">
                                      {seat.seatNumber}
                                    </strong>
                                  </span>
                                  {renderSeatActions(seat, true)}
                                </article>
                              ))}
                            </div>
                          </section>
                        ))}
                      </TabsContent>
                    </>
                  )}
                </CardContent>
              </Card>
            </Tabs>
          </>
        )}
      </div>

      {workspace.status === 'success' && creatingSeat && canCreate && (
        <VehicleSeatFormDialog
          onClose={() => setCreatingSeat(false)}
          onSaved={handleSeatSaved}
          vehicleId={vehicleId}
        />
      )}
      {workspace.status === 'success' && editingSeat && canUpdate && (
        <VehicleSeatFormDialog
          onClose={() => setEditingSeat(null)}
          onSaved={handleSeatSaved}
          seat={editingSeat}
          vehicleId={vehicleId}
        />
      )}
      {deletingSeat && canDelete && (
        <ResourceConfirmation
          busy={deleteSubmitting}
          description="Ghế sẽ bị xóa khỏi cấu hình của xe. Chỉ xóa được khi ghế chưa được sử dụng trong chuyến xe."
          onClose={() => {
            if (!deleteSubmittingRef.current) {
              setDeletingSeat(null);
              setDeleteError(null);
            }
          }}
          title={`Xóa ghế ${deletingSeat.seatNumber}?`}
        >
          {deleteError && <ResourceNotice kind="error">{deleteError}</ResourceNotice>}
          <Button
            aria-busy={deleteSubmitting}
            disabled={deleteSubmitting}
            onClick={confirmDelete}
            variant="destructive"
          >
            {deleteSubmitting && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {deleteSubmitting ? 'Đang xóa…' : 'Xóa ghế'}
          </Button>
        </ResourceConfirmation>
      )}
    </SuperAdminLayout>
  );
}
