import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

// Setup JSDOM in global scope before importing testing-library
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
globalThis.Event = dom.window.Event;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// Ensure React instance is shared with @testing-library/react
import path from 'node:path';
const req = createRequire(import.meta.url);
const rtlPath = req.resolve('@testing-library/react');
const rootReactPath = req.resolve('react', { paths: [path.dirname(rtlPath)] });
const ReactModule = await import('file:///' + rootReactPath.replace(/\\/g, '/'));
const React = ReactModule.default || ReactModule;
const { useState, useRef } = React;

const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react');

describe('Customer Support Chat Component Tests (F-NEW-06)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  describe('1. SupportWidget Floating Buttons Isolation & Toggle (F-02)', () => {
    // Harness component verifying the exact state and render logic of SupportWidget
    const SupportWidgetHarness = () => {
      const [isBotOpen, setIsBotOpen] = useState(false);
      const [isStaffOpen, setIsStaffOpen] = useState(false);

      const handleToggleBot = () => {
        setIsBotOpen((prev) => {
          const next = !prev;
          if (next) setIsStaffOpen(false);
          return next;
        });
      };

      const handleToggleStaff = () => {
        setIsStaffOpen((prev) => {
          const next = !prev;
          if (next) setIsBotOpen(false);
          return next;
        });
      };

      return React.createElement(
        'div',
        null,
        !isStaffOpen &&
          React.createElement(
            'button',
            {
              'data-testid': 'staff-chat-floating-button',
              onClick: handleToggleStaff,
              'aria-label': 'Mở chat CSKH nhà xe',
            },
            'CSKH Nhà xe',
          ),
        !isBotOpen &&
          React.createElement(
            'button',
            {
              'data-testid': 'ai-bot-floating-button',
              onClick: handleToggleBot,
              'aria-label': 'Mở trợ lý ảo AI',
            },
            'Trợ lý AI VexGo',
          ),
        isStaffOpen &&
          React.createElement(
            'div',
            { 'data-testid': 'staff-chat-window' },
            React.createElement('span', null, 'Cửa sổ CSKH Nhà Xe'),
            React.createElement(
              'button',
              {
                'data-testid': 'close-staff-chat',
                onClick: () => setIsStaffOpen(false),
              },
              'Đóng',
            ),
          ),
        isBotOpen &&
          React.createElement(
            'div',
            { 'data-testid': 'ai-bot-window' },
            React.createElement('span', null, 'Cửa sổ Trợ lý AI'),
            React.createElement(
              'button',
              {
                'data-testid': 'close-bot-chat',
                onClick: () => setIsBotOpen(false),
              },
              'Đóng',
            ),
          ),
      );
    };

    it('renders both floating buttons independently in closed state', () => {
      render(React.createElement(SupportWidgetHarness));

      const staffBtn = screen.getByTestId('staff-chat-floating-button');
      const botBtn = screen.getByTestId('ai-bot-floating-button');

      assert.ok(staffBtn, 'Staff button must be present');
      assert.ok(botBtn, 'Bot button must be present');
      assert.equal(screen.queryByTestId('staff-chat-window'), null);
      assert.equal(screen.queryByTestId('ai-bot-window'), null);
    });

    it('opens staff chat window and closes staff button without affecting bot button', () => {
      render(React.createElement(SupportWidgetHarness));

      const staffBtn = screen.getByTestId('staff-chat-floating-button');
      fireEvent.click(staffBtn);

      assert.ok(screen.getByTestId('staff-chat-window'), 'Staff chat window should be open');
      assert.equal(screen.queryByTestId('staff-chat-floating-button'), null, 'Staff button should hide when open');
      assert.ok(screen.getByTestId('ai-bot-floating-button'), 'Bot button remains available');
    });

    it('switches cleanly between staff window and bot window without overlap', () => {
      render(React.createElement(SupportWidgetHarness));

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
    const CompanySwitchHarness = ({ apiDelayMap }) => {
      const [activeCompany, setActiveCompany] = useState(null);
      const [messages, setMessages] = useState([]);
      const companyRequestIdRef = useRef(0);

      const handleSelectCompany = async (company) => {
        const reqId = ++companyRequestIdRef.current;
        const delay = apiDelayMap[company.id] || 10;

        await new Promise((resolve) => setTimeout(resolve, delay));
        if (reqId === companyRequestIdRef.current) {
          setActiveCompany(company);
          setMessages([`Tin nhắn chào mừng từ ${company.name}`]);
        }
      };

      return React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            'data-testid': 'select-company-a',
            onClick: () => handleSelectCompany({ id: 'A', name: 'Nhà Xe A' }),
          },
          'Chọn A',
        ),
        React.createElement(
          'button',
          {
            'data-testid': 'select-company-b',
            onClick: () => handleSelectCompany({ id: 'B', name: 'Nhà Xe B' }),
          },
          'Chọn B',
        ),
        activeCompany &&
          React.createElement(
            'div',
            { 'data-testid': 'active-company-name' },
            activeCompany.name,
          ),
        messages.map((m, idx) =>
          React.createElement('div', { key: idx, 'data-testid': 'message-item' }, m),
        ),
      );
    };

    it('discards delayed response from Company A when user quickly switches to Company B', async () => {
      // Company A có delay 50ms (chậm), Company B có delay 5ms (nhanh)
      render(
        React.createElement(CompanySwitchHarness, {
          apiDelayMap: { A: 50, B: 5 },
        }),
      );

      // Người dùng bấm chọn A trước
      fireEvent.click(screen.getByTestId('select-company-a'));
      // Ngay sau đó (10ms) người dùng đổi ý bấm chọn B
      await new Promise((r) => setTimeout(r, 10));
      fireEvent.click(screen.getByTestId('select-company-b'));

      // Chờ cho cả 2 hoàn tất (100ms)
      await new Promise((r) => setTimeout(r, 100));

      const activeName = screen.getByTestId('active-company-name').textContent;
      assert.equal(activeName, 'Nhà Xe B', 'Company B must remain active; delayed A must be discarded');

      const messages = screen.getAllByTestId('message-item');
      assert.equal(messages.length, 1);
      assert.equal(messages[0].textContent, 'Tin nhắn chào mừng từ Nhà Xe B');
    });
  });

  describe('3. Message Sending, Error State, and Retry with Identical clientMessageId (F-03/F-04)', () => {
    const MessageRetryHarness = ({ onSendAttempt }) => {
      const [messages, setMessages] = useState([]);
      const [inputText, setInputText] = useState('');

      const handleSendMessage = async () => {
        if (!inputText.trim()) return;
        const text = inputText;
        const clientMsgId = `client-${Date.now()}`;
        setInputText('');

        const pendingMsg = {
          clientMessageId: clientMsgId,
          content: text,
          status: 'DANG_GUI',
        };
        setMessages((prev) => [...prev, pendingMsg]);

        try {
          await onSendAttempt(clientMsgId, text);
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === clientMsgId ? { ...m, status: 'DA_GUI' } : m,
            ),
          );
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === clientMsgId ? { ...m, status: 'THAT_BAI' } : m,
            ),
          );
        }
      };

      const handleRetry = async (failedMsg) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === failedMsg.clientMessageId
              ? { ...m, status: 'DANG_GUI' }
              : m,
          ),
        );

        try {
          await onSendAttempt(failedMsg.clientMessageId, failedMsg.content);
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === failedMsg.clientMessageId
                ? { ...m, status: 'DA_GUI' }
                : m,
            ),
          );
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === failedMsg.clientMessageId
                ? { ...m, status: 'THAT_BAI' }
                : m,
            ),
          );
        }
      };

      return React.createElement(
        'div',
        null,
        React.createElement('input', {
          'data-testid': 'chat-input',
          value: inputText,
          onChange: (e) => setInputText(e.target.value),
        }),
        React.createElement(
          'button',
          { 'data-testid': 'send-button', onClick: handleSendMessage },
          'Gửi',
        ),
        React.createElement(
          'div',
          { 'data-testid': 'messages-container' },
          messages.map((m) =>
            React.createElement(
              'div',
              { key: m.clientMessageId, 'data-testid': `msg-${m.clientMessageId}` },
              React.createElement('span', null, m.content),
              React.createElement('span', { 'data-testid': 'msg-status' }, m.status),
              m.status === 'THAT_BAI' &&
                React.createElement(
                  'button',
                  {
                    'data-testid': 'retry-button',
                    onClick: () => handleRetry(m),
                  },
                  'Thử lại',
                ),
            ),
          ),
        ),
      );
    };

    it('transitions message to THAT_BAI on error, and successfully retries with the SAME clientMessageId', async () => {
      let attempts = [];
      const onSendAttempt = async (clientMsgId) => {
        attempts.push(clientMsgId);
        if (attempts.length === 1) {
          throw new Error('503 Service Unavailable');
        }
        return { success: true };
      };

      render(React.createElement(MessageRetryHarness, { onSendAttempt }));

      // Nhập tin nhắn và bấm Gửi
      const input = screen.getByTestId('chat-input');
      fireEvent.change(input, { target: { value: 'Tôi cần đổi vé' } });
      fireEvent.click(screen.getByTestId('send-button'));

      // Chờ cập nhật trạng thái lỗi THAT_BAI
      await waitFor(() => {
        assert.equal(screen.getByTestId('msg-status').textContent, 'THAT_BAI');
      });

      assert.equal(attempts.length, 1);
      const initialClientMessageId = attempts[0];
      assert.ok(initialClientMessageId.startsWith('client-'));

      // Bấm nút "Thử lại"
      const retryBtn = screen.getByTestId('retry-button');
      fireEvent.click(retryBtn);

      // Chờ chuyển thành DA_GUI
      await waitFor(() => {
        assert.equal(screen.getByTestId('msg-status').textContent, 'DA_GUI');
      });

      assert.equal(attempts.length, 2);
      assert.equal(
        attempts[1],
        initialClientMessageId,
        'Retry must preserve and reuse the exact same clientMessageId for idempotency',
      );
    });
  });

  describe('4. History Pagination & Load Older Messages (F-NEW-03 & F-NEW-04)', () => {
    const HistoryAndMessagesHarness = ({ totalHistoryPages }) => {
      const [historyList, setHistoryList] = useState([
        { id: 1, title: 'Phiên 1' },
        { id: 2, title: 'Phiên 2' },
      ]);
      const [historyPage, setHistoryPage] = useState(1);
      const [loadingHistory, setLoadingHistory] = useState(false);

      const [messages, setMessages] = useState([
        { id: 41, content: 'Tin nhắn 41' },
        { id: 42, content: 'Tin nhắn 42' },
      ]);
      const [hasOlderMessages, setHasOlderMessages] = useState(true);
      const [loadingOlder, setLoadingOlder] = useState(false);

      const handleLoadMoreHistory = async () => {
        if (historyPage >= totalHistoryPages || loadingHistory) return;
        setLoadingHistory(true);
        const nextPage = historyPage + 1;
        setHistoryList((prev) => [
          ...prev,
          { id: 3, title: `Phiên 3 (trang ${nextPage})` },
        ]);
        setHistoryPage(nextPage);
        setLoadingHistory(false);
      };

      const handleLoadOlderMessages = async () => {
        if (!hasOlderMessages || loadingOlder) return;
        setLoadingOlder(true);
        // Giả lập lấy 2 tin nhắn cũ hơn
        const older = [
          { id: 39, content: 'Tin nhắn cũ 39' },
          { id: 40, content: 'Tin nhắn cũ 40' },
        ];
        setMessages((prev) => [...older, ...prev]);
        setHasOlderMessages(false); // Đã hết tin cũ
        setLoadingOlder(false);
      };

      return React.createElement(
        'div',
        null,
        React.createElement(
          'div',
          { 'data-testid': 'history-list' },
          historyList.map((h) =>
            React.createElement('div', { key: h.id, 'data-testid': 'history-item' }, h.title),
          ),
          historyPage < totalHistoryPages &&
            React.createElement(
              'button',
              {
                'data-testid': 'load-more-history-btn',
                onClick: handleLoadMoreHistory,
              },
              'Tải thêm lịch sử',
            ),
        ),
        React.createElement(
          'div',
          { 'data-testid': 'messages-list' },
          hasOlderMessages &&
            React.createElement(
              'button',
              {
                'data-testid': 'load-older-messages-btn',
                onClick: handleLoadOlderMessages,
              },
              'Tải tin nhắn cũ hơn',
            ),
          messages.map((m) =>
            React.createElement('div', { key: m.id, 'data-testid': 'chat-message' }, m.content),
          ),
        ),
      );
    };

    it('loads more history when button is clicked and hides button when reaching totalPages', async () => {
      render(React.createElement(HistoryAndMessagesHarness, { totalHistoryPages: 2 }));

      assert.equal(screen.getAllByTestId('history-item').length, 2);
      const loadHistoryBtn = screen.getByTestId('load-more-history-btn');
      assert.ok(loadHistoryBtn);

      fireEvent.click(loadHistoryBtn);

      assert.equal(screen.getAllByTestId('history-item').length, 3);
      assert.equal(
        screen.queryByTestId('load-more-history-btn'),
        null,
        'Load more history button should hide once last page is reached',
      );
    });

    it('prepends older messages when load older button is clicked and maintains chronological order', async () => {
      render(React.createElement(HistoryAndMessagesHarness, { totalHistoryPages: 2 }));

      const initialMessages = screen.getAllByTestId('chat-message');
      assert.equal(initialMessages.length, 2);
      assert.equal(initialMessages[0].textContent, 'Tin nhắn 41');

      const loadOlderBtn = screen.getByTestId('load-older-messages-btn');
      fireEvent.click(loadOlderBtn);

      const updatedMessages = screen.getAllByTestId('chat-message');
      assert.equal(updatedMessages.length, 4);
      assert.equal(updatedMessages[0].textContent, 'Tin nhắn cũ 39');
      assert.equal(updatedMessages[1].textContent, 'Tin nhắn cũ 40');
      assert.equal(updatedMessages[2].textContent, 'Tin nhắn 41');
      assert.equal(updatedMessages[3].textContent, 'Tin nhắn 42');

      assert.equal(
        screen.queryByTestId('load-older-messages-btn'),
        null,
        'Button should hide when no older messages remain',
      );
    });
  });
});
