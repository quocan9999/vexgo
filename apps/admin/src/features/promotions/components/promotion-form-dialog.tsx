'use client';

import { ResourceSheetForm } from '@/components/admin/resource-sheet-form';

import { LoaderCircle } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { AdminMoneyInput } from '@/components/admin/admin-money-input';
import { ResourceSheet } from '@/components/admin/resource-ui';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Button } from '@/components/ui/action-button';
import {
  createPromotion,
  updatePromotion,
  PromotionApiError,
  type PromotionApiErrorDetail,
} from '../services/promotion-service';
import type {
  CreatePromotionRequest,
  Promotion,
  PromotionDiscountType,
} from '../types/promotion';

type Props = {
  promotion?: Promotion;
  onClose: () => void;
  onSaved: (promotion: Promotion) => void;
};
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
  'name',
  'code',
  'discountType',
  'discountValue',
  'maxDiscount',
  'minimumTicketAmount',
  'startsOn',
  'endsOn',
  'usageLimit',
];
const DECIMAL_PATTERN = /^\d{1,16}(?:\.\d{1,2})?$/;

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function cents(value: string): string | null {
  if (!DECIMAL_PATTERN.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return `${whole!.replace(/^0+(?=\d)/, '')}${fraction.padEnd(2, '0')}`.replace(
    /^0+(?=\d)/,
    '',
  );
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
  else if (name.length > 150)
    errors.name = 'Tên chương trình không vượt quá 150 ký tự.';
  if (!/^[A-Z0-9][A-Z0-9_-]{2,49}$/.test(code))
    errors.code = 'Mã gồm 3–50 ký tự A–Z, 0–9, gạch dưới hoặc gạch ngang.';
  if (
    values.discountType !== 'PHAN_TRAM' &&
    values.discountType !== 'SO_TIEN'
  ) {
    errors.discountType = 'Vui lòng chọn loại giảm giá.';
  }
  const discountValue = cents(values.discountValue);
  if (discountValue === null || compareMinorUnits(discountValue, '0') <= 0)
    errors.discountValue =
      'Mức giảm phải là số dương, tối đa 2 chữ số thập phân.';
  else if (
    values.discountType === 'PHAN_TRAM' &&
    compareMinorUnits(discountValue, '10000') > 0
  )
    errors.discountValue = 'Phần trăm giảm không được vượt quá 100.';
  if (values.discountType === 'PHAN_TRAM') {
    const maxDiscount = cents(values.maxDiscount);
    if (maxDiscount === null || compareMinorUnits(maxDiscount, '0') <= 0)
      errors.maxDiscount = 'Giảm tối đa bắt buộc và phải lớn hơn 0.';
  }
  if (values.minimumTicketAmount.trim()) {
    const minimum = cents(values.minimumTicketAmount);
    if (minimum === null)
      errors.minimumTicketAmount =
        'Giá trị tối thiểu phải là số không âm, tối đa 2 chữ số thập phân.';
  }
  if (!isDateOnly(values.startsOn))
    errors.startsOn = 'Vui lòng chọn ngày bắt đầu hợp lệ.';
  if (!isDateOnly(values.endsOn))
    errors.endsOn = 'Vui lòng chọn ngày kết thúc hợp lệ.';
  else if (isDateOnly(values.startsOn) && values.endsOn < values.startsOn)
    errors.endsOn = 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
  if (
    !/^\d+$/.test(values.usageLimit) ||
    !Number.isSafeInteger(Number(values.usageLimit)) ||
    Number(values.usageLimit) < 1
  ) {
    errors.usageLimit = 'Số lượt tối đa phải là số nguyên dương.';
  }
  return errors;
}

function mapServerFieldErrors(details: PromotionApiErrorDetail[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const detail of details) {
    if (FIELD_NAMES.includes(detail.field as FormField))
      errors[detail.field as FormField] = detail.message;
  }
  return errors;
}

export function PromotionFormDialog({ promotion, onClose, onSaved }: Props) {
  const submittingRef = useRef(false);
  const [codeLocked, setCodeLocked] = useState(
    Boolean(promotion && promotion.usageCount > 0),
  );
  const [values, setValues] = useState<FormValues>(() =>
    promotion
      ? {
          name: promotion.name,
          code: promotion.code,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue.replace(/\.00$/, ''),
          maxDiscount: promotion.maxDiscount?.replace(/\.00$/, '') ?? '',
          minimumTicketAmount:
            promotion.minimumTicketAmount?.replace(/\.00$/, '') ?? '',
          startsOn: promotion.startsOn,
          endsOn: promotion.endsOn,
          usageLimit: String(promotion.usageLimit),
        }
      : {
          name: '',
          code: '',
          discountType: '',
          discountValue: '',
          maxDiscount: '',
          minimumTicketAmount: '',
          startsOn: '',
          endsOn: '',
          usageLimit: '',
        },
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const idPrefix = promotion
    ? `edit-promotion-${promotion.id}`
    : 'create-promotion';
  const formTitle = promotion ? 'Chỉnh sửa khuyến mãi' : 'Thêm khuyến mãi';

  function focusFirstInvalidField(errors: FieldErrors) {
    const field = FIELD_NAMES.find((name) => errors[name]);
    if (field)
      requestAnimationFrame(() =>
        document.getElementById(`${idPrefix}-${field}`)?.focus(),
      );
  }

  function closeDialog() {
    if (!submittingRef.current) onClose();
  }

  function updateField(field: FormField, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
      ...(field === 'discountType' && value === 'SO_TIEN'
        ? { maxDiscount: '' }
        : {}),
    }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === 'startsOn' ? { endsOn: undefined } : {}),
      ...(field === 'discountType' ? { maxDiscount: undefined } : {}),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const errors = validate(values);
    if (promotion && Number(values.usageLimit) < promotion.usageCount) {
      errors.usageLimit =
        'Số lượt tối đa không được nhỏ hơn số lượt đã sử dụng.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(errors);
      return;
    }

    const request: CreatePromotionRequest = {
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      discountType: values.discountType as PromotionDiscountType,
      discountValue: values.discountValue.trim(),
      ...(values.discountType === 'PHAN_TRAM'
        ? { maxDiscount: values.maxDiscount.trim() }
        : {}),
      ...(values.minimumTicketAmount.trim()
        ? { minimumTicketAmount: values.minimumTicketAmount.trim() }
        : {}),
      startsOn: values.startsOn,
      endsOn: values.endsOn,
      usageLimit: Number(values.usageLimit),
    };
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const saved = promotion
        ? await updatePromotion(promotion.id, request)
        : await createPromotion(request);
      onSaved(saved);
    } catch (requestError: unknown) {
      if (requestError instanceof PromotionApiError) {
        const serverErrors = mapServerFieldErrors(requestError.details);
        setFieldErrors(serverErrors);
        if (Object.keys(serverErrors).length > 0) {
          if (requestError.code === 'PROMOTION_CODE_LOCKED' && promotion) {
            setCodeLocked(true);
            setValues((current) => ({ ...current, code: promotion.code }));
          }
          focusFirstInvalidField(serverErrors);
        } else if (requestError.code === 'PROMOTION_CODE_EXISTS') {
          const errors: FieldErrors = {
            code: 'Mã khuyến mãi đã tồn tại trong nhà xe này.',
          };
          setFieldErrors(errors);
          focusFirstInvalidField(errors);
        } else {
          toast.error(
            requestError.message ||
              'Không thể lưu khuyến mãi. Vui lòng thử lại.',
          );
        }
      } else {
        toast.error('Không thể kết nối hoặc lưu khuyến mãi. Vui lòng thử lại.');
      }
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function fieldError(field: FormField, errorId: string) {
    return fieldErrors[field] ? (
      <FieldError id={errorId}>{fieldErrors[field]}</FieldError>
    ) : null;
  }

  return (
    <ResourceSheet
      title={formTitle}
      description={
        promotion
          ? 'Cập nhật điều kiện áp dụng của chương trình.'
          : 'Thiết lập mã giảm giá và thời hạn áp dụng.'
      }
      busy={submitting}
      preventDismiss={submitting}
      onClose={closeDialog}
    >
      <ResourceSheetForm
        noValidate
        onSubmit={handleSubmit}
        footer={
          <div className="-mx-4 flex shrink-0 justify-end gap-3 border-t bg-popover px-4 py-4 sm:-mx-6 sm:px-6">
            <Button
              disabled={submitting}
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button disabled={submitting} aria-busy={submitting} type="submit">
              {submitting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                  size={16}
                />
              )}
              {submitting
                ? promotion
                  ? 'Đang lưu…'
                  : 'Đang tạo…'
                : promotion
                  ? 'Lưu thay đổi'
                  : 'Tạo khuyến mãi'}
            </Button>
          </div>
        }
      >
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-name`}>
            Tên chương trình *
          </FieldLabel>
          <Input
            id={`${idPrefix}-name`}
            maxLength={150}
            required
            disabled={submitting}
            value={values.name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={
              fieldErrors.name ? `${idPrefix}-name-error` : undefined
            }
            onChange={(event) => updateField('name', event.target.value)}
          />
          {fieldError('name', `${idPrefix}-name-error`)}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-code`}>Mã khuyến mãi *</FieldLabel>
          <Input
            autoCapitalize="characters"
            autoComplete="off"
            id={`${idPrefix}-code`}
            readOnly={codeLocked}
            maxLength={50}
            required
            disabled={submitting}
            value={values.code}
            aria-invalid={Boolean(fieldErrors.code)}
            aria-describedby={
              fieldErrors.code ? `${idPrefix}-code-error` : undefined
            }
            onChange={(event) => updateField('code', event.target.value)}
          />
          {fieldError('code', `${idPrefix}-code-error`)}
          {codeLocked && (
            <span className="text-xs text-muted-foreground">
              Mã đã phát sinh sử dụng nên không thể thay đổi.
            </span>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-discountType`}>
            Loại giảm giá *
          </FieldLabel>
          <Select
            value={values.discountType || null}
            disabled={submitting}
            onValueChange={(value) => updateField('discountType', value ?? '')}
          >
            <SelectTrigger
              id={`${idPrefix}-discountType`}
              aria-invalid={Boolean(fieldErrors.discountType)}
              aria-describedby={
                fieldErrors.discountType
                  ? `${idPrefix}-discountType-error`
                  : undefined
              }
            >
              <SelectValue placeholder="Chọn loại giảm giá">
                {values.discountType === 'PHAN_TRAM'
                  ? 'Phần trăm'
                  : values.discountType === 'SO_TIEN'
                    ? 'Số tiền cố định'
                    : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PHAN_TRAM">Phần trăm</SelectItem>
              <SelectItem value="SO_TIEN">Số tiền cố định</SelectItem>
            </SelectContent>
          </Select>
          {fieldError('discountType', `${idPrefix}-discountType-error`)}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-discountValue`}>
            Mức giảm {values.discountType === 'PHAN_TRAM' ? '(%)' : '(VND)'} *
          </FieldLabel>
          {values.discountType === 'SO_TIEN' ? (
            <AdminMoneyInput
              appearance="resource"
              id={`${idPrefix}-discountValue`}
              autoComplete="off"
              required
              disabled={submitting}
              value={values.discountValue}
              aria-invalid={Boolean(fieldErrors.discountValue)}
              aria-describedby={
                fieldErrors.discountValue
                  ? `${idPrefix}-discountValue-error`
                  : undefined
              }
              onValueChange={(value) => updateField('discountValue', value)}
            />
          ) : (
            <Input
              id={`${idPrefix}-discountValue`}
              inputMode="decimal"
              autoComplete="off"
              required
              disabled={submitting}
              value={values.discountValue}
              aria-invalid={Boolean(fieldErrors.discountValue)}
              aria-describedby={
                fieldErrors.discountValue
                  ? `${idPrefix}-discountValue-error`
                  : undefined
              }
              onChange={(event) =>
                updateField('discountValue', event.target.value)
              }
            />
          )}
          {fieldError('discountValue', `${idPrefix}-discountValue-error`)}
        </Field>
        {values.discountType === 'PHAN_TRAM' && (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-maxDiscount`}>
              Giảm tối đa (VND) *
            </FieldLabel>
            <AdminMoneyInput
              appearance="resource"
              id={`${idPrefix}-maxDiscount`}
              autoComplete="off"
              required
              disabled={submitting}
              value={values.maxDiscount}
              aria-invalid={Boolean(fieldErrors.maxDiscount)}
              aria-describedby={
                fieldErrors.maxDiscount
                  ? `${idPrefix}-maxDiscount-error`
                  : undefined
              }
              onValueChange={(value) => updateField('maxDiscount', value)}
            />
            {fieldError('maxDiscount', `${idPrefix}-maxDiscount-error`)}
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-minimumTicketAmount`}>
            Giá trị vé tối thiểu (VND)
          </FieldLabel>
          <AdminMoneyInput
            appearance="resource"
            id={`${idPrefix}-minimumTicketAmount`}
            autoComplete="off"
            disabled={submitting}
            value={values.minimumTicketAmount}
            aria-invalid={Boolean(fieldErrors.minimumTicketAmount)}
            aria-describedby={
              fieldErrors.minimumTicketAmount
                ? `${idPrefix}-minimumTicketAmount-error`
                : undefined
            }
            onValueChange={(value) => updateField('minimumTicketAmount', value)}
          />
          {fieldError(
            'minimumTicketAmount',
            `${idPrefix}-minimumTicketAmount-error`,
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-startsOn`}>Bắt đầu *</FieldLabel>
          <Input
            id={`${idPrefix}-startsOn`}
            type="date"
            required
            disabled={submitting}
            value={values.startsOn}
            aria-invalid={Boolean(fieldErrors.startsOn)}
            aria-describedby={
              fieldErrors.startsOn ? `${idPrefix}-startsOn-error` : undefined
            }
            onChange={(event) => updateField('startsOn', event.target.value)}
          />
          {fieldError('startsOn', `${idPrefix}-startsOn-error`)}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-endsOn`}>Kết thúc *</FieldLabel>
          <Input
            id={`${idPrefix}-endsOn`}
            min={values.startsOn || undefined}
            type="date"
            required
            disabled={submitting}
            value={values.endsOn}
            aria-invalid={Boolean(fieldErrors.endsOn)}
            aria-describedby={
              fieldErrors.endsOn ? `${idPrefix}-endsOn-error` : undefined
            }
            onChange={(event) => updateField('endsOn', event.target.value)}
          />
          {fieldError('endsOn', `${idPrefix}-endsOn-error`)}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-usageLimit`}>
            Số lượt tối đa *
          </FieldLabel>
          <Input
            id={`${idPrefix}-usageLimit`}
            inputMode="numeric"
            min={Math.max(1, promotion?.usageCount ?? 0)}
            step="1"
            type="number"
            required
            disabled={submitting}
            value={values.usageLimit}
            aria-invalid={Boolean(fieldErrors.usageLimit)}
            aria-describedby={
              fieldErrors.usageLimit
                ? `${idPrefix}-usageLimit-error`
                : undefined
            }
            onChange={(event) => updateField('usageLimit', event.target.value)}
          />
          {fieldError('usageLimit', `${idPrefix}-usageLimit-error`)}
          {promotion && (
            <span className="text-xs text-muted-foreground">
              Đã sử dụng: {promotion.usageCount.toLocaleString('vi-VN')} lượt.
              Số lượt đã dùng được ghi nhận tự động.
            </span>
          )}
        </Field>
      </ResourceSheetForm>
    </ResourceSheet>
  );
}
