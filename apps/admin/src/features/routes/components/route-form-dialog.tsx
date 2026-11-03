'use client';

import { ResourceSheetForm } from '@/components/admin/resource-sheet-form';
import { LocationPicker } from '@/features/locations/components/location-picker';

import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRef, useState, type FormEvent } from 'react';
import { ResourceNotice, ResourceSheet } from '@/components/admin/resource-ui';
import {
  Field as FieldRoot,
  FieldLabel,
  FieldError,
} from '@/components/ui/field';
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
  createRoute,
  RouteApiError,
  updateRoute,
  type RouteApiErrorDetail,
} from '../services/route-service';
import type { Route, RouteStatus } from '../types/route';
import { parseRouteDuration } from '../utils/route-duration';

type RouteFormDialogProps = {
  tenantBusCompanyId?: number;
  onClose: () => void;
  onSaved: (route: Route) => void;
  route?: Route;
};

type Values = {
  origin: string;
  destination: string;
  durationMinutes: string;
  status: RouteStatus | '';
};
type Field = keyof Values;
type FieldErrors = Partial<Record<Field, string>>;

function mappedErrors(details: RouteApiErrorDetail[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const detail of details) {
    if (
      detail.field === 'origin' ||
      detail.field === 'destination' ||
      detail.field === 'durationMinutes' ||
      detail.field === 'status'
    ) {
      errors[detail.field] = detail.message;
    }
  }
  return errors;
}

export function RouteFormDialog({
  tenantBusCompanyId,
  onClose,
  onSaved,
  route,
}: RouteFormDialogProps) {
  const editing = route !== undefined;
  const idPrefix = editing ? `edit-route-${route.routeId}` : 'create-route';
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<Values>(() => ({
    origin: route?.origin ?? '',
    destination: route?.destination ?? '',
    durationMinutes:
      route?.durationMinutes == null ? '' : String(route.durationMinutes),
    status: '',
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function closeDialog() {
    if (!submittingRef.current) onClose();
  }

  function updateField(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!editing) {
      if (values.status !== 'HOAT_DONG' && values.status !== 'TAM_NGUNG') {
        errors.status = 'Vui lòng chọn trạng thái.';
      }
    }
    if (!values.origin.trim()) errors.origin = 'Vui lòng nhập điểm đi.';
    else if (values.origin.trim().length > 100)
      errors.origin = 'Điểm đi không được vượt quá 100 ký tự.';
    if (!values.destination.trim())
      errors.destination = 'Vui lòng nhập điểm đến.';
    else if (values.destination.trim().length > 100)
      errors.destination = 'Điểm đến không được vượt quá 100 ký tự.';
    else if (
      values.origin.trim() &&
      values.origin.trim().toLowerCase() === values.destination.trim().toLowerCase()
    ) {
      errors.destination = 'Điểm đến không được trùng với điểm đi.';
    }
    const duration = parseRouteDuration(values.durationMinutes);
    if ('error' in duration) errors.durationMinutes = duration.error;
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setFormError(null);
    if (!editing && tenantBusCompanyId === undefined) {
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
    const parsedDuration = parseRouteDuration(values.durationMinutes);
    if ('error' in parsedDuration) return;
    const durationMinutes = parsedDuration.value;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const input = {
        origin: values.origin.trim(),
        destination: values.destination.trim(),
        durationMinutes,
      };
      const saved = editing
        ? await updateRoute(route.routeId, input)
        : await createRoute({
            ...input,
            busCompanyId: tenantBusCompanyId!,
            status: values.status as RouteStatus,
          });
      onSaved(saved);
    } catch (requestError: unknown) {
      if (requestError instanceof RouteApiError) {
        if (requestError.code === 'ROUTE_CODE_EXISTS') {
          toast.error('Không thể cấp mã tuyến. Vui lòng thử tạo lại.');
        } else if (
          requestError.code === 'ROUTE_DUPLICATE_ENDPOINTS' ||
          requestError.code === 'ROUTE_SAME_ENDPOINTS'
        ) {
          toast.error(requestError.message);
          setFieldErrors((current) => ({
            ...current,
            destination: requestError.message,
          }));
        } else {
          const errors = mappedErrors(requestError.details);
          setFieldErrors(errors);
          focusFirstInvalid();
          if (
            Object.keys(errors).length === 0 ||
            requestError.details.length !== Object.keys(errors).length
          ) {
            toast.error(requestError.message);
          }
        }
      } else if (requestError instanceof TypeError) {
        toast.error('Không thể kết nối đến máy chủ API. Vui lòng thử lại.');
      } else {
        toast.error(
          requestError instanceof Error
            ? requestError.message
            : 'Không thể lưu tuyến xe.',
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

  function textField(
    field: 'origin' | 'destination',
    label: string,
  ) {
    const excludeValue = field === 'origin' ? values.destination : values.origin;
    return (
      <FieldRoot data-invalid={Boolean(fieldErrors[field])}>
        <FieldLabel htmlFor={`${idPrefix}-${field}`}>
          {label} <span aria-hidden>*</span>
        </FieldLabel>
        <LocationPicker
          describedBy={
            fieldErrors[field] ? `${idPrefix}-${field}-error` : undefined
          }
          invalid={Boolean(fieldErrors[field])}
          disabled={submitting}
          id={`${idPrefix}-${field}`}
          onChange={(value) => updateField(field, value)}
          value={values[field]}
          excludeValue={excludeValue}
        />
        <FieldError id={`${idPrefix}-${field}-error`}>
          {fieldErrors[field]}
        </FieldError>
      </FieldRoot>
    );
  }

  return (
    <ResourceSheet
      title={editing ? 'Chỉnh sửa tuyến xe' : 'Thêm tuyến xe'}
      description={
        editing
          ? 'Cập nhật điểm đi, điểm đến và thời gian chạy của tuyến.'
          : 'Nhập thông tin tuyến thuộc nhà xe của bạn và thời gian chạy dự kiến.'
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
            <Button disabled={submitting} aria-busy={submitting} type="submit">
              {submitting && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {submitting ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo tuyến'}
            </Button>
          </div>
        }
      >
        {formError && <ResourceNotice kind="error">{formError}</ResourceNotice>}
        {editing && (
          <div className="space-y-1 rounded-[var(--admin-radius-panel)] border bg-muted/40 p-4">
            <strong className="admin-data-mono text-[13px]">
              {route.code}
            </strong>
            <p className="text-xs text-muted-foreground">
              {route.busCompany.name} ·{' '}
              {route.status === 'HOAT_DONG' ? 'Đang hoạt động' : 'Tạm ngưng'}
            </p>
          </div>
        )}
        {textField('origin', 'Điểm đi')}
        {textField('destination', 'Điểm đến')}
        <FieldRoot data-invalid={Boolean(fieldErrors.durationMinutes)}>
          <FieldLabel htmlFor={`${idPrefix}-durationMinutes`}>
            Thời gian chạy (phút) <span aria-hidden>*</span>
          </FieldLabel>
          <Input
            aria-describedby={
              fieldErrors.durationMinutes
                ? `${idPrefix}-durationMinutes-error`
                : undefined
            }
            aria-invalid={Boolean(fieldErrors.durationMinutes)}
            disabled={submitting}
            id={`${idPrefix}-durationMinutes`}
            inputMode="numeric"
            min={1}
            onChange={(event) =>
              updateField('durationMinutes', event.target.value)
            }
            required
            step={1}
            type="number"
            value={values.durationMinutes}
          />
          <FieldError id={`${idPrefix}-durationMinutes-error`}>
            {fieldErrors.durationMinutes}
          </FieldError>
        </FieldRoot>
        {!editing && (
          <FieldRoot data-invalid={Boolean(fieldErrors.status)}>
            <FieldLabel htmlFor={`${idPrefix}-status`}>
              Trạng thái <span aria-hidden>*</span>
            </FieldLabel>
            <Select
              disabled={submitting}
              value={values.status || null}
              onValueChange={(value) =>
                updateField('status', String(value ?? ''))
              }
            >
              <SelectTrigger
                id={`${idPrefix}-status`}
                aria-label="Trạng thái"
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.status)}
                aria-describedby={
                  fieldErrors.status ? `${idPrefix}-status-error` : undefined
                }
              >
                <SelectValue placeholder="Chọn trạng thái">
                  {values.status === 'HOAT_DONG'
                    ? 'Đang hoạt động'
                    : values.status === 'TAM_NGUNG'
                      ? 'Tạm ngưng'
                      : 'Chọn trạng thái'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="HOAT_DONG">Đang hoạt động</SelectItem>
                  <SelectItem value="TAM_NGUNG">Tạm ngưng</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError id={`${idPrefix}-status-error`}>
              {fieldErrors.status}
            </FieldError>
          </FieldRoot>
        )}
      </ResourceSheetForm>
    </ResourceSheet>
  );
}
