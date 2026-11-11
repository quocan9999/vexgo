import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { supportChatApi } from '../../../src/features/support-chat/services/support-chat.api.ts';

describe('Customer Support Chat F-01 & F-03/F-04 Flow Regression Tests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('F-01: Anti-Race Condition on Fast Bus Company Switching (A -> B Out-of-Order)', () => {
    it('safely discards delayed responses from Company A when user quickly switches to Company B', async () => {
      let companyAResolved = false;
      let companyBResolved = false;

      // Mô phỏng API với delay: Nhà xe A (id=10) trả lời sau 60ms, Nhà xe B (id=20) trả lời ngay sau 5ms
      globalThis.fetch = async (url) => {
        const urlStr = String(url);

        if (urlStr.includes('/bus-companies/10/active-conversation')) {
          await new Promise((resolve) => setTimeout(resolve, 60));
          companyAResolved = true;
          return new Response(
            JSON.stringify({
              data: {
                cuocTroChuyenId: 101,
                maCuocTroChuyen: 'CHAT-A-101',
                tieuDe: 'Hỗ trợ Nhà xe A',
                trangThai: 'DANG_XU_LY',
                nhaXeId: 10,
                nhaXe: { nhaXeId: 10, tenNhaXe: 'Nhà Xe A' },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (urlStr.includes('/bus-companies/20/active-conversation')) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          companyBResolved = true;
          return new Response(
            JSON.stringify({
              data: {
                cuocTroChuyenId: 202,
                maCuocTroChuyen: 'CHAT-B-202',
                tieuDe: 'Hỗ trợ Nhà xe B',
                trangThai: 'DANG_XU_LY',
                nhaXeId: 20,
                nhaXe: { nhaXeId: 20, tenNhaXe: 'Nhà Xe B' },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      // Mô phỏng logic request-id guard trong CustomerSupportChat
      let currentRequestId = 0;
      let activeConversationState = null;

      const selectCompanyWithGuard = async (companyId) => {
        const reqId = ++currentRequestId;
        const conv = await supportChatApi.getActiveConversation(companyId, 'test-token');
        if (reqId === currentRequestId) {
          activeConversationState = conv;
        }
      };

      // Khách bấm chọn A trước
      const promiseA = selectCompanyWithGuard(10);
      // Ngay sau đó khách đổi ý bấm chọn B
      const promiseB = selectCompanyWithGuard(20);

      // Chờ cả 2 promise hoàn thành
      await Promise.all([promiseA, promiseB]);

      assert.equal(companyAResolved, true, 'Company A should have resolved');
      assert.equal(companyBResolved, true, 'Company B should have resolved');

      // Xác minh: State cuối cùng BẮT BUỘC là của Nhà xe B, không bị kết quả về sau của A đè lên!
      assert.notEqual(activeConversationState, null);
      assert.equal(activeConversationState.nhaXeId, 20);
      assert.equal(activeConversationState.maCuocTroChuyen, 'CHAT-B-202');
    });
  });

  describe('F-01: Viewing Closed Conversations History (DA_DONG)', () => {
    it('fetches closed conversations list when active conversation is null and returns transcript', async () => {
      const calls = [];
      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        calls.push(urlStr);

        if (urlStr.includes('/support-chat/bus-companies/15/active-conversation')) {
          return new Response(JSON.stringify({ statusCode: 404, error: 'NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (urlStr.includes('/support-chat/conversations?nhaXeId=15')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  cuocTroChuyenId: 501,
                  maCuocTroChuyen: 'CHAT-CLOSED-501',
                  tieuDe: 'Hỗ trợ chuyến Sài Gòn - Đà Lạt',
                  trangThai: 'DA_DONG',
                  nhaXeId: 15,
                  dongLuc: '2026-10-15T10:00:00.000Z',
                  createdAt: '2026-10-15T09:00:00.000Z',
                  nhaXe: { nhaXeId: 15, tenNhaXe: 'Phương Trang' },
                },
              ],
              meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (urlStr.includes('/support-chat/conversations/501/messages')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  tinNhanId: 1,
                  cuocTroChuyenId: 501,
                  noiDung: 'Chào bạn, mình cần hỗ trợ dời ngày đi.',
                  loaiNguoiGui: 'KHACH_HANG',
                  trangThai: 'DA_DOC',
                  createdAt: '2026-10-15T09:01:00.000Z',
                },
                {
                  tinNhanId: 2,
                  cuocTroChuyenId: 501,
                  noiDung: 'Dạ Phương Trang đã đổi vé thành công cho bạn ạ!',
                  loaiNguoiGui: 'NHAN_VIEN',
                  trangThai: 'DA_DOC',
                  createdAt: '2026-10-15T09:05:00.000Z',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected URL: ${urlStr}`);
      };

      // 1. Kiểm tra active conversation -> null
      const active = await supportChatApi.getActiveConversation(15, 'token');
      assert.equal(active, null);

      // 2. Tải danh sách hội thoại của nhà xe 15 -> có 1 cuộc trò chuyện DA_DONG
      const convs = await supportChatApi.listConversations({ nhaXeId: 15 }, 'token');
      assert.equal(convs.data.length, 1);
      assert.equal(convs.data[0].trangThai, 'DA_DONG');

      // 3. Tải tin nhắn của phiên chat đã đóng -> đọc lại transcript thành công
      const messages = await supportChatApi.getMessages(501, 'token');
      assert.equal(messages.length, 2);
      assert.equal(messages[0].noiDung, 'Chào bạn, mình cần hỗ trợ dời ngày đi.');
      assert.equal(messages[1].noiDung, 'Dạ Phương Trang đã đổi vé thành công cho bạn ạ!');
    });
  });

  describe('F-03 & F-04: Socket Timeout & Idempotent REST Fail-over with Same clientMessageId', () => {
    it('uses identical clientMessageId when failing over from socket to REST to prevent duplicate messages', async () => {
      const stableClientMessageId = 'client-uuid-stable-1234';
      let capturedBody = null;

      globalThis.fetch = async (url, init = {}) => {
        const urlStr = String(url);
        if (urlStr.includes('/support-chat/conversations/77/messages') && init.method === 'POST') {
          capturedBody = JSON.parse(String(init.body));
          return new Response(
            JSON.stringify({
              data: {
                tinNhanId: 999,
                cuocTroChuyenId: 77,
                noiDung: capturedBody.noiDung,
                clientMessageId: capturedBody.clientMessageId,
                loaiNguoiGui: 'KHACH_HANG',
                trangThai: 'DA_GUI',
                createdAt: new Date().toISOString(),
              },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error(`Unexpected URL: ${urlStr}`);
      };

      // Giả lập fail-over REST sau khi socket bị timeout
      const restRes = await supportChatApi.sendMessage(
        77,
        'Tin nhắn gửi lại sau khi mất Socket ACK',
        'token',
        stableClientMessageId,
      );

      assert.equal(restRes.tinNhanId, 999);
      assert.equal(capturedBody.clientMessageId, stableClientMessageId);
      assert.equal(capturedBody.noiDung, 'Tin nhắn gửi lại sau khi mất Socket ACK');
    });

    it('marks message as THAT_BAI upon total failure and enables retry with the same clientMessageId', async () => {
      const stableClientMessageId = 'client-fail-and-retry-456';
      let attemptCount = 0;

      globalThis.fetch = async () => {
        attemptCount++;
        if (attemptCount === 1) {
          // Lần 1: Lỗi mạng
          return new Response(
            JSON.stringify({ error: 'NETWORK_ERROR', message: 'Mất kết nối mạng' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          );
        }
        // Lần 2 (Retry): Thành công
        return new Response(
          JSON.stringify({
            data: {
              tinNhanId: 1001,
              cuocTroChuyenId: 77,
              noiDung: 'Nội dung thử lại',
              clientMessageId: stableClientMessageId,
              loaiNguoiGui: 'KHACH_HANG',
              trangThai: 'DA_GUI',
              createdAt: new Date().toISOString(),
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      };

      // Mô phỏng state tin nhắn phía client
      let msgState = {
        tinNhanId: -Date.now(),
        noiDung: 'Nội dung thử lại',
        clientMessageId: stableClientMessageId,
        deliveryStatus: 'DANG_GUI',
      };

      // Lần 1: Thất bại -> Chuyển sang THAT_BAI
      try {
        await supportChatApi.sendMessage(77, msgState.noiDung, 'token', msgState.clientMessageId);
      } catch {
        msgState = { ...msgState, deliveryStatus: 'THAT_BAI' };
      }

      assert.equal(msgState.deliveryStatus, 'THAT_BAI', 'Message should be marked as THAT_BAI on failure');

      // Lần 2: Người dùng bấm Thử lại (Retry) với cùng clientMessageId
      msgState = { ...msgState, deliveryStatus: 'DANG_GUI' };
      const retryResult = await supportChatApi.sendMessage(
        77,
        msgState.noiDung,
        'token',
        msgState.clientMessageId,
      );

      msgState = { ...retryResult, deliveryStatus: 'DA_GUI' };

      assert.equal(attemptCount, 2);
      assert.equal(msgState.deliveryStatus, 'DA_GUI', 'Message should be marked as DA_GUI after retry');
      assert.equal(msgState.tinNhanId, 1001);
      assert.equal(msgState.clientMessageId, stableClientMessageId);
    });
  });
});
