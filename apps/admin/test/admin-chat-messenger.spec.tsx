// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import {
  AdminChatMessenger,
  reconcileAdminMessages,
} from '../src/features/support-chat/components/admin-chat-messenger';
import { adminSupportChatApi } from '../src/features/support-chat/services/admin-support-chat.api';
import type { AdminSession } from '../src/features/admin-auth/services/admin-auth';
import type {
  AdminSupportConversation,
  AdminSupportMessage,
} from '../src/features/support-chat/types';
import type { UseAdminChatSocketProps } from '../src/features/support-chat/hooks/use-admin-chat-socket';

let capturedSocketProps: Partial<UseAdminChatSocketProps> = {};
const socketRead = vi.fn();
let bubbleBounds = new Map<number, DOMRect>();
const rect = (top: number, bottom: number): DOMRect => ({top, bottom, left: 10, right: 150, width: 140, height: bottom - top, x: 10, y: top, toJSON: () => ({})});

vi.mock('@/features/admin-auth/services/admin-auth', () => ({
  getAdminAccessToken: () => 'mock-admin-token-123',
}));

vi.mock('../src/features/support-chat/hooks/use-admin-chat-socket', () => ({
  useAdminChatSocket: (props: UseAdminChatSocketProps) => {
    capturedSocketProps = props;
    return {
      isConnected: true,
      customerTyping: false,
      sendMessage: vi.fn().mockResolvedValue({ success: false, error: 'SOCKET_TIMEOUT' }),
      claimConversation: vi.fn().mockResolvedValue({ success: true }),
      closeConversation: vi.fn().mockResolvedValue({ success: true }),
      emitTyping: vi.fn(),
      markMessagesAsRead: socketRead,
    };
  },
}));

const mockSession: AdminSession = {
  accountId: 10,
  fullName: 'Trần CSKH',
  phoneNumber: '0901234567',
  email: 'cskh@futa.vn',
  roles: ['NHAN_VIEN_CSKH'],
  permissions: ['chat:read', 'chat:manage'],
  employee: {
    employeeId: 5,
    busCompanyId: 1,
    busCompanyCode: 'FUTA',
    busCompanyName: 'Phương Trang',
  },
  busCompanyId: 1,
};

const createMockConversation = (id: number, name: string, status = 'CHO_TIEP_NHAN'): AdminSupportConversation => ({
  cuocTroChuyenId: id,
  maCuocTroChuyen: `CHAT-${id}`,
  tieuDe: `Hỗ trợ ${name}`,
  trangThai: status as 'CHO_TIEP_NHAN' | 'DANG_XU_LY' | 'DA_DONG',
  kenhHoTro: 'WEB',
  cheDoChat: 'NGUOI_THAT',
  khachHangId: id * 10,
  nhanVienId: status === 'CHO_TIEP_NHAN' ? null : 10,
  nhaXeId: 1,
  createdAt: '2026-10-16T08:00:00.000Z',
  updatedAt: '2026-10-16T08:05:00.000Z',
  nhaXe: { nhaXeId: 1, tenNhaXe: 'Phương Trang', logo: null, hotline: '19006067' },
  khachHang: {
    khachHangId: id * 10,
    maKhachHang: `KH-${id}`,
    taiKhoan: { hoTen: name, soDienThoai: `098765432${id % 10}`, avatarUrl: null },
  },
  nhanVien: status === 'CHO_TIEP_NHAN' ? null : {
    nhanVienId: 10,
    maNhanVien: 'NV-10',
    taiKhoan: { hoTen: 'Trần CSKH', avatarUrl: null },
  },
  tinNhanCuoi: {
    tinNhanId: id * 100,
    cuocTroChuyenId: id,
    taiKhoanGuiId: id * 10,
    loaiNguoiGui: 'KHACH_HANG' as const,
    loaiTinNhan: 'VAN_BAN' as const,
    noiDung: `Tin nhắn từ ${name}`,
    trangThai: 'DA_GUI' as const,
    createdAt: '2026-10-16T08:05:00.000Z',
  },
});

describe('AdminChatMessenger Component & Flow Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    bubbleBounds = new Map();
    Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'visible'});
    vi.spyOn(window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid === 'admin-chat-transcript') return rect(0, 100);
      return bubbleBounds.get(Number(this.dataset.chatMessageId)) ?? rect(10, 30);
    });
  });

  describe('Lead R3: Admin visible text bubble read receipts', () => {
    async function openUnreadPage() {
      const conversation = createMockConversation(1, 'Viewport customer', 'DANG_XU_LY');
      conversation.soTinChuaDoc = 50;
      const records: AdminSupportMessage[] = Array.from({length: 50}, (_, i) => ({
        tinNhanId: i + 1, cuocTroChuyenId: 1, taiKhoanGuiId: 20,
        loaiNguoiGui: 'KHACH_HANG', loaiTinNhan: 'VAN_BAN',
        noiDung: `Viewport text ${i + 1}`, trangThai: 'DA_GUI',
        createdAt: new Date(Date.UTC(2026, 9, 21, 0, 0, i)).toISOString(),
      }));
      vi.spyOn(adminSupportChatApi, 'listConversations').mockResolvedValue({data: [conversation], meta: {page: 1, pageSize: 20, totalItems: 1, totalPages: 1}});
      vi.spyOn(adminSupportChatApi, 'getMessages').mockResolvedValue(records);
      vi.spyOn(adminSupportChatApi, 'getConversationById').mockImplementation(async () => ({...conversation, soTinChuaDoc: records.filter(m => m.trangThai === 'DA_GUI').length}));
      const read = vi.spyOn(adminSupportChatApi, 'markMessagesAsRead').mockImplementation(async (_id, _token, ids) => {
        for (const m of records) if (ids?.includes(m.tinNhanId)) m.trangThai = 'DA_DOC';
        return {updatedCount: ids?.length ?? 0};
      });
      render(<AdminChatMessenger session={mockSession} />);
      fireEvent.click(await screen.findByText('Viewport customer'));
      await screen.findByText('Viewport text 50');
      return {read, records};
    }
    it('reads only visible text bubbles out of 50 loaded unread records and marks more on scroll', async () => {
      for (let id = 1; id <= 50; id++) bubbleBounds.set(id, rect(200, 240));
      bubbleBounds.set(49, rect(10, 30));
      bubbleBounds.set(50, rect(40, 60));
      const {read, records} = await openUnreadPage();
      await waitFor(() => expect(read).toHaveBeenCalledWith(1, 'mock-admin-token-123', [49, 50]));
      await waitFor(() => expect(screen.getByText('48')).toBeTruthy());
      expect(records.filter(m => m.trangThai === 'DA_GUI')).toHaveLength(48);
      expect(socketRead).not.toHaveBeenCalled();
      const textBubble = screen.getByText('Viewport text 1');
      expect(textBubble.dataset.chatMessageId).toBe('1');
      expect(textBubble.textContent).toBe('Viewport text 1');
      bubbleBounds.set(1, rect(20, 40));
      const scrollCount = vi.mocked(window.HTMLElement.prototype.scrollIntoView).mock.calls.length;
      fireEvent.scroll(screen.getByTestId('admin-chat-transcript'));
      await waitFor(() => expect(read.mock.calls.map(call => call[2])).toEqual([[49, 50], [1]]));
      await waitFor(() => expect(screen.getByText('47')).toBeTruthy());
      expect(vi.mocked(window.HTMLElement.prototype.scrollIntoView).mock.calls.length).toBe(scrollCount);
      expect(records[1].trangThai).toBe('DA_GUI');
    });
    it('does not read offscreen text merely because its header/row is visible, then detects a visible bubble on resize', async () => {
      for (let id = 1; id <= 50; id++) bubbleBounds.set(id, rect(110, 140));
      const {read} = await openUnreadPage();
      expect(read).not.toHaveBeenCalled();
      expect(screen.getByText('50', {selector: 'span'})).toBeTruthy();
      // All outer rows have visible default geometry; only the actual text rectangle matters.
      bubbleBounds.set(2, rect(90, 120));
      fireEvent(window, new Event('resize'));
      await waitFor(() => expect(read.mock.calls.map(call => call[2])).toEqual([[2]]));
    });
    it('waits for a visible tab and reads only the visible IDs when visibility returns', async () => {
      Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'});
      for (let id = 1; id <= 50; id++) bubbleBounds.set(id, rect(200, 240));
      bubbleBounds.set(50, rect(20, 40));
      const {read} = await openUnreadPage();
      expect(read).not.toHaveBeenCalled();
      Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'visible'});
      fireEvent(document, new Event('visibilitychange'));
      await waitFor(() => expect(read.mock.calls.map(call => call[2])).toEqual([[50]]));
    });
    it('serializes visible reads and checks newly visible IDs after the pending ACK', async () => {
      for (let id = 1; id <= 50; id++) bubbleBounds.set(id, rect(200, 240));
      const {read, records} = await openUnreadPage();
      let release!: () => void;
      read.mockImplementationOnce(() => new Promise(resolve => { release = () => { records[0].trangThai = 'DA_DOC'; resolve({updatedCount: 1}); }; }));
      bubbleBounds.set(1, rect(20, 40));
      fireEvent.scroll(screen.getByTestId('admin-chat-transcript'));
      await waitFor(() => expect(read.mock.calls.map(call => call[2])).toEqual([[1]]));
      bubbleBounds.set(2, rect(50, 70));
      fireEvent.scroll(screen.getByTestId('admin-chat-transcript'));
      expect(read).toHaveBeenCalledTimes(1);
      expect(screen.getByText('50', {selector: 'span'})).toBeTruthy();
      await act(async () => release());
      await waitFor(() => expect(read.mock.calls.map(call => call[2])).toEqual([[1], [2]]));
      await waitFor(() => expect(screen.getByText('48')).toBeTruthy());
      expect(records[2].trangThai).toBe('DA_GUI');
    });
    it('preserves failed read state without a retry loop and later reads only the currently visible bubble', async () => {
      for (let id = 1; id <= 50; id++) bubbleBounds.set(id, rect(200, 240));
      const {read, records} = await openUnreadPage();
      read.mockRejectedValueOnce(new Error('read endpoint unavailable'));
      bubbleBounds.set(1, rect(20, 40));
      await act(async () => fireEvent.scroll(screen.getByTestId('admin-chat-transcript')));
      expect(read).toHaveBeenCalledTimes(1);
      expect(records[0].trangThai).toBe('DA_GUI');
      expect(screen.getByText('50', {selector: 'span'})).toBeTruthy();
      bubbleBounds.set(1, rect(200, 240));
      bubbleBounds.set(2, rect(20, 40));
      fireEvent.scroll(screen.getByTestId('admin-chat-transcript'));
      await waitFor(() => expect(read.mock.calls.map(call => call[2])).toEqual([[1], [2]]));
      await waitFor(() => expect(screen.getByText('49')).toBeTruthy());
      expect(records[0].trangThai).toBe('DA_GUI');
    });
  });

  describe('Lead R2: authoritative reads and reconnect gaps', () => {
    const message = (
      id: number,
      status: 'DA_GUI' | 'DA_DOC' = 'DA_DOC',
    ): AdminSupportMessage => ({
      tinNhanId: id,
      cuocTroChuyenId: 1,
      taiKhoanGuiId: 20,
      loaiNguoiGui: 'KHACH_HANG',
      loaiTinNhan: 'VAN_BAN',
      noiDung: `R2 message ${id}`,
      trangThai: status,
      createdAt: new Date(Date.UTC(2026, 9, 21, 0, 0, id)).toISOString(),
    });
    function setup(unread = 0) {
      const conversation = createMockConversation(
        1,
        'R2 customer',
        'DANG_XU_LY',
      );
      conversation.soTinChuaDoc = unread;
      vi.spyOn(adminSupportChatApi, 'listConversations').mockResolvedValue({
        data: [conversation],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });
      vi.spyOn(adminSupportChatApi, 'getConversationById').mockResolvedValue(
        conversation,
      );
      return conversation;
    }
    it('does not mark hidden older unread messages when the latest page has no unread IDs', async () => {
      setup(10);
      vi.spyOn(adminSupportChatApi, 'getMessages').mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => message(i + 11)),
      );
      const read = vi
        .spyOn(adminSupportChatApi, 'markMessagesAsRead')
        .mockResolvedValue({ updatedCount: 10 });
      render(<AdminChatMessenger session={mockSession} />);
      fireEvent.click(await screen.findByText('R2 customer'));
      await screen.findByText('R2 message 60');
      expect(read).not.toHaveBeenCalled();
      expect(socketRead).not.toHaveBeenCalled();
      expect(screen.getByText('10')).toBeTruthy();
    });
    it('keeps unread count until the exact-ID REST acknowledgement and authoritative detail arrive', async () => {
      const conversation = setup(10);
      vi.spyOn(adminSupportChatApi, 'getMessages').mockResolvedValue([
        message(60, 'DA_GUI'),
      ]);
      let acknowledge!: (value: { updatedCount: number }) => void;
      const read = vi
        .spyOn(adminSupportChatApi, 'markMessagesAsRead')
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              acknowledge = resolve;
            }),
        );
      vi.mocked(adminSupportChatApi.getConversationById)
        .mockResolvedValueOnce(conversation)
        .mockResolvedValue({ ...conversation, soTinChuaDoc: 9 });
      render(<AdminChatMessenger session={mockSession} />);
      fireEvent.click(await screen.findByText('R2 customer'));
      await waitFor(() =>
        expect(read).toHaveBeenCalledWith(1, 'mock-admin-token-123', [60]),
      );
      expect(screen.getByText('10')).toBeTruthy();
      expect(socketRead).not.toHaveBeenCalled();
      const scrollCount = vi.mocked(window.HTMLElement.prototype.scrollIntoView).mock.calls.length;
      await act(async () => acknowledge({ updatedCount: 1 }));
      await waitFor(() => expect(screen.getByText('9')).toBeTruthy());
      expect(read).toHaveBeenCalledTimes(1);
      expect(vi.mocked(window.HTMLElement.prototype.scrollIntoView).mock.calls.length).toBe(scrollCount);
    });
    it('preserves unread count when the REST read request fails', async () => {
      setup(10);
      vi.spyOn(adminSupportChatApi, 'getMessages').mockResolvedValue([
        message(60, 'DA_GUI'),
      ]);
      const read = vi
        .spyOn(adminSupportChatApi, 'markMessagesAsRead')
        .mockRejectedValue(new Error('offline'));
      render(<AdminChatMessenger session={mockSession} />);
      fireEvent.click(await screen.findByText('R2 customer'));
      await waitFor(() => expect(read).toHaveBeenCalled());
      expect(screen.getByText('10')).toBeTruthy();
      expect(socketRead).not.toHaveBeenCalled();
    });
    it('bridges more than one page offline to the pre-disconnect watermark and retains realtime messages', async () => {
      setup();
      let reconnecting = false;
      const get = vi
        .spyOn(adminSupportChatApi, 'getMessages')
        .mockImplementation(async (_id, _token, options) => {
          if (!reconnecting)
            return Array.from({ length: 10 }, (_, i) => message(i + 1));
          const before =
            typeof options === 'object' ? (options.beforeId ?? 121) : 121;
          return Array.from({ length: Math.min(50, before - 1) }, (_, i) =>
            message(Math.max(1, before - 50) + i),
          );
        });
      render(<AdminChatMessenger session={mockSession} />);
      fireEvent.click(await screen.findByText('R2 customer'));
      await screen.findByText('R2 message 10');
      reconnecting = true;
      await act(async () => {
        capturedSocketProps.onNewMessage?.({
          ...message(121),
          loaiNguoiGui: 'NHAN_VIEN',
        });
        await capturedSocketProps.onReconnected?.();
      });
      for (let id = 1; id <= 121; id++)
        expect(
          screen.getAllByText(`R2 message ${id}`, { exact: true }).length,
        ).toBeGreaterThanOrEqual(1);
      expect(get).toHaveBeenCalledWith(1, 'mock-admin-token-123', {
        pageSize: 50,
        beforeId: 71,
      });
      expect(get).toHaveBeenCalledWith(1, 'mock-admin-token-123', {
        pageSize: 50,
        beforeId: 21,
      });
    });
  });


  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('F-05: Mobile Responsive Master-Detail Layout', () => {
    it('provides back-to-list navigation button on mobile view and resets selected conversation', async () => {
      const mockConvs = [
        createMockConversation(1, 'Nguyễn Văn A', 'DANG_XU_LY'),
        createMockConversation(2, 'Lê Thị B', 'CHO_TIEP_NHAN'),
      ];

      vi.spyOn(adminSupportChatApi, 'listConversations').mockResolvedValue({
        data: mockConvs,
        meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
      });

      vi.spyOn(adminSupportChatApi, 'getMessages').mockResolvedValue([
        {
          tinNhanId: 101,
          cuocTroChuyenId: 1,
          taiKhoanGuiId: 10,
          loaiNguoiGui: 'KHACH_HANG',
          loaiTinNhan: 'VAN_BAN',
          noiDung: 'Em cần kiểm tra vé ạ',
          trangThai: 'DA_GUI',
          createdAt: '2026-10-16T08:05:00.000Z',
        },
      ]);

      render(<AdminChatMessenger session={mockSession} />);

      // Chờ danh sách cuộc trò chuyện tải xong
      expect(await screen.findByText('Nguyễn Văn A')).toBeTruthy();
      expect(screen.getByText('Lê Thị B')).toBeTruthy();

      // Click chọn cuộc trò chuyện của Nguyễn Văn A
      fireEvent.click(screen.getByText('Nguyễn Văn A'));

      // Xác minh chi tiết cuộc trò chuyện được hiển thị
      expect(await screen.findByText('Em cần kiểm tra vé ạ')).toBeTruthy();

      // Nút quay lại danh sách trên mobile (F-05) phải có trong document
      const backButton = screen.getByTitle('Quay lại danh sách');
      expect(backButton).toBeTruthy();

      // Click nút quay lại danh sách trên mobile
      fireEvent.click(backButton);

      // Sau khi bấm quay lại, màn hình quay về trạng thái chưa chọn cuộc trò chuyện
      await waitFor(() => {
        expect(screen.getByText('Chọn cuộc trò chuyện')).toBeTruthy();
      });
    });
  });

  describe('F-06: Pagination / Load More with > 50 Conversations & Server Search', () => {
    it('displays load more button when totalItems > pageSize and loads next page on click', async () => {
      // Giả lập 20 cuộc trò chuyện đầu tiên trên tổng số 55 cuộc trò chuyện (F-06)
      const firstBatch = Array.from({ length: 20 }, (_, i) =>
        createMockConversation(i + 1, `Khách hàng ${i + 1}`),
      );
      const secondBatch = Array.from({ length: 20 }, (_, i) =>
        createMockConversation(i + 21, `Khách hàng ${i + 21}`),
      );

      const listSpy = vi.spyOn(adminSupportChatApi, 'listConversations').mockImplementation(async (params) => {
        if (params.page === 2) {
          return {
            data: secondBatch,
            meta: { page: 2, pageSize: 20, totalItems: 55, totalPages: 3 },
          };
        }
        return {
          data: firstBatch,
          meta: { page: 1, pageSize: 20, totalItems: 55, totalPages: 3 },
        };
      });

      render(<AdminChatMessenger session={mockSession} />);

      // Chờ danh sách trang 1 hiển thị
      expect(await screen.findByText('Khách hàng 1')).toBeTruthy();
      expect(screen.getByText('Khách hàng 20')).toBeTruthy();

      // Nút Tải thêm cuộc trò chuyện (20/55) phải xuất hiện vì còn trang tiếp theo
      const loadMoreBtn = await screen.findByRole('button', {
        name: /Tải thêm cuộc trò chuyện \(20\/55\)/i,
      });
      expect(loadMoreBtn).toBeTruthy();

      // Click nút Tải thêm
      fireEvent.click(loadMoreBtn);

      // Xác minh API được gọi với page: 2
      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2, pageSize: 20 }),
          'mock-admin-token-123',
        );
      });

      // Xác minh cuộc trò chuyện trang 2 (Khách hàng 21) được nối vào danh sách
      expect(await screen.findByText('Khách hàng 21')).toBeTruthy();
    });

    it('sends search query parameter to server-side search API after debounce', async () => {
      const listSpy = vi.spyOn(adminSupportChatApi, 'listConversations').mockResolvedValue({
        data: [createMockConversation(99, 'Khách Tìm Kiếm')],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      render(<AdminChatMessenger session={mockSession} />);

      const searchInput = screen.getByPlaceholderText('Tìm khách hàng, số điện thoại...');
      fireEvent.change(searchInput, { target: { value: 'Khách Tìm Kiếm' } });

      // Chờ debounce 400ms kích hoạt gọi API với search param
      await waitFor(
        () => {
          expect(listSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              search: 'Khách Tìm Kiếm',
              page: 1,
            }),
            'mock-admin-token-123',
          );
        },
        { timeout: 2000 },
      );
    });
  });

  describe('F-04: Delivery States & Retry Mechanism on Message Send Failure', () => {
    it('marks message as THAT_BAI with retry button when send fails, and successfully retries with the same clientMessageId', async () => {
      const mockConv = createMockConversation(1, 'Khách hàng Cần Hỗ Trợ', 'DANG_XU_LY');

      vi.spyOn(adminSupportChatApi, 'listConversations').mockResolvedValue({
        data: [mockConv],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      vi.spyOn(adminSupportChatApi, 'getMessages').mockResolvedValue([]);

      let sendCount = 0;
      let capturedClientMsgId = '';

      vi.spyOn(adminSupportChatApi, 'sendMessage').mockImplementation(
        async (_convId, content, _token, clientMessageId) => {
          sendCount++;
          capturedClientMsgId = clientMessageId || '';
          if (sendCount === 1) {
            throw new Error('Network error on send message');
          }
          return {
            tinNhanId: 888,
            cuocTroChuyenId: 1,
            taiKhoanGuiId: 10,
            loaiNguoiGui: 'NHAN_VIEN',
            loaiTinNhan: 'VAN_BAN',
            noiDung: content,
            clientMessageId: clientMessageId,
            trangThai: 'DA_GUI',
            createdAt: new Date().toISOString(),
          };
        },
      );

      render(<AdminChatMessenger session={mockSession} />);

      // Chọn cuộc trò chuyện
      fireEvent.click(await screen.findByText('Khách hàng Cần Hỗ Trợ'));

      const input = await screen.findByPlaceholderText('Nhập nội dung phản hồi khách hàng...');
      const sendBtn = screen.getByRole('button', { name: /Gửi/i });

      // Nhập nội dung và gửi lần 1 -> gặp lỗi
      fireEvent.change(input, { target: { value: 'Dạ Phương Trang xin chào bạn!' } });
      fireEvent.click(sendBtn);

      // Xác minh tin nhắn hiển thị trạng thái thất bại và nút "Thử lại" (F-04)
      expect(await screen.findByText('Gửi thất bại')).toBeTruthy();
      const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
      expect(retryBtn).toBeTruthy();

      const initialClientMsgId = capturedClientMsgId;
      expect(initialClientMsgId).toBeTruthy();

      // Bấm nút "Thử lại"
      fireEvent.click(retryBtn);

      // Xác minh gửi lại thành công với đúng cùng clientMessageId ban đầu
      await waitFor(() => {
        expect(sendCount).toBe(2);
      });
      expect(capturedClientMsgId).toBe(initialClientMsgId);

      // Sau khi thử lại thành công, trạng thái "Gửi thất bại" biến mất
      await waitFor(() => {
        expect(screen.queryByText('Gửi thất bại')).toBeNull();
      });
    });
  });

  describe('P1 Finding 1: Mark Messages as Read on Conversation Open and Realtime Inbound Messages', () => {
    it('automatically marks customer unread messages as read when admin opens a conversation', async () => {
      const mockConv = createMockConversation(1, 'Nguyễn Khách', 'DANG_XU_LY');
      mockConv.soTinChuaDoc = 2;

      vi.spyOn(adminSupportChatApi, 'listConversations').mockResolvedValue({
        data: [mockConv],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const unreadCustomerMsgs = [
        {
          tinNhanId: 101,
          cuocTroChuyenId: 1,
          taiKhoanGuiId: 10,
          loaiNguoiGui: 'KHACH_HANG' as const,
          loaiTinNhan: 'VAN_BAN' as const,
          noiDung: 'Tin nhắn 1 chưa đọc',
          trangThai: 'DA_GUI' as const,
          createdAt: '2026-10-16T08:00:00.000Z',
        },
        {
          tinNhanId: 102,
          cuocTroChuyenId: 1,
          taiKhoanGuiId: 10,
          loaiNguoiGui: 'KHACH_HANG' as const,
          loaiTinNhan: 'VAN_BAN' as const,
          noiDung: 'Tin nhắn 2 chưa đọc',
          trangThai: 'DA_GUI' as const,
          createdAt: '2026-10-16T08:01:00.000Z',
        },
      ];

      vi.spyOn(adminSupportChatApi, 'getMessages').mockResolvedValue(unreadCustomerMsgs);
      const markReadSpy = vi.spyOn(adminSupportChatApi, 'markMessagesAsRead').mockResolvedValue({ updatedCount: 2 });

      render(<AdminChatMessenger session={mockSession} />);

      // Chọn cuộc trò chuyện
      fireEvent.click(await screen.findByText('Nguyễn Khách'));

      // Chờ tin nhắn hiển thị
      expect(await screen.findByText('Tin nhắn 1 chưa đọc')).toBeTruthy();

      // Xác minh markMessagesAsRead đã được gọi với ID cuộc trò chuyện và danh sách ID tin nhắn chưa đọc
      await waitFor(() => {
        expect(markReadSpy).toHaveBeenCalledWith(1, 'mock-admin-token-123', [101, 102]);
      });
    });

    it('marks incoming customer message as read immediately when admin has the conversation actively open', async () => {
      const mockConv = createMockConversation(1, 'Trần Khách', 'DANG_XU_LY');

      vi.spyOn(adminSupportChatApi, 'listConversations').mockResolvedValue({
        data: [mockConv],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      vi.spyOn(adminSupportChatApi, 'getMessages').mockResolvedValue([]);
      const markReadSpy = vi.spyOn(adminSupportChatApi, 'markMessagesAsRead').mockResolvedValue({ updatedCount: 1 });

      render(<AdminChatMessenger session={mockSession} />);

      // Chọn cuộc trò chuyện
      fireEvent.click(await screen.findByText('Trần Khách'));
      await screen.findByPlaceholderText('Nhập nội dung phản hồi khách hàng...');

      // Giả lập socket nhận tin nhắn mới từ khách hàng
      expect(capturedSocketProps.onNewMessage).toBeDefined();
      capturedSocketProps.onNewMessage!({
        tinNhanId: 205,
        cuocTroChuyenId: 1,
        taiKhoanGuiId: 10,
        loaiNguoiGui: 'KHACH_HANG',
        loaiTinNhan: 'VAN_BAN',
        noiDung: 'Em mới gửi thêm tin này ạ',
        trangThai: 'DA_GUI',
        createdAt: new Date().toISOString(),
      });

      // Xác minh tin nhắn mới được hiển thị cả trong tin nhắn và preview
      const foundNewMsgs = await screen.findAllByText('Em mới gửi thêm tin này ạ');
      expect(foundNewMsgs.length).toBeGreaterThanOrEqual(1);

      // Xác minh markMessagesAsRead được gọi ngay lập tức cho tin nhắn mới này
      await waitFor(() => {
        expect(markReadSpy).toHaveBeenCalledWith(1, 'mock-admin-token-123', [205]);
      });
    });
  });

  describe('P1 Finding 2: Reconciling Optimistic Messages on Reconnect', () => {
    it('reconciles optimistic THAT_BAI message with confirmed server message', () => {
      const prevMsgs = [
        {
          tinNhanId: -100,
          cuocTroChuyenId: 1,
          taiKhoanGuiId: 10,
          loaiNguoiGui: 'NHAN_VIEN' as const,
          loaiTinNhan: 'VAN_BAN' as const,
          noiDung: 'Chào bạn, mình hỗ trợ nhé',
          clientMessageId: 'staff-client-99',
          trangThai: 'DA_GUI' as const,
          deliveryStatus: 'THAT_BAI' as const,
          createdAt: '2026-10-16T08:00:00.000Z',
        },
      ];

      const serverFreshMsgs = [
        {
          tinNhanId: 501,
          cuocTroChuyenId: 1,
          taiKhoanGuiId: 10,
          loaiNguoiGui: 'NHAN_VIEN' as const,
          loaiTinNhan: 'VAN_BAN' as const,
          noiDung: 'Chào bạn, mình hỗ trợ nhé',
          clientMessageId: 'staff-client-99',
          trangThai: 'DA_GUI' as const,
          createdAt: '2026-10-16T08:00:00.000Z',
        },
      ];

      const reconciled = reconcileAdminMessages(prevMsgs, serverFreshMsgs);
      expect(reconciled).toHaveLength(1);
      expect(reconciled[0].tinNhanId).toBe(501);
      expect(reconciled[0].deliveryStatus).toBe('DA_GUI');
      expect(reconciled[0].clientMessageId).toBe('staff-client-99');
    });
  });

  describe('P2 Finding 3: Controlled Deferred History Fetch Does Not Overwrite Realtime Messages', () => {
    it('preserves realtime message received while old history GET is still pending', async () => {
      const mockConv = createMockConversation(1, 'Phạm Khách', 'DANG_XU_LY');

      vi.spyOn(adminSupportChatApi, 'listConversations').mockResolvedValue({
        data: [mockConv],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      let resolveDeferredGet: (msgs: AdminSupportMessage[]) => void;
      const deferredGetPromise = new Promise<AdminSupportMessage[]>((resolve) => {
        resolveDeferredGet = resolve;
      });

      vi.spyOn(adminSupportChatApi, 'getMessages').mockReturnValue(deferredGetPromise);

      render(<AdminChatMessenger session={mockSession} />);

      // Chọn cuộc trò chuyện (bắt đầu gọi GET getMessages ở T0)
      fireEvent.click(await screen.findByText('Phạm Khách'));

      // T1: Trong lúc GET đang chờ kết quả, socket nhận tin nhắn realtime mới
      expect(capturedSocketProps.onNewMessage).toBeDefined();
      capturedSocketProps.onNewMessage!({
        tinNhanId: 301,
        cuocTroChuyenId: 1,
        taiKhoanGuiId: 10,
        loaiNguoiGui: 'KHACH_HANG',
        loaiTinNhan: 'VAN_BAN',
        noiDung: 'Tin nhắn realtime đến tại T1',
        trangThai: 'DA_GUI',
        createdAt: '2026-10-16T08:05:00.000Z',
      });

      // Xác minh tin nhắn realtime xuất hiện trên màn hình
      const realtimeElements = await screen.findAllByText('Tin nhắn realtime đến tại T1');
      expect(realtimeElements.length).toBeGreaterThanOrEqual(1);

      // T2: Snapshot lịch sử cũ trả về (chỉ chứa tin nhắn trước đó)
      resolveDeferredGet!([
        {
          tinNhanId: 200,
          cuocTroChuyenId: 1,
          taiKhoanGuiId: 10,
          loaiNguoiGui: 'KHACH_HANG',
          loaiTinNhan: 'VAN_BAN',
          noiDung: 'Tin nhắn cũ từ snapshot T0',
          trangThai: 'DA_GUI',
          createdAt: '2026-10-16T08:00:00.000Z',
        },
      ]);

      // Xác minh cả tin nhắn cũ T0 và tin nhắn realtime T1 đều có mặt trong UI (không bị ghi đè/xóa mất)
      expect(await screen.findByText('Tin nhắn cũ từ snapshot T0')).toBeTruthy();
      expect(screen.getAllByText('Tin nhắn realtime đến tại T1').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('P2 Finding 4: Reconnect Slow Guard When Switching Conversations', () => {
    it('does not inject messages of conversation A into conversation B if user switches while reconnect is in-flight', async () => {
      const convA = createMockConversation(1, 'Hội thoại A', 'DANG_XU_LY');
      const convB = createMockConversation(2, 'Hội thoại B', 'DANG_XU_LY');

      vi.spyOn(adminSupportChatApi, 'listConversations').mockResolvedValue({
        data: [convA, convB],
        meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
      });

      let resolveDeferredGetA: (msgs: AdminSupportMessage[]) => void;
      const deferredGetAPromise = new Promise<AdminSupportMessage[]>((resolve) => {
        resolveDeferredGetA = resolve;
      });

      vi.spyOn(adminSupportChatApi, 'getConversationById').mockResolvedValue(convA);

      vi.spyOn(adminSupportChatApi, 'getMessages').mockImplementation(async (convId) => {
        if (convId === 1) {
          return deferredGetAPromise;
        }
        return [
          {
            tinNhanId: 902,
            cuocTroChuyenId: 2,
            taiKhoanGuiId: 20,
            loaiNguoiGui: 'KHACH_HANG',
            loaiTinNhan: 'VAN_BAN',
            noiDung: 'Nội dung hội thoại B',
            trangThai: 'DA_GUI',
            createdAt: '2026-10-16T08:00:00.000Z',
          },
        ];
      });

      render(<AdminChatMessenger session={mockSession} />);

      // Chọn hội thoại A
      fireEvent.click(await screen.findByText('Hội thoại A'));

      // Kích hoạt reconnect cho hội thoại A trong khi getMessages(1) đang pending
      capturedSocketProps.onReconnected!();

      // Nhân viên nhanh chóng chuyển sang hội thoại B
      fireEvent.click(screen.getByText('Hội thoại B'));

      // Chờ hội thoại B hiển thị tin nhắn của nó
      expect(await screen.findByText('Nội dung hội thoại B')).toBeTruthy();

      // Lúc này request reconnect của A mới resolve
      resolveDeferredGetA!([
        {
          tinNhanId: 901,
          cuocTroChuyenId: 1,
          taiKhoanGuiId: 10,
          loaiNguoiGui: 'KHACH_HANG',
          loaiTinNhan: 'VAN_BAN',
          noiDung: 'Nội dung rò rỉ của hội thoại A',
          trangThai: 'DA_GUI',
          createdAt: '2026-10-16T08:00:00.000Z',
        },
      ]);

      // Xác minh tin nhắn của hội thoại A KHÔNG bị chèn vào khung chat của hội thoại B
      await waitFor(() => {
        expect(screen.queryByText('Nội dung rò rỉ của hội thoại A')).toBeNull();
      });
      expect(screen.getByText('Nội dung hội thoại B')).toBeTruthy();
    });
  });

  describe('Browser QA: realtime conversation discovery preserves server filters', () => {
    it('refreshes the current search and status filter when a new conversation event arrives', async () => {
      const matching = createMockConversation(81, 'Khớp khách mới', 'CHO_TIEP_NHAN');
      const excluded = createMockConversation(82, 'Không được chèn từ socket', 'DA_DONG');
      let createdOnServer = false;
      const listSpy = vi.spyOn(adminSupportChatApi, 'listConversations').mockImplementation(async (params) => {
        const matchesCurrentFilter = params.search === 'Khớp' && params.trangThai === 'CHO_TIEP_NHAN';
        const data = createdOnServer && matchesCurrentFilter ? [matching] : [];
        return { data, meta: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1 } };
      });
      render(<AdminChatMessenger session={mockSession} />);
      await waitFor(() => expect(listSpy).toHaveBeenCalled());
      fireEvent.click(screen.getByRole('button', { name: 'Chờ nhận' }));
      fireEvent.change(screen.getByPlaceholderText('Tìm khách hàng, số điện thoại...'), { target: { value: 'Khớp' } });
      await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Khớp', trangThai: 'CHO_TIEP_NHAN', page: 1 }),
        'mock-admin-token-123',
      ));
      const beforeEvent = listSpy.mock.calls.length;
      createdOnServer = true;
      expect(capturedSocketProps.onNewConversation).toBeTypeOf('function');
      act(() => capturedSocketProps.onNewConversation!(excluded));
      expect(await screen.findByText('Khớp khách mới')).toBeTruthy();
      expect(listSpy.mock.calls.length).toBeGreaterThan(beforeEvent);
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Khớp', trangThai: 'CHO_TIEP_NHAN', page: 1, pageSize: 20 }),
        'mock-admin-token-123',
      );
      expect(screen.queryByText('Không được chèn từ socket')).toBeNull();
    });

    it('discovers an unknown incoming conversation through an authoritative list refetch', async () => {
      const known = createMockConversation(1, 'Khách hiện có', 'DANG_XU_LY');
      const discovered = createMockConversation(2, 'Khách mới được phát hiện', 'CHO_TIEP_NHAN');
      let messageArrived = false;
      const listSpy = vi.spyOn(adminSupportChatApi, 'listConversations').mockImplementation(async () => {
        const data = messageArrived ? [discovered, known] : [known];
        return { data, meta: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1 } };
      });
      render(<AdminChatMessenger session={mockSession} />);
      expect(await screen.findByText('Khách hiện có')).toBeTruthy();
      expect(screen.queryByText('Khách mới được phát hiện')).toBeNull();
      const beforeEvent = listSpy.mock.calls.length;
      messageArrived = true;
      act(() => capturedSocketProps.onNewMessage!({
        tinNhanId: 8802,
        cuocTroChuyenId: 2,
        taiKhoanGuiId: 20,
        loaiNguoiGui: 'KHACH_HANG',
        loaiTinNhan: 'VAN_BAN',
        noiDung: 'Tin đầu của hội thoại chưa có trong danh sách',
        trangThai: 'DA_GUI',
        createdAt: '2026-10-21T00:10:00.000Z',
      }));
      expect(await screen.findByText('Khách mới được phát hiện')).toBeTruthy();
      expect(screen.getByText('Khách hiện có')).toBeTruthy();
      expect(listSpy.mock.calls.length).toBeGreaterThan(beforeEvent);
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 }), 'mock-admin-token-123',
      );
    });

    it('ignores a late old-search list after realtime refresh of the new search', async () => {
      type ListResponse = Awaited<ReturnType<typeof adminSupportChatApi.listConversations>>;
      let resolveOld!: (response: ListResponse) => void;
      const oldSearch = new Promise<ListResponse>((resolve) => { resolveOld = resolve; });
      const current = createMockConversation(90, 'Kết quả tìm kiếm mới', 'DANG_XU_LY');
      const stale = createMockConversation(91, 'Kết quả cũ phải bỏ qua', 'DANG_XU_LY');
      const listSpy = vi.spyOn(adminSupportChatApi, 'listConversations').mockImplementation(async (params) => {
        if (params.search === 'cũ') return oldSearch;
        const data = params.search === 'mới' ? [current] : [];
        return { data, meta: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1 } };
      });
      render(<AdminChatMessenger session={mockSession} />);
      await waitFor(() => expect(listSpy).toHaveBeenCalled());
      const input = screen.getByPlaceholderText('Tìm khách hàng, số điện thoại...');
      fireEvent.change(input, { target: { value: 'cũ' } });
      await waitFor(() => expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'cũ' }), 'mock-admin-token-123',
      ));
      fireEvent.change(input, { target: { value: 'mới' } });
      expect(await screen.findByText('Kết quả tìm kiếm mới')).toBeTruthy();
      const beforeEvent = listSpy.mock.calls.length;
      act(() => capturedSocketProps.onNewConversation!(current));
      await waitFor(() => expect(listSpy.mock.calls.length).toBeGreaterThan(beforeEvent));
      await act(async () => {
        resolveOld({ data: [stale], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } });
        await oldSearch;
      });
      expect(screen.getByText('Kết quả tìm kiếm mới')).toBeTruthy();
      expect(screen.queryByText('Kết quả cũ phải bỏ qua')).toBeNull();
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'mới', page: 1 }), 'mock-admin-token-123',
      );
    });
  });


  describe('Browser QA: staff read-receipt ownership', () => {
    it('ignores the admin own read receipt and marks only customer-confirmed outgoing IDs as read', async () => {
      const conversation = createMockConversation(1, 'Khách đọc phản hồi', 'DANG_XU_LY');
      vi.spyOn(adminSupportChatApi, 'listConversations').mockResolvedValue({
        data: [conversation], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });
      vi.spyOn(adminSupportChatApi, 'getMessages').mockResolvedValue([
        {
          tinNhanId: 901, cuocTroChuyenId: 1, taiKhoanGuiId: mockSession.accountId,
          loaiNguoiGui: 'NHAN_VIEN', loaiTinNhan: 'VAN_BAN',
          noiDung: 'Phản hồi thứ nhất của nhân viên', trangThai: 'DA_GUI',
          createdAt: '2026-10-21T00:10:00.000Z',
        },
        {
          tinNhanId: 902, cuocTroChuyenId: 1, taiKhoanGuiId: mockSession.accountId,
          loaiNguoiGui: 'NHAN_VIEN', loaiTinNhan: 'VAN_BAN',
          noiDung: 'Phản hồi thứ hai của nhân viên', trangThai: 'DA_GUI',
          createdAt: '2026-10-21T00:11:00.000Z',
        },
      ]);
      render(<AdminChatMessenger session={mockSession} />);
      fireEvent.click(await screen.findByText('Khách đọc phản hồi'));
      const first = (await screen.findByText('Phản hồi thứ nhất của nhân viên')).parentElement!;
      const second = screen.getByText('Phản hồi thứ hai của nhân viên').parentElement!;
      expect(within(first).getByText('Đã gửi')).toBeTruthy();
      expect(within(second).getByText('Đã gửi')).toBeTruthy();

      // This event means the admin read inbound messages, not that the customer read replies.
      act(() => capturedSocketProps.onMessagesReadReceipt!({
        cuocTroChuyenId: 1, readByTaiKhoanId: mockSession.accountId, updatedCount: 1,
      }));
      expect(within(first).queryByText('Đã đọc')).toBeNull();
      expect(within(second).queryByText('Đã đọc')).toBeNull();
      expect(screen.getAllByText('Đã gửi')).toHaveLength(2);

      act(() => capturedSocketProps.onMessagesReadReceipt!({
        cuocTroChuyenId: 1, readByTaiKhoanId: 20, tinNhanIds: [901], updatedCount: 1,
      }));
      expect(within(first).getByText('Đã đọc')).toBeTruthy();
      expect(within(second).getByText('Đã gửi')).toBeTruthy();
      expect(within(second).queryByText('Đã đọc')).toBeNull();

      act(() => capturedSocketProps.onMessagesReadReceipt!({
        cuocTroChuyenId: 2, readByTaiKhoanId: 20, tinNhanIds: [902], updatedCount: 1,
      }));
      expect(within(second).getByText('Đã gửi')).toBeTruthy();
    });
  });

});
