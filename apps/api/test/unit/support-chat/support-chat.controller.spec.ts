import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupportChatController } from '../../../src/support-chat/support-chat.controller.js';
import type { SupportChatService } from '../../../src/support-chat/support-chat.service.js';
import type { SupportChatGateway } from '../../../src/support-chat/support-chat.gateway.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

describe('SupportChatController', () => {
  let controller: SupportChatController;
  let service: any;
  let gateway: any;

  const mockCustomer: AuthPrincipal = {
    taiKhoanId: 101,
    sessionId: 'session-101',
    roles: ['KHACH_HANG'],
    permissions: [],
    nhanVienId: null,
    nhaXeId: null,
  };

  const mockStaff: AuthPrincipal = {
    taiKhoanId: 202,
    sessionId: 'session-202',
    roles: ['NHAN_VIEN_CSKH'],
    permissions: ['chat:read', 'chat:manage'],
    nhanVienId: 12,
    nhaXeId: 5,
  };

  beforeEach(() => {
    service = {
      createConversation: vi.fn(),
      listConversations: vi.fn(),
      getConversationById: vi.fn(),
      getActiveConversation: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn(),
      claimConversation: vi.fn(),
      closeConversation: vi.fn(),
      markMessagesAsRead: vi.fn(),
    };

    gateway = {
      server: {
        to: vi.fn().mockReturnThis(),
        emit: vi.fn(),
      },
    };

    controller = new SupportChatController(
      service as unknown as SupportChatService,
      gateway as unknown as SupportChatGateway,
    );
  });

  it('createConversation gọi chatService.createConversation và emit sự kiện tới room nhà xe khi isNew = true', async () => {
    const mockCreated = {
      cuocTroChuyenId: 1,
      maCuocTroChuyen: 'CHAT-001',
      tieuDe: 'Hỗ trợ',
      nhaXeId: 5,
      khachHang: { khachHangId: 50 },
    };
    service.createConversation.mockResolvedValue({
      conversation: mockCreated,
      isNew: true,
      firstMessage: null,
    });

    const result = await controller.createConversation(mockCustomer, {
      nhaXeId: 5,
      tinNhanDauTien: 'Xin chào',
    });

    expect(service.createConversation).toHaveBeenCalledWith(mockCustomer, {
      nhaXeId: 5,
      tinNhanDauTien: 'Xin chào',
    });
    expect(gateway.server.to).toHaveBeenCalledWith('company_5');
    expect(result).toEqual(mockCreated);
  });

  it('createConversation không emit CONVERSATION_NEW nếu cuộc trò chuyện đã tồn tại trước đó (isNew = false)', async () => {
    const mockExisting = {
      cuocTroChuyenId: 1,
      maCuocTroChuyen: 'CHAT-001',
      tieuDe: 'Hỗ trợ',
      nhaXeId: 5,
      khachHang: { khachHangId: 50 },
    };
    service.createConversation.mockResolvedValue({
      conversation: mockExisting,
      isNew: false,
      firstMessage: null,
    });

    const result = await controller.createConversation(mockCustomer, {
      nhaXeId: 5,
    });

    expect(gateway.server.to).not.toHaveBeenCalled();
    expect(result).toEqual(mockExisting);
  });

  it('createConversation emit MESSAGE_NEW khi có firstMessage được tạo kèm theo', async () => {
    const mockCreated = {
      cuocTroChuyenId: 1,
      maCuocTroChuyen: 'CHAT-001',
      tieuDe: 'Hỗ trợ',
      nhaXeId: 5,
      khachHang: { khachHangId: 50 },
    };
    const mockMsg = {
      tinNhanId: 10,
      cuocTroChuyenId: 1,
      noiDung: 'Xin chào',
      loaiNguoiGui: 'KHACH_HANG',
    };
    service.createConversation.mockResolvedValue({
      conversation: mockCreated,
      isNew: true,
      firstMessage: mockMsg,
    });

    const result = await controller.createConversation(mockCustomer, {
      nhaXeId: 5,
      tinNhanDauTien: 'Xin chào',
    });

    expect(gateway.server.to).toHaveBeenCalledWith('company_5');
    expect(gateway.server.to).toHaveBeenCalledWith('conversation_1');
    expect(result).toEqual(mockCreated);
  });

  it('listConversations gọi chatService.listConversations với query và principal', async () => {
    const mockList = {
      data: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    };
    service.listConversations.mockResolvedValue(mockList);

    const query = { page: 1, pageSize: 20 };
    const result = await controller.listConversations(mockStaff, query);
    expect(service.listConversations).toHaveBeenCalledWith(mockStaff, query);
    expect(result).toEqual(mockList);
  });

  it('getConversationById gọi chatService.getConversationById', async () => {
    const mockConv = { cuocTroChuyenId: 10 };
    service.getConversationById.mockResolvedValue(mockConv);

    const result = await controller.getConversationById(mockStaff, 10);
    expect(service.getConversationById).toHaveBeenCalledWith(mockStaff, 10);
    expect(result).toEqual(mockConv);
  });

  it('sendMessage gọi chatService.sendMessage và broadcast tin nhắn mới tới room cuộc trò chuyện', async () => {
    const mockMsg = {
      tinNhanId: 1,
      cuocTroChuyenId: 10,
      noiDung: 'Chào bạn',
      loaiNguoiGui: 'NHAN_VIEN',
    };
    service.sendMessage.mockResolvedValue(mockMsg);
    service.getConversationById.mockResolvedValue({
      cuocTroChuyenId: 10,
      nhaXeId: 5,
    });

    const result = await controller.sendMessage(mockStaff, 10, {
      noiDung: 'Chào bạn',
    });

    expect(service.sendMessage).toHaveBeenCalledWith(mockStaff, {
      cuocTroChuyenId: 10,
      noiDung: 'Chào bạn',
    });
    expect(gateway.server.to).toHaveBeenCalledWith('conversation_10');
    expect(result).toEqual(mockMsg);
  });

  it('claimConversation gọi chatService.claimConversation và broadcast CLAIMED', async () => {
    const mockUpdated = {
      cuocTroChuyenId: 10,
      trangThai: 'DANG_XU_LY',
      nhaXeId: 5,
    };
    service.claimConversation.mockResolvedValue(mockUpdated);

    const result = await controller.claimConversation(mockStaff, 10);

    expect(service.claimConversation).toHaveBeenCalledWith(mockStaff, 10);
    expect(gateway.server.to).toHaveBeenCalledWith('conversation_10');
    expect(gateway.server.to).toHaveBeenCalledWith('company_5');
    expect(result).toEqual(mockUpdated);
  });

  it('closeConversation gọi chatService.closeConversation và broadcast CLOSED', async () => {
    const mockClosed = {
      cuocTroChuyenId: 10,
      trangThai: 'DA_DONG',
      nhaXeId: 5,
    };
    service.closeConversation.mockResolvedValue(mockClosed);

    const result = await controller.closeConversation(mockStaff, 10, {
      lyDo: 'Xong',
    });

    expect(service.closeConversation).toHaveBeenCalledWith(mockStaff, 10, {
      lyDo: 'Xong',
    });
    expect(gateway.server.to).toHaveBeenCalledWith('conversation_10');
    expect(gateway.server.to).toHaveBeenCalledWith('company_5');
    expect(result).toEqual(mockClosed);
  });

  it('markAsRead gọi chatService.markMessagesAsRead và broadcast READ_RECEIPT', async () => {
    service.markMessagesAsRead.mockResolvedValue({ updatedCount: 2 });

    const result = await controller.markAsRead(mockCustomer, 10, {
      tinNhanIds: [1, 2],
    });

    expect(service.markMessagesAsRead).toHaveBeenCalledWith(mockCustomer, 10, {
      tinNhanIds: [1, 2],
    });
    expect(gateway.server.to).toHaveBeenCalledWith('conversation_10');
    expect(result).toEqual({ updatedCount: 2 });
  });
});
