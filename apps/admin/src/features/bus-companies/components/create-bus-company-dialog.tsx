'use client';

import { LoaderCircle } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { ResourceNotice, ResourceSheet } from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BusCompanyApiError,
  createBusCompany,
  type BusCompanyApiErrorDetail,
} from '../services/bus-company-service';
import type { BusCompany, BusCompanyStatus } from '../types/bus-company';

type CreateBusCompanyDialogProps = {
  onClose: () => void;
  onCreated: (company: BusCompany) => void;
};

type FormValues = {
  code: string;
  name: string;
  contactInfo: string;
  status: BusCompanyStatus;
};

type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField, string>>;

const INITIAL_VALUES: FormValues = {
  code: '',
  name: '',
  contactInfo: '',
  status: 'HOAT_DONG',
};

function fieldErrorsFromDetails(details: BusCompanyApiErrorDetail[]) {
  const errors: FieldErrors = {};

  for (const detail of details) {
    if (
      detail.field === 'code' ||
      detail.field === 'name' ||
      detail.field === 'contactInfo' ||
      detail.field === 'status'
    ) {
      errors[detail.field] = detail.message;
    }
  }

  return errors;
}

export function CreateBusCompanyDialog({
  onClose,
  onCreated,
}: CreateBusCompanyDialogProps) {
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    const code = values.code.trim();
    const name = values.name.trim();

    if (!code) errors.code = 'Vui lòng nhập mã nhà xe.';
    else if (code.length > 50) {
      errors.code = 'Mã nhà xe không được vượt quá 50 ký tự.';
    }

    if (!name) errors.name = 'Vui lòng nhập tên nhà xe.';
    else if (name.length > 150) {
      errors.name = 'Tên nhà xe không được vượt quá 150 ký tự.';
    }

    if (values.status !== 'HOAT_DONG' && values.status !== 'TAM_NGUNG') {
      errors.status = 'Vui lòng chọn trạng thái hợp lệ.';
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const company = await createBusCompany({
        code: values.code.trim(),
        name: values.name.trim(),
        contactInfo: values.contactInfo.trim() || null,
        status: values.status,
      });
      onCreated(company);
    } catch (requestError: unknown) {
      if (requestError instanceof BusCompanyApiError) {
        if (requestError.code === 'BUS_COMPANY_CODE_EXISTS') {
          setFieldErrors({ code: requestError.message });
          setFormError(null);
        } else {
          const serverErrors = fieldErrorsFromDetails(requestError.details);
          const hasFieldErrors = Object.keys(serverErrors).length > 0;
          setFieldErrors(serverErrors);
          if (requestError.code === 'VALIDATION_ERROR' && hasFieldErrors) {
            setFormError('Vui lòng kiểm tra lại các trường được đánh dấu.');
          } else {
            setFormError(hasFieldErrors ? null : requestError.message);
          }
        }
      } else {
        setFormError(
          requestError instanceof Error
            ? requestError.message
            : 'Không thể tạo nhà xe. Vui lòng thử lại.',
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ResourceSheet
      title="Thêm nhà xe"
      description="Nhập thông tin cơ bản để thêm đối tác vào hệ thống."
      busy={submitting}
      preventDismiss={submitting}
      onClose={onClose}
    >
      <form
        className="flex min-h-full flex-col gap-5"
        noValidate
        onSubmit={handleSubmit}
      >

        {formError && (
          <ResourceNotice kind="error">{formError}</ResourceNotice>
        )}

        <Field data-invalid={Boolean(fieldErrors.code)}>
          <FieldLabel htmlFor="create-company-code">Mã nhà xe</FieldLabel>
          <Input
            autoComplete="off"
            className="admin-data-mono"
            id="create-company-code"
            maxLength={50}
            onChange={(event) => updateField('code', event.target.value)}
            placeholder="Ví dụ: NX001"
            required
            type="text"
            value={values.code}
            aria-invalid={Boolean(fieldErrors.code)}
            aria-describedby={
              fieldErrors.code ? 'create-company-code-error' : undefined
            }
          />
          <FieldError id="create-company-code-error">
            {fieldErrors.code}
          </FieldError>
        </Field>

        <Field data-invalid={Boolean(fieldErrors.name)}>
          <FieldLabel htmlFor="create-company-name">Tên nhà xe</FieldLabel>
          <Input
            autoComplete="organization"
            id="create-company-name"
            maxLength={150}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Nhập tên nhà xe"
            required
            type="text"
            value={values.name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={
              fieldErrors.name ? 'create-company-name-error' : undefined
            }
          />
          <FieldError id="create-company-name-error">
            {fieldErrors.name}
          </FieldError>
        </Field>

        <Field data-invalid={Boolean(fieldErrors.contactInfo)}>
          <FieldLabel htmlFor="create-company-contact">
            Thông tin liên hệ{' '}
            <span className="text-xs font-normal text-muted-foreground">
              (Tùy chọn)
            </span>
          </FieldLabel>
          <Input
            autoComplete="tel"
            id="create-company-contact"
            onChange={(event) =>
              updateField('contactInfo', event.target.value)
            }
            placeholder="Số điện thoại hoặc thông tin liên hệ"
            type="text"
            value={values.contactInfo}
            aria-invalid={Boolean(fieldErrors.contactInfo)}
            aria-describedby={
              fieldErrors.contactInfo
                ? 'create-company-contact-error'
                : undefined
            }
          />
          <FieldError id="create-company-contact-error">
            {fieldErrors.contactInfo}
          </FieldError>
        </Field>

        <Field data-invalid={Boolean(fieldErrors.status)}>
          <FieldLabel htmlFor="create-company-status-trigger">
            Trạng thái
          </FieldLabel>
          <Select
            onValueChange={(value) => {
              if (value === 'HOAT_DONG' || value === 'TAM_NGUNG') {
                updateField('status', value);
              }
            }}
            value={values.status}
          >
            <SelectTrigger
              aria-describedby={
                fieldErrors.status
                  ? 'create-company-status-error'
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.status)}
              id="create-company-status-trigger"
            >
              <SelectValue>
                {values.status === 'HOAT_DONG'
                  ? 'Đang hoạt động'
                  : 'Tạm ngưng'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOAT_DONG">Đang hoạt động</SelectItem>
              <SelectItem value="TAM_NGUNG">Tạm ngưng</SelectItem>
            </SelectContent>
          </Select>
          <FieldError id="create-company-status-error">
            {fieldErrors.status}
          </FieldError>
        </Field>

        <div className="sticky bottom-0 -mx-4 mt-auto flex justify-end gap-2 border-t bg-popover px-4 py-4 sm:-mx-6 sm:px-6">
          <Button
            disabled={submitting}
            onClick={closeDialog}
            type="button"
            variant="outline"
          >
            Hủy
          </Button>
            <Button disabled={submitting} type="submit">
            {submitting && (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 motion-safe:animate-spin"
              />
            )}
            {submitting ? 'Đang tạo…' : 'Tạo nhà xe'}
          </Button>
        </div>
      </form>
    </ResourceSheet>
  );
}
