'use client';

import { ResourceModalForm } from '@/components/admin/resource-modal-form';
import { useTranslations } from 'next-intl';
import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRef, useState, type FormEvent } from 'react';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { ResourceNotice, ResourceModalDialog } from '@/components/admin/resource-ui';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/action-button';
import type { VehicleFilterOptionState } from '../hooks/use-vehicle-filter-options';
import {
  createVehicle,
  updateVehicle,
  VehicleApiError,
} from '../services/vehicle-service';
import {
  VEHICLE_STATUSES,
  type VehicleDetail,
  type VehicleSeatLayoutInput,
  type VehicleStatus,
} from '../types/vehicle';
import { SeatLayoutEditor } from './seat-layout-editor';
import { compactSeatNumbersAfterRemoval } from './seat-layout-utils';
import type { SeatLayoutItem } from './seat-layout-utils';

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
  vehicleTypeId: string;
  status: VehicleStatus;
};

type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField | 'seats', string>>;

export function VehicleFormDialog({
  vehicle,
  vehicleTypes,
  onRetryOptions,
  onClose,
  onSaved,
}: VehicleFormDialogProps) {
  const tVehicles = useTranslations('vehicles');
  const tCommon = useTranslations('common');
  const authState = useAdminSession();
  const tenantId =
    authState.status === 'authenticated'
      ? authState.session.busCompanyId
      : null;
  const editing = vehicle !== undefined;
  const idPrefix = editing
    ? `edit-vehicle-${vehicle.vehicleId}`
    : 'create-vehicle';
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>(() => ({
    licensePlate: vehicle?.licensePlate ?? '',
    vehicleTypeId: String(vehicle?.vehicleType.vehicleTypeId ?? ''),
    status: 'HOAT_DONG',
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [layoutSeats, setLayoutSeats] = useState<SeatLayoutItem[]>([]);
  const optionsReady = Boolean(tenantId) && vehicleTypes.status === 'success';
  const optionErrors = [
    vehicleTypes.status === 'error'
      ? tVehicles('optionsErrorPrefixVehicleType', {
          error: vehicleTypes.message,
        })
      : null,
  ].filter((message): message is string => message !== null);

  function closeDialog() {
    if (!submittingRef.current) onClose();
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
    const vehicleTypeId = Number(values.vehicleTypeId);

    if (!licensePlate) errors.licensePlate = tVehicles('errors.plateRequired');
    else if (licensePlate.length > 15) {
      errors.licensePlate = tVehicles('errors.plateMaxLength');
    }

    if (!Number.isSafeInteger(vehicleTypeId) || vehicleTypeId < 1) {
      errors.vehicleTypeId = tVehicles('errors.typeRequired');
    }
    if (!editing && !VEHICLE_STATUSES.includes(values.status)) {
      errors.status = tVehicles('errors.statusRequired');
    }
    if (!editing && layoutSeats.length === 0) {
      errors.seats = tVehicles('errors.seatsRequired');
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    if (!optionsReady) {
      setFormError(tVehicles('unresolvedOperatorOrTypes'));
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
      const editableFields = {
        licensePlate: values.licensePlate.trim(),
        busCompanyId: tenantId!,
        vehicleTypeId: Number(values.vehicleTypeId),
      };
      const savedVehicle = editing
        ? await updateVehicle(vehicle.vehicleId, editableFields)
        : await createVehicle({
            ...editableFields,
            status: values.status,
            seats: layoutSeats.map(
              ({
                seatNumber,
                position,
                floor,
                x,
                y,
              }): VehicleSeatLayoutInput => ({
                seatNumber,
                position,
                floor,
                x,
                y,
              }),
            ),
          });
      onSaved(savedVehicle);
    } catch (requestError: unknown) {
      if (
        requestError instanceof VehicleApiError &&
        requestError.code === 'VEHICLE_LICENSE_PLATE_EXISTS'
      ) {
        setFieldErrors({ licensePlate: tVehicles('errors.plateExists') });
        requestAnimationFrame(() =>
          formRef.current
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus(),
        );
      } else if (requestError instanceof TypeError) {
        toast.error(tVehicles('networkError'));
      } else {
        toast.error(
          requestError instanceof Error
            ? requestError.message
            : editing
              ? tVehicles('saveError')
              : tVehicles('saveError'),
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ResourceModalDialog
      title={
        editing
          ? tVehicles('formDialogEditTitle', { plate: vehicle.licensePlate })
          : tVehicles('formDialogCreateTitle')
      }
      description={
        editing
          ? tVehicles('formDialogEditDesc')
          : tVehicles('formDialogCreateDesc')
      }
      busy={submitting}
      preventDismiss={submitting}
      onClose={closeDialog}
      size={editing ? 'md' : '3xl'}
    >
      <ResourceModalForm
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        footer={
          <div className="-mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t bg-slate-50/80 dark:bg-slate-900/60 px-5 py-3.5 sm:-mx-6 sm:-mb-6 sm:px-6 shrink-0">
            <Button
              disabled={submitting}
              onClick={closeDialog}
              variant="outline"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              aria-busy={submitting}
              disabled={submitting || !optionsReady}
              type="submit"
            >
              {submitting && (
                <LoaderCircle
                  aria-hidden
                  className="motion-safe:animate-spin"
                />
              )}
              {submitting
                ? tVehicles('saving')
                : editing
                  ? tCommon('saveChanges')
                  : tVehicles('createVehicle')}
            </Button>
          </div>
        }
      >
        {formError && <ResourceNotice kind="error">{formError}</ResourceNotice>}
        {optionErrors.length > 0 && (
          <ResourceNotice kind="error">
            <p>{optionErrors.join(' ')}</p>
            <Button
              className="mt-3"
              disabled={submitting}
              onClick={onRetryOptions}
              variant="outline"
            >
              {tVehicles('retryFilterOptions')}
            </Button>
          </ResourceNotice>
        )}
        <Field data-invalid={Boolean(fieldErrors.licensePlate)}>
          <FieldLabel htmlFor={`${idPrefix}-license-plate`}>
            {tVehicles('plateNumber')} <span aria-hidden>*</span>
          </FieldLabel>
          <Input
            aria-describedby={
              fieldErrors.licensePlate
                ? `${idPrefix}-license-plate-error`
                : undefined
            }
            aria-invalid={Boolean(fieldErrors.licensePlate)}
            autoComplete="off"
            className="admin-data-mono"
            disabled={submitting}
            id={`${idPrefix}-license-plate`}
            maxLength={15}
            onChange={(event) =>
              updateField('licensePlate', event.target.value)
            }
            placeholder={tVehicles('plateNumberPlaceholder')}
            required
            value={values.licensePlate}
          />
          <FieldError id={`${idPrefix}-license-plate-error`}>
            {fieldErrors.licensePlate}
          </FieldError>
        </Field>
        <Field data-invalid={Boolean(fieldErrors.vehicleTypeId)}>
          <FieldLabel htmlFor={`${idPrefix}-vehicle-type`}>
            {tVehicles('vehicleType')} <span aria-hidden>*</span>
          </FieldLabel>
          <Select
            disabled={submitting || !optionsReady}
            onValueChange={(value) =>
              updateField('vehicleTypeId', String(value ?? ''))
            }
            value={values.vehicleTypeId || null}
          >
            <SelectTrigger
              aria-describedby={
                fieldErrors.vehicleTypeId
                  ? `${idPrefix}-vehicle-type-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.vehicleTypeId)}
              aria-required
              id={`${idPrefix}-vehicle-type`}
            >
              <SelectValue placeholder={tVehicles('selectVehicleTypePlaceholder')}>
                {vehicleTypes.status === 'success'
                  ? vehicleTypes.options.find(
                      (option) => String(option.id) === values.vehicleTypeId,
                    )?.label
                  : vehicle?.vehicleType.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                {vehicleTypes.status === 'success' &&
                  vehicleTypes.options.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.label}
                    </SelectItem>
                  ))}
                {vehicleTypes.status !== 'success' && vehicle && (
                  <SelectItem value={String(vehicle.vehicleType.vehicleTypeId)}>
                    {vehicle.vehicleType.name}
                  </SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError id={`${idPrefix}-vehicle-type-error`}>
            {fieldErrors.vehicleTypeId}
          </FieldError>
        </Field>
        {!editing && (
          <Field data-invalid={Boolean(fieldErrors.status)}>
            <FieldLabel htmlFor={`${idPrefix}-status`}>
              {tVehicles('vehicleStatus')} <span aria-hidden>*</span>
            </FieldLabel>
            <Select
              disabled={submitting}
              onValueChange={(value) =>
                updateField('status', value as VehicleStatus)
              }
              value={values.status}
            >
              <SelectTrigger
                aria-describedby={
                  fieldErrors.status ? `${idPrefix}-status-error` : undefined
                }
                aria-invalid={Boolean(fieldErrors.status)}
                aria-required
                id={`${idPrefix}-status`}
              >
                <SelectValue>
                  {values.status === 'HOAT_DONG'
                    ? tVehicles('statusActive')
                    : tVehicles('statusMaintenance')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  <SelectItem value="HOAT_DONG">
                    {tVehicles('statusActive')}
                  </SelectItem>
                  <SelectItem value="BAO_TRI">
                    {tVehicles('statusMaintenance')}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError id={`${idPrefix}-status-error`}>
              {fieldErrors.status}
            </FieldError>
          </Field>
        )}
        {!editing && (
          <SeatLayoutEditor
            canRemoveDraft
            disabled={submitting}
            error={fieldErrors.seats}
            onChange={(nextSeats) => {
              setLayoutSeats(nextSeats);
              setFieldErrors((current) => ({ ...current, seats: undefined }));
            }}
            onRemoveSeat={(seatNumber) =>
              setLayoutSeats((current) =>
                compactSeatNumbersAfterRemoval(current, seatNumber),
              )
            }
            seats={layoutSeats}
          />
        )}
      </ResourceModalForm>
    </ResourceModalDialog>
  );
}
