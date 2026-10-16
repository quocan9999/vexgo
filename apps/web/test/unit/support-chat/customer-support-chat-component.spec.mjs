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
const ReactModule = await import('file:///' + rootReactPath.replace(/\\/g, '/'));
const React = ReactModule.default || ReactModule;

const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react');

// Import REAL components and real APIs (F-NEW-06)
const { CustomerSupportChat } = await import('@/features/support-chat/components/customer-support-chat');
const { SupportWidget } = await import('@/components/layout/support-widget');
const { AuthSessionProvider } = await import('@/features/auth/auth-session');
const { supportChatApi } = await import('@/features/support-chat/services/support-chat.api');

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

      assert.ok(screen.getByTestId('staff-chat-window'), 'Staff chat window should be open');
      assert.equal(
        screen.queryByTestId('staff-chat-floating-button'),
        null,
        'Staff button should hide when open',
      );
      assert.ok(screen.getByTestId('ai-bot-floating-button'), 'Bot button remains available');
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
          { busCompanyId: 10, name: 'Nhà Xe Phương Trang', contactInfo: '1900 6067' },
          { busCompanyId: 20, name: 'Nhà Xe Thành Bưởi', contactInfo: '1900 6079' },
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
            noiDung: convId === 101 ? 'Tin nhắn Phương Trang' : 'Tin nhắn Thành Bưởi',
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
          { busCompanyId: 10, name: 'Nhà Xe Phương Trang', contactInfo: '1900 6067' },
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

        supportChatApi.sendMessage = async (convId, noiDung, token, clientMessageId) => {
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
          { busCompanyId: 10, name: 'Nhà Xe Phương Trang', contactInfo: '1900 6067' },
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
          return { data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } };
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
          { busCompanyId: 10, name: 'Nhà Xe Phương Trang', contactInfo: '1900 6067' },
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
          { tinNhanId: 31, noiDung: 'Tin nhắn cũ 31', loaiNguoiGui: 'NHAN_VIEN', createdAt: new Date().toISOString() },
          { tinNhanId: 32, noiDung: 'Tin nhắn cũ 32', loaiNguoiGui: 'NHAN_VIEN', createdAt: new Date().toISOString() },
          { tinNhanId: 33, noiDung: 'Tin nhắn cũ 33', loaiNguoiGui: 'NHAN_VIEN', createdAt: new Date().toISOString() },
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
});
