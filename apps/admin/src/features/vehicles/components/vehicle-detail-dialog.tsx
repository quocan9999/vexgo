'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getVehicleById } from '../services/vehicle-service';
import {
  VEHICLE_STATUS_OPTIONS,
  type Vehicle,
  type VehicleStatus,
} from '../types/vehicle';

type VehicleDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; vehicle: Vehicle };

function timestampFormat(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(status: VehicleStatus) {
  return (
    VEHICLE_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    'Không xác định'
  );
}

function requestErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.';
  }
  return error instanceof Error ? error.message : 'Không thể tải thông tin xe.';
}

export function VehicleDetailDialog({
  vehicleId,
  onClose,
}: {
  vehicleId: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<VehicleDetailState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getVehicleById(vehicleId, controller.signal)
      .then((vehicle) => {
        if (!controller.signal.aborted) {
          setState({ status: 'success', vehicle });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', message: requestErrorMessage(error) });
        }
      });

    return () => controller.abort();
  }, [vehicleId, retryCount]);

  function closeDialog() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else onClose();
  }

  function retry() {
    setState({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  return (
    <dialog
      aria-describedby="vehicle-detail-description"
      aria-labelledby="vehicle-detail-title"
      aria-modal="true"
      className="vehicle-detail-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="vehicle-detail-dialog-content">
        <div className="vehicle-detail-dialog-heading">
          <div>
            <p className="vehicles-eyebrow">QUẢN LÝ PHƯƠNG TIỆN</p>
            <h2 id="vehicle-detail-title">Chi tiết xe</h2>
          </div>
          <button
            aria-label="Đóng chi tiết xe"
            className="vehicles-icon-button"
            onClick={closeDialog}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </div>
        <p
          className="vehicle-detail-description"
          id="vehicle-detail-description"
        >
          Thông tin xe được tải trực tiếp từ hệ thống.
        </p>

        {state.status === 'loading' && (
          <div className="vehicle-detail-state" role="status">
            <LoaderCircle
              aria-hidden="true"
              className="vehicles-spinner"
              size={19}
            />
            Đang tải thông tin xe…
          </div>
        )}

        {state.status === 'error' && (
          <div className="vehicle-detail-error" role="alert">
            <strong>Chưa tải được thông tin xe</strong>
            <p>{state.message}</p>
            <button className="vehicles-button" onClick={retry} type="button">
              Thử lại
            </button>
          </div>
        )}

        {state.status === 'success' && (
          <div className="vehicle-detail-body">
            <div className="vehicle-detail-title-row">
              <span
                className={`vehicle-status-badge${state.vehicle.status === 'HOAT_DONG' ? ' is-active' : ' is-maintenance'}`}
              >
                {statusLabel(state.vehicle.status)}
              </span>
              <h3>{state.vehicle.licensePlate}</h3>
            </div>
            <dl className="vehicle-detail-fields">
              <div>
                <dt>Nhà xe</dt>
                <dd>{state.vehicle.busCompany.name}</dd>
              </div>
              <div>
                <dt>Mã nhà xe</dt>
                <dd>{state.vehicle.busCompany.code}</dd>
              </div>
              <div>
                <dt>Loại xe</dt>
                <dd>{state.vehicle.vehicleType.name}</dd>
              </div>
              <div>
                <dt>Mô tả loại xe</dt>
                <dd>
                  {state.vehicle.vehicleType.description || 'Chưa có mô tả'}
                </dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>{timestampFormat(state.vehicle.createdAt)}</dd>
              </div>
              <div>
                <dt>Cập nhật lần cuối</dt>
                <dd>{timestampFormat(state.vehicle.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </dialog>
  );
}
