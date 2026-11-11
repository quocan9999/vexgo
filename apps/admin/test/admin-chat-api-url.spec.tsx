import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminSupportChatApi } from '../src/features/support-chat/services/admin-support-chat.api';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Admin chat uses the shared API origin contract', () => {
  it.each(['http://localhost:4012', 'http://localhost:4012/'])(
    'loads chat history with the same API origin as login: %s',
    async (origin) => {
      vi.stubEnv('NEXT_PUBLIC_API_URL', origin);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [], meta: { page: 1 } }), {
          status: 200,
        }),
      );
      vi.stubGlobal('fetch', fetchMock);
      await adminSupportChatApi.listConversations({ page: 1 }, 'qa-token');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:4012/api/v1/support-chat/conversations?page=1',
        expect.objectContaining({ credentials: 'include' }),
      );
      expect(
        new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization'),
      ).toBe('Bearer qa-token');
    },
  );

  it('sends a message through the versioned shared API and preserves its retry ID', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4012');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { tinNhanId: 1 } }), {
        status: 201,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await adminSupportChatApi.sendMessage(
      7,
      'QA',
      'qa-token',
      'stable-retry-id',
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'http://localhost:4012/api/v1/support-chat/conversations/7/messages',
    );
    expect(JSON.parse(options.body)).toMatchObject({
      noiDung: 'QA',
      clientMessageId: 'stable-retry-id',
    });
  });
});
