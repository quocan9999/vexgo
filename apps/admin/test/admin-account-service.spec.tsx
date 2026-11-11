import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminAccountApiError,
  createAdminAccount,
  getAdminAccountById,
  getAdminAccounts,
  replaceAdminAccountRoles,
  updateAdminAccount,
  updateAdminAccountStatus,
} from '@/features/admin-accounts/services/admin-account-service';
import type { AdminAccount } from '@/features/admin-accounts/types/admin-account';

const account: AdminAccount = {
  accountId: 11,
  fullName: 'Nguyễn Minh Anh',
  phoneNumber: '+84901234567',
  dateOfBirth: '1990-02-28',
  citizenId: '079123456789',
  email: 'minhanh@example.com',
  phoneVerified: true,
  status: 'HOAT_DONG',
  roles: ['NHAN_VIEN_BAN_VE'],
  employee: {
    employeeId: 21,
    employeeCode: 'FUTA-NV-0001',
    employmentStatus: 'DANG_LAM_VIEC',
  },
  busCompany: {
    busCompanyId: 5,
    code: 'FUTA',
    name: 'Phương Trang',
    status: 'HOAT_DONG',
  },
  createdAt: '2026-09-29T10:00:00.000Z',
  updatedAt: '2026-09-29T10:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

describe('Admin account API service', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    expect(process.env.NEXT_PUBLIC_API_URL).toBe(originalApiUrl);
  });

  it('serializes account list filters and parses the pagination envelope', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        data: [account],
        meta: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 },
      }),
    );

    await expect(
      getAdminAccounts({
        page: 2,
        pageSize: 10,
        search: 'FUTA & nhân viên',
        sortBy: 'fullName',
        sortDirection: 'asc',
        status: 'HOAT_DONG',
        busCompanyId: 5,
        roleName: 'NHAN_VIEN_BAN_VE',
        createdFrom: '2026-09-01',
        createdTo: '2026-09-30',
      }),
    ).resolves.toEqual({
      data: [account],
      meta: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 },
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      'http://localhost:4000/api/v1/admin-accounts?page=2&pageSize=10&search=FUTA+%26+nh%C3%A2n+vi%C3%AAn&sortBy=fullName&sortDirection=asc&status=HOAT_DONG&busCompanyId=5&roleName=NHAN_VIEN_BAN_VE&createdFrom=2026-09-01&createdTo=2026-09-30',
    );
    expect(init?.credentials).toBe('include');
    expect(init?.cache).toBe('no-store');
  });

  it('loads one account from the detail endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: account }));

    await expect(getAdminAccountById(11)).resolves.toEqual(account);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      'http://localhost:4000/api/v1/admin-accounts/11',
    );
  });

  it('creates an account with selected tenant roles and the chosen bus company', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: account }, 201),
    );
    const input = {
      fullName: 'Nguyễn Minh Anh',
      phoneNumber: '+84901234567',
      password: 'VexGo@123',
      busCompanyId: 5,
      employeeCode: 'FUTA-NV-0001',
      roleNames: ['NHAN_VIEN_BAN_VE', 'NHAN_VIEN_CSKH'] as const,
      dateOfBirth: '1990-02-28',
      email: 'minhanh@example.com',
      citizenId: '079123456789',
    };

    await expect(createAdminAccount(input)).resolves.toEqual(account);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe('http://localhost:4000/api/v1/admin-accounts');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it('updates only editable profile fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: account }));

    await expect(
      updateAdminAccount(11, { fullName: 'Minh Anh', email: null }),
    ).resolves.toEqual(account);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe('http://localhost:4000/api/v1/admin-accounts/11');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({
      fullName: 'Minh Anh',
      email: null,
    });
  });

  it('changes account status through the dedicated status endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: { ...account, status: 'TAM_KHOA' } }),
    );

    await expect(
      updateAdminAccountStatus(11, 'TAM_KHOA'),
    ).resolves.toMatchObject({
      status: 'TAM_KHOA',
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      'http://localhost:4000/api/v1/admin-accounts/11/status',
    );
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ status: 'TAM_KHOA' });
  });

  it('replaces account roles and allows an empty set to revoke tenant roles', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: { ...account, roles: [] } }),
    );

    await expect(replaceAdminAccountRoles(11, [])).resolves.toMatchObject({
      roles: [],
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      'http://localhost:4000/api/v1/admin-accounts/11/roles',
    );
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ roleNames: [] });
  });

  it('rejects empty create roles, duplicate roles and non-tenant role assignments locally', async () => {
    const baseInput = {
      fullName: 'Nguyễn Minh Anh',
      phoneNumber: '+84901234567',
      password: 'VexGo@123',
      busCompanyId: 5,
      employeeCode: 'FUTA-NV-0001',
      roleNames: ['NHAN_VIEN_BAN_VE'] as const,
    };

    await expect(
      createAdminAccount({ ...baseInput, roleNames: [] }),
    ).rejects.toMatchObject({ code: 'INVALID_TENANT_ROLE_LIST' });
    await expect(
      replaceAdminAccountRoles(11, ['SUPER_ADMIN']),
    ).rejects.toMatchObject({ code: 'INVALID_TENANT_ROLE_LIST' });
    await expect(
      replaceAdminAccountRoles(11, ['NHAN_VIEN_CSKH', 'NHAN_VIEN_CSKH']),
    ).rejects.toMatchObject({ code: 'INVALID_TENANT_ROLE_LIST' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an invalid account id before requesting the API', async () => {
    await expect(getAdminAccountById(0)).rejects.toMatchObject({
      code: 'INVALID_ADMIN_ACCOUNT_ID',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves API errors and rejects malformed or out-of-catalog role data', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(
          { error: 'PERMISSION_FORBIDDEN', message: 'Không đủ quyền.' },
          403,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { ...account, roles: ['SUPER_ADMIN'] } }),
      );

    await expect(getAdminAccountById(11)).rejects.toMatchObject({
      code: 'PERMISSION_FORBIDDEN',
      message: 'Không đủ quyền.',
    });
    await expect(getAdminAccountById(11)).rejects.toBeInstanceOf(
      AdminAccountApiError,
    );
  });
});
