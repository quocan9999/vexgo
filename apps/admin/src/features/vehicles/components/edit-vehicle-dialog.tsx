'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { BusCompany } from '@/features/bus-companies/types/bus-company';
import type { VehicleType } from '@/features/vehicle-types/types/vehicle-type';
import {
  updateVehicle,
  VehicleApiError,
  type VehicleApiErrorDetail,
} from '../services/vehicle-service';
import type { Vehicle } from '../types/vehicle';
import {
  VehicleFormFields,
  type VehicleFormErrors,
  type VehicleFormField,
  type VehicleFormValues,
} from './vehicle-form-fields';

function fieldErrorsFromDetails(details: VehicleApiErrorDetail[]) {
  const errors: VehicleFormErrors = {};

  for (const detail of details) {
    if (
      detail.field === 'licensePlate' ||
      detail.field === 'busCompanyId' ||
      detail.field === 'vehicleTypeId'
    ) {
      errors[detail.field] = detail.message;
    }
  }

  return errors;
}

function requestErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.';
  }
  return error instanceof Error
    ? error.message
    : 'Không thể cập nhật xe. Vui lòng thử lại.';
}

export function EditVehicleDialog({
  vehicle,
  busCompanies,
  vehicleTypes,
  optionsLoading,
  optionsError,
  onRetryOptions,
  onClose,
  onUpdated,
}: {
  vehicle: Vehicle;
  busCompanies: BusCompany[];
  vehicleTypes: VehicleType[];
  optionsLoading: boolean;
  optionsError: string | null;
  onRetryOptions: () => void;
  onClose: () => void;
  onUpdated: (vehicle: Vehicle) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<VehicleFormValues>(() => ({
    licensePlate: vehicle.licensePlate,
    busCompanyId: String(vehicle.busCompany.busCompanyId),
    vehicleTypeId: String(vehicle.vehicleType.vehicleTypeId),
  }));
  const [fieldErrors, setFieldErrors] = useState<VehicleFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
  }

  function updateField(field: VehicleFormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validate(): VehicleFormErrors {
    const errors: VehicleFormErrors = {};
    const licensePlate = values.licensePlate.trim();

    if (!licensePlate) errors.licensePlate = 'Vui lòng nhập biển số xe.';
    else if (licensePlate.length > 15) {
      errors.licensePlate = 'Biển số xe không được vượt quá 15 ký tự.';
    }

    if (!values.busCompanyId) errors.busCompanyId = 'Vui lòng chọn nhà xe.';
    if (!values.vehicleTypeId) errors.vehicleTypeId = 'Vui lòng chọn loại xe.';
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (
      optionsLoading ||
      optionsError ||
      !busCompanies.length ||
      !vehicleTypes.length
    ) {
      setFormError(
        'Cần tải được danh sách nhà xe và loại xe trước khi lưu thay đổi.',
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const updatedVehicle = await updateVehicle(vehicle.vehicleId, {
        licensePlate: values.licensePlate.trim(),
        busCompanyId: Number(values.busCompanyId),
        vehicleTypeId: Number(values.vehicleTypeId),
      });
      onUpdated(updatedVehicle);
    } catch (requestError: unknown) {
      if (requestError instanceof VehicleApiError) {
        if (requestError.code === 'VEHICLE_LICENSE_PLATE_EXISTS') {
          setFieldErrors({ licensePlate: requestError.message });
          setFormError(null);
        } else {
          const serverErrors = fieldErrorsFromDetails(requestError.details);
          setFieldErrors(serverErrors);
          setFormError(
            Object.keys(serverErrors).length > 0 ? null : requestError.message,
          );
        }
      } else {
        setFormError(requestErrorMessage(requestError));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const cannotSubmit =
    submitting ||
    optionsLoading ||
    Boolean(optionsError) ||
    !busCompanies.length ||
    !vehicleTypes.length;

  return (
    <dialog
      aria-describedby="edit-vehicle-description"
      aria-labelledby="edit-vehicle-title"
      className="vehicle-form-dialog"
      onCancel={(event) => {
        if (submittingRef.current) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <section className="vehicle-form-panel">
        <div className="vehicle-form-heading">
          <div>
            <p className="vehicles-eyebrow">HỒ SƠ XE</p>
            <h2 id="edit-vehicle-title">Chỉnh sửa xe</h2>
          </div>
          <button
            aria-label="Đóng biểu mẫu chỉnh sửa xe"
            className="vehicles-icon-button"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </div>

        <form className="vehicle-form" noValidate onSubmit={handleSubmit}>
          <p className="vehicle-form-description" id="edit-vehicle-description">
            Cập nhật biển số, nhà xe và loại xe. Trạng thái được quản lý riêng.
          </p>

          {optionsLoading && (
            <p className="vehicle-form-status" role="status">
              Đang tải lựa chọn nhà xe và loại xe…
            </p>
          )}
          {optionsError && (
            <div className="vehicle-form-error" role="alert">
              <p>{optionsError}</p>
              <button
                className="vehicles-button"
                onClick={onRetryOptions}
                type="button"
              >
                Tải lại lựa chọn
              </button>
            </div>
          )}
          {!optionsLoading &&
            !optionsError &&
            (!busCompanies.length || !vehicleTypes.length) && (
              <div className="vehicle-form-error" role="alert">
                Chưa có đủ nhà xe và loại xe để lưu thông tin này.
              </div>
            )}
          {formError && (
            <div className="vehicle-form-error" role="alert">
              {formError}
            </div>
          )}

          <VehicleFormFields
            busCompanies={busCompanies}
            errors={fieldErrors}
            idPrefix="edit-vehicle"
            onChange={updateField}
            showStatus={false}
            values={values}
            vehicleTypes={vehicleTypes}
          />

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
              disabled={cannotSubmit}
              type="submit"
            >
              {submitting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="vehicles-spinner"
                  size={16}
                />
              )}
              {submitting ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </section>
    </dialog>
  );
}
