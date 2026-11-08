'use client';

import { ResourceModalForm } from '@/components/admin/resource-modal-form';

import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRef, useState, type FormEvent } from 'react';
import { ResourceNotice, ResourceModalDialog } from '@/components/admin/resource-ui';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/action-button';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { useTranslations } from 'next-intl';
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
  const tVehicleTypes = useTranslations('vehicleTypes');
  const tCommon = useTranslations('common');
  const editing = vehicleType !== undefined;
  const idPrefix = editing
    ? `edit-vehicle-type-${vehicleType.vehicleTypeId}`
    : 'create-vehicle-type';
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>(() => ({
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
  const authState = useAdminSession();
  const tenantId =
    authState.status === 'authenticated'
      ? authState.session.busCompanyId
      : null;

  function closeDialog() {
    if (!submittingRef.current) onClose();
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
    if (!editing && !tenantId) {
      setFormError(
        'Không xác định được nhà xe của tài khoản. Vui lòng đăng nhập lại.',
      );
      return;
    }
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid();
      return;
    }

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
            busCompanyId: tenantId!,
          });
      onSaved(savedVehicleType);
    } catch (requestError: unknown) {
      if (requestError instanceof VehicleTypeApiError) {
        if (requestError.code === 'VEHICLE_TYPE_NAME_EXISTS') {
          setFieldErrors({ name: requestError.message });
          setFormError(null);
          focusFirstInvalid();
        } else {
          const serverErrors = fieldErrorsFromDetails(requestError.details);
          const detailsAreMapped =
            requestError.details.length > 0 &&
            requestError.details.every(
              (detail) =>
                detail.field === 'name' ||
                detail.field === 'description' ||
                detail.field === 'motorbikeCapacityDefault' ||
                detail.field === 'bulkyCargoCapacityDefault' ||
                detail.field === 'lightCargoCapacityDefault',
            );
          setFieldErrors(serverErrors);
          if (!detailsAreMapped) toast.error(requestError.message);
          focusFirstInvalid();
        }
      } else if (requestError instanceof TypeError) {
        toast.error('Không thể kết nối đến máy chủ API. Vui lòng thử lại.');
      } else {
        toast.error(
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

  function focusFirstInvalid() {
    requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus(),
    );
  }

  return (
    <ResourceModalDialog
      title={
        editing
          ? tVehicleTypes('dialogEditTitle')
          : tVehicleTypes('dialogCreateTitle')
      }
      description={
        editing
          ? tVehicleTypes('dialogEditDesc')
          : tVehicleTypes('dialogCreateDesc')
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
            <Button disabled={submitting} onClick={closeDialog} variant="outline">
              {tCommon('cancel')}
            </Button>
            <Button aria-busy={submitting} disabled={submitting} type="submit">
              {submitting && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {submitting
                ? tCommon('saving')
                : editing
                  ? tCommon('saveChanges')
                  : tVehicleTypes('createVehicleType')}
            </Button>
          </div>
        }
      >
        {formError && <ResourceNotice kind="error">{formError}</ResourceNotice>}
        <Field data-invalid={Boolean(fieldErrors.name)}>
          <FieldLabel htmlFor={`${idPrefix}-name`}>
            {tVehicleTypes('colName')} <span aria-hidden>*</span>
          </FieldLabel>
          <Input
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
          <FieldError id={`${idPrefix}-name-error`}>
            {fieldErrors.name}
          </FieldError>
        </Field>
        <Field data-invalid={Boolean(fieldErrors.description)}>
          <FieldLabel htmlFor={`${idPrefix}-description`}>
            {tVehicleTypes('colDescription')}
          </FieldLabel>
          <Textarea
            aria-describedby={
              fieldErrors.description
                ? `${idPrefix}-description-error`
                : undefined
            }
            aria-invalid={Boolean(fieldErrors.description)}
            disabled={submitting}
            id={`${idPrefix}-description`}
            maxLength={500}
            onChange={(event) => updateField('description', event.target.value)}
            rows={4}
            value={values.description}
          />
          <FieldError id={`${idPrefix}-description-error`}>
            {fieldErrors.description}
          </FieldError>
        </Field>
        <fieldset className="min-w-0 space-y-4 rounded-[var(--admin-radius-panel)] border border-border p-4">
          <legend className="px-1 text-[13px] font-semibold">
            {tVehicleTypes('defaultCargoCapacity')}
          </legend>
          <p
            className="text-xs leading-relaxed text-muted-foreground"
            id={`${idPrefix}-capacity-help`}
          >
            {tVehicleTypes('defaultCargoHelp')}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(
              [
                { field: 'motorbikeCapacityDefault', label: tVehicleTypes('motorbike') },
                { field: 'bulkyCargoCapacityDefault', label: tVehicleTypes('bulkyCargo') },
                { field: 'lightCargoCapacityDefault', label: tVehicleTypes('lightCargo') },
              ] as const
            ).map(({ field, label }) => (
              <Field key={field} data-invalid={Boolean(fieldErrors[field])}>
                <FieldLabel htmlFor={`${idPrefix}-${field}`}>
                  {label}
                </FieldLabel>
                <Input
                  aria-describedby={`${idPrefix}-capacity-help${fieldErrors[field] ? ` ${idPrefix}-${field}-error` : ''}`}
                  aria-invalid={Boolean(fieldErrors[field])}
                  disabled={submitting}
                  id={`${idPrefix}-${field}`}
                  min={0}
                  max={2_147_483_647}
                  step={1}
                  type="number"
                  inputMode="numeric"
                  value={values[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                />
                <FieldError id={`${idPrefix}-${field}-error`}>
                  {fieldErrors[field]}
                </FieldError>
              </Field>
            ))}
          </div>
        </fieldset>
      </ResourceModalForm>
    </ResourceModalDialog>
  );
}
