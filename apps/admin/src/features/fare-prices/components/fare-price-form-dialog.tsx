'use client';

import { ResourceSheetForm } from '@/components/admin/resource-sheet-form';

import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRef, useState, type FormEvent } from 'react';
import { ResourceNotice, ResourceSheet } from '@/components/admin/resource-ui';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/action-button';
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
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
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

  if (
    !editing &&
    (!Number.isSafeInteger(routeId) ||
      routeId < 1 ||
      routeOptions.status !== 'success' ||
      routeOptions.options.length === 0)
  ) {
    errors.routeId = 'Vui lòng chọn tuyến xe.';
  }
  if (
    !editing &&
    (!Number.isSafeInteger(vehicleTypeId) ||
      vehicleTypeId < 1 ||
      vehicleTypeOptions.status !== 'success' ||
      vehicleTypeOptions.options.length === 0)
  ) {
    errors.vehicleTypeId = 'Vui lòng chọn loại xe.';
  }
  if (!values.listedPrice.trim())
    errors.listedPrice = 'Vui lòng nhập giá niêm yết.';
  else if (!Number.isSafeInteger(listedPrice) || listedPrice <= 0) {
    errors.listedPrice = 'Giá niêm yết phải là số nguyên VND lớn hơn 0.';
  }
  if (!isDateOnly(values.validFrom)) {
    errors.validFrom = 'Vui lòng chọn ngày bắt đầu hợp lệ.';
  }
  if (values.validTo && !isDateOnly(values.validTo)) {
    errors.validTo = 'Ngày kết thúc không hợp lệ.';
  } else if (
    values.validTo &&
    isDateOnly(values.validFrom) &&
    values.validTo < values.validFrom
  ) {
    errors.validTo = 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
  }
  if (
    !editing &&
    values.status !== 'HOAT_DONG' &&
    values.status !== 'TAM_NGUNG'
  ) {
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
  const idPrefix = editing
    ? `edit-fare-price-${farePrice.farePriceId}`
    : 'create-fare-price';
  const formRef = useRef<HTMLFormElement>(null);
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
  const [submitting, setSubmitting] = useState(false);

  function closeDialog() {
    if (!submittingRef.current) onClose();
  }

  function updateField(field: FormField, value: string) {
    // Lookup refreshes may re-announce the controlled Select value. A no-op
    // change must not erase the server validation error for that selection.
    if (values[field] === value) return;
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === 'validFrom' ? { validTo: undefined } : {}),
    }));
  }

  function setRelationError(
    field: 'routeId' | 'vehicleTypeId',
    message: string,
  ) {
    setFieldErrors((current) => ({ ...current, [field]: message }));
    focusFirstInvalid();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const errors = validate(values, routeOptions, vehicleTypeOptions, editing);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid();
      return;
    }

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
      onSaved(savedFarePrice);
    } catch (requestError: unknown) {
      if (requestError instanceof FarePriceApiError) {
        if (requestError.code === 'FARE_PRICE_OVERLAP') {
          toast.error(
            'Khoảng hiệu lực này bị trùng với một bảng giá đang hoạt động của cùng tuyến và loại xe.',
          );
        } else if (requestError.code === 'ROUTE_NOT_FOUND') {
          setRelationError(
            'routeId',
            'Tuyến xe không còn tồn tại. Vui lòng chọn lại.',
          );
          onRetryRouteOptions();
        } else if (requestError.code === 'VEHICLE_TYPE_NOT_FOUND') {
          setRelationError(
            'vehicleTypeId',
            'Loại xe không còn tồn tại. Vui lòng chọn lại.',
          );
          onRetryVehicleTypeOptions();
        } else if (requestError.code === 'FARE_PRICE_CONCURRENT_MODIFICATION') {
          toast.error(
            'Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng tải lại và thử lại.',
          );
        } else if (requestError.code === 'FARE_PRICE_NOT_FOUND' && editing) {
          onNotFound?.();
        } else {
          const serverErrors = mapServerFieldErrors(requestError.details);
          setFieldErrors(serverErrors);
          focusFirstInvalid();
          if (
            Object.keys(serverErrors).length === 0 ||
            Object.keys(serverErrors).length !== requestError.details.length
          ) {
            toast.error(requestError.message);
          }
        }
      } else if (requestError instanceof TypeError) {
        toast.error('Không thể kết nối đến máy chủ API. Vui lòng thử lại.');
      } else {
        toast.error(
          editing
            ? 'Không thể cập nhật bảng giá. Vui lòng thử lại.'
            : 'Không thể tạo bảng giá. Vui lòng thử lại.',
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function focusFirstInvalid() {
    requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')
        ?.focus(),
    );
  }
  const routeRows = optionRows(routeOptions);
  const vehicleTypeRows = optionRows(vehicleTypeOptions);
  const routeUnavailable =
    !editing && (routeOptions.status !== 'success' || routeRows.length === 0);
  const vehicleTypeUnavailable =
    !editing &&
    (vehicleTypeOptions.status !== 'success' || vehicleTypeRows.length === 0);

  function selectField(
    field: 'routeId' | 'vehicleTypeId' | 'status',
    label: string,
    placeholder: string,
    rows: { value: string; label: string }[],
    disabled: boolean,
  ) {
    return (
      <Field data-invalid={Boolean(fieldErrors[field])}>
        <FieldLabel htmlFor={`${idPrefix}-${field}`}>
          {label} <span aria-hidden>*</span>
        </FieldLabel>
        <Select
          disabled={disabled}
          value={values[field] || null}
          onValueChange={(value) => updateField(field, String(value ?? ''))}
        >
          <SelectTrigger
            id={`${idPrefix}-${field}`}
            aria-label={label}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors[field])}
            aria-describedby={
              fieldErrors[field] ? `${idPrefix}-${field}-error` : undefined
            }
          >
            <SelectValue placeholder={placeholder}>
              {rows.find((row) => row.value === values[field])?.label ??
                placeholder}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {rows.map((row) => (
                <SelectItem value={row.value} key={row.value}>
                  {row.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldError id={`${idPrefix}-${field}-error`}>
          {fieldErrors[field]}
        </FieldError>
      </Field>
    );
  }
  return (
    <ResourceSheet
      title={editing ? 'Chỉnh sửa bảng giá' : 'Thêm bảng giá'}
      description={
        editing
          ? 'Cập nhật giá niêm yết và thời gian hiệu lực của bảng giá.'
          : 'Thiết lập giá vé theo tuyến, loại xe và thời gian hiệu lực.'
      }
      busy={submitting}
      preventDismiss={submitting}
      onClose={closeDialog}
    >
      <ResourceSheetForm
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        footer={
          <div className="-mx-4 flex justify-end gap-3 border-t bg-popover px-4 py-4 sm:-mx-6 sm:px-6 shrink-0">
            <Button disabled={submitting} variant="outline" onClick={closeDialog}>
              Hủy
            </Button>
            <Button
              disabled={submitting || routeUnavailable || vehicleTypeUnavailable}
              aria-busy={submitting}
              type="submit"
            >
              {submitting && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {submitting
                ? editing
                  ? 'Đang lưu…'
                  : 'Đang tạo…'
                : editing
                  ? 'Lưu thay đổi'
                  : 'Tạo bảng giá'}
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-1 rounded-[var(--admin-radius-panel)] border bg-muted/40 p-4 text-[13px]">
            <strong className="admin-data-mono">{farePrice.route.code}</strong>
            <p className="break-words">
              {farePrice.route.origin} → {farePrice.route.destination}
            </p>
            <p className="text-xs text-muted-foreground">
              {farePrice.vehicleType.name} ·{' '}
              {farePrice.status === 'HOAT_DONG' ? 'Hoạt động' : 'Tạm ngưng'}
            </p>
          </div>
        )}
        {!editing && (
          <>
            {selectField(
              'routeId',
              'Tuyến xe',
              'Chọn tuyến xe',
              routeRows.map((row) => ({
                value: String(row.id),
                label: row.label,
              })),
              submitting || routeUnavailable,
            )}
            {routeOptions.status === 'loading' && (
              <p className="text-xs text-muted-foreground" role="status">
                Đang tải danh sách tuyến xe…
              </p>
            )}
            {routeOptions.status === 'error' && (
              <ResourceNotice kind="error">
                <p>Không thể tải danh sách tuyến xe.</p>
                <Button
                  disabled={submitting}
                  className="mt-2"
                  variant="outline"
                  size="sm"
                  onClick={onRetryRouteOptions}
                >
                  Thử lại tuyến xe
                </Button>
              </ResourceNotice>
            )}
            {routeOptions.status === 'success' && routeRows.length === 0 && (
              <ResourceNotice kind="error">
                Chưa có tuyến xe để tạo bảng giá.
              </ResourceNotice>
            )}
            {selectField(
              'vehicleTypeId',
              'Loại xe',
              'Chọn loại xe',
              vehicleTypeRows.map((row) => ({
                value: String(row.id),
                label: row.label,
              })),
              submitting || vehicleTypeUnavailable,
            )}
            {vehicleTypeOptions.status === 'loading' && (
              <p className="text-xs text-muted-foreground" role="status">
                Đang tải danh sách loại xe…
              </p>
            )}
            {vehicleTypeOptions.status === 'error' && (
              <ResourceNotice kind="error">
                <p>Không thể tải danh sách loại xe.</p>
                <Button
                  disabled={submitting}
                  className="mt-2"
                  variant="outline"
                  size="sm"
                  onClick={onRetryVehicleTypeOptions}
                >
                  Thử lại loại xe
                </Button>
              </ResourceNotice>
            )}
            {vehicleTypeOptions.status === 'success' &&
              vehicleTypeRows.length === 0 && (
                <ResourceNotice kind="error">
                  Chưa có loại xe để tạo bảng giá.
                </ResourceNotice>
              )}
          </>
        )}
        <Field data-invalid={Boolean(fieldErrors.listedPrice)}>
          <FieldLabel htmlFor={`${idPrefix}-listedPrice`}>
            Giá niêm yết (VND) <span aria-hidden>*</span>
          </FieldLabel>
          <Input
            id={`${idPrefix}-listedPrice`}
            aria-describedby={
              fieldErrors.listedPrice
                ? `${idPrefix}-listedPrice-error`
                : undefined
            }
            aria-invalid={Boolean(fieldErrors.listedPrice)}
            autoComplete="off"
            disabled={submitting}
            inputMode="numeric"
            min="1"
            step="1"
            required
            type="number"
            value={values.listedPrice}
            onChange={(event) => updateField('listedPrice', event.target.value)}
          />
          <FieldError id={`${idPrefix}-listedPrice-error`}>
            {fieldErrors.listedPrice}
          </FieldError>
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(fieldErrors.validFrom)}>
            <FieldLabel htmlFor={`${idPrefix}-validFrom`}>
              Hiệu lực từ <span aria-hidden>*</span>
            </FieldLabel>
            <Input
              id={`${idPrefix}-validFrom`}
              aria-describedby={
                fieldErrors.validFrom
                  ? `${idPrefix}-validFrom-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.validFrom)}
              disabled={submitting}
              required
              type="date"
              value={values.validFrom}
              onChange={(event) => updateField('validFrom', event.target.value)}
            />
            <FieldError id={`${idPrefix}-validFrom-error`}>
              {fieldErrors.validFrom}
            </FieldError>
          </Field>
          <Field data-invalid={Boolean(fieldErrors.validTo)}>
            <FieldLabel htmlFor={`${idPrefix}-validTo`}>
              Hiệu lực đến
            </FieldLabel>
            <Input
              id={`${idPrefix}-validTo`}
              aria-describedby={
                fieldErrors.validTo
                  ? `${idPrefix}-validTo-error`
                  : `${idPrefix}-validTo-hint`
              }
              aria-invalid={Boolean(fieldErrors.validTo)}
              disabled={submitting}
              min={values.validFrom || undefined}
              type="date"
              value={values.validTo}
              onChange={(event) => updateField('validTo', event.target.value)}
            />
            <FieldError id={`${idPrefix}-validTo-error`}>
              {fieldErrors.validTo}
            </FieldError>
            {!fieldErrors.validTo && (
              <p
                className="text-xs text-muted-foreground"
                id={`${idPrefix}-validTo-hint`}
              >
                Để trống nếu không giới hạn ngày kết thúc.
              </p>
            )}
          </Field>
        </div>
        {!editing &&
          selectField(
            'status',
            'Trạng thái',
            'Chọn trạng thái',
            [
              { value: 'HOAT_DONG', label: 'Hoạt động' },
              { value: 'TAM_NGUNG', label: 'Tạm ngưng' },
            ],
            submitting,
          )}
      </ResourceSheetForm>
    </ResourceSheet>
  );
}
