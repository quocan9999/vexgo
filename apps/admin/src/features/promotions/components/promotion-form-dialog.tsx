'use client';

import { LoaderCircle } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
import { createPromotion, PromotionApiError, type PromotionApiErrorDetail } from '../services/promotion-service';
import type { CreatePromotionRequest, Promotion, PromotionDiscountType } from '../types/promotion';
import styles from '../promotions.module.css';

type Props = { onClose: () => void; onSaved: (promotion: Promotion) => void };
type FormValues = {
  name: string;
  code: string;
  discountType: PromotionDiscountType | '';
  discountValue: string;
  maxDiscount: string;
  minimumTicketAmount: string;
  startsOn: string;
  endsOn: string;
  usageLimit: string;
};
type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField, string>>;

const FIELD_NAMES: readonly FormField[] = [
  'name', 'code', 'discountType', 'discountValue', 'maxDiscount',
  'minimumTicketAmount', 'startsOn', 'endsOn', 'usageLimit',
];
const DECIMAL_PATTERN = /^\d{1,16}(?:\.\d{1,2})?$/;

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cents(value: string): string | null {
  if (!DECIMAL_PATTERN.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return `${whole!.replace(/^0+(?=\d)/, '')}${fraction.padEnd(2, '0')}`.replace(/^0+(?=\d)/, '');
}

function compareMinorUnits(left: string, right: string): number {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  const code = values.code.trim().toUpperCase();
  if (!name) errors.name = 'Vui lòng nhập tên chương trình.';
  else if (name.length > 150) errors.name = 'Tên chương trình không vượt quá 150 ký tự.';
  if (!/^[A-Z0-9][A-Z0-9_-]{2,49}$/.test(code)) errors.code = 'Mã gồm 3–50 ký tự A–Z, 0–9, gạch dưới hoặc gạch ngang.';
  if (values.discountType !== 'PHAN_TRAM' && values.discountType !== 'SO_TIEN') {
    errors.discountType = 'Vui lòng chọn loại giảm giá.';
  }
  const discountValue = cents(values.discountValue);
  if (discountValue === null || compareMinorUnits(discountValue, '0') <= 0) errors.discountValue = 'Mức giảm phải là số dương, tối đa 2 chữ số thập phân.';
  else if (values.discountType === 'PHAN_TRAM' && compareMinorUnits(discountValue, '10000') > 0) errors.discountValue = 'Phần trăm giảm không được vượt quá 100.';
  if (values.discountType === 'PHAN_TRAM') {
    const maxDiscount = cents(values.maxDiscount);
    if (maxDiscount === null || compareMinorUnits(maxDiscount, '0') <= 0) errors.maxDiscount = 'Giảm tối đa bắt buộc và phải lớn hơn 0.';
  }
  if (values.minimumTicketAmount.trim()) {
    const minimum = cents(values.minimumTicketAmount);
    if (minimum === null) errors.minimumTicketAmount = 'Giá trị tối thiểu phải là số không âm, tối đa 2 chữ số thập phân.';
  }
  if (!isDateOnly(values.startsOn)) errors.startsOn = 'Vui lòng chọn ngày bắt đầu hợp lệ.';
  if (!isDateOnly(values.endsOn)) errors.endsOn = 'Vui lòng chọn ngày kết thúc hợp lệ.';
  else if (isDateOnly(values.startsOn) && values.endsOn < values.startsOn) errors.endsOn = 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
  if (!/^\d+$/.test(values.usageLimit) || !Number.isSafeInteger(Number(values.usageLimit)) || Number(values.usageLimit) < 1) {
    errors.usageLimit = 'Số lượt tối đa phải là số nguyên dương.';
  }
  return errors;
}

function mapServerFieldErrors(details: PromotionApiErrorDetail[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const detail of details) {
    if (FIELD_NAMES.includes(detail.field as FormField)) errors[detail.field as FormField] = detail.message;
  }
  return errors;
}

export function PromotionFormDialog({ onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<FormValues>({
    name: '', code: '', discountType: '', discountValue: '', maxDiscount: '',
    minimumTicketAmount: '', startsOn: '', endsOn: '', usageLimit: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idPrefix = 'create-promotion';

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
  }

  function updateField(field: FormField, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
      ...(field === 'discountType' && value === 'SO_TIEN' ? { maxDiscount: '' } : {}),
    }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === 'startsOn' ? { endsOn: undefined } : {}),
      ...(field === 'discountType' ? { maxDiscount: undefined } : {}),
    }));
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setFormError(null);
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    const request: CreatePromotionRequest = {
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      discountType: values.discountType as PromotionDiscountType,
      discountValue: values.discountValue.trim(),
      ...(values.discountType === 'PHAN_TRAM' ? { maxDiscount: values.maxDiscount.trim() } : {}),
      ...(values.minimumTicketAmount.trim() ? { minimumTicketAmount: values.minimumTicketAmount.trim() } : {}),
      startsOn: values.startsOn,
      endsOn: values.endsOn,
      usageLimit: Number(values.usageLimit),
    };
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const created = await createPromotion(request);
      dialogRef.current?.close();
      onSaved(created);
    } catch (requestError: unknown) {
      if (requestError instanceof PromotionApiError) {
        const serverErrors = mapServerFieldErrors(requestError.details);
        setFieldErrors(serverErrors);
        if (Object.keys(serverErrors).length > 0) {
          setFormError('Vui lòng kiểm tra lại các trường được đánh dấu.');
          requestAnimationFrame(() => summaryRef.current?.focus());
        } else if (requestError.code === 'PROMOTION_CODE_EXISTS') {
          setFieldErrors((current) => ({ ...current, code: 'Mã khuyến mãi đã tồn tại trong nhà xe này.' }));
          setFormError('Mã khuyến mãi đã tồn tại trong nhà xe này.');
          requestAnimationFrame(() => summaryRef.current?.focus());
        } else {
          setFormError(requestError.message || 'Không thể tạo khuyến mãi. Vui lòng thử lại.');
        }
      } else {
        setFormError('Không thể kết nối hoặc tạo khuyến mãi. Vui lòng thử lại.');
      }
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function fieldError(field: FormField, errorId: string) {
    return fieldErrors[field]
      ? <span className="admin-crud-form-field-error" id={errorId}>{fieldErrors[field]}</span>
      : null;
  }

  const summaryEntries = FIELD_NAMES.flatMap((field) => fieldErrors[field] ? [{ field, message: fieldErrors[field]! }] : []);

  return (
    <AdminFormDialog
      ariaLabelledBy={`${idPrefix}-title`}
      dialogRef={dialogRef}
      onClose={onClose}
      preventDismiss={submitting}
    >
      <header className="admin-form-dialog__header">
        <div>
          <p className="eyebrow">QUẢN LÝ ƯU ĐÃI</p>
          <h2 id={`${idPrefix}-title`}>Thêm khuyến mãi</h2>
        </div>
      </header>
      <form className="admin-crud-form" noValidate onSubmit={handleSubmit}>
        {summaryEntries.length > 0 && (
          <div aria-labelledby={`${idPrefix}-errors-title`} className="admin-crud-form-error" ref={summaryRef} role="alert" tabIndex={-1}>
            <strong id={`${idPrefix}-errors-title`}>Có {summaryEntries.length} trường cần kiểm tra</strong>
            <ul>
              {summaryEntries.map(({ field, message }) => (
                <li key={field}><a href={`#${idPrefix}-${field}`} onClick={(event) => { event.preventDefault(); document.getElementById(`${idPrefix}-${field}`)?.focus(); }}>{message}</a></li>
              ))}
            </ul>
          </div>
        )}
        {formError && <p className="admin-crud-form-error" role="alert">{formError}</p>}
        <p className={styles.activeNote} role="note">Khuyến mãi mới luôn bắt đầu ở trạng thái Hoạt động. Bạn có thể tạm ngưng sau khi tạo.</p>

        <div className="admin-crud-form-field">
          <label htmlFor={`${idPrefix}-name`}>Tên chương trình *</label>
          <input id={`${idPrefix}-name`} maxLength={150} required disabled={submitting} value={values.name} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? `${idPrefix}-name-error` : undefined} onChange={(event) => updateField('name', event.target.value)} />
          {fieldError('name', `${idPrefix}-name-error`)}
        </div>
        <div className="admin-crud-form-field">
          <label htmlFor={`${idPrefix}-code`}>Mã khuyến mãi *</label>
          <input autoCapitalize="characters" autoComplete="off" id={`${idPrefix}-code`} maxLength={50} required disabled={submitting} value={values.code} aria-invalid={Boolean(fieldErrors.code)} aria-describedby={fieldErrors.code ? `${idPrefix}-code-error` : undefined} onChange={(event) => updateField('code', event.target.value)} />
          {fieldError('code', `${idPrefix}-code-error`)}
        </div>
        <div className="admin-crud-form-field">
          <label htmlFor={`${idPrefix}-discountType`}>Loại giảm giá *</label>
          <select id={`${idPrefix}-discountType`} required disabled={submitting} value={values.discountType} aria-invalid={Boolean(fieldErrors.discountType)} aria-describedby={fieldErrors.discountType ? `${idPrefix}-discountType-error` : undefined} onChange={(event) => updateField('discountType', event.target.value)}>
            <option value="">Chọn loại giảm giá</option>
            <option value="PHAN_TRAM">Phần trăm</option>
            <option value="SO_TIEN">Số tiền cố định</option>
          </select>
          {fieldError('discountType', `${idPrefix}-discountType-error`)}
        </div>
        <div className="admin-crud-form-field">
          <label htmlFor={`${idPrefix}-discountValue`}>Mức giảm {values.discountType === 'PHAN_TRAM' ? '(%)' : '(VND)'} *</label>
          <input id={`${idPrefix}-discountValue`} inputMode="decimal" autoComplete="off" required disabled={submitting} value={values.discountValue} aria-invalid={Boolean(fieldErrors.discountValue)} aria-describedby={fieldErrors.discountValue ? `${idPrefix}-discountValue-error` : undefined} onChange={(event) => updateField('discountValue', event.target.value)} />
          {fieldError('discountValue', `${idPrefix}-discountValue-error`)}
        </div>
        {values.discountType === 'PHAN_TRAM' && <div className="admin-crud-form-field">
          <label htmlFor={`${idPrefix}-maxDiscount`}>Giảm tối đa (VND) *</label>
          <input id={`${idPrefix}-maxDiscount`} inputMode="decimal" autoComplete="off" required disabled={submitting} value={values.maxDiscount} aria-invalid={Boolean(fieldErrors.maxDiscount)} aria-describedby={fieldErrors.maxDiscount ? `${idPrefix}-maxDiscount-error` : undefined} onChange={(event) => updateField('maxDiscount', event.target.value)} />
          {fieldError('maxDiscount', `${idPrefix}-maxDiscount-error`)}
        </div>}
        <div className="admin-crud-form-field">
          <label htmlFor={`${idPrefix}-minimumTicketAmount`}>Giá trị vé tối thiểu (VND)</label>
          <input id={`${idPrefix}-minimumTicketAmount`} inputMode="decimal" autoComplete="off" disabled={submitting} value={values.minimumTicketAmount} aria-invalid={Boolean(fieldErrors.minimumTicketAmount)} aria-describedby={fieldErrors.minimumTicketAmount ? `${idPrefix}-minimumTicketAmount-error` : undefined} onChange={(event) => updateField('minimumTicketAmount', event.target.value)} />
          {fieldError('minimumTicketAmount', `${idPrefix}-minimumTicketAmount-error`)}
        </div>
        <div className="admin-crud-form-field">
          <label htmlFor={`${idPrefix}-startsOn`}>Bắt đầu *</label>
          <input id={`${idPrefix}-startsOn`} type="date" required disabled={submitting} value={values.startsOn} aria-invalid={Boolean(fieldErrors.startsOn)} aria-describedby={fieldErrors.startsOn ? `${idPrefix}-startsOn-error` : undefined} onChange={(event) => updateField('startsOn', event.target.value)} />
          {fieldError('startsOn', `${idPrefix}-startsOn-error`)}
        </div>
        <div className="admin-crud-form-field">
          <label htmlFor={`${idPrefix}-endsOn`}>Kết thúc *</label>
          <input id={`${idPrefix}-endsOn`} min={values.startsOn || undefined} type="date" required disabled={submitting} value={values.endsOn} aria-invalid={Boolean(fieldErrors.endsOn)} aria-describedby={fieldErrors.endsOn ? `${idPrefix}-endsOn-error` : undefined} onChange={(event) => updateField('endsOn', event.target.value)} />
          {fieldError('endsOn', `${idPrefix}-endsOn-error`)}
        </div>
        <div className="admin-crud-form-field">
          <label htmlFor={`${idPrefix}-usageLimit`}>Số lượt tối đa *</label>
          <input id={`${idPrefix}-usageLimit`} inputMode="numeric" min="1" step="1" type="number" required disabled={submitting} value={values.usageLimit} aria-invalid={Boolean(fieldErrors.usageLimit)} aria-describedby={fieldErrors.usageLimit ? `${idPrefix}-usageLimit-error` : undefined} onChange={(event) => updateField('usageLimit', event.target.value)} />
          {fieldError('usageLimit', `${idPrefix}-usageLimit-error`)}
        </div>
        <div className="admin-crud-form-actions">
          <Button disabled={submitting} onClick={closeDialog} type="button" variant="secondary">Hủy</Button>
          <Button disabled={submitting} type="submit">
            {submitting && <LoaderCircle aria-hidden="true" className="admin-crud-form-spinner" size={16} />}
            {submitting ? 'Đang tạo…' : 'Tạo khuyến mãi'}
          </Button>
        </div>
      </form>
    </AdminFormDialog>
  );
}
