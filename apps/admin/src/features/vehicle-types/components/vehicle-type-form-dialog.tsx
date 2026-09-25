'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
import {
  createVehicleType,
  updateVehicleType,
  VehicleTypeApiError,
  type VehicleTypeApiErrorDetail,
} from '../services/vehicle-type-service';
import type { VehicleType } from '../types/vehicle-type';

type VehicleTypeFormDialogProps = {
  vehicleType?: VehicleType;
  onClose: () => void;
  onSaved: (vehicleType: VehicleType) => void;
};

type FormValues = {
  name: string;
  description: string;
};

type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField, string>>;

function fieldErrorsFromDetails(details: VehicleTypeApiErrorDetail[]) {
  const errors: FieldErrors = {};

  for (const detail of details) {
    if (detail.field === 'name' || detail.field === 'description') {
      errors[detail.field] = detail.message;
    }
  }

  return errors;
}

export function VehicleTypeFormDialog({
  vehicleType,
  onClose,
  onSaved,
}: VehicleTypeFormDialogProps) {
  const editing = vehicleType !== undefined;
  const idPrefix = editing
    ? `edit-vehicle-type-${vehicleType.vehicleTypeId}`
    : 'create-vehicle-type';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>(() => ({
    name: vehicleType?.name ?? '',
    description: vehicleType?.description ?? '',
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
  }

  function updateField(field: FormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const name = values.name.trim();
    const description = values.description.trim();

    if (!name) errors.name = 'Vui lòng nhập tên loại xe.';
    else if (name.length > 100) {
      errors.name = 'Tên loại xe không được vượt quá 100 ký tự.';
    }

    if (description.length > 500) {
      errors.description = 'Mô tả không được vượt quá 500 ký tự.';
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    const input = {
      name: values.name.trim(),
      description: values.description.trim() || null,
    };

    try {
      const savedVehicleType = editing
        ? await updateVehicleType(vehicleType.vehicleTypeId, input)
        : await createVehicleType(input);
      dialogRef.current?.close();
      onSaved(savedVehicleType);
    } catch (requestError: unknown) {
      if (requestError instanceof VehicleTypeApiError) {
        if (requestError.code === 'VEHICLE_TYPE_NAME_EXISTS') {
          setFieldErrors({ name: requestError.message });
          setFormError(null);
        } else {
          const serverErrors = fieldErrorsFromDetails(requestError.details);
          const detailsAreMapped =
            requestError.details.length > 0 &&
            requestError.details.every(
              (detail) =>
                detail.field === 'name' || detail.field === 'description',
            );
          setFieldErrors(serverErrors);
          setFormError(detailsAreMapped ? null : requestError.message);
        }
      } else if (requestError instanceof TypeError) {
        setFormError(
          'Không thể kết nối đến máy chủ API. Vui lòng thử lại.',
        );
      } else {
        setFormError(
          requestError instanceof Error
            ? requestError.message
            : editing
              ? 'Không thể cập nhật loại xe. Vui lòng thử lại.'
              : 'Không thể tạo loại xe. Vui lòng thử lại.',
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
            <p className="eyebrow">DANH MỤC PHƯƠNG TIỆN</p>
            <h2 id={`${idPrefix}-title`}>
              {editing ? 'Chỉnh sửa loại xe' : 'Thêm loại xe'}
            </h2>
            <p id={`${idPrefix}-description`}>
              {editing
                ? 'Cập nhật tên và mô tả của loại xe.'
                : 'Nhập tên và mô tả cho loại xe mới.'}
            </p>
          </div>
          <button
            aria-label={
              editing ? 'Đóng biểu mẫu chỉnh sửa loại xe' : 'Đóng biểu mẫu thêm loại xe'
            }
            className="icon-button"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </div>

        <form
          className="vehicle-type-form"
          noValidate
          onSubmit={handleSubmit}
        >
          {formError && (
            <div className="vehicle-type-form-error" role="alert">
              {formError}
            </div>
          )}

          <div className="vehicle-type-form-field">
            <label htmlFor={`${idPrefix}-name`}>Tên loại xe *</label>
            <input
              autoComplete="off"
              aria-describedby={
                fieldErrors.name ? `${idPrefix}-name-error` : undefined
              }
              aria-invalid={Boolean(fieldErrors.name)}
              disabled={submitting}
              id={`${idPrefix}-name`}
              maxLength={100}
              onChange={(event) => updateField('name', event.target.value)}
              required
              type="text"
              value={values.name}
            />
            {fieldErrors.name && (
              <span
                className="vehicle-type-form-field-error"
                id={`${idPrefix}-name-error`}
              >
                {fieldErrors.name}
              </span>
            )}
          </div>

          <div className="vehicle-type-form-field">
            <label htmlFor={`${idPrefix}-description`}>Mô tả</label>
            <textarea
              aria-describedby={
                fieldErrors.description
                  ? `${idPrefix}-description-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.description)}
              disabled={submitting}
              id={`${idPrefix}-description`}
              maxLength={500}
              onChange={(event) =>
                updateField('description', event.target.value)
              }
              rows={4}
              value={values.description}
            />
            {fieldErrors.description && (
              <span
                className="vehicle-type-form-field-error"
                id={`${idPrefix}-description-error`}
              >
                {fieldErrors.description}
              </span>
            )}
          </div>

          <div className="vehicle-type-form-actions">
            <Button
              disabled={submitting}
              onClick={closeDialog}
              type="button"
              variant="secondary"
            >
              Hủy
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="vehicle-type-form-spinner"
                  size={16}
                />
              )}
              {submitting
                ? 'Đang lưu…'
                : editing
                  ? 'Lưu thay đổi'
                  : 'Tạo loại xe'}
            </Button>
          </div>
        </form>
      </>
    </AdminFormDialog>
  );
}
