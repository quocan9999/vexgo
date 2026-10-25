// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  token: 'old-token' as string | null,
  refresh: vi.fn(),
  sockets: [] as MockSocket[],
}));
type Callback = (payload?: unknown) => void;
type MockSocket = {
  connected: boolean;
  handlers: Map<string, Callback>;
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  fire: (name: string, payload?: unknown) => void;
};
vi.mock('@/features/admin-auth/services/admin-auth', () => ({
  getAdminAccessToken: () => fixture.token,
  refreshAdminAccessToken: fixture.refresh,
}));
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const handlers = new Map<string, Callback>();
    const socket = {} as MockSocket;
    Object.assign(socket, {
      connected: false,
      handlers,
      on: vi.fn((name: string, callback: Callback) => {
        handlers.set(name, callback);
        return socket;
      }),
      once: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(() => {
        socket.connected = false;
        handlers.get('disconnect')?.();
      }),
      fire: (name: string, payload?: unknown) => {
        if (name === 'support.connected') socket.connected = true;
        handlers.get(name)?.(payload);
      },
    });
    fixture.sockets.push(socket);
    return socket;
  }),
}));
import { useAdminChatSocket } from '../src/features/support-chat/hooks/use-admin-chat-socket';
beforeEach(() => {
  fixture.token = 'old-token';
  fixture.refresh.mockReset().mockResolvedValue(null);
  fixture.sockets.length = 0;
});
afterEach(() => cleanup());
describe('Admin chat socket authentication recovery', () => {
  it('waits for authenticated support.connected instead of transport connect', () => {
    const { result } = renderHook(() =>
      useAdminChatSocket({ token: 'old-token', activeConversationId: 4 }),
    );
    act(() => fixture.sockets[0].fire('connect'));
    expect(result.current.isConnected).toBe(false);
    act(() => fixture.sockets[0].fire('support.connected'));
    expect(result.current.isConnected).toBe(true);
    expect(fixture.sockets[0].emit).toHaveBeenCalledWith(
      'support.conversation.join',
      { cuocTroChuyenId: 4 },
    );
  });
  it.each(['ACCESS_TOKEN_INVALID', 'SESSION_REVOKED'])(
    'refreshes once for %s and rejoins/resyncs on the parent new-token socket',
    async (code) => {
      const onReconnected = vi.fn();
      let finish!: (token: string | null) => void;
      fixture.refresh.mockReturnValue(
        new Promise<string | null>((resolve) => {
          finish = resolve;
        }),
      );
      const { result, rerender } = renderHook(
        ({ token }) =>
          useAdminChatSocket({ token, activeConversationId: 4, onReconnected }),
        { initialProps: { token: 'old-token' } },
      );
      const old = fixture.sockets[0];
      act(() => old.fire('support.connected'));
      const baseline = onReconnected.mock.calls.length;
      act(() => {
        old.fire('support.error', { error: code });
        old.fire('support.error', { error: code });
      });
      expect(fixture.refresh).toHaveBeenCalledExactlyOnceWith('old-token');
      expect(result.current.isConnected).toBe(false);
      await act(async () => {
        fixture.token = 'new-token';
        finish('new-token');
        await Promise.resolve();
      });
      // The auth provider publishes the new token. The old asynchronous attempt must not create its own socket.
      expect(fixture.sockets).toHaveLength(1);
      rerender({ token: 'new-token' });
      expect(fixture.sockets).toHaveLength(2);
      const current = fixture.sockets[1];
      act(() => current.fire('support.connected'));
      expect(result.current.isConnected).toBe(true);
      expect(current.emit).toHaveBeenCalledWith('support.conversation.join', {
        cuocTroChuyenId: 4,
      });
      expect(onReconnected.mock.calls.length).toBeGreaterThan(baseline);
      act(() => old.fire('support.error', { error: 'ACCESS_TOKEN_INVALID' }));
      expect(fixture.refresh).toHaveBeenCalledTimes(1);
      expect(current.disconnect).not.toHaveBeenCalled();
    },
  );
  it('ignores a rejected old token once auth identity has already changed', () => {
    renderHook(() =>
      useAdminChatSocket({ token: 'old-token', activeConversationId: null }),
    );
    fixture.token = 'another-account-token';
    act(() =>
      fixture.sockets[0].fire('support.error', {
        error: 'ACCESS_TOKEN_INVALID',
      }),
    );
    expect(fixture.refresh).not.toHaveBeenCalled();
  });
  it('does not reconnect or update a disposed hook when a refresh completes late', async () => {
    let finish!: (token: string | null) => void;
    fixture.refresh.mockReturnValue(
      new Promise<string | null>((resolve) => {
        finish = resolve;
      }),
    );
    const { unmount } = renderHook(() =>
      useAdminChatSocket({ token: 'old-token', activeConversationId: 4 }),
    );
    const socket = fixture.sockets[0];
    act(() => socket.fire('support.error', { error: 'ACCESS_TOKEN_INVALID' }));
    unmount();
    await act(async () => {
      fixture.token = 'new-token';
      finish('new-token');
      await Promise.resolve();
    });
    socket.fire('support.error', { error: 'SESSION_REVOKED' });
    expect(fixture.sockets).toHaveLength(1);
    expect(fixture.refresh).toHaveBeenCalledTimes(1);
  });
  it('stays disconnected after refresh failure and never loops on repeated auth errors', async () => {
    fixture.refresh.mockRejectedValue(new Error('refresh unavailable'));
    const { result } = renderHook(() =>
      useAdminChatSocket({ token: 'old-token', activeConversationId: null }),
    );
    const socket = fixture.sockets[0];
    await act(async () => {
      socket.fire('support.error', { error: 'ACCESS_TOKEN_INVALID' });
      await Promise.resolve();
    });
    act(() => socket.fire('support.error', { error: 'ACCESS_TOKEN_INVALID' }));
    expect(fixture.refresh).toHaveBeenCalledTimes(1);
    expect(result.current.isConnected).toBe(false);
    expect(fixture.sockets).toHaveLength(1);
  });
});
