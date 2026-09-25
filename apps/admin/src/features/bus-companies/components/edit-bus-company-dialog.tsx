'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
import {
  BusCompanyApiError,
  updateBusCompany,
  type BusCompanyApiErrorDetail,
} from '../services/bus-company-service';
import type { BusCompany } from '../types/bus-company';

type EditBusCompanyDialogProps = {
  company: BusCompany;
  onClose: () => void;
  onUpdated: (company: BusCompany) => void;
};

type FormValues = {
  code: string;
  name: string;
  contactInfo: string;
};

type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField, string>>;

function fieldErrorsFromDetails(details: BusCompanyApiErrorDetail[]) {
  const errors: FieldErrors = {};

  for (const detail of details) {
    if (
      detail.field === 'code' ||
      detail.field === 'name' ||
      detail.field === 'contactInfo'
    ) {
      errors[detail.field] = detail.message;
    }
  }

  return errors;
}

export function EditBusCompanyDialog({
  company,
  onClose,
  onUpdated,
}: EditBusCompanyDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>(() => ({
    code: company.code,
    name: company.name,
    contactInfo: company.contactInfo ?? '',
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
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
      const updatedCompany = await updateBusCompany(company.busCompanyId, {
        code: values.code.trim(),
        name: values.name.trim(),
        contactInfo: values.contactInfo.trim() || null,
      });
      onUpdated(updatedCompany);
    } catch (requestError: unknown) {
      if (requestError instanceof BusCompanyApiError) {
        if (requestError.code === 'BUS_COMPANY_CODE_EXISTS') {
          setFieldErrors({ code: requestError.message });
          setFormError(null);
        } else {
          const serverErrors = fieldErrorsFromDetails(requestError.details);
          setFieldErrors(serverErrors);
          setFormError(
            Object.keys(serverErrors).length > 0 ? null : requestError.message,
          );
        }
      } else {
        setFormError(
          requestError instanceof Error
            ? requestError.message
            : 'Không thể cập nhật nhà xe. Vui lòng thử lại.',
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AdminFormDialog
      ariaLabelledBy="edit-company-title"
      dialogRef={dialogRef}
      onClose={onClose}
      preventDismiss={submitting}
    >
      <>
        <div className="admin-dialog-header">
          <div className="admin-dialog-header__copy">
            <p className="eyebrow">HỒ SƠ NHÀ XE</p>
            <h2 id="edit-company-title">Chỉnh sửa nhà xe</h2>
          </div>
          <button
            aria-label="Đóng biểu mẫu chỉnh sửa nhà xe"
            className="icon-button"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
          >
            <X size={19} />
          </button>
        </div>

        <form
          className="bus-company-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <p className="bus-company-form-intro">
            Cập nhật mã, tên và thông tin liên hệ của nhà xe.
          </p>

          {formError && (
            <div className="bus-company-form-error" role="alert">
              {formError}
            </div>
          )}

          <div className="bus-company-form-field">
            <label htmlFor="edit-company-code">Mã nhà xe</label>
            <input
              autoComplete="off"
              id="edit-company-code"
              maxLength={50}
              onChange={(event) => updateField('code', event.target.value)}
              required
              type="text"
              value={values.code}
              aria-invalid={Boolean(fieldErrors.code)}
              aria-describedby={
                fieldErrors.code ? 'edit-company-code-error' : undefined
              }
            />
            {fieldErrors.code && (
              <span
                className="bus-company-form-field-error"
                id="edit-company-code-error"
              >
                {fieldErrors.code}
              </span>
            )}
          </div>

          <div className="bus-company-form-field">
            <label htmlFor="edit-company-name">Tên nhà xe</label>
            <input
              autoComplete="organization"
              id="edit-company-name"
              maxLength={150}
              onChange={(event) => updateField('name', event.target.value)}
              required
              type="text"
              value={values.name}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={
                fieldErrors.name ? 'edit-company-name-error' : undefined
              }
            />
            {fieldErrors.name && (
              <span
                className="bus-company-form-field-error"
                id="edit-company-name-error"
              >
                {fieldErrors.name}
              </span>
            )}
          </div>

          <div className="bus-company-form-field">
            <label htmlFor="edit-company-contact">
              Thông tin liên hệ <span>(Tùy chọn)</span>
            </label>
            <input
              autoComplete="tel"
              id="edit-company-contact"
              onChange={(event) =>
                updateField('contactInfo', event.target.value)
              }
              type="text"
              value={values.contactInfo}
              aria-invalid={Boolean(fieldErrors.contactInfo)}
              aria-describedby={
                fieldErrors.contactInfo
                  ? 'edit-company-contact-error'
                  : undefined
              }
            />
            {fieldErrors.contactInfo && (
              <span
                className="bus-company-form-field-error"
                id="edit-company-contact-error"
              >
                {fieldErrors.contactInfo}
              </span>
            )}
          </div>

          <div className="bus-company-form-actions">
            <Button
              disabled={submitting}
              onClick={closeDialog}
              type="button"
              variant="secondary"
            >
              Hủy
            </Button>
            <Button
              disabled={submitting}
              type="submit"
            >
              {submitting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="bus-company-form-spinner"
                  size={16}
                />
              )}
              {submitting ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </>
    </AdminFormDialog>
  );
}
