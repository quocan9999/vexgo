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
    const rooms = new Set<string>();
    return {
      handshake: {
        auth: auth || {},
        headers: headers || {},
      },
      data: {},
      rooms,
      emit: vi.fn(),
      disconnect: vi.fn(),
      join: vi.fn().mockImplementation((r: string) => {
        rooms.add(r);
        return Promise.resolve();
      }),
      leave: vi.fn().mockImplementation((r: string) => {
        rooms.delete(r);
        return Promise.resolve();
      }),
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

      expect(client.join).toHaveBeenCalledWith('session_session-customer');
      expect(client.join).toHaveBeenCalledWith('user_101');
      expect(client.emit).toHaveBeenCalledWith(CHAT_EVENTS.SUPPORT_CONNECTED, expect.objectContaining({
        taiKhoanId: 101,
        khachHangId: 50,
      }));
    });

    it('kết nối thành công cho Nhân viên có quyền và tham gia cả session_{sessionId}, user_{taiKhoanId} và company_{nhaXeId}', async () => {
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

      expect(client.join).toHaveBeenCalledWith('session_session-staff-cskh');
      expect(client.join).toHaveBeenCalledWith('user_202');
      expect(client.join).toHaveBeenCalledWith('company_5');
      expect(client.emit).toHaveBeenCalledWith(CHAT_EVENTS.SUPPORT_CONNECTED, expect.objectContaining({
        taiKhoanId: 202,
        nhaXeId: 5,
      }));
    });
  });

  describe('WebSocket Event Handlers', () => {
    beforeEach(() => {
      prisma.phienDangNhap.findUnique.mockResolvedValue({
        sessionId: 'test-session-123',
        taiKhoanId: 101,
        thuHoiLuc: null,
        hetHanLuc: new Date(Date.now() + 3600000),
        taiKhoan: {
          taiKhoanId: 101,
          trangThai: 'HOAT_DONG',
          nhanVien: null,
          taiKhoanVaiTros: [
            {
              vaiTro: {
                vaiTroId: 1,
                tenVaiTro: 'KHACH_HANG',
              },
            },
          ],
        },
      });
    });

    it('handleJoinConversation cho phép client tham gia room conversation_{id}', async () => {
      const client = createMockSocket();
      client.data = {
        principal: { taiKhoanId: 101, sessionId: 'test-session-123', roles: ['KHACH_HANG'] },
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
        principal: { taiKhoanId: 101, sessionId: 'test-session-123', roles: ['KHACH_HANG'] },
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
        principal: { taiKhoanId: 101, sessionId: 'test-session-123' },
      };
      // Giả lập client đã trong room
      client.rooms.add('conversation_10');

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

    it('rời khỏi company room cũ và toàn bộ conversation room khi nhân viên thay đổi nhaXeId (BE-R01)', async () => {
      const client = createMockSocket();
      client.data = {
        principal: {
          taiKhoanId: 202,
          sessionId: 'test-session-staff',
          roles: ['NHAN_VIEN_CSKH'],
          nhanVienId: 12,
          nhaXeId: 5,
        },
      };
      // Giả lập client đang ở company room 5 và 2 conversation rooms thuộc nhaXe 5
      client.rooms.add('company_5');
      client.rooms.add('conversation_10');
      client.rooms.add('conversation_11');

      // Database phản hồi nhân viên đã được chuyển sang nhaXeId: 9
      prisma.phienDangNhap.findUnique.mockResolvedValue({
        sessionId: 'test-session-staff',
        taiKhoanId: 202,
        thuHoiLuc: null,
        hetHanLuc: new Date(Date.now() + 3600000),
        taiKhoan: {
          taiKhoanId: 202,
          trangThai: 'HOAT_DONG',
          nhanVien: { nhanVienId: 12, nhaXeId: 9 },
          taiKhoanVaiTros: [{ vaiTro: { vaiTroId: 4, tenVaiTro: 'NHAN_VIEN_CSKH' } }],
        },
      });
      permissionResolver.resolve.mockReturnValue(['chat:read', 'chat:manage']);
      supportChatService.getConversationById.mockResolvedValue({ cuocTroChuyenId: 99 });

      // Gọi handleJoinConversation cho conversation mới thuộc tenant 9
      await gateway.handleJoinConversation(client, { cuocTroChuyenId: 99 });

      // Phải rời company_5
      expect(client.leave).toHaveBeenCalledWith('company_5');
      // Phải rời toàn bộ conversation_* cũ
      expect(client.leave).toHaveBeenCalledWith('conversation_10');
      expect(client.leave).toHaveBeenCalledWith('conversation_11');
      // Phải tham gia company_9 và conversation_99
      expect(client.join).toHaveBeenCalledWith('company_9');
      expect(client.join).toHaveBeenCalledWith('conversation_99');
    });

    it('handleTypingStatus kiểm tra quyền getConversationById và từ chối emit nếu không có quyền (BE-R01)', async () => {
      const client = createMockSocket();
      client.data = {
        principal: { taiKhoanId: 101, sessionId: 'test-session-123' },
      };
      client.rooms.add('conversation_10');

      // Giả lập getConversationById từ chối (404/403)
      supportChatService.getConversationById.mockRejectedValue(new Error('Forbidden'));

      const res = await gateway.handleTypingStatus(client, {
        cuocTroChuyenId: 10,
        isTyping: true,
      });

      expect(supportChatService.getConversationById).toHaveBeenCalledWith(
        expect.objectContaining({ taiKhoanId: 101 }),
        10,
      );
      expect(client.to).not.toHaveBeenCalled();
      expect(res).toEqual({ success: false });
    });

    it('invalidateSession chỉ ngắt kết nối socket thuộc đúng session bị thu hồi, giữ nguyên session khác của cùng tài khoản (BE-R01/RT-04)', async () => {
      const socketSession1 = createMockSocket({ token: 'tok-1' });
      const socketSession2 = createMockSocket({ token: 'tok-2' });

      jwtService.verifyAsync
        .mockResolvedValueOnce({ sub: 202, sid: 'sess-1', roles: ['NHAN_VIEN_CSKH'] })
        .mockResolvedValueOnce({ sub: 202, sid: 'sess-2', roles: ['NHAN_VIEN_CSKH'] });

      prisma.phienDangNhap.findUnique
        .mockResolvedValueOnce({
          taiKhoanId: 202,
          sessionId: 'sess-1',
          thuHoiLuc: null,
          hetHanLuc: new Date(Date.now() + 100000),
          taiKhoan: {
            taiKhoanId: 202,
            trangThai: 'HOAT_DONG',
            nhanVien: { nhanVienId: 12, nhaXeId: 5 },
            taiKhoanVaiTros: [{ vaiTro: { vaiTroId: 4, tenVaiTro: 'NHAN_VIEN_CSKH' } }],
          },
        })
        .mockResolvedValueOnce({
          taiKhoanId: 202,
          sessionId: 'sess-2',
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

      await gateway.handleConnection(socketSession1);
      await gateway.handleConnection(socketSession2);

      await gateway.invalidateSession('sess-1');

      expect(socketSession1.disconnect).toHaveBeenCalledWith(true);
      expect(socketSession1.rooms.has('company_5')).toBe(false);
      expect(socketSession2.disconnect).not.toHaveBeenCalled();
      expect(socketSession2.rooms.has('company_5')).toBe(true);
    });

    it('emitMessageNew tự động kiểm tra lại và loại bỏ socket có quyền đã bị thu hồi hoặc chuyển tenant trước khi broadcast (BE-R01/RT-04)', async () => {
      const idleRevokedStaffSocket = createMockSocket({ token: 'tok-revoked' });
      const idleTransferredStaffSocket = createMockSocket({ token: 'tok-transferred' });

      jwtService.verifyAsync
        .mockResolvedValueOnce({ sub: 201, sid: 'sess-revoked', roles: ['NHAN_VIEN_CSKH'] })
        .mockResolvedValueOnce({ sub: 202, sid: 'sess-transferred', roles: ['NHAN_VIEN_CSKH'] });

      prisma.phienDangNhap.findUnique
        .mockResolvedValueOnce({
          taiKhoanId: 201,
          sessionId: 'sess-revoked',
          thuHoiLuc: null,
          hetHanLuc: new Date(Date.now() + 100000),
          taiKhoan: {
            taiKhoanId: 201,
            trangThai: 'HOAT_DONG',
            nhanVien: { nhanVienId: 11, nhaXeId: 5 },
            taiKhoanVaiTros: [{ vaiTro: { vaiTroId: 4, tenVaiTro: 'NHAN_VIEN_CSKH' } }],
          },
        })
        .mockResolvedValueOnce({
          taiKhoanId: 202,
          sessionId: 'sess-transferred',
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

      await gateway.handleConnection(idleRevokedStaffSocket);
      await gateway.handleConnection(idleTransferredStaffSocket);
      await idleRevokedStaffSocket.join('conversation_10');
      await idleTransferredStaffSocket.join('conversation_10');

      // Sau khi kết nối và ngồi im, sess-revoked bị mất quyền chat, còn sess-transferred chuyển sang nhaXeId = 9
      prisma.phienDangNhap.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.sessionId === 'sess-revoked') {
          return {
            taiKhoanId: 201,
            sessionId: 'sess-revoked',
            thuHoiLuc: null,
            hetHanLuc: new Date(Date.now() + 100000),
            taiKhoan: {
              taiKhoanId: 201,
              trangThai: 'HOAT_DONG',
              nhanVien: { nhanVienId: 11, nhaXeId: 5 },
              taiKhoanVaiTros: [{ vaiTro: { vaiTroId: 4, tenVaiTro: 'NHAN_VIEN_CSKH' } }],
            },
          };
        }
        return {
          taiKhoanId: 202,
          sessionId: 'sess-transferred',
          thuHoiLuc: null,
          hetHanLuc: new Date(Date.now() + 100000),
          taiKhoan: {
            taiKhoanId: 202,
            trangThai: 'HOAT_DONG',
            nhanVien: { nhanVienId: 12, nhaXeId: 9 },
            taiKhoanVaiTros: [{ vaiTro: { vaiTroId: 4, tenVaiTro: 'NHAN_VIEN_CSKH' } }],
          },
        };
      });

      permissionResolver.resolve.mockImplementation((_assignments: any, scope: any) => {
        if (scope.nhanVienId === 11) return []; // bị thu hồi quyền chat
        return ['chat:read', 'chat:manage'];
      });

      await gateway.emitMessageNew(
        { tinNhanId: 99, cuocTroChuyenId: 10, noiDung: 'Bí mật tenant 5', loaiNguoiGui: 'KHACH_HANG' },
        { cuocTroChuyenId: 10, nhaXeId: 5, khachHangId: 50, tieuDe: 'Hỗ trợ' },
      );

      // Socket bị thu hồi quyền đã bị disconnect và xóa khỏi mọi room trước khi emit
      expect(idleRevokedStaffSocket.disconnect).toHaveBeenCalledWith(true);
      expect(idleRevokedStaffSocket.rooms.has('conversation_10')).toBe(false);
      expect(idleRevokedStaffSocket.rooms.has('company_5')).toBe(false);

      // Socket chuyển sang tenant 9 đã rời conversation_10 và company_5, gia nhập company_9
      expect(idleTransferredStaffSocket.disconnect).not.toHaveBeenCalled();
      expect(idleTransferredStaffSocket.rooms.has('conversation_10')).toBe(false);
      expect(idleTransferredStaffSocket.rooms.has('company_5')).toBe(false);
      expect(idleTransferredStaffSocket.rooms.has('company_9')).toBe(true);
    });
  });
});
