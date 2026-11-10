'use client';

import { ResourceModalForm } from '@/components/admin/resource-modal-form';

import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ResourceNotice, ResourceModalDialog } from '@/components/admin/resource-ui';
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
  tFare: (key: string) => string,
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
    errors.routeId = tFare('errors.routeRequired');
  }
  if (
    !editing &&
    (!Number.isSafeInteger(vehicleTypeId) ||
      vehicleTypeId < 1 ||
      vehicleTypeOptions.status !== 'success' ||
      vehicleTypeOptions.options.length === 0)
  ) {
    errors.vehicleTypeId = tFare('errors.typeRequired');
  }
  if (!values.listedPrice.trim())
    errors.listedPrice = tFare('errors.priceRequired');
  else if (!Number.isSafeInteger(listedPrice) || listedPrice <= 0) {
    errors.listedPrice = tFare('errors.pricePositiveInteger');
  }
  if (!isDateOnly(values.validFrom)) {
    errors.validFrom = tFare('errors.validFromRequired');
  }
  if (values.validTo && !isDateOnly(values.validTo)) {
    errors.validTo = tFare('errors.validToInvalid');
  } else if (
    values.validTo &&
    isDateOnly(values.validFrom) &&
    values.validTo < values.validFrom
  ) {
    errors.validTo = tFare('errors.validToAfterValidFrom');
  }
  if (
    !editing &&
    values.status !== 'HOAT_DONG' &&
    values.status !== 'TAM_NGUNG'
  ) {
    errors.status = tFare('errors.statusRequired');
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
  const tFare = useTranslations('farePrices');
  const tCommon = useTranslations('common');
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

    const errors = validate(values, routeOptions, vehicleTypeOptions, editing, tFare);
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
            tFare('errors.overlapActive'),
          );
        } else if (requestError.code === 'ROUTE_NOT_FOUND') {
          setRelationError(
            'routeId',
            tFare('errors.routeNotFound'),
          );
          onRetryRouteOptions();
        } else if (requestError.code === 'VEHICLE_TYPE_NOT_FOUND') {
          setRelationError(
            'vehicleTypeId',
            tFare('errors.vehicleTypeNotFound'),
          );
          onRetryVehicleTypeOptions();
        } else if (requestError.code === 'FARE_PRICE_CONCURRENT_MODIFICATION') {
          toast.error(
            tFare('errors.concurrentModification'),
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
        toast.error(tFare('networkError'));
      } else {
        toast.error(
          editing
            ? tFare('errors.updateFailed')
            : tFare('errors.createFailed'),
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
          onValueChange={(value, details) => {
            // Base UI clears an unmatched selection while lookup items unmount.
            // That synchronization is not a user edit and must retain the
            // selected ID and its server error until another option is chosen.
            if (value === null && details.reason === 'none') {
              details.cancel();
              return;
            }
            updateField(field, String(value ?? ''));
          }}
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
    <ResourceModalDialog
      title={editing ? tFare('formEditTitle') : tFare('formCreateTitle')}
      description={
        editing
          ? tFare('formEditDesc')
          : tFare('formCreateDesc')
      }
      busy={submitting}
      preventDismiss={submitting}
      onClose={closeDialog}
      size="lg"
    >
      <ResourceModalForm
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        footer={
          <div className="-mx-5 -mb-5 flex justify-end gap-3 border-t bg-slate-50/80 dark:bg-slate-900/60 px-5 py-3.5 sm:-mx-6 sm:-mb-6 sm:px-6 shrink-0">
            <Button disabled={submitting} variant="outline" onClick={closeDialog}>
              {tCommon('cancel')}
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
                  ? tFare('formSubmittingEdit')
                  : tFare('formSubmittingCreate')
                : editing
                  ? tFare('formSubmitEdit')
                  : tFare('formSubmitCreate')}
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
              {farePrice.status === 'HOAT_DONG' ? tFare('statusActive') : tFare('statusSuspended')}
            </p>
          </div>
        )}
        {!editing && (
          <>
            {selectField(
              'routeId',
              tFare('route'),
              tFare('formRoutePlaceholder'),
              routeRows.map((row) => ({
                value: String(row.id),
                label: row.label,
              })),
              submitting || routeUnavailable,
            )}
            {routeOptions.status === 'loading' && (
              <p className="text-xs text-muted-foreground" role="status">
                {tFare('loadingFilters')}
              </p>
            )}
            {routeOptions.status === 'error' && (
              <ResourceNotice kind="error">
                <p>{tFare('failedFilters')}</p>
                <Button
                  disabled={submitting}
                  className="mt-2"
                  variant="outline"
                  size="sm"
                  onClick={onRetryRouteOptions}
                >
                  {tFare('retryRoute')}
                </Button>
              </ResourceNotice>
            )}
            {routeOptions.status === 'success' && routeRows.length === 0 && (
              <ResourceNotice kind="error">
                {tFare('failedFilters')}
              </ResourceNotice>
            )}
            {selectField(
              'vehicleTypeId',
              tFare('vehicleType'),
              tFare('formVehicleTypePlaceholder'),
              vehicleTypeRows.map((row) => ({
                value: String(row.id),
                label: row.label,
              })),
              submitting || vehicleTypeUnavailable,
            )}
            {vehicleTypeOptions.status === 'loading' && (
              <p className="text-xs text-muted-foreground" role="status">
                {tFare('loadingFilters')}
              </p>
            )}
            {vehicleTypeOptions.status === 'error' && (
              <ResourceNotice kind="error">
                <p>{tFare('failedFilters')}</p>
                <Button
                  disabled={submitting}
                  className="mt-2"
                  variant="outline"
                  size="sm"
                  onClick={onRetryVehicleTypeOptions}
                >
                  {tFare('retryVehicleType')}
                </Button>
              </ResourceNotice>
            )}
            {vehicleTypeOptions.status === 'success' &&
              vehicleTypeRows.length === 0 && (
                <ResourceNotice kind="error">
                  {tFare('failedFilters')}
                </ResourceNotice>
              )}
          </>
        )}
        <Field data-invalid={Boolean(fieldErrors.listedPrice)}>
          <FieldLabel htmlFor={`${idPrefix}-listedPrice`}>
            {tFare('formPriceLabel')} <span aria-hidden>*</span>
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
              {tFare('colValidFrom')} <span aria-hidden>*</span>
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
              {tFare('colValidTo')}
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
                {tFare('unlimitedDate')}
              </p>
            )}
          </Field>
        </div>
        {!editing &&
          selectField(
            'status',
            tFare('colStatus'),
            tFare('filterStatus'),
            [
              { value: 'HOAT_DONG', label: tFare('statusActive') },
              { value: 'TAM_NGUNG', label: tFare('statusSuspended') },
            ],
            submitting,
          )}
      </ResourceModalForm>
    </ResourceModalDialog>
  );
}
