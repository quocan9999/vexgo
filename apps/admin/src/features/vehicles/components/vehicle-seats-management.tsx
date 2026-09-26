'use client';

import { CheckCircle2, LoaderCircle, Plus, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
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
import '../vehicles.css';

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [seatNumber, setSeatNumber] = useState(seat?.seatNumber ?? '');
  const [position, setPosition] = useState(seat?.position ?? '');
  const [seatNumberError, setSeatNumberError] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idPrefix = editing ? `edit-vehicle-seat-${seat.seatId}` : 'create-vehicle-seat';

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const cleanSeatNumber = seatNumber.trim();
    const cleanPosition = position.trim();
    if (!cleanSeatNumber) {
      setSeatNumberError('Vui lòng nhập số ghế.');
      return;
    }
    if (cleanSeatNumber.length > 10) {
      setSeatNumberError('Số ghế không được vượt quá 10 ký tự.');
      return;
    }
    if (cleanPosition.length > 50) {
      setPositionError('Vị trí không được vượt quá 50 ký tự.');
      return;
    }

    const input: VehicleSeatInput = {
      seatNumber: cleanSeatNumber,
      position: cleanPosition || null,
    };
    submittingRef.current = true;
    setSubmitting(true);
    setSeatNumberError(null);
    setPositionError(null);
    setFormError(null);
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
      } else {
        setFormError(requestErrorMessage(error, 'Không thể lưu thông tin ghế.'));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AdminFormDialog
      ariaBusy={submitting}
      ariaDescribedBy={`${idPrefix}-description`}
      ariaLabelledBy={`${idPrefix}-title`}
      dialogRef={dialogRef}
      onClose={onClose}
      preventDismiss={submitting}
    >
      <>
        <div className="admin-dialog-header">
          <div className="admin-dialog-header__copy">
            <p className="eyebrow">CẤU HÌNH XE</p>
            <h2 id={`${idPrefix}-title`}>{editing ? 'Chỉnh sửa ghế' : 'Thêm ghế'}</h2>
            <p id={`${idPrefix}-description`}>
              Lưu số ghế và nhóm vị trí theo thông tin của xe.
            </p>
          </div>
          <Button
            aria-label="Đóng biểu mẫu ghế"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
            variant="secondary"
          >
            <X aria-hidden="true" size={17} />
          </Button>
        </div>
        <form className="vehicle-seat-form" onSubmit={submit}>
          <label className="vehicle-seat-field" htmlFor={`${idPrefix}-number`}>
            Số ghế <span aria-hidden="true">*</span>
            <input
              aria-describedby={seatNumberError ? `${idPrefix}-number-error` : undefined}
              aria-invalid={seatNumberError ? true : undefined}
              autoFocus
              id={`${idPrefix}-number`}
              maxLength={10}
              onChange={(event) => {
                setSeatNumber(event.target.value);
                setSeatNumberError(null);
              }}
              required
              value={seatNumber}
            />
            {seatNumberError && (
              <span className="vehicle-seat-field-error" id={`${idPrefix}-number-error`}>
                {seatNumberError}
              </span>
            )}
          </label>
          <label className="vehicle-seat-field" htmlFor={`${idPrefix}-position`}>
            Vị trí
            <input
              aria-describedby={positionError ? `${idPrefix}-position-error` : undefined}
              aria-invalid={positionError ? true : undefined}
              id={`${idPrefix}-position`}
              maxLength={50}
              onChange={(event) => {
                setPosition(event.target.value);
                setPositionError(null);
                setFormError(null);
              }}
              placeholder="Ví dụ: Tầng dưới, Dãy trái"
              value={position}
            />
            {positionError && (
              <span className="vehicle-seat-field-error" id={`${idPrefix}-position-error`}>
                {positionError}
              </span>
            )}
          </label>
          {formError && <p className="vehicle-seat-form-error" role="alert">{formError}</p>}
          <div className="vehicle-seat-form-actions">
            <Button disabled={submitting} onClick={closeDialog} type="button" variant="secondary">
              Hủy
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting && <LoaderCircle aria-hidden="true" className="vehicles-spinner" size={15} />}
              {submitting ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm ghế'}
            </Button>
          </div>
        </form>
      </>
    </AdminFormDialog>
  );
}

function SeatActions({
  seat,
  onEdit,
  onDelete,
}: {
  seat: VehicleSeat;
  onEdit: (seat: VehicleSeat) => void;
  onDelete: (seat: VehicleSeat) => void;
}) {
  return (
    <div className="vehicle-seat-actions">
      <Button
        aria-label={`Chỉnh sửa ghế ${seat.seatNumber}`}
        onClick={() => onEdit(seat)}
        type="button"
        variant="secondary"
      >
        Chỉnh sửa
      </Button>
      <Button
        aria-label={`Xóa ghế ${seat.seatNumber}`}
        onClick={() => onDelete(seat)}
        type="button"
        variant="secondary"
      >
        Xóa
      </Button>
    </div>
  );
}

export function VehicleSeatsManagement({ vehicleId }: { vehicleId: number }) {
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
  const [notice, setNotice] = useState<string | null>(null);

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
    setNotice(action === 'created' ? 'Đã thêm ghế.' : 'Đã cập nhật ghế.');
    setWorkspace({ status: 'loading' });
    setRefreshCount((count) => count + 1);
  }

  async function confirmDelete() {
    if (!deletingSeat || deleteSubmittingRef.current) return;
    deleteSubmittingRef.current = true;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteVehicleSeat(vehicleId, deletingSeat.seatId);
      setDeletingSeat(null);
      setNotice(`Đã xóa ghế ${deletingSeat.seatNumber}.`);
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

  function renderSeatActions(seat: VehicleSeat) {
    return (
      <SeatActions
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
      <div className="admin-page-content vehicle-seats-page">
        <AdminPageHeader
          actions={
            <div className="vehicle-seats-header-actions">
              <Link className="button button-secondary" href="/vehicles">
                Quay lại danh sách xe
              </Link>
              <Button
                disabled={workspace.status !== 'success'}
                onClick={() => setCreatingSeat(true)}
                type="button"
              >
                <Plus aria-hidden="true" size={16} />
                Thêm ghế
              </Button>
            </div>
          }
          eyebrow="QUẢN LÝ PHƯƠNG TIỆN"
          title="Cấu hình ghế"
          titleId="vehicle-seats-title"
        />

        {notice && (
          <div className="vehicles-success-notice vehicle-seats-notice" role="status">
            <CheckCircle2 aria-hidden="true" size={16} />
            <span>{notice}</span>
          </div>
        )}

        {validVehicleId && workspace.status === 'loading' && (
          <section className="vehicle-seats-state" role="status">
            <LoaderCircle aria-hidden="true" className="vehicles-spinner" size={18} />
            Đang tải thông tin xe và danh sách ghế…
          </section>
        )}
        {(!validVehicleId || workspace.status === 'error') && (
          <section className="vehicle-seats-state" role="alert">
            <p>{validVehicleId && workspace.status === 'error' ? workspace.message : 'ID xe không hợp lệ.'}</p>
            {validVehicleId && (
              <Button onClick={retry} type="button" variant="secondary">
                <RefreshCw aria-hidden="true" size={15} />
                Thử lại
              </Button>
            )}
          </section>
        )}

        {workspace.status === 'success' && (
          <>
            <section aria-label="Thông tin xe" className="vehicle-seats-context">
              <div>
                <span>Biển số xe</span>
                <strong>{workspace.vehicle.licensePlate}</strong>
              </div>
              <div>
                <span>Loại xe</span>
                <strong>{workspace.vehicle.vehicleType.name}</strong>
              </div>
              <div>
                <span>Tổng số ghế</span>
                <strong>{workspace.seats.length}</strong>
              </div>
            </section>

            <section aria-labelledby="vehicle-seat-configuration-heading" className="vehicle-seats-panel">
              <div className="vehicle-seats-panel-header">
                <div>
                  <h2 id="vehicle-seat-configuration-heading">Ghế gốc của xe</h2>
                  <p>Nhóm trực quan dựa trên trường vị trí đã lưu, không thể hiện tọa độ hàng hoặc cột.</p>
                </div>
                <div aria-label="Kiểu hiển thị ghế" className="vehicle-seat-view-toggle" role="group">
                  <Button
                    aria-pressed={view === 'list'}
                    onClick={() => setView('list')}
                    type="button"
                    variant={view === 'list' ? 'primary' : 'secondary'}
                  >
                    Danh sách
                  </Button>
                  <Button
                    aria-pressed={view === 'groups'}
                    onClick={() => setView('groups')}
                    type="button"
                    variant={view === 'groups' ? 'primary' : 'secondary'}
                  >
                    Nhóm vị trí
                  </Button>
                </div>
              </div>

              {workspace.seats.length === 0 ? (
                <div className="vehicle-seats-empty">
                  <p>Xe này chưa được cấu hình ghế.</p>
                  <Button onClick={() => setCreatingSeat(true)} type="button">
                    <Plus aria-hidden="true" size={16} />
                    Thêm ghế đầu tiên
                  </Button>
                </div>
              ) : view === 'list' ? (
                <div className="vehicle-seat-list">
                  {workspace.seats.map((seat) => (
                    <article className="vehicle-seat-row" key={seat.seatId}>
                      <div className="vehicle-seat-row-info">
                        <h3>{seat.seatNumber}</h3>
                        <p>{seat.position?.trim() || 'Chưa xác định vị trí'}</p>
                      </div>
                      {renderSeatActions(seat)}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="vehicle-seat-groups">
                  {[...seatGroups.entries()].map(([groupName, seats]) => (
                    <section aria-label={groupName} className="vehicle-seat-group" key={groupName}>
                      <h3>{groupName}</h3>
                      <div className="vehicle-seat-tiles">
                        {seats.map((seat) => (
                          <article className="vehicle-seat-tile" key={seat.seatId}>
                            <strong>{seat.seatNumber}</strong>
                            {renderSeatActions(seat)}
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {workspace.status === 'success' && creatingSeat && (
        <VehicleSeatFormDialog
          onClose={() => setCreatingSeat(false)}
          onSaved={handleSeatSaved}
          vehicleId={vehicleId}
        />
      )}
      {workspace.status === 'success' && editingSeat && (
        <VehicleSeatFormDialog
          onClose={() => setEditingSeat(null)}
          onSaved={handleSeatSaved}
          seat={editingSeat}
          vehicleId={vehicleId}
        />
      )}
      {deletingSeat && (
        <AdminConfirmDialog
          ariaBusy={deleteSubmitting}
          ariaDescribedBy="vehicle-seat-delete-description"
          ariaLabelledBy="vehicle-seat-delete-title"
          onClose={() => {
            if (!deleteSubmittingRef.current) setDeletingSeat(null);
          }}
          preventDismiss={deleteSubmitting}
        >
          <>
            <h2 id="vehicle-seat-delete-title">Xóa ghế {deletingSeat.seatNumber}?</h2>
            <p id="vehicle-seat-delete-description">
              Ghế sẽ bị xóa khỏi cấu hình của xe. Chỉ xóa được khi ghế chưa được sử dụng trong chuyến xe.
            </p>
            {deleteError && <p className="admin-confirm-dialog__error" role="alert">{deleteError}</p>}
            <div className="admin-confirm-dialog__actions">
              <Button
                disabled={deleteSubmitting}
                onClick={() => setDeletingSeat(null)}
                type="button"
                variant="secondary"
              >
                Hủy
              </Button>
              <Button disabled={deleteSubmitting} onClick={confirmDelete} type="button">
                {deleteSubmitting && <LoaderCircle aria-hidden="true" className="vehicles-spinner" size={15} />}
                {deleteSubmitting ? 'Đang xóa…' : 'Xóa ghế'}
              </Button>
            </div>
          </>
        </AdminConfirmDialog>
      )}
    </SuperAdminLayout>
  );
}
