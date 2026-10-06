// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAdminAccessToken,
  getAdminAuthSnapshot,
  getAdminAuthErrorMessage,
  initializeAdminSession,
  signInAdmin,
  signOutAdmin,
  AdminAuthError,
} from '@/features/admin-auth/services/admin-auth';
import { adminApiFetch } from '@/lib/admin-api-client';
import type { AdminSession } from '@/features/admin-auth/services/admin-auth';

const tenantSession = {
  accountId: 20,
  fullName: 'Quản lý FUTA',
  phoneNumber: '+84900000020',
  email: 'admin@futa.test',
  roles: ['NHA_XE_ADMIN'],
  permissions: ['VEHICLES_TYPES_MANAGE'],
  employee: {
    employeeId: 7,
    busCompanyId: 10,
    busCompanyCode: 'FUTA',
    busCompanyName: 'FUTA',
  },
  busCompanyId: 10,
};

const platformSession = {
  accountId: 1,
  fullName: 'Super Admin',
  phoneNumber: '+84900000001',
  email: 'root@vexgo.test',
  roles: ['SUPER_ADMIN'],
  permissions: [],
  employee: null,
  busCompanyId: null,
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authResponse(accessToken: string) {
  return jsonResponse({ data: { accessToken } });
}

function sessionResponse(session: AdminSession) {
  return jsonResponse({ data: session });
}

describe('Admin cookie session and API client', () => {
  beforeEach(async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await signOutAdmin();
    vi.mocked(fetch).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['email', 'admin@futa.test'],
    ['số điện thoại', '+84900000020'],
  ])('đăng nhập bằng %s và chỉ giữ access token trong bộ nhớ', async (_label, identifier) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(authResponse('access-token'))
      .mockResolvedValueOnce(sessionResponse(tenantSession));

    const session = await signInAdmin(identifier, 'password-123');

    expect(session.roles).toEqual(['NHA_XE_ADMIN']);
    expect(getAdminAccessToken()).toBe('access-token');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/v1/auth/login');
    expect(JSON.parse(String(init?.body))).toEqual({
      identifier,
      password: 'password-123',
    });
    expect(init?.credentials).toBe('include');
    expect(new Headers(init?.headers).get('x-refresh-token-transport')).toBe('cookie');
    expect(window.localStorage?.length ?? 0).toBe(0);
    expect(window.sessionStorage?.length ?? 0).toBe(0);
  });

  it('khôi phục session sau khi tải lại trang bằng refresh cookie', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(authResponse('restored-access'))
      .mockResolvedValueOnce(sessionResponse(tenantSession));

    const session = await initializeAdminSession();

    expect(session?.accountId).toBe(20);
    expect(getAdminAccessToken()).toBe('restored-access');
    expect(getAdminAuthSnapshot().status).toBe('authenticated');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    const [refreshUrl, refreshInit] = vi.mocked(fetch).mock.calls[0];
    expect(refreshUrl).toBe('http://localhost:4000/api/v1/auth/refresh');
    expect(refreshInit?.credentials).toBe('include');
    expect(JSON.parse(String(refreshInit?.body))).toEqual({});
    const [, sessionInit] = vi.mocked(fetch).mock.calls[1];
    expect(new Headers(sessionInit?.headers).get('Authorization')).toBe('Bearer restored-access');
    expect(window.localStorage?.length ?? 0).toBe(0);
    expect(window.sessionStorage?.length ?? 0).toBe(0);
  });

  it('hiển thị đúng lỗi validate từ API mà không biến lỗi thành đăng nhập thành công', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ.',
      details: [{ field: 'identifier', message: 'Email hoặc số điện thoại không hợp lệ.' }],
    }, 400));

    await expect(signInAdmin('not-an-email', 'short')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'identifier' }],
    });
    expect(getAdminAccessToken()).toBeNull();
    expect(getAdminAuthErrorMessage(new AdminAuthError(
      'Sai thông tin',
      401,
      'INVALID_CREDENTIALS',
    ))).toContain('không chính xác');
  });

  it('chỉ xóa phiên sau logout thành công; giữ phiên khi server chưa thu hồi được', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(authResponse('access-token'))
      .mockResolvedValueOnce(sessionResponse(tenantSession))
      .mockResolvedValueOnce(jsonResponse({ message: 'DB unavailable' }, 503));
    await signInAdmin('admin@futa.test', 'password-123');

    await expect(signOutAdmin()).rejects.toMatchObject({ status: 503 });
    expect(getAdminAccessToken()).toBe('access-token');
    expect(getAdminAuthSnapshot().status).toBe('authenticated');

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await signOutAdmin();
    expect(getAdminAccessToken()).toBeNull();
    expect(getAdminAuthSnapshot().status).toBe('anonymous');
  });

  it('refreshes once after 401, reloads trusted roles, retries the request once', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(authResponse('old-access'))
      .mockResolvedValueOnce(sessionResponse(tenantSession))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(authResponse('new-access'))
      .mockResolvedValueOnce(sessionResponse(platformSession))
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    await signInAdmin('admin@futa.test', 'password-123');

    const response = await adminApiFetch('http://localhost:4000/api/v1/routes');

    expect(response.status).toBe(200);
    expect(getAdminAccessToken()).toBe('new-access');
    expect(getAdminAuthSnapshot()).toMatchObject({
      status: 'authenticated',
      session: { roles: ['SUPER_ADMIN'], busCompanyId: null },
    });
    const apiCalls = vi.mocked(fetch).mock.calls.filter(([url]) =>
      String(url).endsWith('/api/v1/routes'),
    );
    expect(new Headers(apiCalls[0][1]?.headers).get('Authorization')).toBe('Bearer old-access');
    expect(new Headers(apiCalls[1][1]?.headers).get('Authorization')).toBe('Bearer new-access');
  });

  it('reloads the trusted session after a SUPER_ADMIN mapping changes', async () => {
    const beforeUpdate = { ...platformSession, permissions: ['bus-company:read'] };
    const afterUpdate = { ...platformSession, permissions: [] };
    vi.mocked(fetch)
      .mockResolvedValueOnce(authResponse('platform-access'))
      .mockResolvedValueOnce(sessionResponse(beforeUpdate))
      .mockResolvedValueOnce(sessionResponse(afterUpdate));
    await signInAdmin('admin@vexgo.test', 'password-123');

    const auth = await import('@/features/admin-auth/services/admin-auth');
    const reloadAdminSession = Reflect.get(auth, 'reloadAdminSession') as
      | (() => Promise<{ permissions: string[] }>)
      | undefined;
    expect(reloadAdminSession).toBeTypeOf('function');
    if (!reloadAdminSession) return;

    await expect(reloadAdminSession()).resolves.toMatchObject({ permissions: [] });
    expect(getAdminAuthSnapshot()).toMatchObject({
      status: 'authenticated',
      session: { roles: ['SUPER_ADMIN'], permissions: [] },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    const [sessionUrl, sessionInit] = vi.mocked(fetch).mock.calls[2];
    expect(sessionUrl).toBe('http://localhost:4000/api/v1/auth/session');
    expect(new Headers(sessionInit?.headers).get('Authorization')).toBe(
      'Bearer platform-access',
    );
  });

  it('refreshes an expired access token before loading the updated role mapping', async () => {
    const oldSession = { ...platformSession, permissions: ['bus-company:read'] };
    const updatedSession = { ...platformSession, permissions: [] };
    vi.mocked(fetch)
      .mockResolvedValueOnce(authResponse('expired-access'))
      .mockResolvedValueOnce(sessionResponse(oldSession))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(authResponse('refreshed-access'))
      .mockResolvedValueOnce(sessionResponse(updatedSession));
    await signInAdmin('admin@vexgo.test', 'password-123');

    const auth = await import('@/features/admin-auth/services/admin-auth');
    const reloadAdminSession = Reflect.get(auth, 'reloadAdminSession') as
      | (() => Promise<{ permissions: string[] }>)
      | undefined;
    expect(reloadAdminSession).toBeTypeOf('function');
    if (!reloadAdminSession) return;

    await expect(reloadAdminSession()).resolves.toMatchObject({ permissions: [] });
    expect(getAdminAccessToken()).toBe('refreshed-access');
    expect(getAdminAuthSnapshot()).toMatchObject({
      status: 'authenticated',
      session: { permissions: [] },
    });
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('keeps the known session if fetching the refreshed identity fails', async () => {
    const oldSession = { ...platformSession, permissions: ['bus-company:read'] };
    vi.mocked(fetch)
      .mockResolvedValueOnce(authResponse('platform-access'))
      .mockResolvedValueOnce(sessionResponse(oldSession))
      .mockResolvedValueOnce(jsonResponse({ message: 'API offline' }, 503));
    await signInAdmin('admin@vexgo.test', 'password-123');

    const auth = await import('@/features/admin-auth/services/admin-auth');
    const reloadAdminSession = Reflect.get(auth, 'reloadAdminSession') as
      | (() => Promise<unknown>)
      | undefined;
    expect(reloadAdminSession).toBeTypeOf('function');
    if (!reloadAdminSession) return;

    await expect(reloadAdminSession()).rejects.toMatchObject({ status: 503 });
    expect(getAdminAuthSnapshot()).toMatchObject({
      status: 'authenticated',
      session: { permissions: ['bus-company:read'] },
    });
  });

  it('xóa phiên phía Admin khi request được retry vẫn trả 401', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(authResponse('old-access'))
      .mockResolvedValueOnce(sessionResponse(tenantSession))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(authResponse('new-access'))
      .mockResolvedValueOnce(sessionResponse(tenantSession))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    await signInAdmin('admin@futa.test', 'password-123');

    const response = await adminApiFetch('http://localhost:4000/api/v1/routes');

    expect(response.status).toBe(401);
    expect(getAdminAccessToken()).toBeNull();
    expect(getAdminAuthSnapshot().status).toBe('anonymous');
  });
});
