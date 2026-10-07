'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
import { getBusCompanyFilterOptions } from '@/features/bus-companies/services/bus-company-service';
import type { BusCompanyFilterOption } from '@/features/bus-companies/services/bus-company-service';
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
  busCompanyId: string;
  name: string;
  description: string;
  motorbikeCapacityDefault: string;
  bulkyCargoCapacityDefault: string;
  lightCargoCapacityDefault: string;
};

type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField, string>>;

function fieldErrorsFromDetails(details: VehicleTypeApiErrorDetail[]) {
  const errors: FieldErrors = {};

  for (const detail of details) {
    if (
      detail.field === 'busCompanyId' ||
      detail.field === 'name' ||
      detail.field === 'description' ||
      detail.field === 'motorbikeCapacityDefault' ||
      detail.field === 'bulkyCargoCapacityDefault' ||
      detail.field === 'lightCargoCapacityDefault'
    ) {
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
    busCompanyId: '',
    name: vehicleType?.name ?? '',
    description: vehicleType?.description ?? '',
    motorbikeCapacityDefault: String(
      vehicleType?.motorbikeCapacityDefault ?? 0,
    ),
    bulkyCargoCapacityDefault: String(
      vehicleType?.bulkyCargoCapacityDefault ?? 0,
    ),
    lightCargoCapacityDefault: String(
      vehicleType?.lightCargoCapacityDefault ?? 0,
    ),
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busCompanyOptions, setBusCompanyOptions] = useState<{
    status: 'loading' | 'success' | 'error';
    options: BusCompanyFilterOption[];
  }>({ status: 'loading', options: [] });

  useEffect(() => {
    if (editing) return;
    const controller = new AbortController();
    getBusCompanyFilterOptions(controller.signal)
      .then((options) => setBusCompanyOptions({ status: 'success', options }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setBusCompanyOptions({ status: 'error', options: [] });
        setFormError(
          error instanceof Error
            ? error.message
            : 'Không thể tải danh sách nhà xe.',
        );
      });
    return () => controller.abort();
  }, [editing]);

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
    if (
      !editing &&
      (!/^\d+$/.test(values.busCompanyId) || Number(values.busCompanyId) < 1)
    ) {
      errors.busCompanyId = 'Vui lòng chọn nhà xe.';
    }
    const name = values.name.trim();
    const description = values.description.trim();

    if (!name) errors.name = 'Vui lòng nhập tên loại xe.';
    else if (name.length > 100) {
      errors.name = 'Tên loại xe không được vượt quá 100 ký tự.';
    }

    if (description.length > 500) {
      errors.description = 'Mô tả không được vượt quá 500 ký tự.';
    }

    for (const field of [
      'motorbikeCapacityDefault',
      'bulkyCargoCapacityDefault',
      'lightCargoCapacityDefault',
    ] as const) {
      const value = values[field];
      const capacity = Number(value);
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(capacity) ||
        capacity > 2_147_483_647
      ) {
        errors[field] = 'Nhập số nguyên từ 0 đến 2147483647.';
      }
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
    const editableFields = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      motorbikeCapacityDefault: Number(values.motorbikeCapacityDefault),
      bulkyCargoCapacityDefault: Number(values.bulkyCargoCapacityDefault),
      lightCargoCapacityDefault: Number(values.lightCargoCapacityDefault),
    };

    try {
      const savedVehicleType = editing
        ? await updateVehicleType(vehicleType.vehicleTypeId, editableFields)
        : await createVehicleType({
            ...editableFields,
            busCompanyId: Number(values.busCompanyId),
          });
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
                detail.field === 'busCompanyId' ||
                detail.field === 'name' ||
                detail.field === 'description' ||
                detail.field === 'motorbikeCapacityDefault' ||
                detail.field === 'bulkyCargoCapacityDefault' ||
                detail.field === 'lightCargoCapacityDefault',
            );
          setFieldErrors(serverErrors);
          setFormError(detailsAreMapped ? null : requestError.message);
        }
      } else if (requestError instanceof TypeError) {
        setFormError('Không thể kết nối đến máy chủ API. Vui lòng thử lại.');
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
          <Button
            aria-label={
              editing
                ? 'Đóng biểu mẫu chỉnh sửa loại xe'
                : 'Đóng biểu mẫu thêm loại xe'
            }
            className="icon-button"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
            variant="secondary"
          >
            <X aria-hidden="true" size={19} />
          </Button>
        </div>

        <form className="vehicle-type-form" noValidate onSubmit={handleSubmit}>
          {formError && (
            <div className="vehicle-type-form-error" role="alert">
              {formError}
            </div>
          )}

          {!editing && (
            <div className="vehicle-type-form-field">
              <label htmlFor={`${idPrefix}-bus-company`}>Nhà xe *</label>
              <select
                aria-describedby={
                  fieldErrors.busCompanyId
                    ? `${idPrefix}-bus-company-error`
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.busCompanyId)}
                disabled={submitting || busCompanyOptions.status !== 'success'}
                id={`${idPrefix}-bus-company`}
                onChange={(event) =>
                  updateField('busCompanyId', event.target.value)
                }
                required
                value={values.busCompanyId}
              >
                <option value="">
                  {busCompanyOptions.status === 'loading'
                    ? 'Đang tải nhà xe…'
                    : 'Chọn nhà xe'}
                </option>
                {busCompanyOptions.options.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.label}
                  </option>
                ))}
              </select>
              {fieldErrors.busCompanyId && (
                <span
                  className="vehicle-type-form-field-error"
                  id={`${idPrefix}-bus-company-error`}
                >
                  {fieldErrors.busCompanyId}
                </span>
              )}
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

          <fieldset className="vehicle-type-capacity-group">
            <legend>Sức chứa hàng mặc định</legend>
            <p
              className="vehicle-type-capacity-help"
              id={`${idPrefix}-capacity-help`}
            >
              Các giá trị này được dùng làm sức chứa mặc định khi tạo chuyến
              mới. Thay đổi tại đây không cập nhật sức chứa của các chuyến đã
              tồn tại.
            </p>
            <div className="vehicle-type-capacity-fields">
              <div className="vehicle-type-form-field">
                <label htmlFor={`${idPrefix}-motorbikeCapacityDefault`}>
                  Xe máy
                </label>
                <input
                  aria-describedby={`${idPrefix}-capacity-help${fieldErrors.motorbikeCapacityDefault ? ` ${idPrefix}-motorbikeCapacityDefault-error` : ''}`}
                  aria-invalid={Boolean(fieldErrors.motorbikeCapacityDefault)}
                  disabled={submitting}
                  id={`${idPrefix}-motorbikeCapacityDefault`}
                  max={2_147_483_647}
                  min={0}
                  onChange={(event) =>
                    updateField('motorbikeCapacityDefault', event.target.value)
                  }
                  step={1}
                  type="number"
                  value={values.motorbikeCapacityDefault}
                />
                {fieldErrors.motorbikeCapacityDefault && (
                  <span
                    className="vehicle-type-form-field-error"
                    id={`${idPrefix}-motorbikeCapacityDefault-error`}
                  >
                    {fieldErrors.motorbikeCapacityDefault}
                  </span>
                )}
              </div>
              <div className="vehicle-type-form-field">
                <label htmlFor={`${idPrefix}-bulkyCargoCapacityDefault`}>
                  Hàng cồng kềnh
                </label>
                <input
                  aria-describedby={`${idPrefix}-capacity-help${fieldErrors.bulkyCargoCapacityDefault ? ` ${idPrefix}-bulkyCargoCapacityDefault-error` : ''}`}
                  aria-invalid={Boolean(fieldErrors.bulkyCargoCapacityDefault)}
                  disabled={submitting}
                  id={`${idPrefix}-bulkyCargoCapacityDefault`}
                  max={2_147_483_647}
                  min={0}
                  onChange={(event) =>
                    updateField('bulkyCargoCapacityDefault', event.target.value)
                  }
                  step={1}
                  type="number"
                  value={values.bulkyCargoCapacityDefault}
                />
                {fieldErrors.bulkyCargoCapacityDefault && (
                  <span
                    className="vehicle-type-form-field-error"
                    id={`${idPrefix}-bulkyCargoCapacityDefault-error`}
                  >
                    {fieldErrors.bulkyCargoCapacityDefault}
                  </span>
                )}
              </div>
              <div className="vehicle-type-form-field">
                <label htmlFor={`${idPrefix}-lightCargoCapacityDefault`}>
                  Hàng nhẹ
                </label>
                <input
                  aria-describedby={`${idPrefix}-capacity-help${fieldErrors.lightCargoCapacityDefault ? ` ${idPrefix}-lightCargoCapacityDefault-error` : ''}`}
                  aria-invalid={Boolean(fieldErrors.lightCargoCapacityDefault)}
                  disabled={submitting}
                  id={`${idPrefix}-lightCargoCapacityDefault`}
                  max={2_147_483_647}
                  min={0}
                  onChange={(event) =>
                    updateField('lightCargoCapacityDefault', event.target.value)
                  }
                  step={1}
                  type="number"
                  value={values.lightCargoCapacityDefault}
                />
                {fieldErrors.lightCargoCapacityDefault && (
                  <span
                    className="vehicle-type-form-field-error"
                    id={`${idPrefix}-lightCargoCapacityDefault-error`}
                  >
                    {fieldErrors.lightCargoCapacityDefault}
                  </span>
                )}
              </div>
            </div>
          </fieldset>

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
