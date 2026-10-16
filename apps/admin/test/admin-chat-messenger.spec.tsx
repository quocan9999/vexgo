// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { AdminChatMessenger } from '../src/features/support-chat/components/admin-chat-messenger';
import { adminSupportChatApi } from '../src/features/support-chat/services/admin-support-chat.api';
import type { AdminSession } from '../src/features/admin-auth/services/admin-auth';

vi.mock('@/features/admin-auth/services/admin-auth', () => ({
  getAdminAccessToken: () => 'mock-admin-token-123',
}));

vi.mock('../src/features/support-chat/hooks/use-admin-chat-socket', () => ({
  useAdminChatSocket: () => ({
    isConnected: true,
    customerTyping: false,
    sendMessage: vi.fn().mockResolvedValue({ success: false, error: 'SOCKET_TIMEOUT' }),
    claimConversation: vi.fn().mockResolvedValue({ success: true }),
    closeConversation: vi.fn().mockResolvedValue({ success: true }),
    emitTyping: vi.fn(),
  }),
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

const createMockConversation = (id: number, name: string, status = 'CHO_TIEP_NHAN') => ({
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
});
