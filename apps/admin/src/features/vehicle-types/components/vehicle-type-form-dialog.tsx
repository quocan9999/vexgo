'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createVehicleType,
  updateVehicleType,
  VehicleTypeApiError,
} from '../services/vehicle-type-service';
import type { VehicleType } from '../types/vehicle-type';

type FormField = 'name' | 'description';
type FieldErrors = Partial<Record<FormField, string>>;
type FormValues = { name: string; description: string };

type VehicleTypeFormDialogProps =
  | {
      mode: 'create';
      onClose: () => void;
      onSaved: (vehicleType: VehicleType) => void;
      vehicleType?: never;
    }
  | {
      mode: 'edit';
      onClose: () => void;
      onSaved: (vehicleType: VehicleType) => void;
      vehicleType: VehicleType;
    };

function fieldErrorsFromDetails(details: VehicleTypeApiError['details']) {
  const errors: FieldErrors = {};
  let hasUnmappedError = false;

  for (const detail of details) {
    if (detail.field === 'name' || detail.field === 'description') {
      errors[detail.field] = detail.message;
    } else {
      hasUnmappedError = true;
    }
  }

  return { errors, hasUnmappedError };
}

export function VehicleTypeFormDialog({
  mode,
  onClose,
  onSaved,
  vehicleType,
}: VehicleTypeFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>(() => ({
    name: mode === 'edit' ? (vehicleType?.name ?? '') : '',
    description: mode === 'edit' ? (vehicleType?.description ?? '') : '',
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const title = mode === 'create' ? 'Thêm loại xe' : 'Chỉnh sửa loại xe';
  const action = mode === 'create' ? 'Tạo loại xe' : 'Lưu thay đổi';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
  }

  function updateField(field: FormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validateField(field: FormField, value: string) {
    const trimmedValue = value.trim();

    if (field === 'name') {
      if (!trimmedValue) return 'Vui lòng nhập tên loại xe.';
      if (trimmedValue.length > 100) {
        return 'Tên loại xe không được vượt quá 100 ký tự.';
      }
      return undefined;
    }

    if (trimmedValue.length > 500) {
      return 'Mô tả không được vượt quá 500 ký tự.';
    }
    return undefined;
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const nameError = validateField('name', values.name);
    const descriptionError = validateField('description', values.description);

    if (nameError) errors.name = nameError;
    if (descriptionError) errors.description = descriptionError;
    return errors;
  }

  function focusFirstInvalidField(errors: FieldErrors) {
    if (errors.name) nameInputRef.current?.focus();
    else if (errors.description) descriptionInputRef.current?.focus();
  }

  function validateOnBlur(field: FormField) {
    const message = validateField(field, values[field]);
    setFieldErrors((current) => ({ ...current, [field]: message }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(errors);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    const input = {
      name: values.name.trim(),
      description: values.description.trim() || null,
    };

    try {
      const savedVehicleType =
        mode === 'create'
          ? await createVehicleType(input)
          : await updateVehicleType(vehicleType.vehicleTypeId, input);
      dialogRef.current?.close();
      onSaved(savedVehicleType);
    } catch (requestError: unknown) {
      if (requestError instanceof VehicleTypeApiError) {
        if (requestError.code === 'VEHICLE_TYPE_NAME_EXISTS') {
          const errors = { name: requestError.message };
          setFieldErrors(errors);
          setFormError(null);
          focusFirstInvalidField(errors);
        } else if (requestError.code === 'VALIDATION_ERROR') {
          const mapped = fieldErrorsFromDetails(requestError.details);
          setFieldErrors(mapped.errors);
          focusFirstInvalidField(mapped.errors);
          setFormError(
            mapped.hasUnmappedError || Object.keys(mapped.errors).length === 0
              ? requestError.message
              : null,
          );
        } else {
          setFormError(requestError.message);
        }
      } else if (requestError instanceof TypeError) {
        setFormError('Không thể kết nối đến máy chủ API. Vui lòng thử lại.');
      } else {
        setFormError(
          requestError instanceof Error
            ? requestError.message
            : `Không thể ${mode === 'create' ? 'tạo' : 'cập nhật'} loại xe. Vui lòng thử lại.`,
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <dialog
      aria-describedby="vehicle-type-form-description"
      aria-labelledby="vehicle-type-form-title"
      aria-modal="true"
      className="vehicle-type-dialog vehicle-type-form-dialog"
      onCancel={(event) => {
        if (submittingRef.current) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="vehicle-type-dialog-content">
        <div className="vehicle-type-dialog-heading">
          <div>
            <p className="vehicle-types-eyebrow">DANH MỤC PHƯƠNG TIỆN</p>
            <h2 id="vehicle-type-form-title">{title}</h2>
          </div>
          <button
            aria-label={`Đóng biểu mẫu ${title.toLocaleLowerCase()}`}
            className="vehicle-types-icon-button"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </div>

        <p
          className="vehicle-type-dialog-description"
          id="vehicle-type-form-description"
        >
          {mode === 'create'
            ? 'Nhập tên loại xe và mô tả tùy chọn.'
            : 'Cập nhật tên loại xe và mô tả.'}
        </p>

        <form className="vehicle-type-form" noValidate onSubmit={handleSubmit}>
          {formError && (
            <div className="vehicle-type-form-error" role="alert">
              {formError}
            </div>
          )}

          <div className="vehicle-type-form-field">
            <label htmlFor="vehicle-type-form-name">Tên loại xe *</label>
            <input
              autoComplete="off"
              aria-describedby={
                fieldErrors.name ? 'vehicle-type-form-name-error' : undefined
              }
              aria-invalid={Boolean(fieldErrors.name)}
              autoFocus
              id="vehicle-type-form-name"
              onChange={(event) => updateField('name', event.target.value)}
              onBlur={() => validateOnBlur('name')}
              required
              ref={nameInputRef}
              type="text"
              value={values.name}
            />
            {fieldErrors.name && (
              <span
                className="vehicle-type-form-field-error"
                id="vehicle-type-form-name-error"
                role="alert"
              >
                {fieldErrors.name}
              </span>
            )}
          </div>

          <div className="vehicle-type-form-field">
            <label htmlFor="vehicle-type-form-description">Mô tả</label>
            <textarea
              aria-describedby={
                fieldErrors.description
                  ? 'vehicle-type-form-description-error'
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.description)}
              id="vehicle-type-form-description"
              onChange={(event) =>
                updateField('description', event.target.value)
              }
              onBlur={() => validateOnBlur('description')}
              ref={descriptionInputRef}
              rows={4}
              value={values.description}
            />
            {fieldErrors.description && (
              <span
                className="vehicle-type-form-field-error"
                id="vehicle-type-form-description-error"
                role="alert"
              >
                {fieldErrors.description}
              </span>
            )}
          </div>

          <div className="vehicle-type-form-actions">
            <button
              className="vehicle-types-button"
              disabled={submitting}
              onClick={closeDialog}
              type="button"
            >
              Hủy
            </button>
            <button
              className="vehicle-types-button vehicle-type-form-submit"
              disabled={submitting}
              type="submit"
            >
              {submitting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="vehicle-types-spinner"
                  size={16}
                />
              )}
              {submitting
                ? mode === 'create'
                  ? 'Đang tạo…'
                  : 'Đang lưu…'
                : action}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
