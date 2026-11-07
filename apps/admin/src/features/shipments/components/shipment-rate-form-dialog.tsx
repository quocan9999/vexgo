/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ResourceNotice, ResourceModalDialog } from '@/components/admin/resource-ui';
import { ResourceModalForm } from '@/components/admin/resource-modal-form';
import { Button } from '@/components/ui/action-button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  SearchableCombobox,
  type SearchableOption,
} from '@/components/ui/searchable-combobox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createShipmentRate,
  ShipmentRateApiError,
  updateShipmentRate,
} from '../services/shipment-rate-service';
import type {
  ShipmentRate,
  ShipmentRateOptionsState,
  ShipmentRateStatus,
} from '../types/shipment-rate';

type ShipmentRateFormMode = 'create' | 'edit';

type ShipmentRateFormValues = {
  routeId: string;
  cargoTypeId: string;
  weightFrom: string;
  weightTo: string;
  fee: string;
  validFrom: string;
  validTo: string;
  status: ShipmentRateStatus;
};

type FieldName = keyof ShipmentRateFormValues;

const EMPTY_VALUES: ShipmentRateFormValues = {
  routeId: '',
  cargoTypeId: '',
  weightFrom: '0',
  weightTo: '5',
  fee: '',
  validFrom: '',
  validTo: '',
  status: 'HOAT_DONG',
};

const WEIGHT_BAND_PRESETS: Array<{
  label: string;
  weightFrom: string;
  weightTo: string;
}> = [
  { label: '0 → 1 kg', weightFrom: '0', weightTo: '1' },
  { label: '1 → 5 kg', weightFrom: '1', weightTo: '5' },
  { label: '5 → 10 kg', weightFrom: '5', weightTo: '10' },
  { label: '10 → 20 kg', weightFrom: '10', weightTo: '20' },
  { label: '20 → 50 kg', weightFrom: '20', weightTo: '50' },
  { label: 'Trên 50 kg', weightFrom: '50', weightTo: '' },
];

const STATUS_LABELS: Record<ShipmentRateStatus, string> = {
  HOAT_DONG: 'Đang hoạt động',
  TAM_NGUNG: 'Tạm ngưng',
};

export function ShipmentRateFormDialog({
  open,
  mode,
  rate,
  options,
  onRetryOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: ShipmentRateFormMode;
  rate: ShipmentRate | null;
  options: ShipmentRateOptionsState;
  onRetryOptions: () => void;
  onClose: () => void;
  onSaved: (rate: ShipmentRate, message: string) => void;
}) {
  const [values, setValues] = useState<ShipmentRateFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const feeRef = useRef<HTMLInputElement | null>(null);
  const weightFromRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    setValues(
      mode === 'edit' && rate
        ? {
            routeId: String(rate.route.routeId),
            cargoTypeId: String(rate.cargoType.cargoTypeId),
            weightFrom: String(rate.weightFrom),
            weightTo: rate.weightTo === null ? '' : String(rate.weightTo),
            fee: String(rate.fee),
            validFrom: rate.validFrom,
            validTo: rate.validTo ?? '',
            status: rate.status,
          }
        : EMPTY_VALUES,
    );
    setFieldErrors({});
    setFormError(null);
    setSubmitting(false);
  }, [mode, open, rate]);

  const routeSearchableOptions = useMemo<SearchableOption[]>(() => {
    return options.routes.map((route) => ({
      id: `route-${route.id}`,
      value: String(route.id),
      label: route.label,
      badge: route.code,
      description: route.description,
    }));
  }, [options.routes]);

  const selectedCargoTypeLabel = useMemo(() => {
    if (!values.cargoTypeId) return undefined;
    return options.cargoTypes.find(
      (item) => String(item.id) === values.cargoTypeId,
    )?.label;
  }, [options.cargoTypes, values.cargoTypeId]);

  if (!open) return null;

  function updateField<K extends FieldName>(
    field: K,
    value: ShipmentRateFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function applyWeightPreset(weightFrom: string, weightTo: string) {
    setValues((current) => ({
      ...current,
      weightFrom,
      weightTo,
    }));
    setFieldErrors((current) => ({
      ...current,
      weightFrom: undefined,
      weightTo: undefined,
    }));
    setFormError(null);
  }

  function validate(): Partial<Record<FieldName, string>> {
    const errors: Partial<Record<FieldName, string>> = {};
    const weightFromNum = Number(values.weightFrom.trim());
    const hasWeightTo = values.weightTo.trim() !== '';
    const weightToNum = hasWeightTo ? Number(values.weightTo.trim()) : null;
    const feeNum = Number(values.fee.trim());

    if (mode === 'create' && !values.routeId) {
      errors.routeId = 'Vui lòng chọn tuyến xe.';
    }
    if (mode === 'create' && !values.cargoTypeId) {
      errors.cargoTypeId = 'Vui lòng chọn loại hàng hóa.';
    }
    if (
      values.weightFrom.trim() === '' ||
      !Number.isFinite(weightFromNum) ||
      weightFromNum < 0
    ) {
      errors.weightFrom = 'Khối lượng từ phải lớn hơn hoặc bằng 0.';
    }
    if (
      hasWeightTo &&
      (weightToNum === null ||
        !Number.isFinite(weightToNum) ||
        weightToNum <= 0)
    ) {
      errors.weightTo = 'Khối lượng đến phải là số lớn hơn 0.';
    } else if (
      weightToNum !== null &&
      Number.isFinite(weightFromNum) &&
      weightToNum <= weightFromNum
    ) {
      errors.weightTo = 'Khối lượng đến phải lớn hơn khối lượng từ.';
    }
    if (!values.fee.trim()) {
      errors.fee = 'Vui lòng nhập mức cước.';
    } else if (!Number.isFinite(feeNum) || feeNum <= 0) {
      errors.fee = 'Mức cước phải lớn hơn 0.';
    }
    if (!values.validFrom) {
      errors.validFrom = 'Vui lòng chọn ngày bắt đầu hiệu lực.';
    }
    if (
      values.validFrom &&
      values.validTo &&
      values.validTo < values.validFrom
    ) {
      errors.validTo =
        'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu hiệu lực.';
    }

    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.weightFrom) weightFromRef.current?.focus();
      else if (errors.fee) feeRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const parsedWeightFrom = Number(values.weightFrom.trim());
    const parsedWeightTo =
      values.weightTo.trim() === '' ? null : Number(values.weightTo.trim());
    const parsedFee = Number(values.fee.trim());

    try {
      const saved =
        mode === 'edit' && rate
          ? await updateShipmentRate(rate.rateId, {
              weightFrom: parsedWeightFrom,
              weightTo: parsedWeightTo,
              fee: parsedFee,
              validFrom: values.validFrom,
              validTo: values.validTo || null,
              status: values.status,
            })
          : await createShipmentRate({
              routeId: Number(values.routeId),
              cargoTypeId: Number(values.cargoTypeId),
              weightFrom: parsedWeightFrom,
              weightTo: parsedWeightTo,
              fee: parsedFee,
              validFrom: values.validFrom,
              ...(values.validTo ? { validTo: values.validTo } : {}),
              status: values.status,
            });

      onSaved(
        saved,
        mode === 'edit'
          ? 'Đã cập nhật mức cước gửi hàng.'
          : 'Đã tạo mức cước gửi hàng mới.',
      );
    } catch (error) {
      if (error instanceof ShipmentRateApiError && error.details.length > 0) {
        const nextFieldErrors: Partial<Record<FieldName, string>> = {};
        for (const detail of error.details) {
          if (detail.field in EMPTY_VALUES) {
            nextFieldErrors[detail.field as FieldName] = detail.message;
          }
        }
        setFieldErrors(nextFieldErrors);
      }
      const msg =
        error instanceof Error
          ? error.message
          : 'Không thể lưu mức cước gửi hàng. Vui lòng thử lại.';
      setFormError(msg);
      toast.error(msg);
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <ResourceModalDialog
      title={
        mode === 'edit'
          ? 'Chỉnh sửa mức cước gửi hàng'
          : 'Thêm mức cước gửi hàng'
      }
      description="Thiết lập nấc khối lượng, đơn giá vận chuyển hàng hóa và thời gian hiệu lực."
      busy={submitting}
      preventDismiss={submitting}
      onClose={onClose}
      size="xl"
    >
      <ResourceModalForm
        noValidate
        onSubmit={handleSubmit}
        footer={
          <div className="-mx-5 -mb-5 flex justify-end gap-3 border-t bg-slate-50/80 dark:bg-slate-900/60 px-5 py-3.5 sm:-mx-6 sm:-mb-6 sm:px-6 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {submitting
                ? 'Đang lưu...'
                : mode === 'edit'
                  ? 'Lưu thay đổi'
                  : 'Tạo mức cước'}
            </Button>
          </div>
        }
      >
        {formError && (
          <ResourceNotice kind="error">
            <p>{formError}</p>
          </ResourceNotice>
        )}

        {mode === 'create' && options.error && (
          <ResourceNotice kind="error">
            <p>{options.error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onRetryOptions}
            >
              Tải lại danh mục
            </Button>
          </ResourceNotice>
        )}

        {mode === 'edit' && rate ? (
          <div className="space-y-1 rounded-[var(--admin-radius-panel)] border bg-muted/40 p-4 text-[13px]">
            <strong className="admin-data-mono">{rate.route.code}</strong>
            <p className="break-words">
              {rate.route.origin} → {rate.route.destination}
            </p>
            <p className="text-xs text-muted-foreground">
              {rate.cargoType.name} · {STATUS_LABELS[rate.status]}
            </p>
          </div>
        ) : (
          <>
            <Field data-invalid={Boolean(fieldErrors.routeId)}>
              <FieldLabel htmlFor="shipment-rate-route">
                Tuyến xe <span aria-hidden>*</span>
              </FieldLabel>
              <SearchableCombobox
                id="shipment-rate-route"
                value={values.routeId}
                options={routeSearchableOptions}
                onChange={(value) => updateField('routeId', value)}
                disabled={submitting || options.loading}
                loading={options.loading}
                allowCustom={false}
                placeholder="Tìm và chọn tuyến xe..."
                aria-invalid={Boolean(fieldErrors.routeId)}
              />
              <FieldError>{fieldErrors.routeId}</FieldError>
            </Field>

            <Field data-invalid={Boolean(fieldErrors.cargoTypeId)}>
              <FieldLabel htmlFor="shipment-rate-cargo-type">
                Loại hàng hóa <span aria-hidden>*</span>
              </FieldLabel>
              <Select
                value={values.cargoTypeId}
                onValueChange={(value) =>
                  updateField('cargoTypeId', value ?? '')
                }
                disabled={submitting || options.loading}
              >
                <SelectTrigger
                  id="shipment-rate-cargo-type"
                  className="w-full"
                  aria-invalid={Boolean(fieldErrors.cargoTypeId)}
                >
                  <SelectValue placeholder="Chọn loại hàng hóa">
                    {selectedCargoTypeLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {options.cargoTypes.map((cargoType) => (
                      <SelectItem
                        key={cargoType.id}
                        value={String(cargoType.id)}
                      >
                        {cargoType.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{fieldErrors.cargoTypeId}</FieldError>
            </Field>
          </>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Chọn nhanh nấc khối lượng phổ biến
          </p>
          <div className="flex flex-wrap gap-2">
            {WEIGHT_BAND_PRESETS.map((preset) => {
              const isSelected =
                values.weightFrom === preset.weightFrom &&
                values.weightTo === preset.weightTo;
              return (
                <Button
                  key={preset.label}
                  type="button"
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() =>
                    applyWeightPreset(preset.weightFrom, preset.weightTo)
                  }
                  disabled={submitting}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(fieldErrors.weightFrom)}>
            <FieldLabel htmlFor="shipment-rate-weight-from">
              Khối lượng từ (kg) <span aria-hidden>*</span>
            </FieldLabel>
            <Input
              ref={weightFromRef}
              id="shipment-rate-weight-from"
              type="number"
              min={0}
              step="0.5"
              value={values.weightFrom}
              onChange={(event) =>
                updateField('weightFrom', event.target.value)
              }
              placeholder="0"
              aria-invalid={Boolean(fieldErrors.weightFrom)}
            />
            <FieldError>{fieldErrors.weightFrom}</FieldError>
          </Field>

          <Field data-invalid={Boolean(fieldErrors.weightTo)}>
            <FieldLabel htmlFor="shipment-rate-weight-to">
              Khối lượng đến (kg)
            </FieldLabel>
            <Input
              id="shipment-rate-weight-to"
              type="number"
              min={0.5}
              step="0.5"
              value={values.weightTo}
              onChange={(event) => updateField('weightTo', event.target.value)}
              placeholder="Để trống nếu không giới hạn"
              aria-invalid={Boolean(fieldErrors.weightTo)}
            />
            <FieldError>{fieldErrors.weightTo}</FieldError>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(fieldErrors.fee)}>
            <FieldLabel htmlFor="shipment-rate-fee">
              Mức cước cơ bản (VND) <span aria-hidden>*</span>
            </FieldLabel>
            <Input
              ref={feeRef}
              id="shipment-rate-fee"
              type="number"
              inputMode="numeric"
              min={1000}
              step={1000}
              value={values.fee}
              onChange={(event) => updateField('fee', event.target.value)}
              placeholder="35000"
              aria-invalid={Boolean(fieldErrors.fee)}
            />
            <FieldError>{fieldErrors.fee}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="shipment-rate-status">Trạng thái</FieldLabel>
            <Select
              value={values.status}
              onValueChange={(value) =>
                updateField(
                  'status',
                  (value ?? 'HOAT_DONG') as ShipmentRateStatus,
                )
              }
            >
              <SelectTrigger id="shipment-rate-status" className="w-full">
                <SelectValue>{STATUS_LABELS[values.status]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="HOAT_DONG">Đang hoạt động</SelectItem>
                  <SelectItem value="TAM_NGUNG">Tạm ngưng</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(fieldErrors.validFrom)}>
            <FieldLabel htmlFor="shipment-rate-valid-from">
              Hiệu lực từ ngày <span aria-hidden>*</span>
            </FieldLabel>
            <Input
              id="shipment-rate-valid-from"
              type="date"
              value={values.validFrom}
              onChange={(event) => updateField('validFrom', event.target.value)}
              aria-invalid={Boolean(fieldErrors.validFrom)}
              disabled={submitting}
            />
            <FieldError>{fieldErrors.validFrom}</FieldError>
          </Field>

          <Field data-invalid={Boolean(fieldErrors.validTo)}>
            <FieldLabel htmlFor="shipment-rate-valid-to">
              Hiệu lực đến ngày (tùy chọn)
            </FieldLabel>
            <Input
              id="shipment-rate-valid-to"
              type="date"
              min={values.validFrom || undefined}
              value={values.validTo}
              onChange={(event) => updateField('validTo', event.target.value)}
              aria-invalid={Boolean(fieldErrors.validTo)}
              disabled={submitting}
            />
            <FieldError>{fieldErrors.validTo}</FieldError>
          </Field>
        </div>
      </ResourceModalForm>
    </ResourceModalDialog>
  );
}
