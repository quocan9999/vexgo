'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
import {
  createFarePrice,
  FarePriceApiError,
  type FarePriceApiErrorDetail,
} from '../services/fare-price-service';
import type {
  CreateFarePriceRequest,
  FarePriceOption,
  FarePriceOptionsState,
  FarePriceStatus,
} from '../types/fare-price';
import styles from '../fare-prices.module.css';

type FarePriceFormDialogProps = {
  routeOptions: FarePriceOptionsState;
  vehicleTypeOptions: FarePriceOptionsState;
  onClose: () => void;
  onRetryRouteOptions: () => void;
  onRetryVehicleTypeOptions: () => void;
  onSaved: () => void;
};

type FormValues = {
  routeId: string;
  vehicleTypeId: string;
  listedPrice: string;
  validFrom: string;
  validTo: string;
  status: FarePriceStatus | '';
};

type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField, string>>;

const FIELD_NAMES: readonly FormField[] = [
  'routeId',
  'vehicleTypeId',
  'listedPrice',
  'validFrom',
  'validTo',
  'status',
];

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function mapServerFieldErrors(details: FarePriceApiErrorDetail[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const detail of details) {
    if (FIELD_NAMES.includes(detail.field as FormField)) {
      errors[detail.field as FormField] = detail.message;
    }
  }
  return errors;
}

function validate(values: FormValues, routeOptions: FarePriceOptionsState, vehicleTypeOptions: FarePriceOptionsState): FieldErrors {
  const errors: FieldErrors = {};
  const routeId = Number(values.routeId);
  const vehicleTypeId = Number(values.vehicleTypeId);
  const listedPrice = Number(values.listedPrice);

  if (!Number.isSafeInteger(routeId) || routeId < 1 || routeOptions.status !== 'success' || routeOptions.options.length === 0) {
    errors.routeId = 'Vui lòng chọn tuyến xe.';
  }
  if (!Number.isSafeInteger(vehicleTypeId) || vehicleTypeId < 1 || vehicleTypeOptions.status !== 'success' || vehicleTypeOptions.options.length === 0) {
    errors.vehicleTypeId = 'Vui lòng chọn loại xe.';
  }
  if (!values.listedPrice.trim()) errors.listedPrice = 'Vui lòng nhập giá niêm yết.';
  else if (!Number.isSafeInteger(listedPrice) || listedPrice <= 0) {
    errors.listedPrice = 'Giá niêm yết phải là số nguyên VND lớn hơn 0.';
  }
  if (!isDateOnly(values.validFrom)) {
    errors.validFrom = 'Vui lòng chọn ngày bắt đầu hợp lệ.';
  }
  if (values.validTo && !isDateOnly(values.validTo)) {
    errors.validTo = 'Ngày kết thúc không hợp lệ.';
  } else if (values.validTo && isDateOnly(values.validFrom) && values.validTo < values.validFrom) {
    errors.validTo = 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
  }
  if (values.status !== 'HOAT_DONG' && values.status !== 'TAM_NGUNG') {
    errors.status = 'Vui lòng chọn trạng thái.';
  }

  return errors;
}

function optionRows(options: FarePriceOptionsState): FarePriceOption[] {
  return options.status === 'success' ? options.options : [];
}

export function FarePriceFormDialog({
  routeOptions,
  vehicleTypeOptions,
  onClose,
  onRetryRouteOptions,
  onRetryVehicleTypeOptions,
  onSaved,
}: FarePriceFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>({
    routeId: '',
    vehicleTypeId: '',
    listedPrice: '',
    validFrom: '',
    validTo: '',
    status: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
  }

  function updateField(field: FormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === 'validFrom' ? { validTo: undefined } : {}),
    }));
    setFormError(null);
  }

  function setRelationError(field: 'routeId' | 'vehicleTypeId', message: string) {
    setFieldErrors((current) => ({ ...current, [field]: message }));
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    const errors = validate(values, routeOptions, vehicleTypeOptions);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);

    const input: CreateFarePriceRequest = {
      routeId: Number(values.routeId),
      vehicleTypeId: Number(values.vehicleTypeId),
      listedPrice: Number(values.listedPrice),
      validFrom: values.validFrom,
      validTo: values.validTo || null,
      status: values.status as FarePriceStatus,
    };

    try {
      await createFarePrice(input);
      dialogRef.current?.close();
      onSaved();
    } catch (requestError: unknown) {
      if (requestError instanceof FarePriceApiError) {
        if (requestError.code === 'FARE_PRICE_OVERLAP') {
          setFormError(
            'Khoảng hiệu lực này bị trùng với một bảng giá đang hoạt động của cùng tuyến và loại xe.',
          );
        } else if (requestError.code === 'ROUTE_NOT_FOUND') {
          setRelationError('routeId', 'Tuyến xe không còn tồn tại. Vui lòng chọn lại.');
          onRetryRouteOptions();
        } else if (requestError.code === 'VEHICLE_TYPE_NOT_FOUND') {
          setRelationError('vehicleTypeId', 'Loại xe không còn tồn tại. Vui lòng chọn lại.');
          onRetryVehicleTypeOptions();
        } else if (requestError.code === 'FARE_PRICE_CONCURRENT_MODIFICATION') {
          setFormError('Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng thử lại.');
        } else {
          const serverErrors = mapServerFieldErrors(requestError.details);
          setFieldErrors(serverErrors);
          if (Object.keys(serverErrors).length === 0 || Object.keys(serverErrors).length !== requestError.details.length) {
            setFormError(requestError.message);
          }
        }
      } else if (requestError instanceof TypeError) {
        setFormError('Không thể kết nối đến máy chủ API. Vui lòng thử lại.');
      } else {
        setFormError('Không thể tạo bảng giá. Vui lòng thử lại.');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function fieldError(field: FormField, id: string) {
    return fieldErrors[field]
      ? <span className="admin-crud-form-field-error" id={id}>{fieldErrors[field]}</span>
      : null;
  }

  const routeRows = optionRows(routeOptions);
  const vehicleTypeRows = optionRows(vehicleTypeOptions);
  const routeUnavailable = routeOptions.status !== 'success' || routeRows.length === 0;
  const vehicleTypeUnavailable = vehicleTypeOptions.status !== 'success' || vehicleTypeRows.length === 0;

  return (
    <AdminFormDialog
      ariaBusy={submitting}
      ariaDescribedBy="create-fare-price-description"
      ariaLabelledBy="create-fare-price-title"
      dialogRef={dialogRef}
      onClose={onClose}
      preventDismiss={submitting}
    >
      <>
        <div className="admin-dialog-header">
          <div className="admin-dialog-header__copy">
            <p className="eyebrow">BẢNG GIÁ VÉ</p>
            <h2 id="create-fare-price-title">Thêm bảng giá</h2>
            <p id="create-fare-price-description">
              Thiết lập giá vé theo tuyến, loại xe và thời gian hiệu lực.
            </p>
          </div>
          <Button
            aria-label="Đóng biểu mẫu thêm bảng giá"
            className="icon-button"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
            variant="secondary"
          >
            <X aria-hidden="true" size={19} />
          </Button>
        </div>

        <form className="admin-crud-form" noValidate onSubmit={handleSubmit}>
          {formError && <p className="admin-crud-form-error" role="alert">{formError}</p>}

          <div className="admin-crud-form-field">
            <label htmlFor="create-fare-price-routeId">Tuyến xe *</label>
            <select
              aria-describedby={fieldErrors.routeId ? 'create-fare-price-routeId-error' : undefined}
              aria-invalid={Boolean(fieldErrors.routeId)}
              disabled={submitting || routeUnavailable}
              id="create-fare-price-routeId"
              onChange={(event) => updateField('routeId', event.target.value)}
              required
              value={values.routeId}
            >
              <option value="">Chọn tuyến xe</option>
              {routeRows.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {fieldError('routeId', 'create-fare-price-routeId-error')}
          </div>
          {routeOptions.status === 'loading' && <p role="status">Đang tải danh sách tuyến xe…</p>}
          {routeOptions.status === 'error' && (
            <div className="admin-crud-form-error" role="alert">
              <p>Không thể tải danh sách tuyến xe.</p>
              <Button onClick={onRetryRouteOptions} type="button" variant="secondary">Thử lại tuyến xe</Button>
            </div>
          )}
          {routeOptions.status === 'success' && routeRows.length === 0 && (
            <p className="admin-crud-form-error" role="alert">Chưa có tuyến xe để tạo bảng giá.</p>
          )}

          <div className="admin-crud-form-field">
            <label htmlFor="create-fare-price-vehicleTypeId">Loại xe *</label>
            <select
              aria-describedby={fieldErrors.vehicleTypeId ? 'create-fare-price-vehicleTypeId-error' : undefined}
              aria-invalid={Boolean(fieldErrors.vehicleTypeId)}
              disabled={submitting || vehicleTypeUnavailable}
              id="create-fare-price-vehicleTypeId"
              onChange={(event) => updateField('vehicleTypeId', event.target.value)}
              required
              value={values.vehicleTypeId}
            >
              <option value="">Chọn loại xe</option>
              {vehicleTypeRows.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {fieldError('vehicleTypeId', 'create-fare-price-vehicleTypeId-error')}
          </div>
          {vehicleTypeOptions.status === 'loading' && <p role="status">Đang tải danh sách loại xe…</p>}
          {vehicleTypeOptions.status === 'error' && (
            <div className="admin-crud-form-error" role="alert">
              <p>Không thể tải danh sách loại xe.</p>
              <Button onClick={onRetryVehicleTypeOptions} type="button" variant="secondary">Thử lại loại xe</Button>
            </div>
          )}
          {vehicleTypeOptions.status === 'success' && vehicleTypeRows.length === 0 && (
            <p className="admin-crud-form-error" role="alert">Chưa có loại xe để tạo bảng giá.</p>
          )}

          <div className="admin-crud-form-field">
            <label htmlFor="create-fare-price-listedPrice">Giá niêm yết (VND) *</label>
            <input
              aria-describedby={fieldErrors.listedPrice ? 'create-fare-price-listedPrice-error' : undefined}
              aria-invalid={Boolean(fieldErrors.listedPrice)}
              autoComplete="off"
              disabled={submitting}
              id="create-fare-price-listedPrice"
              inputMode="numeric"
              min="1"
              onChange={(event) => updateField('listedPrice', event.target.value)}
              required
              step="1"
              type="number"
              value={values.listedPrice}
            />
            {fieldError('listedPrice', 'create-fare-price-listedPrice-error')}
          </div>

          <div className="admin-crud-form-field">
            <label htmlFor="create-fare-price-validFrom">Hiệu lực từ *</label>
            <input
              aria-describedby={fieldErrors.validFrom ? 'create-fare-price-validFrom-error' : undefined}
              aria-invalid={Boolean(fieldErrors.validFrom)}
              disabled={submitting}
              id="create-fare-price-validFrom"
              onChange={(event) => updateField('validFrom', event.target.value)}
              required
              type="date"
              value={values.validFrom}
            />
            {fieldError('validFrom', 'create-fare-price-validFrom-error')}
          </div>

          <div className="admin-crud-form-field">
            <label htmlFor="create-fare-price-validTo">Hiệu lực đến</label>
            <input
              aria-describedby={fieldErrors.validTo ? 'create-fare-price-validTo-error' : 'create-fare-price-validTo-hint'}
              aria-invalid={Boolean(fieldErrors.validTo)}
              disabled={submitting}
              id="create-fare-price-validTo"
              min={values.validFrom || undefined}
              onChange={(event) => updateField('validTo', event.target.value)}
              type="date"
              value={values.validTo}
            />
            {fieldError('validTo', 'create-fare-price-validTo-error')}
            {!fieldErrors.validTo && <span className={styles.fieldHint} id="create-fare-price-validTo-hint">Để trống nếu không giới hạn ngày kết thúc.</span>}
          </div>

          <div className="admin-crud-form-field">
            <label htmlFor="create-fare-price-status">Trạng thái *</label>
            <select
              aria-describedby={fieldErrors.status ? 'create-fare-price-status-error' : undefined}
              aria-invalid={Boolean(fieldErrors.status)}
              disabled={submitting}
              id="create-fare-price-status"
              onChange={(event) => updateField('status', event.target.value)}
              required
              value={values.status}
            >
              <option value="">Chọn trạng thái</option>
              <option value="HOAT_DONG">Hoạt động</option>
              <option value="TAM_NGUNG">Tạm ngưng</option>
            </select>
            {fieldError('status', 'create-fare-price-status-error')}
          </div>

          <div className="admin-crud-form-actions">
            <Button disabled={submitting} onClick={closeDialog} type="button" variant="secondary">Hủy</Button>
            <Button disabled={submitting || routeUnavailable || vehicleTypeUnavailable} type="submit">
              {submitting && <LoaderCircle aria-hidden="true" className="admin-crud-form-spinner" size={16} />}
              {submitting ? 'Đang tạo…' : 'Tạo bảng giá'}
            </Button>
          </div>
        </form>
      </>
    </AdminFormDialog>
  );
}
