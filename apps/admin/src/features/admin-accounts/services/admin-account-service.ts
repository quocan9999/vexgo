import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import { TENANT_RBAC_ROLE_NAMES } from '@/features/tenant-rbac/types/tenant-rbac';
import type {
  AdminAccount,
  AdminAccountListQuery,
  AdminAccountStatus,
  CreateAdminAccountInput,
  PaginatedAdminAccounts,
  UpdateAdminAccountInput,
} from '../types/admin-account';

export type AdminAccountApiErrorDetail = {
  field: string;
  message: string;
};

export class AdminAccountApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details: AdminAccountApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'AdminAccountApiError';
  }
}

const TENANT_ROLE_SET = new Set<string>(TENANT_RBAC_ROLE_NAMES);

function getAdminAccountsUrl(): string {
  return `${getApiBaseUrl()}/api/v1/admin-accounts`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseErrorDetails(value: unknown): AdminAccountApiErrorDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((detail): AdminAccountApiErrorDetail[] =>
    isRecord(detail) &&
    typeof detail.field === 'string' &&
    typeof detail.message === 'string'
      ? [{ field: detail.field, message: detail.message }]
      : [],
  );
}

function parseApiError(body: unknown, status: number): AdminAccountApiError {
  return new AdminAccountApiError(
    isRecord(body) && typeof body.message === 'string'
      ? body.message
      : `Không thể xử lý tài khoản quản trị (HTTP ${status}).`,
    status,
    isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    isRecord(body) ? parseErrorDetails(body.details) : [],
  );
}

function invalidResponse(): never {
  throw new AdminAccountApiError(
    'API trả về dữ liệu tài khoản quản trị không hợp lệ.',
    502,
    'INVALID_ADMIN_ACCOUNT_RESPONSE',
  );
}

function parseAccount(value: unknown): AdminAccount {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.accountId) ||
    typeof value.fullName !== 'string' ||
    typeof value.phoneNumber !== 'string' ||
    !isNullableString(value.dateOfBirth) ||
    !isNullableString(value.citizenId) ||
    !isNullableString(value.email) ||
    typeof value.phoneVerified !== 'boolean' ||
    (value.status !== 'HOAT_DONG' && value.status !== 'TAM_KHOA') ||
    !Array.isArray(value.roles) ||
    !value.roles.every(
      (role): role is AdminAccount['roles'][number] =>
        typeof role === 'string' && TENANT_ROLE_SET.has(role),
    ) ||
    new Set(value.roles).size !== value.roles.length ||
    !isRecord(value.employee) ||
    !isPositiveInteger(value.employee.employeeId) ||
    typeof value.employee.employeeCode !== 'string' ||
    typeof value.employee.employmentStatus !== 'string' ||
    !isRecord(value.busCompany) ||
    !isPositiveInteger(value.busCompany.busCompanyId) ||
    typeof value.busCompany.code !== 'string' ||
    typeof value.busCompany.name !== 'string' ||
    (value.busCompany.status !== 'HOAT_DONG' &&
      value.busCompany.status !== 'TAM_NGUNG') ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return invalidResponse();
  }

  return value as unknown as AdminAccount;
}

async function readBody(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw parseApiError(body, response.status);
  return body;
}

async function readData<T>(
  response: Response,
  parse: (value: unknown) => T,
): Promise<T> {
  const body = await readBody(response);
  if (!isRecord(body) || !Object.hasOwn(body, 'data')) return invalidResponse();
  return parse(body.data);
}

function requireAccountId(accountId: number): void {
  if (!isPositiveInteger(accountId)) {
    throw new AdminAccountApiError(
      'Mã tài khoản không hợp lệ.',
      400,
      'INVALID_ADMIN_ACCOUNT_ID',
    );
  }
}

function validateRoleNames(
  roleNames: readonly string[],
  allowEmpty: boolean,
): void {
  if (
    (!allowEmpty && roleNames.length === 0) ||
    new Set(roleNames).size !== roleNames.length ||
    roleNames.some((role) => !TENANT_ROLE_SET.has(role))
  ) {
    throw new AdminAccountApiError(
      'Danh sách vai trò nhà xe không hợp lệ.',
      400,
      'INVALID_TENANT_ROLE_LIST',
    );
  }
}

function parseAccountList(value: unknown): PaginatedAdminAccounts {
  if (
    !isRecord(value) ||
    !Array.isArray(value.data) ||
    !isRecord(value.meta) ||
    !Number.isSafeInteger(value.meta.page) ||
    !Number.isSafeInteger(value.meta.pageSize) ||
    !Number.isSafeInteger(value.meta.totalItems) ||
    !Number.isSafeInteger(value.meta.totalPages) ||
    (value.meta.page as number) < 1 ||
    (value.meta.pageSize as number) < 1 ||
    (value.meta.totalItems as number) < 0 ||
    (value.meta.totalPages as number) < 0
  ) {
    return invalidResponse();
  }

  return {
    data: value.data.map(parseAccount),
    meta: {
      page: value.meta.page as number,
      pageSize: value.meta.pageSize as number,
      totalItems: value.meta.totalItems as number,
      totalPages: value.meta.totalPages as number,
    },
  };
}

function parseAccountEnvelope(value: unknown): AdminAccount {
  return parseAccount(value);
}

export async function getAdminAccounts(
  query: AdminAccountListQuery,
  signal?: AbortSignal,
): Promise<PaginatedAdminAccounts> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    search: query.search.trim(),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });
  if (query.status) searchParams.set('status', query.status);
  if (query.busCompanyId !== undefined) {
    searchParams.set('busCompanyId', String(query.busCompanyId));
  }

  const response = await adminApiFetch(
    `${getAdminAccountsUrl()}?${searchParams.toString()}`,
    { cache: 'no-store', signal },
  );
  return parseAccountList(await readBody(response));
}

export async function getAdminAccountById(
  accountId: number,
  signal?: AbortSignal,
): Promise<AdminAccount> {
  requireAccountId(accountId);
  const response = await adminApiFetch(
    `${getAdminAccountsUrl()}/${accountId}`,
    {
      cache: 'no-store',
      signal,
    },
  );
  return readData(response, parseAccountEnvelope);
}

export async function createAdminAccount(
  input: CreateAdminAccountInput,
): Promise<AdminAccount> {
  validateRoleNames(input.roleNames, false);
  const response = await adminApiFetch(getAdminAccountsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  return readData(response, parseAccountEnvelope);
}

export async function updateAdminAccount(
  accountId: number,
  input: UpdateAdminAccountInput,
): Promise<AdminAccount> {
  requireAccountId(accountId);
  const response = await adminApiFetch(
    `${getAdminAccountsUrl()}/${accountId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  return readData(response, parseAccountEnvelope);
}

export async function updateAdminAccountStatus(
  accountId: number,
  status: AdminAccountStatus,
): Promise<AdminAccount> {
  requireAccountId(accountId);
  const response = await adminApiFetch(
    `${getAdminAccountsUrl()}/${accountId}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
      cache: 'no-store',
    },
  );
  return readData(response, parseAccountEnvelope);
}

export async function replaceAdminAccountRoles(
  accountId: number,
  roleNames: readonly string[],
): Promise<AdminAccount> {
  requireAccountId(accountId);
  validateRoleNames(roleNames, true);
  const response = await adminApiFetch(
    `${getAdminAccountsUrl()}/${accountId}/roles`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleNames: [...roleNames] }),
      cache: 'no-store',
    },
  );
  return readData(response, parseAccountEnvelope);
}
