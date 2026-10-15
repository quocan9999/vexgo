import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { EffectiveRolePermissionLoaderService } from '../auth/permissions/effective-role-permission-loader.service.js';
import { PermissionResolverService } from '../auth/permissions/permission-resolver.service.js';
import { requireAuthSecret } from '../auth/auth-secret.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { SupportChatService } from './support-chat.service.js';
import { CHAT_EVENTS } from './constants/chat-events.constants.js';
import { getAllowedOrigins } from '../common/configure-api.js';
import {
  SendMessageDto,
  WsClaimConversationDto,
  WsCloseConversationDto,
  WsJoinConversationDto,
  WsMarkReadDto,
  WsTypingStatusDto,
} from './dto/index.js';

interface SocketPrincipalData {
  principal: AuthPrincipal;
  khachHangId: number | null;
}

interface AccessTokenPayload {
  sub: number;
  sid: string;
  roles: string[];
}

export function isSocketOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const config = new ConfigService();
  const allowed = getAllowedOrigins(config);
  return allowed.includes(origin);
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (isSocketOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  },
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
export class SupportChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SupportChatGateway.name);
  private readonly accessSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly permissionLoader: EffectiveRolePermissionLoaderService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly supportChatService: SupportChatService,
  ) {
    this.accessSecret = requireAuthSecret(
      this.configService.get<string>('JWT_ACCESS_SECRET'),
      'JWT_ACCESS_SECRET',
    );
  }

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization;
      const authToken = client.handshake.auth?.token;
      const token =
        typeof authToken === 'string' && authToken.length > 0
          ? authToken
          : typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : null;

      if (!token) {
        this.emitSocketErrorAndDisconnect(client, 'AUTH_REQUIRED', 'Yêu cầu token xác thực để kết nối chat hỗ trợ.');
        return;
      }

      let payload: AccessTokenPayload;
      try {
        payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
          secret: this.accessSecret,
          algorithms: ['HS256'],
        });
      } catch {
        this.emitSocketErrorAndDisconnect(client, 'ACCESS_TOKEN_INVALID', 'Token xác thực không hợp lệ hoặc đã hết hạn.');
        return;
      }

      if (
        !Number.isInteger(payload.sub) ||
        payload.sub <= 0 ||
        typeof payload.sid !== 'string' ||
        !Array.isArray(payload.roles)
      ) {
        this.emitSocketErrorAndDisconnect(client, 'ACCESS_TOKEN_INVALID', 'Token xác thực không hợp lệ.');
        return;
      }

      const session = await this.prisma.phienDangNhap.findUnique({
        where: { sessionId: payload.sid },
        include: {
          taiKhoan: {
            select: {
              taiKhoanId: true,
              trangThai: true,
              nhanVien: {
                select: {
                  nhanVienId: true,
                  nhaXeId: true,
                },
              },
              taiKhoanVaiTros: {
                include: {
                  vaiTro: {
                    select: {
                      vaiTroId: true,
                      tenVaiTro: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (
        !session ||
        session.taiKhoanId !== payload.sub ||
        session.thuHoiLuc !== null ||
        session.hetHanLuc <= new Date() ||
        session.taiKhoan.trangThai !== 'HOAT_DONG'
      ) {
        this.emitSocketErrorAndDisconnect(client, 'ACCESS_TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ hoặc đã bị thu hồi.');
        return;
      }

      const roleAssignments = session.taiKhoan.taiKhoanVaiTros;
      const roles = roleAssignments.map(({ vaiTro }) => vaiTro.tenVaiTro);
      const nhanVienId = session.taiKhoan.nhanVien?.nhanVienId ?? null;
      const nhaXeId = session.taiKhoan.nhanVien?.nhaXeId ?? null;

      // LEAD RULE: SUPER ADMIN TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP TRUY CẬP CHAT CSKH
      if (roles.includes('SUPER_ADMIN')) {
        this.emitSocketErrorAndDisconnect(
          client,
          'SUPER_ADMIN_NOT_ALLOWED',
          'Tài khoản Quản trị hệ thống không được phép tham gia chat CSKH.',
        );
        return;
      }

      const effectiveAssignments = await this.permissionLoader.load(
        roleAssignments.map(({ vaiTro }) => ({
          roleId: vaiTro.vaiTroId,
          roleName: vaiTro.tenVaiTro,
        })),
        nhaXeId,
      );

      const permissions = this.permissionResolver.resolve(effectiveAssignments, {
        nhanVienId,
        nhaXeId,
      });

      const isTenantUser = nhaXeId !== null && nhanVienId !== null;

      if (isTenantUser) {
        const hasChatPermission =
          permissions.includes('chat:read') || permissions.includes('chat:manage');
        if (!hasChatPermission) {
          this.emitSocketErrorAndDisconnect(
            client,
            'CHAT_PERMISSION_DENIED',
            'Tài khoản nhân viên không có quyền truy cập chức năng chat CSKH.',
          );
          return;
        }
      }

      let khachHangId: number | null = null;
      if (!isTenantUser) {
        const khachHang = await this.supportChatService.ensureKhachHang(session.taiKhoan.taiKhoanId);
        khachHangId = khachHang.khachHangId;
      }

      const principal: AuthPrincipal = {
        taiKhoanId: session.taiKhoan.taiKhoanId,
        sessionId: session.sessionId,
        roles,
        permissions,
        nhanVienId,
        nhaXeId,
      };

      const socketData: SocketPrincipalData = {
        principal,
        khachHangId,
      };

      client.data = socketData;

      // Tham gia room cá nhân để nhận thông báo / tin nhắn riêng
      await client.join(`user_${principal.taiKhoanId}`);

      // Nếu là nhân viên nhà xe, tham gia room của nhà xe để nhận cuộc trò chuyện mới
      if (principal.nhaXeId) {
        await client.join(`company_${principal.nhaXeId}`);
      }

      client.emit(CHAT_EVENTS.SUPPORT_CONNECTED, {
        taiKhoanId: principal.taiKhoanId,
        roles: principal.roles,
        permissions: principal.permissions,
        khachHangId,
        nhaXeId: principal.nhaXeId,
      });

      this.logger.log(
        `[Socket connected] taiKhoanId=${principal.taiKhoanId}, roles=[${roles.join(', ')}], nhaXeId=${nhaXeId}`,
      );
    } catch (error) {
      this.logger.error('Error handling WebSocket connection:', error);
      this.emitSocketErrorAndDisconnect(client, 'CONNECTION_ERROR', 'Không thể khởi tạo kết nối hỗ trợ.');
    }
  }

  handleDisconnect(client: Socket) {
    const data = client.data as SocketPrincipalData | undefined;
    if (data?.principal) {
      this.logger.log(`[Socket disconnected] taiKhoanId=${data.principal.taiKhoanId}`);
    }
  }

  private emitSocketErrorAndDisconnect(
    client: Socket,
    error: string,
    message: string,
  ) {
    client.emit(CHAT_EVENTS.SUPPORT_ERROR, { error, message });
    client.disconnect(true);
  }

  private getPrincipalFromSocket(client: Socket): AuthPrincipal {
    const data = client.data as SocketPrincipalData | undefined;
    if (!data?.principal) {
      throw new Error('Socket chưa được xác thực.');
    }
    return data.principal;
  }

  /**
   * Revalidate session, role assignments, effective permissions & tenant scope against the database
   * on each critical socket action (BE-01). Disconnects socket if session is revoked, user is locked,
   * or chat permissions are insufficient.
   */
  private async revalidatePrincipalSession(client: Socket): Promise<AuthPrincipal> {
    const cachedPrincipal = this.getPrincipalFromSocket(client);

    const session = await this.prisma.phienDangNhap.findUnique({
      where: { sessionId: cachedPrincipal.sessionId },
      include: {
        taiKhoan: {
          select: {
            taiKhoanId: true,
            trangThai: true,
            nhanVien: {
              select: {
                nhanVienId: true,
                nhaXeId: true,
              },
            },
            taiKhoanVaiTros: {
              include: {
                vaiTro: {
                  select: {
                    vaiTroId: true,
                    tenVaiTro: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.taiKhoanId !== cachedPrincipal.taiKhoanId ||
      session.thuHoiLuc !== null ||
      session.hetHanLuc <= new Date() ||
      session.taiKhoan.trangThai !== 'HOAT_DONG'
    ) {
      this.emitSocketErrorAndDisconnect(
        client,
        'SESSION_REVOKED',
        'Phiên đăng nhập không hợp lệ hoặc đã bị thu hồi.',
      );
      throw new Error('Phiên đăng nhập đã bị thu hồi.');
    }

    const roleAssignments = session.taiKhoan.taiKhoanVaiTros ?? [];
    const roles = roleAssignments.map(({ vaiTro }) => vaiTro.tenVaiTro);
    const nhanVienId = session.taiKhoan.nhanVien?.nhanVienId ?? null;
    const nhaXeId = session.taiKhoan.nhanVien?.nhaXeId ?? null;

    // Chặn Super Admin tuyệt đối (BE-01 / Super Admin isolation)
    if (roles.includes('SUPER_ADMIN')) {
      this.emitSocketErrorAndDisconnect(
        client,
        'SUPER_ADMIN_NOT_ALLOWED',
        'Tài khoản Quản trị hệ thống không được phép tham gia chat CSKH.',
      );
      throw new Error('Super admin không được phép truy cập.');
    }

    const effectiveAssignments = await this.permissionLoader.load(
      roleAssignments.map(({ vaiTro }) => ({
        roleId: vaiTro.vaiTroId,
        roleName: vaiTro.tenVaiTro,
      })),
      nhaXeId,
    );

    const permissions = this.permissionResolver.resolve(effectiveAssignments, {
      nhanVienId,
      nhaXeId,
    });

    const isTenantUser = nhaXeId !== null && nhanVienId !== null;

    if (isTenantUser) {
      const hasChatPermission =
        permissions.includes('chat:read') || permissions.includes('chat:manage');
      if (!hasChatPermission) {
        this.emitSocketErrorAndDisconnect(
          client,
          'CHAT_PERMISSION_DENIED',
          'Tài khoản nhân viên không có quyền truy cập chức năng chat CSKH.',
        );
        throw new Error('Quyền chat đã bị thu hồi.');
      }
    }

    // Nếu tenant scope thay đổi (chuyển nhà xe): cập nhật room
    if (cachedPrincipal.nhaXeId !== nhaXeId) {
      if (cachedPrincipal.nhaXeId) {
        await client.leave(`company_${cachedPrincipal.nhaXeId}`);
      }
      if (nhaXeId) {
        await client.join(`company_${nhaXeId}`);
      }
    }

    const freshPrincipal: AuthPrincipal = {
      taiKhoanId: session.taiKhoan.taiKhoanId,
      sessionId: session.sessionId,
      roles,
      permissions,
      nhanVienId,
      nhaXeId,
    };

    // Cập nhật lại cache trong socket
    const data = client.data as SocketPrincipalData;
    data.principal = freshPrincipal;

    return freshPrincipal;
  }

  @SubscribeMessage(CHAT_EVENTS.CONVERSATION_JOIN)
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsJoinConversationDto,
  ) {
    try {
      const principal = await this.revalidatePrincipalSession(client);
      const conv = await this.supportChatService.getConversationById(
        principal,
        payload.cuocTroChuyenId,
      );

      await client.join(`conversation_${conv.cuocTroChuyenId}`);

      return {
        success: true,
        cuocTroChuyenId: conv.cuocTroChuyenId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.error || 'JOIN_FAILED',
        message: error.message || 'Không thể tham gia cuộc trò chuyện.',
      };
    }
  }

  @SubscribeMessage(CHAT_EVENTS.CONVERSATION_LEAVE)
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsJoinConversationDto,
  ) {
    try {
      await client.leave(`conversation_${payload.cuocTroChuyenId}`);
      return {
        success: true,
        cuocTroChuyenId: payload.cuocTroChuyenId,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Không thể rời cuộc trò chuyện.',
      };
    }
  }

  @SubscribeMessage(CHAT_EVENTS.MESSAGE_SEND)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    try {
      const principal = await this.revalidatePrincipalSession(client);
      const message = await this.supportChatService.sendMessage(principal, dto);

      // Lấy thông tin cuộc trò chuyện để broadcast
      const conv = await this.supportChatService.getConversationById(
        principal,
        dto.cuocTroChuyenId,
      );

      // Broadcast tin nhắn mới tới room cuộc trò chuyện
      this.server
        .to(`conversation_${dto.cuocTroChuyenId}`)
        .emit(CHAT_EVENTS.MESSAGE_NEW, message);

      // Broadcast tới room nhà xe nếu là tin nhắn mới từ khách hàng
      if (message.loaiNguoiGui === 'KHACH_HANG') {
        this.server
          .to(`company_${conv.nhaXeId}`)
          .emit(CHAT_EVENTS.MESSAGE_NEW, {
            ...message,
            cuocTroChuyen: {
              cuocTroChuyenId: conv.cuocTroChuyenId,
              tieuDe: conv.tieuDe,
              khachHang: conv.khachHang,
            },
          });
      }

      return {
        success: true,
        data: message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.error || 'SEND_MESSAGE_FAILED',
        message: error.message || 'Không thể gửi tin nhắn.',
      };
    }
  }

  @SubscribeMessage(CHAT_EVENTS.TYPING_STATUS)
  async handleTypingStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsTypingStatusDto,
  ) {
    try {
      const principal = await this.revalidatePrincipalSession(client);

      const roomName = `conversation_${payload.cuocTroChuyenId}`;
      // Verify authorization: nếu socket chưa trong room, xác minh quyền truy cập
      if (!client.rooms.has(roomName)) {
        await this.supportChatService.getConversationById(principal, payload.cuocTroChuyenId);
        await client.join(roomName);
      }

      client.to(roomName).emit(CHAT_EVENTS.TYPING_STATUS, {
        cuocTroChuyenId: payload.cuocTroChuyenId,
        taiKhoanId: principal.taiKhoanId,
        isTyping: payload.isTyping,
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  @SubscribeMessage(CHAT_EVENTS.CONVERSATION_CLAIM)
  async handleClaimConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsClaimConversationDto,
  ) {
    try {
      const principal = await this.revalidatePrincipalSession(client);
      const updatedConv = await this.supportChatService.claimConversation(
        principal,
        payload.cuocTroChuyenId,
      );

      // Broadcast cho cả room conversation và room nhà xe
      this.server
        .to(`conversation_${payload.cuocTroChuyenId}`)
        .emit(CHAT_EVENTS.CONVERSATION_CLAIMED, updatedConv);

      this.server
        .to(`company_${updatedConv.nhaXeId}`)
        .emit(CHAT_EVENTS.CONVERSATION_CLAIMED, updatedConv);

      return {
        success: true,
        data: updatedConv,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.error || 'CLAIM_FAILED',
        message: error.message || 'Không thể tiếp nhận cuộc trò chuyện.',
      };
    }
  }

  @SubscribeMessage(CHAT_EVENTS.CONVERSATION_CLOSE)
  async handleCloseConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsCloseConversationDto,
  ) {
    try {
      const principal = await this.revalidatePrincipalSession(client);
      const closedConv = await this.supportChatService.closeConversation(
        principal,
        payload.cuocTroChuyenId,
        { lyDo: payload.lyDo },
      );

      this.server
        .to(`conversation_${payload.cuocTroChuyenId}`)
        .emit(CHAT_EVENTS.CONVERSATION_CLOSED, closedConv);

      this.server
        .to(`company_${closedConv.nhaXeId}`)
        .emit(CHAT_EVENTS.CONVERSATION_CLOSED, closedConv);

      return {
        success: true,
        data: closedConv,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.error || 'CLOSE_FAILED',
        message: error.message || 'Không thể kết thúc cuộc trò chuyện.',
      };
    }
  }

  @SubscribeMessage(CHAT_EVENTS.MESSAGE_READ)
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsMarkReadDto,
  ) {
    try {
      const principal = await this.revalidatePrincipalSession(client);
      const result = await this.supportChatService.markMessagesAsRead(
        principal,
        payload.cuocTroChuyenId,
        { tinNhanIds: payload.tinNhanIds },
      );

      this.server
        .to(`conversation_${payload.cuocTroChuyenId}`)
        .emit(CHAT_EVENTS.MESSAGES_READ_RECEIPT, {
          cuocTroChuyenId: payload.cuocTroChuyenId,
          readByTaiKhoanId: principal.taiKhoanId,
          tinNhanIds: payload.tinNhanIds,
          updatedCount: result.updatedCount,
        });

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.error || 'MARK_READ_FAILED',
        message: error.message || 'Không thể đánh dấu tin nhắn đã đọc.',
      };
    }
  }
}
