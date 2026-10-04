'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
import {
  createRoute, RouteApiError, updateRoute,
  type RouteApiErrorDetail,
} from '../services/route-service';
import type { Route, RouteStatus } from '../types/route';

type RouteFormDialogProps = {
  tenantBusCompanyId?: number;
  onClose: () => void;
  onSaved: (route: Route) => void;
  route?: Route;
};

type Values = {
  code: string;
  origin: string;
  destination: string;
  status: RouteStatus | '';
};
type Field = keyof Values;
type FieldErrors = Partial<Record<Field, string>>;

function mappedErrors(details: RouteApiErrorDetail[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const detail of details) {
    if (detail.field === 'code' || detail.field === 'origin' || detail.field === 'destination' ||
        detail.field === 'status') {
      errors[detail.field] = detail.message;
    }
  }
  return errors;
}

export function RouteFormDialog({ tenantBusCompanyId, onClose, onSaved, route }: RouteFormDialogProps) {
  const editing = route !== undefined;
  const idPrefix = editing ? `edit-route-${route.routeId}` : 'create-route';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<Values>(() => ({
    code: route?.code ?? '',
    origin: route?.origin ?? '',
    destination: route?.destination ?? '',
    status: '',
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
  }

  function updateField(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!editing) {
      const code = values.code.trim();
      if (!code) errors.code = 'Vui lòng nhập mã tuyến.';
      else if (code.length > 50) errors.code = 'Mã tuyến không được vượt quá 50 ký tự.';
      if (values.status !== 'HOAT_DONG' && values.status !== 'TAM_NGUNG') {
        errors.status = 'Vui lòng chọn trạng thái.';
      }
    }
    if (!values.origin.trim()) errors.origin = 'Vui lòng nhập điểm đi.';
    else if (values.origin.trim().length > 100) errors.origin = 'Điểm đi không được vượt quá 100 ký tự.';
    if (!values.destination.trim()) errors.destination = 'Vui lòng nhập điểm đến.';
    else if (values.destination.trim().length > 100) errors.destination = 'Điểm đến không được vượt quá 100 ký tự.';
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setFormError(null);
    if (!editing && tenantBusCompanyId === undefined) {
      setFormError('Không xác định được nhà xe của tài khoản. Vui lòng đăng nhập lại.');
      return;
    }
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const input = { origin: values.origin.trim(), destination: values.destination.trim() };
      const saved = editing
        ? await updateRoute(route.routeId, input)
        : await createRoute({
            ...input,
            code: values.code.trim(),
            busCompanyId: tenantBusCompanyId!,
            status: values.status as RouteStatus,
          });
      dialogRef.current?.close();
      onSaved(saved);
    } catch (requestError: unknown) {
      if (requestError instanceof RouteApiError) {
        if (requestError.code === 'ROUTE_CODE_EXISTS') {
          setFieldErrors({ code: 'Mã tuyến đã tồn tại trong nhà xe này.' });
        } else if (requestError.code === 'ROUTE_DUPLICATE_ENDPOINTS') {
          setFormError(requestError.message);
        } else {
          const errors = mappedErrors(requestError.details);
          setFieldErrors(errors);
          if (Object.keys(errors).length === 0 || requestError.details.length !== Object.keys(errors).length) {
            setFormError(requestError.message);
          }
        }
      } else if (requestError instanceof TypeError) {
        setFormError('Không thể kết nối đến máy chủ API. Vui lòng thử lại.');
      } else {
        setFormError(requestError instanceof Error ? requestError.message : 'Không thể lưu tuyến xe.');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function textField(field: 'code' | 'origin' | 'destination', label: string, maxLength: number) {
    return (
      <div className="admin-crud-form-field">
        <label htmlFor={`${idPrefix}-${field}`}>{label} *</label>
        <input
          aria-describedby={fieldErrors[field] ? `${idPrefix}-${field}-error` : undefined}
          aria-invalid={Boolean(fieldErrors[field])}
          autoComplete="off"
          className={field === 'code' ? 'admin-data-mono' : undefined}
          disabled={submitting}
          id={`${idPrefix}-${field}`}
          maxLength={maxLength}
          onChange={(event) => updateField(field, event.target.value)}
          required
          type="text"
          value={values[field]}
        />
        {fieldErrors[field] && <span className="admin-crud-form-field-error" id={`${idPrefix}-${field}-error`}>{fieldErrors[field]}</span>}
      </div>
    );
  }

  return (
    <AdminFormDialog
      ariaBusy={submitting}
      ariaDescribedBy={`${idPrefix}-description`}
      ariaLabelledBy={`${idPrefix}-title`}
      dialogRef={dialogRef}
      onClose={onClose}
      preventDismiss={submitting}
    >
      <>
        <div className="admin-dialog-header">
          <div className="admin-dialog-header__copy">
            <p className="eyebrow">QUẢN LÝ VẬN HÀNH</p>
            <h2 id={`${idPrefix}-title`}>{editing ? 'Chỉnh sửa tuyến xe' : 'Thêm tuyến xe'}</h2>
            <p id={`${idPrefix}-description`}>{editing ? 'Cập nhật điểm đi và điểm đến của tuyến.' : 'Nhập thông tin tuyến thuộc nhà xe của bạn.'}</p>
          </div>
          <Button aria-label={editing ? 'Đóng biểu mẫu chỉnh sửa tuyến xe' : 'Đóng biểu mẫu thêm tuyến xe'} className="icon-button" disabled={submitting} onClick={closeDialog} type="button" variant="secondary"><X aria-hidden="true" size={19} /></Button>
        </div>
        <form className="admin-crud-form" noValidate onSubmit={handleSubmit}>
          {formError && <p className="admin-crud-form-error" role="alert">{formError}</p>}
          {editing && <div className="admin-crud-form-context"><strong className="admin-data-mono">{route.code}</strong><span>{route.busCompany.name} · {route.status === 'HOAT_DONG' ? 'Đang hoạt động' : 'Tạm ngưng'}</span></div>}
          {!editing && textField('code', 'Mã tuyến', 50)}
          {textField('origin', 'Điểm đi', 100)}
          {textField('destination', 'Điểm đến', 100)}
          {!editing && (
            <>
              <div className="admin-crud-form-field">
                <label htmlFor={`${idPrefix}-status`}>Trạng thái *</label>
                <select
                  aria-describedby={fieldErrors.status ? `${idPrefix}-status-error` : undefined}
                  aria-invalid={Boolean(fieldErrors.status)}
                  disabled={submitting}
                  id={`${idPrefix}-status`}
                  onChange={(event) => updateField('status', event.target.value)}
                  required
                  value={values.status}
                >
                  <option value="">Chọn trạng thái</option>
                  <option value="HOAT_DONG">Đang hoạt động</option>
                  <option value="TAM_NGUNG">Tạm ngưng</option>
                </select>
                {fieldErrors.status && <span className="admin-crud-form-field-error" id={`${idPrefix}-status-error`}>{fieldErrors.status}</span>}
              </div>
            </>
          )}
          <div className="admin-crud-form-actions">
            <Button disabled={submitting} onClick={closeDialog} type="button" variant="secondary">Hủy</Button>
            <Button disabled={submitting} type="submit">
              {submitting && <LoaderCircle aria-hidden="true" className="admin-crud-form-spinner" size={16} />}
              {submitting ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo tuyến'}
            </Button>
          </div>
        </form>
      </>
    </AdminFormDialog>
  );
}
