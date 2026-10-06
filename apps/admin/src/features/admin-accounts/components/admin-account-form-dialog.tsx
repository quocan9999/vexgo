'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminFormDialog } from '@/components/admin/admin-form-dialog';
import { Button } from '@/components/ui/button';
import { getBusCompanyFilterOptions } from '@/features/bus-companies/services/bus-company-service';
import { getDefaultRolePermissions } from '@/features/platform-rbac/services/platform-rbac-service';
import type { AdminRbacRole } from '@/features/platform-rbac/types/platform-rbac';
import {
  TENANT_RBAC_ROLE_NAMES,
  type TenantRbacRoleName,
} from '@/features/tenant-rbac/types/tenant-rbac';
import {
  AdminAccountApiError,
  createAdminAccount,
  updateAdminAccount,
  type AdminAccountApiErrorDetail,
} from '../services/admin-account-service';
import type {
  AdminAccount,
  CreateAdminAccountInput,
  UpdateAdminAccountInput,
} from '../types/admin-account';
import styles from './admin-accounts-management.module.css';

type TenantRoleOption = Pick<AdminRbacRole, 'roleName' | 'description'> & {
  roleName: TenantRbacRoleName;
};

type OptionsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'success';
      companies: Array<{ id: number; label: string }>;
      roles: TenantRoleOption[];
    };

type Values = {
  fullName: string;
  phoneNumber: string;
  password: string;
  busCompanyId: string;
  employeeCode: string;
  dateOfBirth: string;
  email: string;
  citizenId: string;
  roleNames: TenantRbacRoleName[];
};

type Field = keyof Values;
type FieldErrors = Partial<Record<Field, string>>;

const TENANT_ROLE_SET = new Set<string>(TENANT_RBAC_ROLE_NAMES);

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function fieldErrorsFromDetails(details: AdminAccountApiErrorDetail[]) {
  const errors: FieldErrors = {};
  const supportedFields = new Set<Field>([
    'fullName',
    'phoneNumber',
    'password',
    'busCompanyId',
    'employeeCode',
    'dateOfBirth',
    'email',
    'citizenId',
  ]);

  for (const detail of details) {
    if (supportedFields.has(detail.field as Field)) {
      errors[detail.field as Field] = detail.message;
    }
  }

  return errors;
}

function roleNameIsTenant(roleName: string): roleName is TenantRbacRoleName {
  return TENANT_ROLE_SET.has(roleName);
}

function initialValues(account?: AdminAccount): Values {
  return {
    fullName: account?.fullName ?? '',
    phoneNumber: '',
    password: '',
    busCompanyId: '',
    employeeCode: '',
    dateOfBirth: account?.dateOfBirth?.slice(0, 10) ?? '',
    email: account?.email ?? '',
    citizenId: account?.citizenId ?? '',
    roleNames: [],
  };
}

export function AdminAccountFormDialog({
  account,
  onClose,
  onSaved,
}: {
  account?: AdminAccount;
  onClose: () => void;
  onSaved: (saved: AdminAccount) => void;
}) {
  const editing = account !== undefined;
  const idPrefix = editing
    ? `edit-admin-account-${account.accountId}`
    : 'create-admin-account';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState<Values>(() => initialValues(account));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [options, setOptions] = useState<OptionsState>(() =>
    editing
      ? { status: 'success', companies: [], roles: [] }
      : { status: 'loading' },
  );

  useEffect(() => {
    if (editing) return;

    const controller = new AbortController();
    Promise.all([
      getBusCompanyFilterOptions(controller.signal),
      getDefaultRolePermissions(controller.signal),
    ])
      .then(([companies, catalog]) => {
        if (controller.signal.aborted) return;
        const roles = catalog.roles.flatMap((role) =>
          role.scope === 'tenant' && roleNameIsTenant(role.roleName)
            ? [{ roleName: role.roleName, description: role.description }]
            : [],
        );
        setOptions({ status: 'success', companies, roles });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setOptions({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Không thể tải nhà xe và danh mục vai trò.',
        });
      });

    return () => controller.abort();
  }, [editing, retryCount]);

  function closeDialog() {
    if (!submittingRef.current) dialogRef.current?.close();
  }

  function retryOptions() {
    setOptions({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  function updateField(field: Exclude<Field, 'roleNames'>, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function toggleRole(roleName: TenantRbacRoleName) {
    setValues((current) => ({
      ...current,
      roleNames: current.roleNames.includes(roleName)
        ? current.roleNames.filter((role) => role !== roleName)
        : [...current.roleNames, roleName],
    }));
    setFieldErrors((current) => ({ ...current, roleNames: undefined }));
    setFormError(null);
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const fullName = values.fullName.trim();
    const email = values.email.trim();
    const citizenId = values.citizenId.trim();

    if (!fullName) errors.fullName = 'Vui lòng nhập họ và tên.';
    else if (fullName.length > 100) {
      errors.fullName = 'Họ và tên không được vượt quá 100 ký tự.';
    }

    if (!editing) {
      if (!/^\+84\d{9}$/.test(values.phoneNumber.trim())) {
        errors.phoneNumber = 'Số điện thoại phải có dạng +84xxxxxxxxx.';
      }
      const passwordBytes = new TextEncoder().encode(values.password).length;
      if (passwordBytes < 8 || passwordBytes > 72) {
        errors.password = 'Mật khẩu phải dài từ 8 đến 72 byte.';
      }
      const busCompanyId = Number(values.busCompanyId);
      if (
        !Number.isSafeInteger(busCompanyId) ||
        busCompanyId < 1 ||
        options.status !== 'success' ||
        !options.companies.some((company) => company.id === busCompanyId)
      ) {
        errors.busCompanyId = 'Vui lòng chọn nhà xe hợp lệ.';
      }
      const employeeCode = values.employeeCode.trim();
      if (!employeeCode) errors.employeeCode = 'Vui lòng nhập mã nhân viên.';
      else if (employeeCode.length > 50) {
        errors.employeeCode = 'Mã nhân viên không được vượt quá 50 ký tự.';
      }
      if (options.status !== 'success' || options.roles.length === 0) {
        errors.roleNames = 'Chưa tải được vai trò nhà xe để gán.';
      } else if (
        values.roleNames.length === 0 ||
        new Set(values.roleNames).size !== values.roleNames.length ||
        values.roleNames.some(
          (roleName) =>
            !options.roles.some((role) => role.roleName === roleName),
        )
      ) {
        errors.roleNames = 'Vui lòng chọn ít nhất một vai trò nhà xe.';
      }
    }

    if (values.dateOfBirth && !isValidDate(values.dateOfBirth)) {
      errors.dateOfBirth = 'Ngày sinh không hợp lệ.';
    }
    if (
      email &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150)
    ) {
      errors.email = 'Email không hợp lệ hoặc vượt quá 150 ký tự.';
    }
    if (citizenId && !/^\d{12}$/.test(citizenId)) {
      errors.citizenId = 'CCCD phải gồm đúng 12 chữ số.';
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
      const commonInput = {
        fullName: values.fullName.trim(),
        dateOfBirth: values.dateOfBirth || null,
        email: values.email.trim() || null,
        citizenId: values.citizenId.trim() || null,
      };
      const saved = editing
        ? await updateAdminAccount(
            account.accountId,
            commonInput satisfies UpdateAdminAccountInput,
          )
        : await createAdminAccount({
            ...commonInput,
            phoneNumber: values.phoneNumber.trim(),
            password: values.password,
            busCompanyId: Number(values.busCompanyId),
            employeeCode: values.employeeCode.trim(),
            roleNames: values.roleNames,
          } satisfies CreateAdminAccountInput);
      dialogRef.current?.close();
      onSaved(saved);
    } catch (requestError: unknown) {
      if (requestError instanceof AdminAccountApiError) {
        const serverErrors = fieldErrorsFromDetails(requestError.details);
        if (requestError.code === 'PHONE_ALREADY_REGISTERED') {
          serverErrors.phoneNumber = requestError.message;
        } else if (requestError.code === 'EMAIL_ALREADY_REGISTERED') {
          serverErrors.email = requestError.message;
        } else if (requestError.code === 'EMPLOYEE_CODE_EXISTS') {
          serverErrors.employeeCode = requestError.message;
        }
        setFieldErrors(serverErrors);
        setFormError(
          Object.keys(serverErrors).length > 0
            ? 'Vui lòng kiểm tra lại các trường được đánh dấu.'
            : requestError.message,
        );
      } else {
        setFormError(
          requestError instanceof TypeError
            ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
            : requestError instanceof Error
              ? requestError.message
              : 'Không thể lưu tài khoản Admin. Vui lòng thử lại.',
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function textField(
    field: Exclude<Field, 'roleNames'>,
    label: string,
    type: 'text' | 'email' | 'date' | 'password' | 'tel' = 'text',
    required = false,
  ) {
    const fieldId = `${idPrefix}-${field}`;
    return (
      <div className="admin-crud-form-field">
        <label htmlFor={fieldId}>
          {label}
          {required ? ' *' : ''}
        </label>
        <input
          aria-describedby={fieldErrors[field] ? `${fieldId}-error` : undefined}
          aria-invalid={Boolean(fieldErrors[field])}
          autoComplete={field === 'password' ? 'new-password' : 'off'}
          className={
            field === 'employeeCode' || field === 'citizenId'
              ? 'admin-data-mono'
              : undefined
          }
          disabled={submitting}
          id={fieldId}
          maxLength={
            field === 'fullName'
              ? 100
              : field === 'employeeCode'
                ? 50
                : undefined
          }
          onChange={(event) => updateField(field, event.target.value)}
          required={required}
          type={type}
          value={values[field]}
        />
        {fieldErrors[field] && (
          <span className="admin-crud-form-field-error" id={`${fieldId}-error`}>
            {fieldErrors[field]}
          </span>
        )}
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
            <p className="eyebrow">QUẢN LÝ TÀI KHOẢN ADMIN</p>
            <h2 id={`${idPrefix}-title`}>
              {editing ? 'Chỉnh sửa tài khoản Admin' : 'Thêm tài khoản Admin'}
            </h2>
            <p id={`${idPrefix}-description`}>
              {editing
                ? 'Cập nhật thông tin cá nhân. Số điện thoại, nhà xe, mã nhân viên và vai trò được quản lý riêng.'
                : 'Tạo tài khoản nhân viên gắn với một nhà xe và ít nhất một vai trò nhà xe.'}
            </p>
          </div>
          <Button
            aria-label={
              editing
                ? 'Đóng biểu mẫu chỉnh sửa tài khoản'
                : 'Đóng biểu mẫu thêm tài khoản'
            }
            className="icon-button"
            disabled={submitting}
            onClick={closeDialog}
            type="button"
            variant="secondary"
          >
            <X aria-hidden="true" size={19} />
          </Button>
        </div>

        <form className="admin-crud-form" noValidate onSubmit={handleSubmit}>
          {formError && (
            <p className="admin-crud-form-error" role="alert">
              {formError}
            </p>
          )}
          {textField('fullName', 'Họ và tên', 'text', true)}
          {!editing && (
            <>
              {textField('phoneNumber', 'Số điện thoại', 'tel', true)}
              {textField('password', 'Mật khẩu', 'password', true)}
              <div className="admin-crud-form-field">
                <label htmlFor={`${idPrefix}-busCompanyId`}>Nhà xe *</label>
                <select
                  aria-describedby={
                    fieldErrors.busCompanyId
                      ? `${idPrefix}-busCompanyId-error`
                      : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.busCompanyId)}
                  disabled={
                    submitting ||
                    options.status !== 'success' ||
                    options.companies.length === 0
                  }
                  id={`${idPrefix}-busCompanyId`}
                  onChange={(event) =>
                    updateField('busCompanyId', event.target.value)
                  }
                  required
                  value={values.busCompanyId}
                >
                  <option value="">Chọn nhà xe</option>
                  {options.status === 'success' &&
                    options.companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.label}
                      </option>
                    ))}
                </select>
                {fieldErrors.busCompanyId && (
                  <span
                    className="admin-crud-form-field-error"
                    id={`${idPrefix}-busCompanyId-error`}
                  >
                    {fieldErrors.busCompanyId}
                  </span>
                )}
                {options.status === 'loading' && (
                  <p aria-live="polite" role="status">
                    Đang tải danh sách nhà xe…
                  </p>
                )}
              </div>
              {textField('employeeCode', 'Mã nhân viên', 'text', true)}
              <fieldset className={styles.roleOptions}>
                <legend>Vai trò nhà xe *</legend>
                {options.status === 'success' &&
                  options.roles.map((role) => (
                    <label className={styles.roleOption} key={role.roleName}>
                      <input
                        checked={values.roleNames.includes(role.roleName)}
                        disabled={submitting}
                        onChange={() => toggleRole(role.roleName)}
                        type="checkbox"
                        value={role.roleName}
                      />
                      <span>{role.description ?? role.roleName}</span>
                    </label>
                  ))}
                {fieldErrors.roleNames && (
                  <span className="admin-crud-form-field-error">
                    {fieldErrors.roleNames}
                  </span>
                )}
                {options.status === 'success' && options.roles.length === 0 && (
                  <p className="admin-crud-form-error" role="alert">
                    Danh mục chưa có vai trò nhà xe hợp lệ.
                  </p>
                )}
              </fieldset>
              {options.status === 'success' &&
                options.companies.length === 0 && (
                  <p className="admin-crud-form-error" role="alert">
                    Chưa có nhà xe để tạo tài khoản.
                  </p>
                )}
              {options.status === 'error' && (
                <div className="admin-crud-form-error" role="alert">
                  <p>{options.message}</p>
                  <Button
                    onClick={retryOptions}
                    type="button"
                    variant="secondary"
                  >
                    Tải lại danh mục
                  </Button>
                </div>
              )}
            </>
          )}
          {textField('dateOfBirth', 'Ngày sinh', 'date')}
          {textField('email', 'Email', 'email')}
          {textField('citizenId', 'CCCD')}
          <div className="admin-crud-form-actions">
            <Button
              disabled={submitting}
              onClick={closeDialog}
              type="button"
              variant="secondary"
            >
              Hủy
            </Button>
            <Button
              disabled={
                submitting ||
                (!editing &&
                  (options.status !== 'success' ||
                    options.companies.length === 0 ||
                    options.roles.length === 0))
              }
              type="submit"
            >
              {submitting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="admin-crud-form-spinner"
                  size={16}
                />
              )}
              {submitting
                ? 'Đang lưu…'
                : editing
                  ? 'Lưu thay đổi'
                  : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      </>
    </AdminFormDialog>
  );
}
