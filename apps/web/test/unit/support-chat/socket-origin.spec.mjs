import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
register('../../helpers/ts-loader.mjs', import.meta.url);
const dom = new JSDOM('<html><body></body></html>', {
  url: 'http://localhost:3000',
});
Object.defineProperty(globalThis, 'window', {
  value: dom.window,
  configurable: true,
});
Object.defineProperty(globalThis, 'document', {
  value: dom.window.document,
  configurable: true,
});
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { renderHook, cleanup, act } = await import('@testing-library/react');
const { useSupportChatSocket } =
  await import('@/features/support-chat/hooks/use-support-chat-socket');
const { mockSockets } = await import('../../helpers/mock-socket-client.mjs');
const originalApi = process.env.NEXT_PUBLIC_API_URL;
const originalSocket = process.env.NEXT_PUBLIC_SOCKET_URL;
afterEach(() => {
  cleanup();
  mockSockets.length = 0;
  for (const [key, value] of [
    ['NEXT_PUBLIC_API_URL', originalApi],
    ['NEXT_PUBLIC_SOCKET_URL', originalSocket],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
it('Customer Web uses the versioned REST URL origin for live chat without a socket override', () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4002/api/v1/';
  delete process.env.NEXT_PUBLIC_SOCKET_URL;
  const received = [];
  renderHook(() =>
    useSupportChatSocket({
      token: 'customer-token',
      activeConversationId: 4,
      onNewMessage: (message) => received.push(message),
    }),
  );
  assert.equal(mockSockets[0].url, 'http://localhost:4002/chat');
  const message = {
    tinNhanId: 8,
    cuocTroChuyenId: 4,
    noiDung: 'Staff live reply',
  };
  act(() => mockSockets[0].serverEmit('support.message.new', message));
  assert.deepEqual(received, [message]);
});
it('Customer Web honors a normalized explicit socket origin', () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4002/api/v1';
  process.env.NEXT_PUBLIC_SOCKET_URL = 'https://socket.example.test/';
  renderHook(() =>
    useSupportChatSocket({
      token: 'customer-token',
      activeConversationId: null,
    }),
  );
  assert.equal(mockSockets[0].url, 'https://socket.example.test/chat');
});
it('Customer Web keeps its default API origin when neither URL is configured', () => {
  delete process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_SOCKET_URL = '';
  renderHook(() =>
    useSupportChatSocket({
      token: 'customer-token',
      activeConversationId: null,
    }),
  );
  assert.equal(mockSockets[0].url, 'http://localhost:4000/chat');
});
