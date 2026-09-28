'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
import {
  createFarePrice,
  updateFarePrice,
  FarePriceApiError,
  type FarePriceApiErrorDetail,
} from '../services/fare-price-service';
import type {
  CreateFarePriceRequest,
  FarePrice,
  FarePriceOption,
  FarePriceOptionsState,
  FarePriceStatus,
} from '../types/fare-price';
import styles from '../fare-prices.module.css';

type FarePriceFormDialogProps = {
  farePrice?: FarePrice;
  routeOptions: FarePriceOptionsState;
  vehicleTypeOptions: FarePriceOptionsState;
  onClose: () => void;
  onRetryRouteOptions: () => void;
  onRetryVehicleTypeOptions: () => void;
  onSaved: (farePrice: FarePrice) => void;
  onNotFound?: () => void;
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

function validate(
  values: FormValues,
  routeOptions: FarePriceOptionsState,
  vehicleTypeOptions: FarePriceOptionsState,
  editing: boolean,
): FieldErrors {
  const errors: FieldErrors = {};
  const routeId = Number(values.routeId);
  const vehicleTypeId = Number(values.vehicleTypeId);
  const listedPrice = Number(values.listedPrice);

  if (!editing && (!Number.isSafeInteger(routeId) || routeId < 1 || routeOptions.status !== 'success' || routeOptions.options.length === 0)) {
    errors.routeId = 'Vui lòng chọn tuyến xe.';
  }
  if (!editing && (!Number.isSafeInteger(vehicleTypeId) || vehicleTypeId < 1 || vehicleTypeOptions.status !== 'success' || vehicleTypeOptions.options.length === 0)) {
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
  if (!editing && values.status !== 'HOAT_DONG' && values.status !== 'TAM_NGUNG') {
    errors.status = 'Vui lòng chọn trạng thái.';
  }

  return errors;
}

function optionRows(options: FarePriceOptionsState): FarePriceOption[] {
  return options.status === 'success' ? options.options : [];
}

export function FarePriceFormDialog({
  farePrice,
  routeOptions,
  vehicleTypeOptions,
  onClose,
  onRetryRouteOptions,
  onRetryVehicleTypeOptions,
  onSaved,
  onNotFound,
}: FarePriceFormDialogProps) {
  const editing = farePrice !== undefined;
  const idPrefix = editing ? `edit-fare-price-${farePrice.farePriceId}` : 'create-fare-price';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>({
    routeId: farePrice ? String(farePrice.route.routeId) : '',
    vehicleTypeId: farePrice ? String(farePrice.vehicleType.vehicleTypeId) : '',
    listedPrice: farePrice ? String(farePrice.listedPrice) : '',
    validFrom: farePrice?.validFrom ?? '',
    validTo: farePrice?.validTo ?? '',
    status: farePrice?.status ?? '',
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
    const errors = validate(values, routeOptions, vehicleTypeOptions, editing);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      let savedFarePrice: FarePrice;
      if (editing) {
        savedFarePrice = await updateFarePrice(farePrice.farePriceId, {
          listedPrice: Number(values.listedPrice),
          validFrom: values.validFrom,
          validTo: values.validTo || null,
        });
      } else {
        const input: CreateFarePriceRequest = {
          routeId: Number(values.routeId),
          vehicleTypeId: Number(values.vehicleTypeId),
          listedPrice: Number(values.listedPrice),
          validFrom: values.validFrom,
          validTo: values.validTo || null,
          status: values.status as FarePriceStatus,
        };
        savedFarePrice = await createFarePrice(input);
      }
      dialogRef.current?.close();
      onSaved(savedFarePrice);
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
          setFormError('Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng tải lại và thử lại.');
        } else if (requestError.code === 'FARE_PRICE_NOT_FOUND' && editing) {
          onNotFound?.();
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
        setFormError(editing ? 'Không thể cập nhật bảng giá. Vui lòng thử lại.' : 'Không thể tạo bảng giá. Vui lòng thử lại.');
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
  const routeUnavailable = !editing && (routeOptions.status !== 'success' || routeRows.length === 0);
  const vehicleTypeUnavailable = !editing && (vehicleTypeOptions.status !== 'success' || vehicleTypeRows.length === 0);

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
            <p className="eyebrow">BẢNG GIÁ VÉ</p>
            <h2 id={`${idPrefix}-title`}>{editing ? 'Chỉnh sửa bảng giá' : 'Thêm bảng giá'}</h2>
            <p id={`${idPrefix}-description`}>
              {editing
                ? 'Cập nhật giá niêm yết và thời gian hiệu lực của bảng giá.'
                : 'Thiết lập giá vé theo tuyến, loại xe và thời gian hiệu lực.'}
            </p>
          </div>
          <Button
            aria-label={editing ? 'Đóng biểu mẫu chỉnh sửa bảng giá' : 'Đóng biểu mẫu thêm bảng giá'}
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

          {editing && (
            <div className="admin-crud-form-context">
              <strong>{farePrice.route.code} — {farePrice.route.origin} → {farePrice.route.destination}</strong>
              <span>Loại xe: {farePrice.vehicleType.name}</span>
              <span>Trạng thái: {farePrice.status === 'HOAT_DONG' ? 'Hoạt động' : 'Tạm ngưng'}</span>
            </div>
          )}

          {!editing && <div className="admin-crud-form-field">
            <label htmlFor={`${idPrefix}-routeId`}>Tuyến xe *</label>
            <select
              aria-describedby={fieldErrors.routeId ? `${idPrefix}-routeId-error` : undefined}
              aria-invalid={Boolean(fieldErrors.routeId)}
              disabled={submitting || routeUnavailable}
              id={`${idPrefix}-routeId`}
              onChange={(event) => updateField('routeId', event.target.value)}
              required
              value={values.routeId}
            >
              <option value="">Chọn tuyến xe</option>
              {routeRows.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {fieldError('routeId', `${idPrefix}-routeId-error`)}
          </div>}
          {!editing && routeOptions.status === 'loading' && <p role="status">Đang tải danh sách tuyến xe…</p>}
          {!editing && routeOptions.status === 'error' && (
            <div className="admin-crud-form-error" role="alert">
              <p>Không thể tải danh sách tuyến xe.</p>
              <Button onClick={onRetryRouteOptions} type="button" variant="secondary">Thử lại tuyến xe</Button>
            </div>
          )}
          {!editing && routeOptions.status === 'success' && routeRows.length === 0 && (
            <p className="admin-crud-form-error" role="alert">Chưa có tuyến xe để tạo bảng giá.</p>
          )}

          {!editing && <div className="admin-crud-form-field">
            <label htmlFor={`${idPrefix}-vehicleTypeId`}>Loại xe *</label>
            <select
              aria-describedby={fieldErrors.vehicleTypeId ? `${idPrefix}-vehicleTypeId-error` : undefined}
              aria-invalid={Boolean(fieldErrors.vehicleTypeId)}
              disabled={submitting || vehicleTypeUnavailable}
              id={`${idPrefix}-vehicleTypeId`}
              onChange={(event) => updateField('vehicleTypeId', event.target.value)}
              required
              value={values.vehicleTypeId}
            >
              <option value="">Chọn loại xe</option>
              {vehicleTypeRows.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {fieldError('vehicleTypeId', `${idPrefix}-vehicleTypeId-error`)}
          </div>}
          {!editing && vehicleTypeOptions.status === 'loading' && <p role="status">Đang tải danh sách loại xe…</p>}
          {!editing && vehicleTypeOptions.status === 'error' && (
            <div className="admin-crud-form-error" role="alert">
              <p>Không thể tải danh sách loại xe.</p>
              <Button onClick={onRetryVehicleTypeOptions} type="button" variant="secondary">Thử lại loại xe</Button>
            </div>
          )}
          {!editing && vehicleTypeOptions.status === 'success' && vehicleTypeRows.length === 0 && (
            <p className="admin-crud-form-error" role="alert">Chưa có loại xe để tạo bảng giá.</p>
          )}

          <div className="admin-crud-form-field">
            <label htmlFor={`${idPrefix}-listedPrice`}>Giá niêm yết (VND) *</label>
            <input
              aria-describedby={fieldErrors.listedPrice ? `${idPrefix}-listedPrice-error` : undefined}
              aria-invalid={Boolean(fieldErrors.listedPrice)}
              autoComplete="off"
              disabled={submitting}
              id={`${idPrefix}-listedPrice`}
              inputMode="numeric"
              min="1"
              onChange={(event) => updateField('listedPrice', event.target.value)}
              required
              step="1"
              type="number"
              value={values.listedPrice}
            />
            {fieldError('listedPrice', `${idPrefix}-listedPrice-error`)}
          </div>

          <div className="admin-crud-form-field">
            <label htmlFor={`${idPrefix}-validFrom`}>Hiệu lực từ *</label>
            <input
              aria-describedby={fieldErrors.validFrom ? `${idPrefix}-validFrom-error` : undefined}
              aria-invalid={Boolean(fieldErrors.validFrom)}
              disabled={submitting}
              id={`${idPrefix}-validFrom`}
              onChange={(event) => updateField('validFrom', event.target.value)}
              required
              type="date"
              value={values.validFrom}
            />
            {fieldError('validFrom', `${idPrefix}-validFrom-error`)}
          </div>

          <div className="admin-crud-form-field">
            <label htmlFor={`${idPrefix}-validTo`}>Hiệu lực đến</label>
            <input
              aria-describedby={fieldErrors.validTo ? `${idPrefix}-validTo-error` : `${idPrefix}-validTo-hint`}
              aria-invalid={Boolean(fieldErrors.validTo)}
              disabled={submitting}
              id={`${idPrefix}-validTo`}
              min={values.validFrom || undefined}
              onChange={(event) => updateField('validTo', event.target.value)}
              type="date"
              value={values.validTo}
            />
            {fieldError('validTo', `${idPrefix}-validTo-error`)}
            {!fieldErrors.validTo && <span className={styles.fieldHint} id={`${idPrefix}-validTo-hint`}>Để trống nếu không giới hạn ngày kết thúc.</span>}
          </div>

          {!editing && <div className="admin-crud-form-field">
            <label htmlFor={`${idPrefix}-status`}>Trạng thái *</label>
            <select
              aria-describedby={fieldErrors.status ? `${idPrefix}-status-error` : undefined}
              aria-invalid={Boolean(fieldErrors.status)}
              disabled={submitting}
              id={`${idPrefix}-status`}
              onChange={(event) => updateField('status', event.target.value)}
              required
              value={values.status}
            >
              <option value="">Chọn trạng thái</option>
              <option value="HOAT_DONG">Hoạt động</option>
              <option value="TAM_NGUNG">Tạm ngưng</option>
            </select>
            {fieldError('status', `${idPrefix}-status-error`)}
          </div>}

          <div className="admin-crud-form-actions">
            <Button disabled={submitting} onClick={closeDialog} type="button" variant="secondary">Hủy</Button>
            <Button disabled={submitting || routeUnavailable || vehicleTypeUnavailable} type="submit">
              {submitting && <LoaderCircle aria-hidden="true" className="admin-crud-form-spinner" size={16} />}
              {submitting ? (editing ? 'Đang lưu…' : 'Đang tạo…') : (editing ? 'Lưu thay đổi' : 'Tạo bảng giá')}
            </Button>
          </div>
        </form>
      </>
    </AdminFormDialog>
  );
}
