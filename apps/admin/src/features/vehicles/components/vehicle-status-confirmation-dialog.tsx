'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  updateVehicleStatus,
  VehicleApiError,
} from '../services/vehicle-service';
import type { Vehicle, VehicleStatus } from '../types/vehicle';

function requestErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.';
  }
  return error instanceof Error
    ? error.message
    : 'Không thể cập nhật trạng thái xe. Vui lòng thử lại.';
}

export function VehicleStatusConfirmationDialog({
  vehicle,
  onClose,
  onUpdated,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onUpdated: (vehicle: Vehicle) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetStatus: VehicleStatus =
    vehicle.status === 'HOAT_DONG' ? 'BAO_TRI' : 'HOAT_DONG';
  const isMovingToMaintenance = targetStatus === 'BAO_TRI';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
  }

  async function confirmStatusChange() {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const updatedVehicle = await updateVehicleStatus(
        vehicle.vehicleId,
        targetStatus,
      );
      onUpdated(updatedVehicle);
      dialogRef.current?.close();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof VehicleApiError
          ? requestError.message
          : requestErrorMessage(requestError),
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <dialog
      aria-describedby="vehicle-status-confirmation-description"
      aria-labelledby="vehicle-status-confirmation-title"
      aria-modal="true"
      className="vehicle-status-confirmation-dialog"
      onCancel={(event) => {
        if (submittingRef.current) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <section className="vehicle-status-confirmation-content">
        <div className="vehicle-form-heading">
          <div>
            <p className="vehicles-eyebrow">XÁC NHẬN THAY ĐỔI</p>
            <h2 id="vehicle-status-confirmation-title">
              {isMovingToMaintenance
                ? 'Chuyển xe sang bảo trì?'
                : 'Đưa xe vào hoạt động?'}
            </h2>
          </div>
          <button
            aria-label="Đóng xác nhận đổi trạng thái"
            className="vehicles-icon-button"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </div>

        <p
          className="vehicle-form-description"
          id="vehicle-status-confirmation-description"
        >
          {isMovingToMaintenance
            ? 'Xe sẽ được chuyển sang trạng thái Bảo trì. Thao tác này không xóa dữ liệu và có thể đưa xe hoạt động lại sau.'
            : 'Xe sẽ được chuyển sang trạng thái Đang hoạt động.'}
        </p>
        <p className="vehicle-status-confirmation-plate">
          Biển số xe: <strong>{vehicle.licensePlate}</strong>
        </p>

        {error && (
          <div className="vehicle-form-error" role="alert">
            {error}
          </div>
        )}

        <div className="vehicle-form-actions">
          <button
            className="vehicles-button"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
          >
            Hủy
          </button>
          <button
            className="vehicles-button vehicle-form-primary"
            disabled={submitting}
            onClick={confirmStatusChange}
            type="button"
          >
            {submitting && (
              <LoaderCircle
                aria-hidden="true"
                className="vehicles-spinner"
                size={16}
              />
            )}
            {submitting ? 'Đang cập nhật…' : 'Xác nhận'}
          </button>
        </div>
      </section>
    </dialog>
  );
}
