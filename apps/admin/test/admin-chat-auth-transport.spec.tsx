// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminSupportChatApi } from '../src/features/support-chat/services/admin-support-chat.api';
import {
  getAdminAccessToken,
  getAdminAuthSnapshot,
  signInAdmin,
  signOutAdmin,
} from '../src/features/admin-auth/services/admin-auth';
const session = {
  accountId: 20,
  fullName: 'QA staff',
  phoneNumber: '+84900000020',
  email: 'qa@example.test',
  roles: ['NHAN_VIEN_CSKH'],
  permissions: ['chat:read', 'chat:manage'],
  employee: {
    employeeId: 7,
    busCompanyId: 1,
    busCompanyCode: 'QA',
    busCompanyName: 'QA',
  },
  busCompanyId: 1,
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
async function login() {
  vi.mocked(fetch)
    .mockResolvedValueOnce(json({ data: { accessToken: 'old-access' } }))
    .mockResolvedValueOnce(json({ data: session }));
  await signInAdmin('qa@example.test', 'fixture-password');
  vi.mocked(fetch).mockReset();
}
beforeEach(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4012');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  );
  await signOutAdmin();
  vi.mocked(fetch).mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('Chat uses the real shared Admin authenticated HTTP transport', () => {
  it('refreshes a 401 list request, reloads trusted session and retries with the new token', async () => {
    await login();
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ error: 'UNAUTHORIZED' }, 401))
      .mockResolvedValueOnce(json({ data: { accessToken: 'new-access' } }))
      .mockResolvedValueOnce(json({ data: session }))
      .mockResolvedValueOnce(
        json({ data: [], meta: { page: 1, totalItems: 0, totalPages: 0 } }),
      );
    expect(
      await adminSupportChatApi.listConversations(
        { page: 1, search: 'QA' },
        'old-access',
      ),
    ).toMatchObject({ data: [], meta: { page: 1 } });
    expect(getAdminAccessToken()).toBe('new-access');
    const calls = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).includes('/support-chat/'));
    expect(calls).toHaveLength(2);
    expect(new Headers(calls[0][1]?.headers).get('authorization')).toBe(
      'Bearer old-access',
    );
    expect(new Headers(calls[1][1]?.headers).get('authorization')).toBe(
      'Bearer new-access',
    );
    expect(calls.every(([, init]) => init?.credentials === 'include')).toBe(
      true,
    );
  });
  it('replays the exact message body and stable clientMessageId once after a real-helper refresh', async () => {
    await login();
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ error: 'UNAUTHORIZED' }, 401))
      .mockResolvedValueOnce(json({ data: { accessToken: 'new-access' } }))
      .mockResolvedValueOnce(json({ data: session }))
      .mockResolvedValueOnce(
        json(
          { data: { tinNhanId: 77, clientMessageId: 'stable-message-id' } },
          201,
        ),
      );
    expect(
      await adminSupportChatApi.sendMessage(
        4,
        'Reply after expiry',
        'old-access',
        'stable-message-id',
      ),
    ).toMatchObject({ tinNhanId: 77 });
    const calls = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) =>
        String(url).endsWith('/conversations/4/messages'),
      );
    expect(calls).toHaveLength(2);
    expect(calls[0][1]?.body).toBe(calls[1][1]?.body);
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({
      noiDung: 'Reply after expiry',
      loaiTinNhan: 'VAN_BAN',
      clientMessageId: 'stable-message-id',
    });
    expect(new Headers(calls[1][1]?.headers).get('authorization')).toBe(
      'Bearer new-access',
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh')),
    ).toHaveLength(1);
  });
  it('does not loop or send again when the refresh session has been revoked', async () => {
    await login();
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ error: 'UNAUTHORIZED' }, 401))
      .mockResolvedValueOnce(json({ error: 'SESSION_REVOKED' }, 401));
    await expect(
      adminSupportChatApi.sendMessage(
        4,
        'Unsent',
        'old-access',
        'stable-revoked',
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(getAdminAuthSnapshot().status).toBe('anonymous');
    expect(getAdminAccessToken()).toBeNull();
  });
});
