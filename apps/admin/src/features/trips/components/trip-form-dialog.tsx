'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
import {
  createTrip,
  TripApiError,
  updateTrip,
  type TripApiErrorDetail,
} from '../services/trip-service';
import type {
  Trip,
  TripLookupOptionsState,
} from '../types/trip';

type TripFormDialogProps = {
  routeOptions: TripLookupOptionsState;
  vehicleOptions: TripLookupOptionsState;
  onRetryRouteOptions: () => void;
  onRetryVehicleOptions: () => void;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
  trip?: Trip;
};

type Values = {
  code: string;
  routeId: string;
  vehicleId: string;
  departureDate: string;
  departureTime: string;
};
type Field = keyof Values;
type FieldErrors = Partial<Record<Field, string>>;

function mappedErrors(details: TripApiErrorDetail[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const detail of details) {
    if (
      detail.field === 'code' ||
      detail.field === 'routeId' ||
      detail.field === 'vehicleId' ||
      detail.field === 'departureDate' ||
      detail.field === 'departureTime'
    ) {
      errors[detail.field] = detail.message;
    }
  }
  return errors;
}

function normalizeTime(time: string): string {
  const trimmed = time.trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  return trimmed;
}

export function TripFormDialog({
  routeOptions,
  vehicleOptions,
  onRetryRouteOptions,
  onRetryVehicleOptions,
  onClose,
  onSaved,
  trip,
}: TripFormDialogProps) {
  const editing = trip !== undefined;
  const idPrefix = editing ? `edit-trip-${trip.tripId}` : 'create-trip';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);

  const [values, setValues] = useState<Values>(() => ({
    code: trip?.code ?? '',
    routeId: trip ? String(trip.route.routeId) : '',
    vehicleId: trip ? String(trip.vehicle.vehicleId) : '',
    departureDate: trip?.departureDate ?? '',
    departureTime: trip?.departureTime ? trip.departureTime.slice(0, 5) : '',
  }));

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOptionsLoading =
    !editing &&
    (routeOptions.status === 'loading' || vehicleOptions.status === 'loading');
  const isOptionsError =
    !editing &&
    (routeOptions.status === 'error' || vehicleOptions.status === 'error');

  function closeDialog() {
    if (!submittingRef.current) {
      dialogRef.current?.close();
    }
  }

  function updateField(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!editing) {
      const code = values.code.trim();
      if (!code) {
        errors.code = 'Vui lòng nhập mã chuyến xe.';
      } else if (code.length > 50) {
        errors.code = 'Mã chuyến không được vượt quá 50 ký tự.';
      }

      if (
        !values.routeId ||
        !Number.isSafeInteger(Number(values.routeId)) ||
        Number(values.routeId) < 1
      ) {
        errors.routeId = 'Vui lòng chọn tuyến xe.';
      }

      if (
        !values.vehicleId ||
        !Number.isSafeInteger(Number(values.vehicleId)) ||
        Number(values.vehicleId) < 1
      ) {
        errors.vehicleId = 'Vui lòng chọn xe phục vụ.';
      }
    }

    if (!values.departureDate.trim()) {
      errors.departureDate = 'Vui lòng chọn ngày khởi hành.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.departureDate.trim())) {
      errors.departureDate = 'Ngày khởi hành không đúng định dạng YYYY-MM-DD.';
    }

    if (!values.departureTime.trim()) {
      errors.departureTime = 'Vui lòng chọn giờ khởi hành.';
    } else if (
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(values.departureTime.trim())
    ) {
      errors.departureTime = 'Giờ khởi hành không hợp lệ (HH:mm).';
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      submittingRef.current ||
      (!editing &&
        (routeOptions.status !== 'success' ||
          routeOptions.options.length === 0 ||
          vehicleOptions.status !== 'success' ||
          vehicleOptions.options.length === 0))
    ) {
      return;
    }

    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const formattedTime = normalizeTime(values.departureTime);
      let saved: Trip;

      if (editing) {
        saved = await updateTrip(trip.tripId, {
          departureDate: values.departureDate.trim(),
          departureTime: formattedTime,
        });
      } else {
        saved = await createTrip({
          code: values.code.trim(),
          routeId: Number(values.routeId),
          vehicleId: Number(values.vehicleId),
          departureDate: values.departureDate.trim(),
          departureTime: formattedTime,
        });
      }

      dialogRef.current?.close();
      onSaved(saved);
    } catch (error: unknown) {
      if (error instanceof TripApiError) {
        if (error.code === 'TRIP_CODE_EXISTS') {
          setFieldErrors((curr) => ({
            ...curr,
            code: 'Mã chuyến xe đã tồn tại trong hệ thống.',
          }));
        } else if (error.code === 'VEHICLE_HAS_NO_SEATS') {
          setFieldErrors((curr) => ({
            ...curr,
            vehicleId:
              'Xe chưa được cấu hình ghế nên chưa thể lập chuyến xe.',
          }));
        } else if (error.details.length > 0) {
          setFieldErrors(mappedErrors(error.details));
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError(
          error instanceof TypeError
            ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
            : error instanceof Error
              ? error.message
              : 'Không thể lưu chuyến xe.',
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
            <p className="eyebrow">
              {editing ? 'CHỈNH SỬA CHUYẾN' : 'TẠO MỚI CHUYẾN'}
            </p>
            <h2 id={`${idPrefix}-title`}>
              {editing ? 'Chỉnh sửa chuyến xe' : 'Thêm chuyến xe mới'}
            </h2>
          </div>
          <form method="dialog">
            <button
              aria-label={
                editing
                  ? 'Đóng hộp thoại chỉnh sửa chuyến'
                  : 'Đóng hộp thoại thêm chuyến'
              }
              className="icon-button"
              disabled={submitting}
              onClick={closeDialog}
              type="button"
            >
              <X aria-hidden="true" size={19} />
            </button>
          </form>
        </div>

        <form className="admin-crud-form" noValidate onSubmit={handleSubmit}>
          <p className="admin-form-dialog__description" id={`${idPrefix}-description`}>
            {editing
              ? 'Cập nhật ngày và giờ khởi hành của chuyến xe.'
              : 'Nhập thông tin chuyến xe, chọn tuyến và xe phục vụ để tạo chuyến và khởi tạo ghế.'}
          </p>

          {editing ? (
            <div className="admin-crud-form-field">
              <label>Thông tin chuyến hiện tại</label>
              <div className="trips-detail-fields" style={{ background: 'var(--admin-surface)', padding: '12px', borderRadius: 'var(--admin-radius-card)', border: '1px solid var(--admin-border)' }}>
                <div>
                  <dt>Mã chuyến</dt>
                  <dd><strong>{trip.code}</strong></dd>
                </div>
                <div>
                  <dt>Tuyến</dt>
                  <dd>{trip.route.origin} → {trip.route.destination}</dd>
                </div>
                <div>
                  <dt>Xe</dt>
                  <dd>{trip.vehicle.licensePlate} ({trip.vehicle.vehicleType.name})</dd>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="admin-crud-form-field">
                <label htmlFor={`${idPrefix}-code`}>
                  Mã chuyến xe <span aria-hidden="true">*</span>
                </label>
                <input
                  aria-describedby={
                    fieldErrors.code ? `${idPrefix}-code-error` : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.code)}
                  aria-required="true"
                  autoComplete="off"
                  disabled={submitting}
                  id={`${idPrefix}-code`}
                  maxLength={50}
                  onChange={(e) => updateField('code', e.target.value)}
                  placeholder="Ví dụ: FUTA-CX-001"
                  type="text"
                  value={values.code}
                />
                {fieldErrors.code && (
                  <span
                    className="admin-crud-form-field-error"
                    id={`${idPrefix}-code-error`}
                    role="alert"
                  >
                    {fieldErrors.code}
                  </span>
                )}
              </div>

              <div className="admin-crud-form-field">
                <label htmlFor={`${idPrefix}-route`}>
                  Tuyến xe <span aria-hidden="true">*</span>
                </label>
                {routeOptions.status === 'loading' && (
                  <p className="routes-option-state" role="status">
                    Đang tải danh sách tuyến xe…
                  </p>
                )}
                {routeOptions.status === 'error' && (
                  <div className="routes-option-state" role="alert">
                    <span>{routeOptions.message}</span>
                    <Button
                      onClick={onRetryRouteOptions}
                      type="button"
                      variant="secondary"
                    >
                      Thử tải lại
                    </Button>
                  </div>
                )}
                {routeOptions.status === 'success' && (
                  <select
                    aria-describedby={
                      fieldErrors.routeId
                        ? `${idPrefix}-route-error`
                        : undefined
                    }
                    aria-invalid={Boolean(fieldErrors.routeId)}
                    aria-required="true"
                    disabled={submitting || routeOptions.options.length === 0}
                    id={`${idPrefix}-route`}
                    onChange={(e) => updateField('routeId', e.target.value)}
                    value={values.routeId}
                  >
                    <option value="">
                      {routeOptions.options.length === 0
                        ? 'Chưa có tuyến xe nào'
                        : '-- Chọn tuyến xe --'}
                    </option>
                    {routeOptions.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                {fieldErrors.routeId && (
                  <span
                    className="admin-crud-form-field-error"
                    id={`${idPrefix}-route-error`}
                    role="alert"
                  >
                    {fieldErrors.routeId}
                  </span>
                )}
              </div>

              <div className="admin-crud-form-field">
                <label htmlFor={`${idPrefix}-vehicle`}>
                  Xe phục vụ <span aria-hidden="true">*</span>
                </label>
                {vehicleOptions.status === 'loading' && (
                  <p className="routes-option-state" role="status">
                    Đang tải danh sách xe…
                  </p>
                )}
                {vehicleOptions.status === 'error' && (
                  <div className="routes-option-state" role="alert">
                    <span>{vehicleOptions.message}</span>
                    <Button
                      onClick={onRetryVehicleOptions}
                      type="button"
                      variant="secondary"
                    >
                      Thử tải lại
                    </Button>
                  </div>
                )}
                {vehicleOptions.status === 'success' && (
                  <select
                    aria-describedby={
                      fieldErrors.vehicleId
                        ? `${idPrefix}-vehicle-error`
                        : undefined
                    }
                    aria-invalid={Boolean(fieldErrors.vehicleId)}
                    aria-required="true"
                    disabled={submitting || vehicleOptions.options.length === 0}
                    id={`${idPrefix}-vehicle`}
                    onChange={(e) => updateField('vehicleId', e.target.value)}
                    value={values.vehicleId}
                  >
                    <option value="">
                      {vehicleOptions.options.length === 0
                        ? 'Chưa có xe nào'
                        : '-- Chọn xe phục vụ --'}
                    </option>
                    {vehicleOptions.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                {fieldErrors.vehicleId && (
                  <span
                    className="admin-crud-form-field-error"
                    id={`${idPrefix}-vehicle-error`}
                    role="alert"
                  >
                    {fieldErrors.vehicleId}
                  </span>
                )}
              </div>
            </>
          )}

          <div className="admin-crud-form-field">
            <label htmlFor={`${idPrefix}-departure-date`}>
              Ngày khởi hành <span aria-hidden="true">*</span>
            </label>
            <input
              aria-describedby={
                fieldErrors.departureDate
                  ? `${idPrefix}-date-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.departureDate)}
              aria-required="true"
              disabled={submitting}
              id={`${idPrefix}-departure-date`}
              onChange={(e) => updateField('departureDate', e.target.value)}
              type="date"
              value={values.departureDate}
            />
            {fieldErrors.departureDate && (
              <span
                className="admin-crud-form-field-error"
                id={`${idPrefix}-date-error`}
                role="alert"
              >
                {fieldErrors.departureDate}
              </span>
            )}
          </div>

          <div className="admin-crud-form-field">
            <label htmlFor={`${idPrefix}-departure-time`}>
              Giờ khởi hành <span aria-hidden="true">*</span>
            </label>
            <input
              aria-describedby={
                fieldErrors.departureTime
                  ? `${idPrefix}-time-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.departureTime)}
              aria-required="true"
              disabled={submitting}
              id={`${idPrefix}-departure-time`}
              onChange={(e) => updateField('departureTime', e.target.value)}
              placeholder="HH:mm (ví dụ 07:30)"
              type="time"
              value={values.departureTime}
            />
            {fieldErrors.departureTime && (
              <span
                className="admin-crud-form-field-error"
                id={`${idPrefix}-time-error`}
                role="alert"
              >
                {fieldErrors.departureTime}
              </span>
            )}
          </div>

          {formError && (
            <p className="admin-crud-form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="admin-crud-form-actions">
            <Button
              disabled={submitting}
              onClick={closeDialog}
              type="button"
              variant="secondary"
            >
              Hủy
            </Button>
            <Button
              disabled={submitting || isOptionsLoading || isOptionsError}
              type="submit"
            >
              {submitting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="admin-crud-form-spinner"
                  size={15}
                />
              )}
              {submitting
                ? editing
                  ? 'Đang lưu…'
                  : 'Đang tạo…'
                : editing
                  ? 'Cập nhật chuyến'
                  : 'Tạo chuyến xe'}
            </Button>
          </div>
        </form>
      </>
    </AdminFormDialog>
  );
}
