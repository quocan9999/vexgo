'use client';

import { LoaderCircle } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { ResourceGeneratedCodeField } from '@/components/admin/resource-generated-code-field';
import { useBusinessCodePreview } from '@/hooks/use-business-code-preview';
import { ResourceSheet, ResourceNotice } from '@/components/admin/resource-ui';
import {
  Field as FormField,
  FieldLabel,
  FieldError,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Button } from '@/components/ui/action-button';
import {
  createTrip,
  TripApiError,
  updateTrip,
  type TripApiErrorDetail,
} from '../services/trip-service';
import type { Trip, TripLookupOptionsState } from '../types/trip';

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
  routeId: string;
  vehicleId: string;
  departureDate: string;
  departureTime: string;
  acceptsShipments: boolean;
};
type Field = Exclude<keyof Values, 'acceptsShipments'>;
type FieldErrors = Partial<Record<Field, string>>;

function mappedErrors(details: TripApiErrorDetail[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const detail of details) {
    if (
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
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  const [values, setValues] = useState<Values>(() => ({
    routeId: trip ? String(trip.route.routeId) : '',
    vehicleId: trip ? String(trip.vehicle.vehicleId) : '',
    departureDate: trip?.departureDate ?? '',
    departureTime: trip?.departureTime ? trip.departureTime.slice(0, 5) : '',
    acceptsShipments: false,
  }));

  const codePreview = useBusinessCodePreview(
    'trips',
    !editing,
    values.departureDate,
  );

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const isOptionsLoading =
    !editing &&
    (routeOptions.status === 'loading' || vehicleOptions.status === 'loading');
  const isOptionsError =
    !editing &&
    (routeOptions.status === 'error' || vehicleOptions.status === 'error');

  function closeDialog() {
    if (!submittingRef.current) {
      onClose();
    }
  }

  function updateField(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!editing) {
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

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }

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
          routeId: Number(values.routeId),
          vehicleId: Number(values.vehicleId),
          departureDate: values.departureDate.trim(),
          departureTime: formattedTime,
          acceptsShipments: values.acceptsShipments,
        });
      }

      onSaved(saved);
    } catch (error: unknown) {
      if (error instanceof TripApiError) {
        if (error.code === 'TRIP_CODE_EXISTS') {
          toast.error('Không thể cấp mã chuyến. Vui lòng thử tạo lại.');
        } else if (error.code === 'ROUTE_NOT_ACTIVE') {
          setFieldErrors((curr) => ({
            ...curr,
            routeId: error.message,
          }));
        } else if (error.code === 'VEHICLE_NOT_ACTIVE') {
          setFieldErrors((curr) => ({
            ...curr,
            vehicleId: error.message,
          }));
        } else if (error.code === 'VEHICLE_HAS_NO_SEATS') {
          setFieldErrors((curr) => ({
            ...curr,
            vehicleId: 'Xe chưa được cấu hình ghế nên chưa thể lập chuyến xe.',
          }));
        } else if (error.details.length > 0) {
          const mapped = mappedErrors(error.details);
          setFieldErrors(mapped);
          if (error.details.some((detail) => !(detail.field in mapped)))
            toast.error(error.message);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error(
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
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
    }
  }

  function relationField(
    field: 'routeId' | 'vehicleId',
    label: string,
    options: TripLookupOptionsState,
    retry: () => void,
  ) {
    return (
      <FormField data-invalid={Boolean(fieldErrors[field])}>
        <FieldLabel htmlFor={`${idPrefix}-${field}`}>{label}</FieldLabel>
        {options.status === 'loading' && (
          <p role="status" className="text-sm text-muted-foreground">
            Đang tải {label.toLocaleLowerCase()}…
          </p>
        )}
        {options.status === 'error' && (
          <ResourceNotice kind="error">
            <span>{options.message}</span>
            <Button disabled={submitting} onClick={retry} variant="outline">
              Thử tải lại
            </Button>
          </ResourceNotice>
        )}
        {options.status === 'success' && (
          <Select
            value={values[field] || null}
            onValueChange={(value) => updateField(field, String(value ?? ''))}
          >
            <SelectTrigger
              id={`${idPrefix}-${field}`}
              disabled={submitting || !options.options.length}
              aria-required="true"
              aria-invalid={Boolean(fieldErrors[field])}
              aria-describedby={
                fieldErrors[field] ? `${idPrefix}-${field}-error` : undefined
              }
            >
              <SelectValue>
                {options.options.find(
                  (option) => String(option.id) === values[field],
                )?.label ??
                  (options.options.length
                    ? `Chọn ${label.toLocaleLowerCase()}`
                    : `Chưa có ${label.toLocaleLowerCase()}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.options.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {fieldErrors[field] && (
          <FieldError id={`${idPrefix}-${field}-error`}>
            {fieldErrors[field]}
          </FieldError>
        )}
      </FormField>
    );
  }

  return (
    <ResourceSheet
      title={editing ? 'Chỉnh sửa chuyến xe' : 'Thêm chuyến xe'}
      description={
        editing
          ? 'Cập nhật ngày và giờ khởi hành của chuyến xe.'
          : 'Chọn tuyến, xe phục vụ và thời gian khởi hành để tạo chuyến và khởi tạo ghế.'
      }
      busy={submitting}
      preventDismiss={submitting}
      onClose={onClose}
    >
      <form
        ref={formRef}
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit}
      >
        {editing ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-[13px]">
            <p className="admin-data-mono font-semibold">{trip.code}</p>
            <p>
              {trip.route.origin} → {trip.route.destination}
            </p>
            <p>
              <span className="admin-data-mono">
                {trip.vehicle.licensePlate}
              </span>{' '}
              · {trip.vehicle.vehicleType.name}
            </p>
          </div>
        ) : (
          <>
            <ResourceGeneratedCodeField
              id={`${idPrefix}-code`}
              label="Mã chuyến xe"
              code={codePreview.code}
              placeholder={codePreview.placeholder}
              error={codePreview.error}
              onRetry={codePreview.retry}
              busy={submitting}
            />
            {relationField(
              'routeId',
              'Tuyến xe',
              routeOptions,
              onRetryRouteOptions,
            )}
            {relationField(
              'vehicleId',
              'Xe phục vụ',
              vehicleOptions,
              onRetryVehicleOptions,
            )}
            <label
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-[13px] font-semibold"
              htmlFor={`${idPrefix}-accepts-shipments`}
            >
              <input
                className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                id={`${idPrefix}-accepts-shipments`}
                type="checkbox"
                checked={values.acceptsShipments}
                disabled={submitting}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    acceptsShipments: event.target.checked,
                  }))
                }
              />
              Nhận gửi hàng
            </label>
          </>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          {(['departureDate', 'departureTime'] as const).map((field) => (
            <FormField key={field} data-invalid={Boolean(fieldErrors[field])}>
              <FieldLabel htmlFor={`${idPrefix}-${field}`}>
                {field === 'departureDate' ? 'Ngày khởi hành' : 'Giờ khởi hành'}
              </FieldLabel>
              <Input
                id={`${idPrefix}-${field}`}
                type={field === 'departureDate' ? 'date' : 'time'}
                value={values[field]}
                disabled={submitting}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors[field])}
                aria-describedby={
                  fieldErrors[field] ? `${idPrefix}-${field}-error` : undefined
                }
                onChange={(event) => updateField(field, event.target.value)}
              />
              {fieldErrors[field] && (
                <FieldError id={`${idPrefix}-${field}-error`}>
                  {fieldErrors[field]}
                </FieldError>
              )}
            </FormField>
          ))}
        </div>
        <div className="sticky -bottom-4 -mx-4 flex justify-end gap-3 border-t bg-card px-4 py-4 sm:-bottom-6 sm:-mx-6 sm:px-6">
          <Button disabled={submitting} onClick={closeDialog} variant="outline">
            Hủy
          </Button>
          <Button
            disabled={
              submitting ||
              isOptionsLoading ||
              isOptionsError ||
              (!editing &&
                (routeOptions.status !== 'success' ||
                  !routeOptions.options.length ||
                  vehicleOptions.status !== 'success' ||
                  !vehicleOptions.options.length))
            }
            type="submit"
          >
            {submitting && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {submitting
              ? 'Đang lưu…'
              : editing
                ? 'Lưu thay đổi'
                : 'Tạo chuyến xe'}
          </Button>
        </div>
      </form>
    </ResourceSheet>
  );
}
