'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
import type { VehicleFilterOptionState } from '../hooks/use-vehicle-filter-options';
import {
  createVehicle,
  updateVehicle,
  VehicleApiError,
} from '../services/vehicle-service';
import {
  VEHICLE_STATUSES,
  type VehicleDetail,
  type VehicleStatus,
} from '../types/vehicle';

type VehicleFormDialogProps = {
  vehicle?: VehicleDetail;
  busCompanies: VehicleFilterOptionState;
  vehicleTypes: VehicleFilterOptionState;
  onRetryOptions: () => void;
  onClose: () => void;
  onSaved: (vehicle: VehicleDetail) => void;
};

type FormValues = {
  licensePlate: string;
  busCompanyId: string;
  vehicleTypeId: string;
  status: VehicleStatus;
};

type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField, string>>;

function optionText(state: VehicleFilterOptionState, resource: string) {
  if (state.status === 'loading') return `Đang tải ${resource}…`;
  if (state.status === 'error') return `Không tải được ${resource}`;
  return `Chọn ${resource}`;
}

export function VehicleFormDialog({
  vehicle,
  busCompanies,
  vehicleTypes,
  onRetryOptions,
  onClose,
  onSaved,
}: VehicleFormDialogProps) {
  const editing = vehicle !== undefined;
  const idPrefix = editing
    ? `edit-vehicle-${vehicle.vehicleId}`
    : 'create-vehicle';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>(() => ({
    licensePlate: vehicle?.licensePlate ?? '',
    busCompanyId: String(vehicle?.busCompany.busCompanyId ?? ''),
    vehicleTypeId: String(vehicle?.vehicleType.vehicleTypeId ?? ''),
    status: 'HOAT_DONG',
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const optionsReady =
    busCompanies.status === 'success' && vehicleTypes.status === 'success';
  const optionErrors = [
    busCompanies.status === 'error' ? `Nhà xe: ${busCompanies.message}` : null,
    vehicleTypes.status === 'error' ? `Loại xe: ${vehicleTypes.message}` : null,
  ].filter((message): message is string => message !== null);

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
  }

  function updateField<Field extends FormField>(
    field: Field,
    value: FormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const licensePlate = values.licensePlate.trim();
    const busCompanyId = Number(values.busCompanyId);
    const vehicleTypeId = Number(values.vehicleTypeId);

    if (!licensePlate) errors.licensePlate = 'Vui lòng nhập biển số xe.';
    else if (licensePlate.length > 15) {
      errors.licensePlate = 'Biển số xe không được vượt quá 15 ký tự.';
    }

    if (!Number.isSafeInteger(busCompanyId) || busCompanyId < 1) {
      errors.busCompanyId = 'Vui lòng chọn nhà xe.';
    }
    if (!Number.isSafeInteger(vehicleTypeId) || vehicleTypeId < 1) {
      errors.vehicleTypeId = 'Vui lòng chọn loại xe.';
    }
    if (!editing && !VEHICLE_STATUSES.includes(values.status)) {
      errors.status = 'Vui lòng chọn trạng thái xe.';
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    if (!optionsReady) {
      setFormError('Cần tải đủ Nhà xe và Loại xe trước khi lưu.');
      return;
    }

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const editableFields = {
        licensePlate: values.licensePlate.trim(),
        busCompanyId: Number(values.busCompanyId),
        vehicleTypeId: Number(values.vehicleTypeId),
      };
      const savedVehicle = editing
        ? await updateVehicle(vehicle.vehicleId, editableFields)
        : await createVehicle({ ...editableFields, status: values.status });
      dialogRef.current?.close();
      onSaved(savedVehicle);
    } catch (requestError: unknown) {
      if (
        requestError instanceof VehicleApiError &&
        requestError.code === 'VEHICLE_LICENSE_PLATE_EXISTS'
      ) {
        setFieldErrors({ licensePlate: 'Biển số xe đã tồn tại.' });
      } else if (requestError instanceof TypeError) {
        setFormError('Không thể kết nối đến máy chủ API. Vui lòng thử lại.');
      } else {
        setFormError(
          requestError instanceof Error
            ? requestError.message
            : editing
              ? 'Không thể cập nhật xe. Vui lòng thử lại.'
              : 'Không thể tạo xe. Vui lòng thử lại.',
        );
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
            <p className="eyebrow">QUẢN LÝ PHƯƠNG TIỆN</p>
            <h2 id={`${idPrefix}-title`}>
              {editing ? 'Chỉnh sửa xe' : 'Thêm xe'}
            </h2>
            <p id={`${idPrefix}-description`}>
              {editing
                ? 'Cập nhật biển số, nhà xe và loại xe.'
                : 'Nhập thông tin xe mới vào hệ thống.'}
            </p>
          </div>
          <button
            aria-label={
              editing ? 'Đóng biểu mẫu chỉnh sửa xe' : 'Đóng biểu mẫu thêm xe'
            }
            className="icon-button"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </div>

        <form className="vehicle-form" noValidate onSubmit={handleSubmit}>
          {formError && (
            <div className="vehicle-form-error" role="alert">
              {formError}
            </div>
          )}

          {optionErrors.length > 0 && (
            <div className="vehicle-form-options-error" role="alert">
              <span>{optionErrors.join(' ')}</span>
              <Button
                disabled={submitting}
                onClick={onRetryOptions}
                type="button"
                variant="secondary"
              >
                Tải lại tùy chọn
              </Button>
            </div>
          )}

          <div className="vehicle-form-field">
            <label htmlFor={`${idPrefix}-license-plate`}>Biển số xe *</label>
            <input
              aria-describedby={
                fieldErrors.licensePlate
                  ? `${idPrefix}-license-plate-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.licensePlate)}
              autoComplete="off"
              disabled={submitting}
              id={`${idPrefix}-license-plate`}
              maxLength={15}
              onChange={(event) =>
                updateField('licensePlate', event.target.value)
              }
              placeholder="Ví dụ: 51B-123.45"
              required
              type="text"
              value={values.licensePlate}
            />
            {fieldErrors.licensePlate && (
              <span
                className="vehicle-form-field-error"
                id={`${idPrefix}-license-plate-error`}
              >
                {fieldErrors.licensePlate}
              </span>
            )}
          </div>

          <div className="vehicle-form-field">
            <label htmlFor={`${idPrefix}-bus-company`}>Nhà xe *</label>
            <select
              aria-describedby={
                fieldErrors.busCompanyId
                  ? `${idPrefix}-bus-company-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.busCompanyId)}
              disabled={submitting || !optionsReady}
              id={`${idPrefix}-bus-company`}
              onChange={(event) =>
                updateField('busCompanyId', event.target.value)
              }
              required
              value={values.busCompanyId}
            >
              <option value="">{optionText(busCompanies, 'nhà xe')}</option>
              {busCompanies.status === 'success' &&
                busCompanies.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              {busCompanies.status !== 'success' && vehicle && (
                <option value={vehicle.busCompany.busCompanyId}>
                  {vehicle.busCompany.name}
                </option>
              )}
            </select>
            {fieldErrors.busCompanyId && (
              <span
                className="vehicle-form-field-error"
                id={`${idPrefix}-bus-company-error`}
              >
                {fieldErrors.busCompanyId}
              </span>
            )}
          </div>

          <div className="vehicle-form-field">
            <label htmlFor={`${idPrefix}-vehicle-type`}>Loại xe *</label>
            <select
              aria-describedby={
                fieldErrors.vehicleTypeId
                  ? `${idPrefix}-vehicle-type-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.vehicleTypeId)}
              disabled={submitting || !optionsReady}
              id={`${idPrefix}-vehicle-type`}
              onChange={(event) =>
                updateField('vehicleTypeId', event.target.value)
              }
              required
              value={values.vehicleTypeId}
            >
              <option value="">Chọn loại xe</option>
              {vehicleTypes.status === 'success' &&
                vehicleTypes.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              {vehicleTypes.status !== 'success' && vehicle && (
                <option value={vehicle.vehicleType.vehicleTypeId}>
                  {vehicle.vehicleType.name}
                </option>
              )}
            </select>
            {fieldErrors.vehicleTypeId && (
              <span
                className="vehicle-form-field-error"
                id={`${idPrefix}-vehicle-type-error`}
              >
                {fieldErrors.vehicleTypeId}
              </span>
            )}
          </div>

          {!editing && (
            <div className="vehicle-form-field">
              <label htmlFor={`${idPrefix}-status`}>Trạng thái *</label>
              <select
                aria-describedby={
                  fieldErrors.status ? `${idPrefix}-status-error` : undefined
                }
                aria-invalid={Boolean(fieldErrors.status)}
                disabled={submitting}
                id={`${idPrefix}-status`}
                onChange={(event) =>
                  updateField('status', event.target.value as VehicleStatus)
                }
                required
                value={values.status}
              >
                <option value="HOAT_DONG">Đang hoạt động</option>
                <option value="BAO_TRI">Bảo trì</option>
              </select>
              {fieldErrors.status && (
                <span
                  className="vehicle-form-field-error"
                  id={`${idPrefix}-status-error`}
                >
                  {fieldErrors.status}
                </span>
              )}
            </div>
          )}

          <div className="vehicle-form-actions">
            <Button
              disabled={submitting}
              onClick={closeDialog}
              type="button"
              variant="secondary"
            >
              Hủy
            </Button>
            <Button disabled={submitting || !optionsReady} type="submit">
              {submitting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="vehicle-form-spinner"
                  size={16}
                />
              )}
              {submitting ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo xe'}
            </Button>
          </div>
        </form>
      </>
    </AdminFormDialog>
  );
}
