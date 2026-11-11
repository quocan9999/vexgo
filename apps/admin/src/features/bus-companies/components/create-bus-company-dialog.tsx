'use client';

import { ResourceModalForm } from '@/components/admin/resource-modal-form';

import { LoaderCircle } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ResourceNotice, ResourceModalDialog } from '@/components/admin/resource-ui';
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
  const tCompanies = useTranslations('busCompanies');
  const tCommon = useTranslations('common');
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

    if (!code) errors.code = tCompanies('validationCodeRequired');
    else if (code.length > 50) {
      errors.code = tCompanies('validationCodeMaxLength');
    }

    if (!name) errors.name = tCompanies('validationNameRequired');
    else if (name.length > 150) {
      errors.name = tCompanies('validationNameMaxLength');
    }

    if (values.status !== 'HOAT_DONG' && values.status !== 'TAM_NGUNG') {
      errors.status = tCompanies('validationStatusInvalid');
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
            setFormError(tCompanies('validationCheckMarkedFields'));
          } else {
            setFormError(hasFieldErrors ? null : requestError.message);
          }
        }
      } else {
        setFormError(
          requestError instanceof Error
            ? requestError.message
            : tCompanies('cannotCreate'),
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ResourceModalDialog
      title={tCompanies('createBusCompany')}
      description={tCompanies('createCompanyDesc')}
      busy={submitting}
      preventDismiss={submitting}
      onClose={onClose}
      size="lg"
    >
      <ResourceModalForm
        noValidate
        onSubmit={handleSubmit}
        footer={
          <div className="-mx-5 -mb-5 flex justify-end gap-2 border-t bg-slate-50/80 dark:bg-slate-900/60 px-5 py-3.5 sm:-mx-6 sm:-mb-6 sm:px-6 shrink-0">
            <Button
              disabled={submitting}
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              {tCommon('cancel')}
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 motion-safe:animate-spin"
                />
              )}
              {submitting ? tCommon('loading') : tCompanies('createButton')}
            </Button>
          </div>
        }
      >
        {formError && (
          <ResourceNotice kind="error">{formError}</ResourceNotice>
        )}
        
        <Field data-invalid={Boolean(fieldErrors.code)}>
          <FieldLabel htmlFor="create-company-code">{tCompanies('colCode')}</FieldLabel>
          <Input
            autoComplete="off"
            className="admin-data-mono"
            id="create-company-code"
            maxLength={50}
            onChange={(event) => updateField('code', event.target.value)}
            placeholder={tCompanies('companyCodePlaceholder')}
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
          <FieldLabel htmlFor="create-company-name">{tCompanies('colName')}</FieldLabel>
          <Input
            autoComplete="organization"
            id="create-company-name"
            maxLength={150}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder={tCompanies('companyNamePlaceholder')}
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
            {tCompanies('contactInfo')}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              {tCompanies('optional')}
            </span>
          </FieldLabel>
          <Input
            autoComplete="tel"
            id="create-company-contact"
            onChange={(event) =>
              updateField('contactInfo', event.target.value)
            }
            placeholder={tCompanies('contactPlaceholder')}
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
            {tCommon('status')}
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
                  ? tCompanies('statusActive')
                  : tCompanies('statusSuspended')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOAT_DONG">{tCompanies('statusActive')}</SelectItem>
              <SelectItem value="TAM_NGUNG">{tCompanies('statusSuspended')}</SelectItem>
            </SelectContent>
          </Select>
          <FieldError id="create-company-status-error">
            {fieldErrors.status}
          </FieldError>
        </Field>
      </ResourceModalForm>
    </ResourceModalDialog>
  );
}
