import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { createRequire } from 'node:module';

// Register ESM ts-loader for resolving @/... paths and transpiling .tsx
register('../../helpers/ts-loader.mjs', import.meta.url);

// Setup JSDOM in global scope before importing testing-library
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.self = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
globalThis.Event = dom.window.Event;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
dom.window.HTMLElement.prototype.scrollIntoView = () => {};

// Ensure React instance is shared with @testing-library/react
const req = createRequire(import.meta.url);
const rtlPath = req.resolve('@testing-library/react');
const rootReactPath = req.resolve('react', { paths: [path.dirname(rtlPath)] });
const ReactModule = await import(
  'file:///' + rootReactPath.replace(/\\/g, '/')
);
const React = ReactModule.default || ReactModule;

const { render, screen, fireEvent, cleanup, waitFor, act } =
  await import('@testing-library/react');
const { mockSockets } = await import('../../helpers/mock-socket-client.mjs');

// Import REAL components and real APIs (F-NEW-06)
const { CustomerSupportChat, reconcileMessages } =
  await import('@/features/support-chat/components/customer-support-chat');
const { SupportWidget } = await import('@/components/layout/support-widget');
const { AuthSessionProvider, useAuthSession } =
  await import('@/features/auth/auth-session');
const { supportChatApi } =
  await import('@/features/support-chat/services/support-chat.api');
const { authApi } = await import('@/features/auth/services/auth.api');

const AUTH_STORAGE_KEY = 'vexgo:auth';

function seedAuthStorage(token = 'test-customer-token') {
  dom.window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      user: {
        accountId: 100,
        customerId: 1,
        fullName: 'Nguyễn Văn Khách',
        phoneNumber: '0901234567',
        roles: ['CUSTOMER'],
      },
      accessToken: token,
      refreshToken: 'test-refresh-token',
    }),
  );
}

function renderWithAuth(ui) {
  return render(React.createElement(AuthSessionProvider, null, ui));
}

describe('Customer displayed-message read receipts', () => {
  let originals;
  let readCalls;
  let finishRead;
  let originalRefresh;
  let originalBounds;
  let bubbleBounds;
  const message = (id, conversationId = 101, sender = 'NHAN_VIEN') => ({
    tinNhanId: id,
    cuocTroChuyenId: conversationId,
    taiKhoanGuiId: sender === 'KHACH_HANG' ? 100 : 200,
    loaiNguoiGui: sender,
    loaiTinNhan: 'VAN_BAN',
    noiDung: `visible-message-${id}`,
    trangThai: 'DA_GUI',
    createdAt: '2026-10-20T10:00:00Z',
  });
  beforeEach(() => {
    originalBounds = dom.window.HTMLElement.prototype.getBoundingClientRect;
    bubbleBounds = new Map();
    dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.getAttribute('data-testid') === 'chat-transcript') {
        return {
          top: 0,
          bottom: 100,
          left: 0,
          right: 200,
          width: 200,
          height: 100,
        };
      }
      return (
        bubbleBounds.get(Number(this.getAttribute('data-chat-message-id'))) ?? {
          top: 10,
          bottom: 30,
          left: 10,
          right: 150,
          width: 140,
          height: 20,
        }
      );
    };
    seedAuthStorage();
    originals = { ...supportChatApi };
    originalRefresh = authApi.refresh;
    readCalls = [];
    finishRead = null;
    supportChatApi.getActiveBusCompanies = async () => [
      { busCompanyId: 10, name: 'Read Company A' },
      { busCompanyId: 20, name: 'Read Company B' },
    ];
    supportChatApi.getActiveConversation = async (id) => ({
      cuocTroChuyenId: id === 10 ? 101 : 202,
      nhaXeId: id,
      trangThai: 'DANG_XU_LY',
      nhaXe: { nhaXeId: id, tenNhaXe: `Read Company ${id === 10 ? 'A' : 'B'}` },
      createdAt: '2026-10-20T10:00:00Z',
    });
    supportChatApi.listConversations = async () => ({ data: [] });
    supportChatApi.getMessages = async (id) =>
      id === 101
        ? [
            message(1),
            message(2, 101, 'KHACH_HANG'),
            { ...message(3), trangThai: 'DA_DOC' },
          ]
        : [message(20, 202)];
    supportChatApi.markMessagesAsRead = async (id, token, ids) => {
      readCalls.push({ id, token, ids });
      if (finishRead)
        await new Promise((resolve) => {
          finishRead.resolve = resolve;
        });
      return { updatedCount: ids.length };
    };
  });
  afterEach(() => {
    cleanup();
    Object.assign(supportChatApi, originals);
    authApi.refresh = originalRefresh;
    dom.window.HTMLElement.prototype.getBoundingClientRect = originalBounds;
  });

  async function openA(extra = null) {
    renderWithAuth(
      React.createElement(
        React.Fragment,
        null,
        extra,
        React.createElement(CustomerSupportChat),
      ),
    );
    await waitFor(() => screen.getByText('Read Company A'));
    fireEvent.click(screen.getByText('Read Company A'));
    await waitFor(() => screen.getByText('visible-message-1'));
  }

  it('bridges every reconnect page after a newer realtime message while preserving a pending optimistic draft', async () => {
    let records = Array.from({ length: 40 }, (_, i) =>
      message(i + 1, 101, 'KHACH_HANG'),
    );
    const pages = [];
    supportChatApi.getConversationById = async () => ({
      cuocTroChuyenId: 101,
      nhaXeId: 10,
      trangThai: 'DANG_XU_LY',
      nhaXe: { tenNhaXe: 'Read Company A' },
    });
    supportChatApi.getMessages = async (_id, _token, options) => {
      const before = options?.beforeId;
      pages.push(before);
      return records
        .filter((item) => !before || item.tinNhanId < before)
        .slice(-40);
    };
    let finishSend;
    supportChatApi.sendMessage = async (_id, content, _token, clientId) =>
      new Promise((resolve) => {
        finishSend = () =>
          resolve({
            ...message(122, 101, 'KHACH_HANG'),
            noiDung: content,
            clientMessageId: clientId,
          });
      });
    await openA();
    fireEvent.change(screen.getByPlaceholderText('Nhập tin nhắn...'), {
      target: { value: 'Pending across reconnect' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('Nhập tin nhắn...'), {
      key: 'Enter',
    });
    await waitFor(() => assert.equal(typeof finishSend, 'function'));
    records = Array.from({ length: 121 }, (_, i) =>
      message(i + 1, 101, 'KHACH_HANG'),
    );
    await act(async () => {
      mockSockets
        .at(-1)
        .serverEmit('support.message.new', message(121, 101, 'KHACH_HANG'));
      mockSockets.at(-1).serverEmit('support.connected', {});
    });
    await waitFor(() => {
      assert.ok(
        screen.getByText('visible-message-41'),
        'The first missed page cannot remain missing',
      );
      assert.ok(screen.getByText('visible-message-81'));
      assert.equal(screen.getAllByText('Pending across reconnect').length, 1);
      assert.deepEqual(pages, [undefined, undefined, 82, 42]);
    });
    await act(async () => {
      finishSend();
    });
  });

  it('reads only bubbles intersecting the viewport, including after history prepend, scroll and realtime arrival', async () => {
    const outside = {
      top: 300,
      bottom: 330,
      left: 10,
      right: 150,
      width: 140,
      height: 30,
    };
    const inside = {
      top: 20,
      bottom: 45,
      left: 10,
      right: 150,
      width: 140,
      height: 25,
    };
    for (let id = 1; id <= 81; id++) bubbleBounds.set(id, outside);
    bubbleBounds.set(80, inside);
    supportChatApi.getMessages = async (_id, _token, options) =>
      options?.beforeId
        ? Array.from({ length: 40 }, (_, i) => message(i + 1))
        : Array.from({ length: 40 }, (_, i) => message(i + 41));
    renderWithAuth(React.createElement(CustomerSupportChat));
    await waitFor(() => screen.getByText('Read Company A'));
    fireEvent.click(screen.getByText('Read Company A'));
    await waitFor(() =>
      assert.deepEqual(
        readCalls.map((call) => call.ids),
        [[80]],
      ),
    );
    fireEvent.click(screen.getByText('Tải tin nhắn cũ hơn'));
    await waitFor(() => screen.getByText('visible-message-1'));
    await act(async () => {
      mockSockets.at(-1).serverEmit('support.message.new', message(81));
    });
    assert.deepEqual(
      readCalls.map((call) => call.ids),
      [[80]],
      'Loaded offscreen history and incoming messages stay unread',
    );
    bubbleBounds.set(1, inside);
    fireEvent.scroll(
      screen.getByText('visible-message-1').closest('.overflow-y-auto'),
    );
    await waitFor(() =>
      assert.deepEqual(
        readCalls.map((call) => call.ids),
        [[80], [1]],
      ),
    );
    bubbleBounds.set(81, inside);
    fireEvent(window, new dom.window.Event('resize'));
    await waitFor(() =>
      assert.deepEqual(
        readCalls.map((call) => call.ids),
        [[80], [1], [81]],
      ),
    );
  });

  it('does not mark a visible sender header read until the actual text bubble crosses the viewport edge', async () => {
    const bounds = dom.window.HTMLElement.prototype.getBoundingClientRect;
    let textVisible = false;
    dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
      if (
        this.getAttribute('data-chat-message-id') === '1' &&
        this.classList.contains('flex')
      ) {
        return {
          top: 80,
          bottom: 150,
          left: 10,
          right: 150,
          width: 140,
          height: 70,
        };
      }
      if (
        this.textContent === 'visible-message-1' &&
        this.children.length === 0
      ) {
        return textVisible
          ? {
              top: 90,
              bottom: 130,
              left: 10,
              right: 150,
              width: 140,
              height: 40,
            }
          : {
              top: 110,
              bottom: 150,
              left: 10,
              right: 150,
              width: 140,
              height: 40,
            };
      }
      return bounds.call(this);
    };
    await openA();
    assert.equal(
      readCalls.length,
      0,
      'An avatar/header edge is not proof that message text was visible',
    );
    textVisible = true;
    fireEvent.scroll(
      screen.getByText('visible-message-1').closest('.overflow-y-auto'),
    );
    await waitFor(() =>
      assert.deepEqual(
        readCalls.map((call) => call.ids),
        [[1]],
      ),
    );
  });

  it('preserves scroll position after a viewport-read ACK but still scrolls for a new message', async () => {
    const originalScroll = dom.window.HTMLElement.prototype.scrollIntoView;
    let scrolls = 0;
    dom.window.HTMLElement.prototype.scrollIntoView = () => {
      scrolls++;
    };
    try {
      bubbleBounds.set(1, {
        top: 300,
        bottom: 330,
        left: 10,
        right: 150,
        width: 140,
        height: 30,
      });
      await openA();
      assert.equal(readCalls.length, 0);
      const beforeRead = scrolls;
      bubbleBounds.set(1, {
        top: 10,
        bottom: 40,
        left: 10,
        right: 150,
        width: 140,
        height: 30,
      });
      fireEvent.scroll(
        screen.getByText('visible-message-1').closest('.overflow-y-auto'),
      );
      await waitFor(() =>
        assert.deepEqual(
          readCalls.map((call) => call.ids),
          [[1]],
        ),
      );
      await act(async () => {
        await Promise.resolve();
      });
      assert.equal(
        scrolls,
        beforeRead,
        'A read-state update must not jump from older visible messages to the bottom',
      );
      await act(async () => {
        mockSockets
          .at(-1)
          .serverEmit('support.message.new', message(4, 101, 'KHACH_HANG'));
      });
      assert.equal(
        scrolls,
        beforeRead + 1,
        'A new message retains the existing scroll behavior',
      );
    } finally {
      dom.window.HTMLElement.prototype.scrollIntoView = originalScroll;
    }
  });

  it('discards a deferred reconnect cursor page after switching conversations', async () => {
    let reconnect = false;
    let releasePage;
    supportChatApi.getConversationById = async () =>
      supportChatApi.getActiveConversation(10);
    supportChatApi.getMessages = async (id, _token, options) => {
      if (id === 202) return [message(200, 202)];
      if (!reconnect)
        return Array.from({ length: 40 }, (_, i) =>
          message(i + 1, 101, 'KHACH_HANG'),
        );
      if (!options?.beforeId)
        return Array.from({ length: 40 }, (_, i) =>
          message(i + 82, 101, 'KHACH_HANG'),
        );
      return new Promise((resolve) => {
        releasePage = resolve;
      });
    };
    await openA();
    reconnect = true;
    await act(async () => {
      mockSockets.at(-1).serverEmit('support.connected', {});
    });
    await waitFor(() => assert.equal(typeof releasePage, 'function'));
    fireEvent.click(screen.getByText('Đổi nhà xe'));
    await waitFor(() => screen.getByText('Read Company B'));
    fireEvent.click(screen.getByText('Read Company B'));
    await waitFor(() => screen.getByText('visible-message-200'));
    await act(async () => {
      releasePage(
        Array.from({ length: 40 }, (_, i) =>
          message(i + 42, 101, 'KHACH_HANG'),
        ),
      );
    });
    assert.equal(screen.queryByText('visible-message-42'), null);
    assert.equal(screen.queryByText('visible-message-121'), null);
    assert.ok(screen.getByText('visible-message-200'));
  });

  it('discards a deferred reconnect cursor page after switching authenticated accounts', async () => {
    let session;
    function Controls() {
      session = useAuthSession();
      return null;
    }
    let reconnect = false;
    let releasePage;
    supportChatApi.getConversationById = async () =>
      supportChatApi.getActiveConversation(10);
    supportChatApi.getMessages = async (_id, _token, options) => {
      if (!reconnect)
        return Array.from({ length: 40 }, (_, i) =>
          message(i + 1, 101, 'KHACH_HANG'),
        );
      if (!options?.beforeId)
        return Array.from({ length: 40 }, (_, i) =>
          message(i + 82, 101, 'KHACH_HANG'),
        );
      return new Promise((resolve) => {
        releasePage = resolve;
      });
    };
    await openA(React.createElement(Controls));
    reconnect = true;
    await act(async () => {
      mockSockets.at(-1).serverEmit('support.connected', {});
    });
    await waitFor(() => assert.equal(typeof releasePage, 'function'));
    await act(async () => {
      session.signIn({
        user: {
          accountId: 101,
          customerId: 2,
          fullName: 'Replacement customer',
          phoneNumber: '0900000002',
          roles: ['CUSTOMER'],
        },
        accessToken: 'replacement-access',
        refreshToken: 'replacement-refresh',
      });
      releasePage(
        Array.from({ length: 40 }, (_, i) =>
          message(i + 42, 101, 'KHACH_HANG'),
        ),
      );
    });
    await waitFor(() => screen.getByText('Read Company A'));
    assert.equal(screen.queryByText('visible-message-42'), null);
    assert.equal(screen.queryByText('visible-message-121'), null);
    assert.equal(
      JSON.parse(dom.window.localStorage.getItem(AUTH_STORAGE_KEY)).user
        .accountId,
      101,
    );
  });

  it('refreshes concurrent expired chat reads once and uses rotated tokens for subsequent history/read calls', async () => {
    let refreshes = 0;
    const tokens = [];
    authApi.refresh = async () => {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        data: {
          accessToken: 'rotated-access',
          refreshToken: 'rotated-refresh',
        },
      };
    };
    const active = supportChatApi.getActiveConversation;
    supportChatApi.getActiveConversation = async (id, token) => {
      tokens.push(token);
      if (token !== 'rotated-access') throw { status: 401 };
      return active(id);
    };
    supportChatApi.listConversations = async (_params, token) => {
      tokens.push(token);
      if (token !== 'rotated-access') throw { status: 401 };
      return { data: [] };
    };
    supportChatApi.getMessages = async (_id, token) => {
      assert.equal(
        token,
        'rotated-access',
        'Sequential history must use the current token, not the pre-refresh closure',
      );
      return [message(1)];
    };
    await openA();
    await waitFor(() =>
      assert.equal(readCalls.at(-1)?.token, 'rotated-access'),
    );
    assert.equal(refreshes, 1);
    assert.equal(
      tokens.filter((token) => token === 'test-customer-token').length,
      2,
    );
    assert.equal(
      JSON.parse(dom.window.localStorage.getItem(AUTH_STORAGE_KEY)).accessToken,
      'rotated-access',
    );
  });

  it('discards a pending refresh after account switch without retrying old chat or overwriting the new session', async () => {
    let releaseRefresh;
    let controls;
    function Controls() {
      controls = useAuthSession();
      return React.createElement('span', null, controls.user?.fullName);
    }
    authApi.refresh = async () =>
      new Promise((resolve) => {
        releaseRefresh = resolve;
      });
    supportChatApi.getActiveConversation = async () => {
      throw { status: 401 };
    };
    supportChatApi.listConversations = async () => {
      throw { status: 401 };
    };
    let histories = 0;
    supportChatApi.getMessages = async () => {
      histories++;
      return [message(1)];
    };
    renderWithAuth(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Controls),
        React.createElement(CustomerSupportChat),
      ),
    );
    await waitFor(() => screen.getByText('Read Company A'));
    fireEvent.click(screen.getByText('Read Company A'));
    await waitFor(() => assert.equal(typeof releaseRefresh, 'function'));
    await act(async () => {
      controls.signIn({
        user: {
          accountId: 101,
          customerId: 2,
          fullName: 'New customer',
          phoneNumber: '0900000002',
          roles: ['CUSTOMER'],
        },
        accessToken: 'new-customer-access',
        refreshToken: 'new-customer-refresh',
      });
      releaseRefresh({
        data: {
          accessToken: 'obsolete-refresh-access',
          refreshToken: 'obsolete-refresh-token',
        },
      });
      await Promise.resolve();
    });
    await waitFor(() => screen.getByText('New customer'));
    assert.equal(histories, 0);
    assert.equal(screen.queryByText('visible-message-1'), null);
    const stored = JSON.parse(
      dom.window.localStorage.getItem(AUTH_STORAGE_KEY),
    );
    assert.equal(stored.user.accountId, 101);
    assert.equal(stored.accessToken, 'new-customer-access');
  });

  it('recovers an expired Socket.IO handshake through REST refresh and ignores disposed socket events', async () => {
    let expired = false;
    let refreshes = 0;
    const list = supportChatApi.listConversations;
    supportChatApi.listConversations = async (params, token) => {
      if (expired && token !== 'socket-rotated-access') throw { status: 401 };
      return list(params, token);
    };
    authApi.refresh = async () => {
      refreshes++;
      return {
        data: {
          accessToken: 'socket-rotated-access',
          refreshToken: 'socket-rotated-refresh',
        },
      };
    };
    await openA();
    const oldSocket = mockSockets.at(-1);
    expired = true;
    await act(async () => {
      oldSocket.serverEmit('support.error', {
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Expired',
      });
    });
    await waitFor(() =>
      assert.equal(
        mockSockets.at(-1).options.auth.token,
        'socket-rotated-access',
      ),
    );
    await act(async () => {
      oldSocket.serverEmit('support.message.new', message(99));
    });
    assert.equal(refreshes, 1);
    assert.equal(screen.queryByText('visible-message-99'), null);
    assert.ok(screen.getByText('visible-message-1'));
  });

  it('retains the socket clientMessageId across ACK failure and expired-token REST retry', async () => {
    let expired = false;
    const attempts = [];
    const active = supportChatApi.getActiveConversation;
    supportChatApi.getConversationById = async () => active(10);
    authApi.refresh = async () => ({
      data: {
        accessToken: 'send-rotated-access',
        refreshToken: 'send-rotated-refresh',
      },
    });
    supportChatApi.sendMessage = async (id, content, token, clientId) => {
      attempts.push({ id, content, token, clientId });
      if (expired && token !== 'send-rotated-access') throw { status: 401 };
      return {
        ...message(80, id, 'KHACH_HANG'),
        noiDung: content,
        clientMessageId: clientId,
      };
    };
    await openA();
    const socket = mockSockets.at(-1);
    await act(async () => {
      socket.serverEmit('support.connected', {});
    });
    expired = true;
    fireEvent.change(screen.getByPlaceholderText('Nhập tin nhắn...'), {
      target: { value: 'One logical message' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('Nhập tin nhắn...'), {
      key: 'Enter',
    });
    await waitFor(() => assert.equal(attempts.length, 2));
    const sent = socket.requests.find(
      (request) => request.event === 'support.message.send',
    );
    assert.ok(sent);
    assert.deepEqual(
      attempts.map((attempt) => attempt.clientId),
      [sent.data.clientMessageId, sent.data.clientMessageId],
    );
    assert.deepEqual(
      attempts.map((attempt) => attempt.token),
      ['test-customer-token', 'send-rotated-access'],
    );
    await waitFor(() => assert.equal(screen.queryByText('Đang gửi...'), null));
  });

  it('marks loaded staff messages on open and realtime arrival; excludes own/read/unrelated messages', async () => {
    await openA();
    await waitFor(() =>
      assert.deepEqual(readCalls, [
        { id: 101, token: 'test-customer-token', ids: [1] },
      ]),
    );
    await act(async () => {
      mockSockets.at(-1).serverEmit('support.message.new', message(4));
    });
    await waitFor(() => assert.deepEqual(readCalls.at(-1).ids, [4]));
    const count = readCalls.length;
    await act(async () => {
      mockSockets.at(-1).serverEmit('support.message.new', message(50, 202));
    });
    assert.equal(screen.queryByText('visible-message-50'), null);
    assert.equal(readCalls.length, count);
    assert.ok(readCalls.every((call) => call.ids.length > 0));
  });

  it('ignores delayed read completion after switching conversations', async () => {
    finishRead = {};
    await openA();
    await waitFor(() => assert.equal(readCalls.length, 1));
    const resolveA = finishRead.resolve;
    finishRead = null;
    fireEvent.click(screen.getByText('Đổi nhà xe'));
    await waitFor(() => screen.getByText('Read Company B'));
    fireEvent.click(screen.getByText('Read Company B'));
    await waitFor(() => screen.getByText('visible-message-20'));
    await act(async () => {
      resolveA();
    });
    assert.equal(screen.queryByText('visible-message-1'), null);
    assert.deepEqual(readCalls.at(-1).ids, [20]);
    assert.equal(readCalls.at(-1).id, 202);
  });

  it('preserves realtime staff message arriving during initial history and reads both displayed IDs', async () => {
    let finishHistory;
    supportChatApi.getMessages = async () =>
      new Promise((resolve) => {
        finishHistory = resolve;
      });
    renderWithAuth(React.createElement(CustomerSupportChat));
    await waitFor(() => screen.getByText('Read Company A'));
    fireEvent.click(screen.getByText('Read Company A'));
    await waitFor(() => assert.equal(typeof finishHistory, 'function'));
    await act(async () => {
      mockSockets.at(-1).serverEmit('support.message.new', message(8));
    });
    assert.equal(
      readCalls.length,
      0,
      'Loading history is not a displayed read boundary',
    );
    await act(async () => {
      finishHistory([message(1)]);
    });
    await waitFor(() => {
      screen.getByText('visible-message-1');
      screen.getByText('visible-message-8');
      assert.deepEqual(
        [...readCalls.at(-1).ids].sort((a, b) => a - b),
        [1, 8],
      );
    });
  });

  it('does not mark a hidden document read and resumes only when it becomes visible', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    try {
      await openA();
      assert.equal(readCalls.length, 0);
      await act(async () => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        });
        document.dispatchEvent(new dom.window.Event('visibilitychange'));
      });
      await waitFor(() => assert.deepEqual(readCalls.at(-1).ids, [1]));
    } finally {
      delete document.visibilityState;
    }
  });

  it('does not mark incoming transcript messages read while the history chooser hides the transcript', async () => {
    supportChatApi.listConversations = async () => ({
      data: [
        {
          cuocTroChuyenId: 90,
          maCuocTroChuyen: 'closed-90',
          nhaXeId: 10,
          tieuDe: 'Older support',
          trangThai: 'DA_DONG',
          nhaXe: { tenNhaXe: 'Read Company A' },
          createdAt: '2026-10-19T10:00:00Z',
          dongLuc: '2026-10-19T11:00:00Z',
        },
      ],
    });
    await openA();
    await waitFor(() => assert.equal(readCalls.length, 1));
    fireEvent.click(screen.getByTitle('Lịch sử hỗ trợ'));
    await waitFor(() => screen.getByText('Lịch sử hỗ trợ - Read Company A'));
    await act(async () => {
      mockSockets.at(-1).serverEmit('support.message.new', message(10));
    });
    assert.equal(screen.queryByText('visible-message-10'), null);
    assert.equal(readCalls.length, 1);
    fireEvent.click(screen.getByText('Quay lại'));
    await waitFor(() => {
      screen.getByText('visible-message-10');
      assert.deepEqual(readCalls.at(-1).ids, [10]);
    });
  });

  it('drops mounted conversation and ignores old socket/read completion after account switch', async () => {
    function SwitchAccount() {
      const { signIn } = useAuthSession();
      return React.createElement(
        'button',
        {
          onClick: () =>
            signIn({
              user: {
                accountId: 101,
                customerId: 2,
                fullName: 'Other Account',
                phoneNumber: '0900000002',
                roles: ['CUSTOMER'],
              },
              accessToken: 'other-account-token',
              refreshToken: 'other-refresh',
            }),
        },
        'Switch test account',
      );
    }
    finishRead = {};
    await openA(React.createElement(SwitchAccount));
    await waitFor(() => assert.equal(readCalls.length, 1));
    const oldSocket = mockSockets.at(-1);
    const resolveA = finishRead.resolve;
    finishRead = null;
    fireEvent.click(screen.getByText('Switch test account'));
    await waitFor(() =>
      assert.equal(screen.queryByText('visible-message-1'), null),
    );
    await act(async () => {
      resolveA();
      oldSocket.serverEmit('support.message.new', message(99));
    });
    assert.equal(screen.queryByText('visible-message-99'), null);
    assert.equal(
      readCalls.length,
      1,
      'No inherited messages may be marked using the new account token',
    );
  });
});

describe('Customer Support Chat Component Tests with Real Components (F-NEW-06)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    seedAuthStorage();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. SupportWidget Floating Buttons Isolation & Toggle (F-02)', () => {
    it('renders both floating buttons independently in closed state', () => {
      renderWithAuth(React.createElement(SupportWidget));

      const staffBtn = screen.getByTestId('staff-chat-floating-button');
      const botBtn = screen.getByTestId('ai-bot-floating-button');

      assert.ok(staffBtn, 'Staff button must be present');
      assert.ok(botBtn, 'Bot button must be present');
      assert.equal(screen.queryByTestId('staff-chat-window'), null);
      assert.equal(screen.queryByTestId('ai-bot-window'), null);
    });

    it('opens staff chat window and closes staff button without affecting bot button', () => {
      renderWithAuth(React.createElement(SupportWidget));

      const staffBtn = screen.getByTestId('staff-chat-floating-button');
      fireEvent.click(staffBtn);

      assert.ok(
        screen.getByTestId('staff-chat-window'),
        'Staff chat window should be open',
      );
      assert.equal(
        screen.queryByTestId('staff-chat-floating-button'),
        null,
        'Staff button should hide when open',
      );
      assert.ok(
        screen.getByTestId('ai-bot-floating-button'),
        'Bot button remains available',
      );
    });

    it('switches cleanly between staff window and bot window without overlap', () => {
      renderWithAuth(React.createElement(SupportWidget));

      // Mở staff chat
      fireEvent.click(screen.getByTestId('staff-chat-floating-button'));
      assert.ok(screen.getByTestId('staff-chat-window'));

      // Bấm mở bot chat -> Staff chat phải tự động đóng
      fireEvent.click(screen.getByTestId('ai-bot-floating-button'));
      assert.ok(screen.getByTestId('ai-bot-window'));
      assert.equal(screen.queryByTestId('staff-chat-window'), null);
      assert.ok(screen.getByTestId('staff-chat-floating-button'));
    });
  });

  describe('2. Anti-Race Condition Guard when Switching Bus Companies (F-01)', () => {
    it('discards delayed response from Company A when user quickly switches to Company B', async () => {
      const originalGetActive = supportChatApi.getActiveBusCompanies;
      const originalGetActiveConv = supportChatApi.getActiveConversation;
      const originalListConv = supportChatApi.listConversations;
      const originalGetMsg = supportChatApi.getMessages;

      try {
        supportChatApi.getActiveBusCompanies = async () => [
          {
            busCompanyId: 10,
            name: 'Nhà Xe Phương Trang',
            contactInfo: '1900 6067',
          },
          {
            busCompanyId: 20,
            name: 'Nhà Xe Thành Bưởi',
            contactInfo: '1900 6079',
          },
        ];

        supportChatApi.listConversations = async () => ({
          data: [],
          meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
        });

        supportChatApi.getActiveConversation = async (nhaXeId) => {
          if (nhaXeId === 10) {
            await new Promise((r) => setTimeout(r, 60));
            return {
              cuocTroChuyenId: 101,
              tieuDe: 'Hỗ trợ Phương Trang',
              trangThai: 'DANG_XU_LY',
              nhaXeId: 10,
              nhaXe: { nhaXeId: 10, tenNhaXe: 'Nhà Xe Phương Trang' },
              createdAt: new Date().toISOString(),
            };
          }
          if (nhaXeId === 20) {
            await new Promise((r) => setTimeout(r, 5));
            return {
              cuocTroChuyenId: 202,
              tieuDe: 'Hỗ trợ Thành Bưởi',
              trangThai: 'DANG_XU_LY',
              nhaXeId: 20,
              nhaXe: { nhaXeId: 20, tenNhaXe: 'Nhà Xe Thành Bưởi' },
              createdAt: new Date().toISOString(),
            };
          }
          return null;
        };

        supportChatApi.getMessages = async (convId) => [
          {
            tinNhanId: convId === 101 ? 1001 : 2002,
            noiDung:
              convId === 101 ? 'Tin nhắn Phương Trang' : 'Tin nhắn Thành Bưởi',
            loaiNguoiGui: 'NHAN_VIEN',
            createdAt: new Date().toISOString(),
          },
        ];

        renderWithAuth(React.createElement(CustomerSupportChat));

        await waitFor(() => {
          screen.getByText('Nhà Xe Phương Trang');
        });

        // Bấm chọn Nhà Xe Phương Trang (Company 10)
        fireEvent.click(screen.getByText('Nhà Xe Phương Trang'));

        // Đổi ý bấm Đổi nhà xe rồi chọn Nhà Xe Thành Bưởi (Company 20)
        await new Promise((r) => setTimeout(r, 10));
        const changeCompanyBtn = screen.getByText('Đổi nhà xe');
        fireEvent.click(changeCompanyBtn);

        await waitFor(() => {
          screen.getByText('Nhà Xe Thành Bưởi');
        });
        fireEvent.click(screen.getByText('Nhà Xe Thành Bưởi'));

        // Chờ phản hồi trễ của Company 10 hoàn tất
        await new Promise((r) => setTimeout(r, 100));

        // Phải hiển thị Nhà Xe Thành Bưởi, không bị phản hồi trễ của Phương Trang ghi đè
        await waitFor(() => {
          assert.ok(screen.getByText('Nhà Xe Thành Bưởi'));
          assert.ok(screen.getByText('Tin nhắn Thành Bưởi'));
          assert.equal(screen.queryByText('Tin nhắn Phương Trang'), null);
        });
      } finally {
        supportChatApi.getActiveBusCompanies = originalGetActive;
        supportChatApi.getActiveConversation = originalGetActiveConv;
        supportChatApi.listConversations = originalListConv;
        supportChatApi.getMessages = originalGetMsg;
      }
    });
  });

  describe('3. Message Sending, Error State, and Retry with Identical clientMessageId (F-03/F-04)', () => {
    it('transitions message to THAT_BAI on error, and successfully retries with the SAME clientMessageId', async () => {
      const originalGetActive = supportChatApi.getActiveBusCompanies;
      const originalGetActiveConv = supportChatApi.getActiveConversation;
      const originalListConv = supportChatApi.listConversations;
      const originalGetMsg = supportChatApi.getMessages;
      const originalSendMsg = supportChatApi.sendMessage;

      const attempts = [];

      try {
        supportChatApi.getActiveBusCompanies = async () => [
          {
            busCompanyId: 10,
            name: 'Nhà Xe Phương Trang',
            contactInfo: '1900 6067',
          },
        ];

        supportChatApi.listConversations = async () => ({
          data: [],
          meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
        });

        supportChatApi.getActiveConversation = async () => ({
          cuocTroChuyenId: 101,
          tieuDe: 'Hỗ trợ khách hàng',
          trangThai: 'DANG_XU_LY',
          nhaXeId: 10,
          nhaXe: { nhaXeId: 10, tenNhaXe: 'Nhà Xe Phương Trang' },
          createdAt: new Date().toISOString(),
        });

        supportChatApi.getMessages = async () => [
          {
            tinNhanId: 1,
            noiDung: 'Chào bạn, nhà xe có thể giúp gì cho bạn?',
            loaiNguoiGui: 'NHAN_VIEN',
            createdAt: new Date().toISOString(),
          },
        ];

        supportChatApi.sendMessage = async (
          convId,
          noiDung,
          token,
          clientMessageId,
        ) => {
          attempts.push({ convId, noiDung, clientMessageId });
          if (attempts.length === 1) {
            throw new Error('503 Service Unavailable');
          }
          return {
            tinNhanId: 2,
            cuocTroChuyenId: convId,
            noiDung,
            loaiNguoiGui: 'KHACH_HANG',
            clientMessageId,
            createdAt: new Date().toISOString(),
          };
        };

        renderWithAuth(React.createElement(CustomerSupportChat));

        await waitFor(() => {
          screen.getByText('Nhà Xe Phương Trang');
        });
        fireEvent.click(screen.getByText('Nhà Xe Phương Trang'));

        await waitFor(() => {
          screen.getByPlaceholderText('Nhập tin nhắn...');
        });

        const input = screen.getByPlaceholderText('Nhập tin nhắn...');
        fireEvent.change(input, { target: { value: 'Tôi muốn đổi vé' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
          screen.getByText('Gửi thất bại');
          screen.getByRole('button', { name: /Thử lại/i });
        });

        assert.equal(attempts.length, 1);
        const initialClientMessageId = attempts[0].clientMessageId;
        assert.ok(initialClientMessageId, 'Must have clientMessageId');
        assert.ok(initialClientMessageId.startsWith('client-'));

        const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
        fireEvent.click(retryBtn);

        await waitFor(() => {
          assert.equal(attempts.length, 2);
          assert.equal(
            attempts[1].clientMessageId,
            initialClientMessageId,
            'Retry MUST preserve and reuse the exact same clientMessageId for idempotency',
          );
          assert.equal(screen.queryByText('Gửi thất bại'), null);
        });
      } finally {
        supportChatApi.getActiveBusCompanies = originalGetActive;
        supportChatApi.getActiveConversation = originalGetActiveConv;
        supportChatApi.listConversations = originalListConv;
        supportChatApi.getMessages = originalGetMsg;
        supportChatApi.sendMessage = originalSendMsg;
      }
    });
  });

  describe('4. History Pagination & Load Older Messages (F-NEW-03 & F-NEW-04)', () => {
    it('loads more history when button is clicked and hides button when reaching totalPages', async () => {
      const originalGetActive = supportChatApi.getActiveBusCompanies;
      const originalGetActiveConv = supportChatApi.getActiveConversation;
      const originalListConv = supportChatApi.listConversations;
      const originalGetMsg = supportChatApi.getMessages;

      try {
        supportChatApi.getActiveBusCompanies = async () => [
          {
            busCompanyId: 10,
            name: 'Nhà Xe Phương Trang',
            contactInfo: '1900 6067',
          },
        ];

        // Không có phiên active để giữ màn hình ở selectedCompany
        supportChatApi.getActiveConversation = async () => null;

        supportChatApi.getMessages = async () => [];

        supportChatApi.listConversations = async (params) => {
          if (params.trangThai === 'DA_DONG') {
            const page = params.page || 1;
            if (page === 1) {
              return {
                data: [
                  {
                    cuocTroChuyenId: 101,
                    maCuocTroChuyen: 'CHAT-01',
                    tieuDe: 'Phiên hỗ trợ 1',
                    trangThai: 'DA_DONG',
                    nhaXeId: 10,
                    nhaXe: { nhaXeId: 10, tenNhaXe: 'Nhà Xe Phương Trang' },
                    createdAt: new Date().toISOString(),
                  },
                ],
                meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 2 },
              };
            }
            if (page === 2) {
              return {
                data: [
                  {
                    cuocTroChuyenId: 102,
                    maCuocTroChuyen: 'CHAT-02',
                    tieuDe: 'Phiên hỗ trợ 2',
                    trangThai: 'DA_DONG',
                    nhaXeId: 10,
                    nhaXe: { nhaXeId: 10, tenNhaXe: 'Nhà Xe Phương Trang' },
                    createdAt: new Date().toISOString(),
                  },
                ],
                meta: { page: 2, pageSize: 20, totalItems: 2, totalPages: 2 },
              };
            }
          }
          return {
            data: [],
            meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
          };
        };

        renderWithAuth(React.createElement(CustomerSupportChat));

        await waitFor(() => {
          screen.getByText('Nhà Xe Phương Trang');
        });
        fireEvent.click(screen.getByText('Nhà Xe Phương Trang'));

        // Cuộc trò chuyện đã đóng hiển thị trong chat room, bấm nút lịch sử ở header
        await waitFor(() => {
          screen.getByTitle('Lịch sử hỗ trợ');
        });
        fireEvent.click(screen.getByTitle('Lịch sử hỗ trợ'));

        await waitFor(() => {
          screen.getByText('Phiên hỗ trợ 1');
          screen.getByText('Tải thêm lịch sử');
        });

        fireEvent.click(screen.getByText('Tải thêm lịch sử'));

        await waitFor(() => {
          screen.getByText('Phiên hỗ trợ 1');
          screen.getByText('Phiên hỗ trợ 2');
          assert.equal(screen.queryByText('Tải thêm lịch sử'), null);
        });
      } finally {
        supportChatApi.getActiveBusCompanies = originalGetActive;
        supportChatApi.getActiveConversation = originalGetActiveConv;
        supportChatApi.listConversations = originalListConv;
        supportChatApi.getMessages = originalGetMsg;
      }
    });

    it('prepends older messages when load older button is clicked and maintains chronological order', async () => {
      const originalGetActive = supportChatApi.getActiveBusCompanies;
      const originalGetActiveConv = supportChatApi.getActiveConversation;
      const originalListConv = supportChatApi.listConversations;
      const originalGetMsg = supportChatApi.getMessages;

      try {
        supportChatApi.getActiveBusCompanies = async () => [
          {
            busCompanyId: 10,
            name: 'Nhà Xe Phương Trang',
            contactInfo: '1900 6067',
          },
        ];

        supportChatApi.listConversations = async () => ({
          data: [],
          meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
        });

        supportChatApi.getActiveConversation = async () => ({
          cuocTroChuyenId: 101,
          tieuDe: 'Hỗ trợ khách hàng',
          trangThai: 'DANG_XU_LY',
          nhaXeId: 10,
          nhaXe: { nhaXeId: 10, tenNhaXe: 'Nhà Xe Phương Trang' },
          createdAt: new Date().toISOString(),
        });

        const initialMessages = Array.from({ length: 40 }, (_, i) => ({
          tinNhanId: 41 + i,
          noiDung: `Tin nhắn số ${41 + i}`,
          loaiNguoiGui: 'NHAN_VIEN',
          createdAt: new Date().toISOString(),
        }));

        const olderMessages = [
          {
            tinNhanId: 31,
            noiDung: 'Tin nhắn cũ 31',
            loaiNguoiGui: 'NHAN_VIEN',
            createdAt: new Date().toISOString(),
          },
          {
            tinNhanId: 32,
            noiDung: 'Tin nhắn cũ 32',
            loaiNguoiGui: 'NHAN_VIEN',
            createdAt: new Date().toISOString(),
          },
          {
            tinNhanId: 33,
            noiDung: 'Tin nhắn cũ 33',
            loaiNguoiGui: 'NHAN_VIEN',
            createdAt: new Date().toISOString(),
          },
        ];

        supportChatApi.getMessages = async (convId, token, opts) => {
          if (opts?.beforeId) {
            return olderMessages;
          }
          return initialMessages;
        };

        renderWithAuth(React.createElement(CustomerSupportChat));

        await waitFor(() => {
          screen.getByText('Nhà Xe Phương Trang');
        });
        fireEvent.click(screen.getByText('Nhà Xe Phương Trang'));

        await waitFor(() => {
          screen.getByText('Tải tin nhắn cũ hơn');
        });

        fireEvent.click(screen.getByText('Tải tin nhắn cũ hơn'));

        await waitFor(() => {
          screen.getByText('Tin nhắn cũ 31');
          screen.getByText('Tin nhắn số 41');
          assert.equal(screen.queryByText('Tải tin nhắn cũ hơn'), null);
        });
      } finally {
        supportChatApi.getActiveBusCompanies = originalGetActive;
        supportChatApi.getActiveConversation = originalGetActiveConv;
        supportChatApi.listConversations = originalListConv;
        supportChatApi.getMessages = originalGetMsg;
      }
    });
  });

  describe('5. P1 Finding 2: Reconciling Optimistic Messages & P2 Finding 4: In-flight Reconnect Guards', () => {
    it('reconciles optimistic THAT_BAI message with confirmed server message on reconnect', () => {
      const prev = [
        {
          tinNhanId: -100,
          cuocTroChuyenId: 10,
          taiKhoanGuiId: 100,
          loaiNguoiGui: 'KHACH_HANG',
          noiDung: 'Chào nhà xe',
          clientMessageId: 'client-fail-1',
          trangThai: 'DA_GUI',
          deliveryStatus: 'THAT_BAI',
          createdAt: '2026-10-16T08:00:00.000Z',
        },
      ];

      const serverFresh = [
        {
          tinNhanId: 501,
          cuocTroChuyenId: 10,
          taiKhoanGuiId: 100,
          loaiNguoiGui: 'KHACH_HANG',
          noiDung: 'Chào nhà xe',
          clientMessageId: 'client-fail-1',
          trangThai: 'DA_GUI',
          createdAt: '2026-10-16T08:00:00.000Z',
        },
      ];

      const reconciled = reconcileMessages(prev, serverFresh);
      assert.equal(reconciled.length, 1);
      assert.equal(reconciled[0].tinNhanId, 501);
      assert.equal(reconciled[0].deliveryStatus, 'DA_GUI');
      assert.equal(reconciled[0].clientMessageId, 'client-fail-1');
    });

    it('does not inject messages of conversation A into conversation B when user switches companies while reconnect is in-flight', async () => {
      const originalGetActive = supportChatApi.getActiveBusCompanies;
      const originalGetActiveConv = supportChatApi.getActiveConversation;
      const originalGetConvById = supportChatApi.getConversationById;
      const originalListConv = supportChatApi.listConversations;
      const originalGetMsg = supportChatApi.getMessages;

      try {
        supportChatApi.getActiveBusCompanies = async () => [
          { busCompanyId: 10, name: 'Nhà Xe A', contactInfo: '1900 1111' },
          { busCompanyId: 20, name: 'Nhà Xe B', contactInfo: '1900 2222' },
        ];

        supportChatApi.listConversations = async () => ({
          data: [],
          meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
        });

        supportChatApi.getActiveConversation = async (companyId) => {
          if (companyId === 10) {
            return {
              cuocTroChuyenId: 101,
              tieuDe: 'Hỗ trợ Nhà Xe A',
              trangThai: 'DANG_XU_LY',
              nhaXeId: 10,
              nhaXe: { nhaXeId: 10, tenNhaXe: 'Nhà Xe A' },
              createdAt: new Date().toISOString(),
            };
          }
          return {
            cuocTroChuyenId: 202,
            tieuDe: 'Hỗ trợ Nhà Xe B',
            trangThai: 'DANG_XU_LY',
            nhaXeId: 20,
            nhaXe: { nhaXeId: 20, tenNhaXe: 'Nhà Xe B' },
            createdAt: new Date().toISOString(),
          };
        };

        supportChatApi.getMessages = async (convId) => {
          if (convId === 101) {
            return [
              {
                tinNhanId: 1001,
                cuocTroChuyenId: 101,
                taiKhoanGuiId: 100,
                loaiNguoiGui: 'KHACH_HANG',
                noiDung: 'Tin nhắn ở nhà xe A',
                createdAt: new Date().toISOString(),
              },
            ];
          }
          return [
            {
              tinNhanId: 2001,
              cuocTroChuyenId: 202,
              taiKhoanGuiId: 100,
              loaiNguoiGui: 'KHACH_HANG',
              noiDung: 'Tin nhắn ở nhà xe B',
              createdAt: new Date().toISOString(),
            },
          ];
        };

        renderWithAuth(React.createElement(CustomerSupportChat));

        await waitFor(() => {
          screen.getByText('Nhà Xe A');
          screen.getByText('Nhà Xe B');
        });

        // Chọn nhà xe A
        fireEvent.click(screen.getByText('Nhà Xe A'));

        await waitFor(() => {
          screen.getByText('Tin nhắn ở nhà xe A');
        });

        // Bấm Đổi nhà xe rồi chuyển sang Nhà Xe B
        fireEvent.click(screen.getByText('Đổi nhà xe'));

        await waitFor(() => {
          screen.getByText('Nhà Xe B');
        });

        fireEvent.click(screen.getByText('Nhà Xe B'));

        await waitFor(() => {
          screen.getByText('Tin nhắn ở nhà xe B');
          assert.equal(screen.queryByText('Tin nhắn ở nhà xe A'), null);
        });
      } finally {
        supportChatApi.getActiveBusCompanies = originalGetActive;
        supportChatApi.getActiveConversation = originalGetActiveConv;
        supportChatApi.getConversationById = originalGetConvById;
        supportChatApi.listConversations = originalListConv;
        supportChatApi.getMessages = originalGetMsg;
      }
    });
  });
});
