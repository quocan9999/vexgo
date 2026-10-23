'use client';

import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRef, useState, type FormEvent } from 'react';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { ResourceNotice, ResourceSheet } from '@/components/admin/resource-ui';
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
  type VehicleStatus,
} from '../types/vehicle';

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
type FieldErrors = Partial<Record<FormField, string>>;

export function VehicleFormDialog({
  vehicle,
  vehicleTypes,
  onRetryOptions,
  onClose,
  onSaved,
}: VehicleFormDialogProps) {
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
  const optionsReady = Boolean(tenantId) && vehicleTypes.status === 'success';
  const optionErrors = [
    vehicleTypes.status === 'error' ? `Loại xe: ${vehicleTypes.message}` : null,
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

    if (!licensePlate) errors.licensePlate = 'Vui lòng nhập biển số xe.';
    else if (licensePlate.length > 15) {
      errors.licensePlate = 'Biển số xe không được vượt quá 15 ký tự.';
    }

    if (!Number.isSafeInteger(vehicleTypeId) || vehicleTypeId < 1) {
      errors.vehicleTypeId = 'Vui lòng chọn loại xe.';
    }
    if (!editing && !VEHICLE_STATUSES.includes(values.status)) {
      errors.status = 'Vui lòng chọn trạng thái xe.';
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    if (!optionsReady) {
      setFormError('Không xác định được nhà xe hoặc chưa tải được loại xe.');
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
        : await createVehicle({ ...editableFields, status: values.status });
      onSaved(savedVehicle);
    } catch (requestError: unknown) {
      if (
        requestError instanceof VehicleApiError &&
        requestError.code === 'VEHICLE_LICENSE_PLATE_EXISTS'
      ) {
        setFieldErrors({ licensePlate: 'Biển số xe đã tồn tại.' });
        requestAnimationFrame(() =>
          formRef.current
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus(),
        );
      } else if (requestError instanceof TypeError) {
        toast.error('Không thể kết nối đến máy chủ API. Vui lòng thử lại.');
      } else {
        toast.error(
          requestError instanceof Error
            ? requestError.message
            : editing
              ? 'Không thể cập nhật xe. Vui lòng thử lại.'
              : 'Không thể tạo xe. Vui lòng thử lại.',
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ResourceSheet
      title={editing ? 'Chỉnh sửa xe' : 'Thêm xe'}
      description={
        editing
          ? 'Cập nhật biển số và loại xe.'
          : 'Nhập thông tin xe mới vào hệ thống.'
      }
      busy={submitting}
      preventDismiss={submitting}
      onClose={closeDialog}
    >
      <form
        ref={formRef}
        className="flex min-h-full flex-col gap-5"
        noValidate
        onSubmit={handleSubmit}
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
              Tải lại tùy chọn
            </Button>
          </ResourceNotice>
        )}
        <Field data-invalid={Boolean(fieldErrors.licensePlate)}>
          <FieldLabel htmlFor={`${idPrefix}-license-plate`}>
            Biển số xe <span aria-hidden>*</span>
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
            placeholder="Ví dụ: 51B-123.45"
            required
            value={values.licensePlate}
          />
          <FieldError id={`${idPrefix}-license-plate-error`}>
            {fieldErrors.licensePlate}
          </FieldError>
        </Field>
        <Field data-invalid={Boolean(fieldErrors.vehicleTypeId)}>
          <FieldLabel htmlFor={`${idPrefix}-vehicle-type`}>
            Loại xe <span aria-hidden>*</span>
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
              <SelectValue placeholder="Chọn loại xe">
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
              Trạng thái <span aria-hidden>*</span>
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
                  {values.status === 'HOAT_DONG' ? 'Đang hoạt động' : 'Bảo trì'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  <SelectItem value="HOAT_DONG">Đang hoạt động</SelectItem>
                  <SelectItem value="BAO_TRI">Bảo trì</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError id={`${idPrefix}-status-error`}>
              {fieldErrors.status}
            </FieldError>
          </Field>
        )}
        <div className="sticky -bottom-4 -mx-4 mt-auto flex flex-wrap justify-end gap-2 border-t bg-card p-4 sm:-bottom-6 sm:-mx-6 sm:p-6">
          <Button disabled={submitting} onClick={closeDialog} variant="outline">
            Hủy
          </Button>
          <Button
            aria-busy={submitting}
            disabled={submitting || !optionsReady}
            type="submit"
          >
            {submitting && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {submitting ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo xe'}
          </Button>
        </div>
      </form>
    </ResourceSheet>
  );
}
