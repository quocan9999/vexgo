'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

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
    <dialog
      aria-labelledby="create-company-title"
      className="company-dialog"
      onCancel={(event) => {
        if (submittingRef.current) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <section className="bus-company-form-panel">
        <div className="detail-heading bus-company-form-heading">
          <div className="detail-heading-copy">
            <p className="eyebrow">ĐỐI TÁC NỀN TẢNG</p>
            <h2 id="create-company-title">Thêm nhà xe</h2>
          </div>
          <button
            aria-label="Đóng biểu mẫu thêm nhà xe"
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
            Nhập thông tin cơ bản để thêm đối tác vào hệ thống.
          </p>

          {formError && (
            <div className="bus-company-form-error" role="alert">
              {formError}
            </div>
          )}

          <div className="bus-company-form-field">
            <label htmlFor="create-company-code">Mã nhà xe</label>
            <input
              autoComplete="off"
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
            {fieldErrors.code && (
              <span
                className="bus-company-form-field-error"
                id="create-company-code-error"
              >
                {fieldErrors.code}
              </span>
            )}
          </div>

          <div className="bus-company-form-field">
            <label htmlFor="create-company-name">Tên nhà xe</label>
            <input
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
            {fieldErrors.name && (
              <span
                className="bus-company-form-field-error"
                id="create-company-name-error"
              >
                {fieldErrors.name}
              </span>
            )}
          </div>

          <div className="bus-company-form-field">
            <label htmlFor="create-company-contact">
              Thông tin liên hệ <span>(Tùy chọn)</span>
            </label>
            <input
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
            {fieldErrors.contactInfo && (
              <span
                className="bus-company-form-field-error"
                id="create-company-contact-error"
              >
                {fieldErrors.contactInfo}
              </span>
            )}
          </div>

          <div className="bus-company-form-field">
            <label htmlFor="create-company-status">Trạng thái</label>
            <select
              id="create-company-status"
              onChange={(event) =>
                updateField('status', event.target.value as BusCompanyStatus)
              }
              value={values.status}
              aria-invalid={Boolean(fieldErrors.status)}
              aria-describedby={
                fieldErrors.status ? 'create-company-status-error' : undefined
              }
            >
              <option value="HOAT_DONG">Đang hoạt động</option>
              <option value="TAM_NGUNG">Tạm ngưng</option>
            </select>
            {fieldErrors.status && (
              <span
                className="bus-company-form-field-error"
                id="create-company-status-error"
              >
                {fieldErrors.status}
              </span>
            )}
          </div>

          <div className="bus-company-form-actions">
            <button
              className="button button-secondary"
              disabled={submitting}
              onClick={closeDialog}
              type="button"
            >
              Hủy
            </button>
            <button
              className="button button-primary"
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
              {submitting ? 'Đang tạo…' : 'Tạo nhà xe'}
            </button>
          </div>
        </form>
      </section>
    </dialog>
  );
}
