import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupportChatGateway } from '../../../src/support-chat/support-chat.gateway.js';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { EffectiveRolePermissionLoaderService } from '../../../src/auth/permissions/effective-role-permission-loader.service.js';
import type { PermissionResolverService } from '../../../src/auth/permissions/permission-resolver.service.js';
import type { SupportChatService } from '../../../src/support-chat/support-chat.service.js';
import { CHAT_EVENTS } from '../../../src/support-chat/constants/chat-events.constants.js';

describe('SupportChatGateway', () => {
  let gateway: SupportChatGateway;
  let jwtService: any;
  let configService: any;
  let prisma: any;
  let permissionLoader: any;
  let permissionResolver: any;
  let supportChatService: any;

  beforeEach(() => {
    jwtService = {
      verifyAsync: vi.fn(),
    };

    configService = {
      get: vi.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'super-secret-jwt-key-for-test-32bytes!';
        return null;
      }),
    };

    prisma = {
      phienDangNhap: {
        findUnique: vi.fn(),
      },
    };

    permissionLoader = {
      load: vi.fn().mockResolvedValue([]),
    };

    permissionResolver = {
      resolve: vi.fn().mockReturnValue([]),
    };

    supportChatService = {
      ensureKhachHang: vi.fn().mockResolvedValue({ khachHangId: 50 }),
      getConversationById: vi.fn(),
      sendMessage: vi.fn(),
      claimConversation: vi.fn(),
      closeConversation: vi.fn(),
      markMessagesAsRead: vi.fn(),
    };

    gateway = new SupportChatGateway(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
      permissionLoader as unknown as EffectiveRolePermissionLoaderService,
      permissionResolver as unknown as PermissionResolverService,
      supportChatService as unknown as SupportChatService,
    );

    gateway.server = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as any;
  });

  function createMockSocket(auth?: Record<string, any>, headers?: Record<string, any>) {
    return {
      handshake: {
        auth: auth || {},
        headers: headers || {},
      },
      data: {},
      emit: vi.fn(),
      disconnect: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      to: vi.fn().mockReturnThis(),
    } as any;
  }

  describe('handleConnection Authentication & Permissions', () => {
    it('ngắt kết nối nếu không có token trong handshake auth hoặc headers', async () => {
      const client = createMockSocket();

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(CHAT_EVENTS.SUPPORT_ERROR, {
        error: 'AUTH_REQUIRED',
        message: 'Yêu cầu token xác thực để kết nối chat hỗ trợ.',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('ngắt kết nối nếu JWT verify thất bại', async () => {
      const client = createMockSocket({ token: 'invalid-token' });
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid signature'));

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(CHAT_EVENTS.SUPPORT_ERROR, {
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Token xác thực không hợp lệ hoặc đã hết hạn.',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('ngắt kết nối nếu phiên đăng nhập bị thu hồi hoặc đã hết hạn', async () => {
      const client = createMockSocket({ token: 'valid-token' });
      jwtService.verifyAsync.mockResolvedValue({ sub: 101, sid: 'session-101', roles: ['KHACH_HANG'] });
      prisma.phienDangNhap.findUnique.mockResolvedValue({
        taiKhoanId: 101,
        thuHoiLuc: new Date(), // đã bị thu hồi
        hetHanLuc: new Date(Date.now() + 10000),
        taiKhoan: { trangThai: 'HOAT_DONG' },
      });

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(CHAT_EVENTS.SUPPORT_ERROR, {
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Phiên đăng nhập không hợp lệ hoặc đã bị thu hồi.',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('LEAD RULE: SUPER_ADMIN tuyệt đối bị từ chối kết nối WebSocket chat CSKH', async () => {
      const client = createMockSocket({ token: 'admin-token' });
      jwtService.verifyAsync.mockResolvedValue({ sub: 1, sid: 'session-admin', roles: ['SUPER_ADMIN'] });
      prisma.phienDangNhap.findUnique.mockResolvedValue({
        taiKhoanId: 1,
        sessionId: 'session-admin',
        thuHoiLuc: null,
        hetHanLuc: new Date(Date.now() + 100000),
        taiKhoan: {
          taiKhoanId: 1,
          trangThai: 'HOAT_DONG',
          nhanVien: null,
          taiKhoanVaiTros: [{ vaiTro: { vaiTroId: 1, tenVaiTro: 'SUPER_ADMIN' } }],
        },
      });

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(CHAT_EVENTS.SUPPORT_ERROR, {
        error: 'SUPER_ADMIN_NOT_ALLOWED',
        message: 'Tài khoản Quản trị hệ thống không được phép tham gia chat CSKH.',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('từ chối nhân viên nhà xe nếu không có quyền chat:read hoặc chat:manage', async () => {
      const client = createMockSocket({ token: 'staff-token' });
      jwtService.verifyAsync.mockResolvedValue({ sub: 201, sid: 'session-staff', roles: ['NHAN_VIEN_DIEU_HANH'] });
      prisma.phienDangNhap.findUnique.mockResolvedValue({
        taiKhoanId: 201,
        sessionId: 'session-staff',
        thuHoiLuc: null,
        hetHanLuc: new Date(Date.now() + 100000),
        taiKhoan: {
          taiKhoanId: 201,
          trangThai: 'HOAT_DONG',
          nhanVien: { nhanVienId: 10, nhaXeId: 5 },
          taiKhoanVaiTros: [{ vaiTro: { vaiTroId: 2, tenVaiTro: 'NHAN_VIEN_DIEU_HANH' } }],
        },
      });
      permissionResolver.resolve.mockReturnValue(['trip:read']); // Không có chat:read hay chat:manage

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(CHAT_EVENTS.SUPPORT_ERROR, {
        error: 'CHAT_PERMISSION_DENIED',
        message: 'Tài khoản nhân viên không có quyền truy cập chức năng chat CSKH.',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('kết nối thành công cho Khách hàng và tham gia room cá nhân user_{taiKhoanId}', async () => {
      const client = createMockSocket({ token: 'customer-token' });
      jwtService.verifyAsync.mockResolvedValue({ sub: 101, sid: 'session-customer', roles: ['KHACH_HANG'] });
      prisma.phienDangNhap.findUnique.mockResolvedValue({
        taiKhoanId: 101,
        sessionId: 'session-customer',
        thuHoiLuc: null,
        hetHanLuc: new Date(Date.now() + 100000),
        taiKhoan: {
          taiKhoanId: 101,
          trangThai: 'HOAT_DONG',
          nhanVien: null,
          taiKhoanVaiTros: [{ vaiTro: { vaiTroId: 3, tenVaiTro: 'KHACH_HANG' } }],
        },
      });

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('user_101');
      expect(client.emit).toHaveBeenCalledWith(CHAT_EVENTS.SUPPORT_CONNECTED, expect.objectContaining({
        taiKhoanId: 101,
        khachHangId: 50,
      }));
    });

    it('kết nối thành công cho Nhân viên có quyền và tham gia cả user_{taiKhoanId} và company_{nhaXeId}', async () => {
      const client = createMockSocket({ token: 'staff-token' });
      jwtService.verifyAsync.mockResolvedValue({ sub: 202, sid: 'session-staff-cskh', roles: ['NHAN_VIEN_CSKH'] });
      prisma.phienDangNhap.findUnique.mockResolvedValue({
        taiKhoanId: 202,
        sessionId: 'session-staff-cskh',
        thuHoiLuc: null,
        hetHanLuc: new Date(Date.now() + 100000),
        taiKhoan: {
          taiKhoanId: 202,
          trangThai: 'HOAT_DONG',
          nhanVien: { nhanVienId: 12, nhaXeId: 5 },
          taiKhoanVaiTros: [{ vaiTro: { vaiTroId: 4, tenVaiTro: 'NHAN_VIEN_CSKH' } }],
        },
      });
      permissionResolver.resolve.mockReturnValue(['chat:read', 'chat:manage']);

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('user_202');
      expect(client.join).toHaveBeenCalledWith('company_5');
      expect(client.emit).toHaveBeenCalledWith(CHAT_EVENTS.SUPPORT_CONNECTED, expect.objectContaining({
        taiKhoanId: 202,
        nhaXeId: 5,
      }));
    });
  });

  describe('WebSocket Event Handlers', () => {
    it('handleJoinConversation cho phép client tham gia room conversation_{id}', async () => {
      const client = createMockSocket();
      client.data = {
        principal: { taiKhoanId: 101, roles: ['KHACH_HANG'] },
      };
      supportChatService.getConversationById.mockResolvedValue({
        cuocTroChuyenId: 10,
      });

      const res = await gateway.handleJoinConversation(client, { cuocTroChuyenId: 10 });

      expect(client.join).toHaveBeenCalledWith('conversation_10');
      expect(res).toEqual({ success: true, cuocTroChuyenId: 10 });
    });

    it('handleSendMessage lưu tin nhắn và broadcast tới room conversation_{id}', async () => {
      const client = createMockSocket();
      client.data = {
        principal: { taiKhoanId: 101, roles: ['KHACH_HANG'] },
      };
      const msg = {
        tinNhanId: 1,
        cuocTroChuyenId: 10,
        noiDung: 'Xin chào',
        loaiNguoiGui: 'KHACH_HANG',
      };
      supportChatService.sendMessage.mockResolvedValue(msg);
      supportChatService.getConversationById.mockResolvedValue({
        cuocTroChuyenId: 10,
        nhaXeId: 5,
      });

      const res = await gateway.handleSendMessage(client, {
        cuocTroChuyenId: 10,
        noiDung: 'Xin chào',
      });

      expect(gateway.server.to).toHaveBeenCalledWith('conversation_10');
      expect(gateway.server.emit).toHaveBeenCalledWith(CHAT_EVENTS.MESSAGE_NEW, msg);
      expect(res).toEqual({ success: true, data: msg });
    });

    it('handleTypingStatus broadcast trạng thái gõ cho đối phương trong cùng room', async () => {
      const client = createMockSocket();
      client.data = {
        principal: { taiKhoanId: 101 },
      };

      const res = await gateway.handleTypingStatus(client, {
        cuocTroChuyenId: 10,
        isTyping: true,
      });

      expect(client.to).toHaveBeenCalledWith('conversation_10');
      expect(client.to().emit).toHaveBeenCalledWith(CHAT_EVENTS.TYPING_STATUS, {
        cuocTroChuyenId: 10,
        taiKhoanId: 101,
        isTyping: true,
      });
      expect(res).toEqual({ success: true });
    });
  });
});
