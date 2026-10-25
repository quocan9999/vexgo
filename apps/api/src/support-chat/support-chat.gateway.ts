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
import { Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { EffectiveRolePermissionLoaderService } from '../auth/permissions/effective-role-permission-loader.service.js';
import { PermissionResolverService } from '../auth/permissions/permission-resolver.service.js';
import { requireAuthSecret } from '../auth/auth-secret.js';
import {
  RealtimeSessionInvalidatorService,
  type RealtimeInvalidationHandler,
} from '../auth/realtime-session-invalidator.service.js';
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
export class SupportChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy, RealtimeInvalidationHandler
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SupportChatGateway.name);
  private readonly accessSecret: string;
  private readonly connectedSockets = new Set<Socket>();
  private readonly unregisterInvalidator?: () => void;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly permissionLoader: EffectiveRolePermissionLoaderService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly supportChatService: SupportChatService,
    @Optional()
    private readonly sessionInvalidator?: RealtimeSessionInvalidatorService,
  ) {
    this.accessSecret = requireAuthSecret(
      this.configService.get<string>('JWT_ACCESS_SECRET'),
      'JWT_ACCESS_SECRET',
    );
    this.unregisterInvalidator = this.sessionInvalidator?.registerHandler(this);
  }

  onModuleDestroy() {
    this.unregisterInvalidator?.();
    this.connectedSockets.clear();
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
      this.connectedSockets.add(client);

      // Tham gia room theo phiên đăng nhập để có thể thu hồi đúng phiên
      await client.join(`session_${principal.sessionId}`);

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
    this.connectedSockets.delete(client);
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
    this.connectedSockets.delete(client);
    if (client.rooms) {
      for (const room of Array.from(client.rooms)) {
        if (room !== client.id) {
          void client.leave(room);
        }
      }
    }
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
   * Proactive invalidation handlers triggered by Auth / AdminAccounts / AdminRBAC services (BE-R01 / RT-04)
   */
  async invalidateSession(sessionId: string, reason = 'SESSION_REVOKED'): Promise<void> {
    const matchingSockets = Array.from(this.connectedSockets).filter((socket) => {
      const data = socket.data as SocketPrincipalData | undefined;
      return data?.principal?.sessionId === sessionId || socket.rooms?.has(`session_${sessionId}`);
    });

    for (const socket of matchingSockets) {
      this.emitSocketErrorAndDisconnect(
        socket,
        reason,
        'Phiên đăng nhập không hợp lệ hoặc đã bị thu hồi.',
      );
    }

    const roomTarget = (this.server as any)?.in?.(`session_${sessionId}`);
    if (typeof roomTarget?.disconnectSockets === 'function') {
      roomTarget.disconnectSockets(true);
    }
  }

  async invalidateAccount(taiKhoanId: number, reason = 'SESSION_REVOKED'): Promise<void> {
    const matchingSockets = Array.from(this.connectedSockets).filter((socket) => {
      const data = socket.data as SocketPrincipalData | undefined;
      return data?.principal?.taiKhoanId === taiKhoanId || socket.rooms?.has(`user_${taiKhoanId}`);
    });

    for (const socket of matchingSockets) {
      this.emitSocketErrorAndDisconnect(
        socket,
        reason,
        'Tài khoản đã bị khóa hoặc phiên đăng nhập đã bị thu hồi.',
      );
    }

    const roomTarget = (this.server as any)?.in?.(`user_${taiKhoanId}`);
    if (typeof roomTarget?.disconnectSockets === 'function') {
      roomTarget.disconnectSockets(true);
    }
  }

  async revalidateAccount(taiKhoanId: number): Promise<void> {
    const matchingSockets = Array.from(this.connectedSockets).filter((socket) => {
      const data = socket.data as SocketPrincipalData | undefined;
      return data?.principal?.taiKhoanId === taiKhoanId || socket.rooms?.has(`user_${taiKhoanId}`);
    });

    for (const socket of matchingSockets) {
      try {
        await this.revalidatePrincipalSession(socket);
      } catch {
        // Socket was disconnected by revalidatePrincipalSession
      }
    }
  }

  async revalidateRole(roleName: string): Promise<void> {
    const matchingSockets = Array.from(this.connectedSockets).filter((socket) => {
      const data = socket.data as SocketPrincipalData | undefined;
      return Boolean(data?.principal?.roles?.includes(roleName));
    });

    for (const socket of matchingSockets) {
      try {
        await this.revalidatePrincipalSession(socket);
      } catch {
        // Socket was disconnected by revalidatePrincipalSession
      }
    }
  }

  async revalidateTenantRole(nhaXeId: number, roleName?: string): Promise<void> {
    const matchingSockets = Array.from(this.connectedSockets).filter((socket) => {
      const data = socket.data as SocketPrincipalData | undefined;
      const principal = data?.principal;
      if (!principal) return false;
      const matchesTenant =
        principal.nhaXeId === nhaXeId || Boolean(socket.rooms?.has(`company_${nhaXeId}`));
      if (!matchesTenant) return false;
      return roleName ? principal.roles.includes(roleName) : true;
    });

    for (const socket of matchingSockets) {
      try {
        await this.revalidatePrincipalSession(socket);
      } catch {
        // Socket was disconnected by revalidatePrincipalSession
      }
    }
  }

  /**
   * Revalidate session, role assignments, effective permissions & tenant scope against the database
   * on each critical socket action AND before broadcasting room events (BE-01 / BE-R01 / RT-04).
   * Disconnects socket if session is revoked, user is locked, or chat permissions are insufficient.
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

    // Nếu tenant scope thay đổi (chuyển nhà xe hoặc mất quyền nhà xe):
    // 1. Rời company room cũ
    // 2. Rời TOÀN BỘ các room conversation_* đã tham gia trước đó để ngăn rò rỉ sự kiện của tenant cũ (BE-R01)
    if (cachedPrincipal.nhaXeId !== nhaXeId) {
      if (cachedPrincipal.nhaXeId) {
        await client.leave(`company_${cachedPrincipal.nhaXeId}`);
      }
      if (client.rooms) {
        const conversationRooms = Array.from(client.rooms).filter((room) =>
          room.startsWith('conversation_'),
        );
        for (const room of conversationRooms) {
          await client.leave(room);
        }
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

  private getConnectedSocketsInRoom(roomName: string): Socket[] {
    return Array.from(this.connectedSockets).filter((socket) =>
      Boolean(socket.rooms?.has(roomName)),
    );
  }

  private async revalidateSocketWithCache(
    socket: Socket,
    cache: Map<Socket, AuthPrincipal | null>,
  ): Promise<AuthPrincipal | null> {
    if (cache.has(socket)) {
      return cache.get(socket) ?? null;
    }
    try {
      const principal = await this.revalidatePrincipalSession(socket);
      cache.set(socket, principal);
      return principal;
    } catch {
      cache.set(socket, null);
      return null;
    }
  }

  /**
   * Revalidate all connected recipient sockets in a company_* room before emitting (BE-R01 / RT-04).
   * Evicts any socket that is no longer an active staff member of that tenant with chat permission.
   */
  private async sanitizeCompanyRoomRecipients(
    nhaXeId: number,
    cache: Map<Socket, AuthPrincipal | null>,
  ): Promise<void> {
    const roomName = `company_${nhaXeId}`;
    const socketsInRoom = this.getConnectedSocketsInRoom(roomName);
    if (socketsInRoom.length === 0) return;

    for (const socket of socketsInRoom) {
      const principal = await this.revalidateSocketWithCache(socket, cache);
      if (!principal) continue;

      if (principal.nhaXeId !== nhaXeId || principal.nhanVienId === null) {
        await socket.leave(roomName);
      }
    }
  }

  /**
   * Revalidate all connected recipient sockets in a conversation_* room before emitting (BE-R01 / RT-04).
   * Evicts any socket whose session/permission was revoked or whose tenant/customer scope no longer matches the conversation.
   */
  private async sanitizeConversationRoomRecipients(
    cuocTroChuyenId: number,
    cache: Map<Socket, AuthPrincipal | null>,
    knownScope?: { nhaXeId?: number; khachHangId?: number },
  ): Promise<void> {
    const roomName = `conversation_${cuocTroChuyenId}`;
    const socketsInRoom = this.getConnectedSocketsInRoom(roomName);
    if (socketsInRoom.length === 0) return;

    let scopeNhaXeId = knownScope?.nhaXeId;
    let scopeKhachHangId = knownScope?.khachHangId;

    if (
      (scopeNhaXeId === undefined || scopeKhachHangId === undefined) &&
      typeof (this.prisma as any)?.cuocTroChuyen?.findUnique === 'function'
    ) {
      const convRecord = await this.prisma.cuocTroChuyen.findUnique({
        where: { cuocTroChuyenId },
        select: { nhaXeId: true, khachHangId: true },
      });
      if (!convRecord) {
        for (const socket of socketsInRoom) {
          await socket.leave(roomName);
        }
        return;
      }
      scopeNhaXeId = convRecord.nhaXeId;
      scopeKhachHangId = convRecord.khachHangId;
    }

    for (const socket of socketsInRoom) {
      const principal = await this.revalidateSocketWithCache(socket, cache);
      if (!principal) continue;

      const isTenantUser = principal.nhaXeId !== null && principal.nhanVienId !== null;
      if (isTenantUser) {
        if (scopeNhaXeId !== undefined && principal.nhaXeId !== scopeNhaXeId) {
          await socket.leave(roomName);
        }
      } else {
        const socketData = socket.data as SocketPrincipalData | undefined;
        let khachHangId = socketData?.khachHangId ?? null;
        if (
          khachHangId === null &&
          typeof (this.supportChatService as any)?.ensureKhachHang === 'function'
        ) {
          const kh = await this.supportChatService.ensureKhachHang(principal.taiKhoanId);
          khachHangId = kh.khachHangId;
          if (socketData) {
            socketData.khachHangId = khachHangId;
          }
        }
        if (scopeKhachHangId !== undefined && khachHangId !== scopeKhachHangId) {
          await socket.leave(roomName);
        }
      }
    }
  }

  /**
   * Unified authorized broadcast methods used by both SupportChatGateway and SupportChatController (BE-R01 / RT-04)
   */
  async emitConversationNew(conversation: {
    cuocTroChuyenId: number;
    nhaXeId: number;
    [key: string]: unknown;
  }): Promise<void> {
    if (!this.server) return;
    const cache = new Map<Socket, AuthPrincipal | null>();
    await this.sanitizeCompanyRoomRecipients(conversation.nhaXeId, cache);
    this.server
      .to(`company_${conversation.nhaXeId}`)
      .emit(CHAT_EVENTS.CONVERSATION_NEW, conversation);
  }

  async emitMessageNew(
    message: {
      loaiNguoiGui: string;
      [key: string]: unknown;
    },
    conversation: {
      cuocTroChuyenId: number;
      nhaXeId: number;
      khachHangId?: number;
      tieuDe?: string | null;
      khachHang?: unknown;
    },
  ): Promise<void> {
    if (!this.server) return;
    const cache = new Map<Socket, AuthPrincipal | null>();
    await this.sanitizeConversationRoomRecipients(
      conversation.cuocTroChuyenId,
      cache,
      {
        nhaXeId: conversation.nhaXeId,
        khachHangId: conversation.khachHangId,
      },
    );

    this.server
      .to(`conversation_${conversation.cuocTroChuyenId}`)
      .emit(CHAT_EVENTS.MESSAGE_NEW, message);

    if (message.loaiNguoiGui === 'KHACH_HANG') {
      await this.sanitizeCompanyRoomRecipients(conversation.nhaXeId, cache);
      this.server
        .to(`company_${conversation.nhaXeId}`)
        .emit(CHAT_EVENTS.MESSAGE_NEW, {
          ...message,
          cuocTroChuyen: {
            cuocTroChuyenId: conversation.cuocTroChuyenId,
            tieuDe: conversation.tieuDe,
            khachHang: conversation.khachHang,
          },
        });
    }
  }

  async emitConversationClaimed(conversation: {
    cuocTroChuyenId: number;
    nhaXeId: number;
    khachHangId?: number;
    [key: string]: unknown;
  }): Promise<void> {
    if (!this.server) return;
    const cache = new Map<Socket, AuthPrincipal | null>();
    await this.sanitizeConversationRoomRecipients(
      conversation.cuocTroChuyenId,
      cache,
      {
        nhaXeId: conversation.nhaXeId,
        khachHangId: conversation.khachHangId,
      },
    );
    await this.sanitizeCompanyRoomRecipients(conversation.nhaXeId, cache);

    this.server
      .to(`conversation_${conversation.cuocTroChuyenId}`)
      .emit(CHAT_EVENTS.CONVERSATION_CLAIMED, conversation);

    this.server
      .to(`company_${conversation.nhaXeId}`)
      .emit(CHAT_EVENTS.CONVERSATION_CLAIMED, conversation);
  }

  async emitConversationClosed(conversation: {
    cuocTroChuyenId: number;
    nhaXeId: number;
    khachHangId?: number;
    [key: string]: unknown;
  }): Promise<void> {
    if (!this.server) return;
    const cache = new Map<Socket, AuthPrincipal | null>();
    await this.sanitizeConversationRoomRecipients(
      conversation.cuocTroChuyenId,
      cache,
      {
        nhaXeId: conversation.nhaXeId,
        khachHangId: conversation.khachHangId,
      },
    );
    await this.sanitizeCompanyRoomRecipients(conversation.nhaXeId, cache);

    this.server
      .to(`conversation_${conversation.cuocTroChuyenId}`)
      .emit(CHAT_EVENTS.CONVERSATION_CLOSED, conversation);

    this.server
      .to(`company_${conversation.nhaXeId}`)
      .emit(CHAT_EVENTS.CONVERSATION_CLOSED, conversation);
  }

  async emitMessagesReadReceipt(payload: {
    cuocTroChuyenId: number;
    readByTaiKhoanId: number;
    tinNhanIds?: number[];
    updatedCount: number;
  }): Promise<void> {
    if (!this.server) return;
    const cache = new Map<Socket, AuthPrincipal | null>();
    await this.sanitizeConversationRoomRecipients(payload.cuocTroChuyenId, cache);

    this.server
      .to(`conversation_${payload.cuocTroChuyenId}`)
      .emit(CHAT_EVENTS.MESSAGES_READ_RECEIPT, payload);
  }

  private validateWsPayload<T extends object>(cls: new () => T, rawPayload: unknown): T {
    const instance = plainToInstance(cls, (rawPayload ?? {}) as Record<string, unknown>);
    const errors = validateSync(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      const firstMessage =
        Object.values(errors[0].constraints ?? {})[0] || 'Dữ liệu đầu vào không hợp lệ.';
      const err: any = new Error(firstMessage);
      err.response = { error: 'VALIDATION_ERROR', message: firstMessage };
      throw err;
    }
    return instance;
  }

  private extractRawWsPayload(firstArg: unknown, secondArg: unknown): unknown {
    if (secondArg !== undefined) {
      return secondArg;
    }
    if (
      firstArg &&
      typeof firstArg === 'object' &&
      'handshake' in (firstArg as Record<string, unknown>) &&
      'disconnect' in (firstArg as Record<string, unknown>)
    ) {
      return {};
    }
    return firstArg;
  }

  @SubscribeMessage(CHAT_EVENTS.CONVERSATION_JOIN)
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload?: WsJoinConversationDto,
  ) {
    try {
      const payload = this.validateWsPayload(
        WsJoinConversationDto,
        this.extractRawWsPayload(client, rawPayload),
      );
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
    @MessageBody() rawPayload?: WsJoinConversationDto,
  ) {
    try {
      const payload = this.validateWsPayload(
        WsJoinConversationDto,
        this.extractRawWsPayload(client, rawPayload),
      );
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
    @MessageBody() rawDto?: SendMessageDto,
  ) {
    try {
      const dto = this.validateWsPayload(
        SendMessageDto,
        this.extractRawWsPayload(client, rawDto),
      );
      const principal = await this.revalidatePrincipalSession(client);
      const message = await this.supportChatService.sendMessage(principal, dto);

      // Lấy thông tin cuộc trò chuyện để broadcast
      const conv = await this.supportChatService.getConversationById(
        principal,
        dto.cuocTroChuyenId,
      );

      await this.emitMessageNew(message, conv);

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
    @MessageBody() rawPayload?: WsTypingStatusDto,
  ) {
    try {
      const payload = this.validateWsPayload(
        WsTypingStatusDto,
        this.extractRawWsPayload(client, rawPayload),
      );
      const principal = await this.revalidatePrincipalSession(client);

      // Luôn kiểm tra quyền truy cập vào cuộc trò chuyện trước khi phát sự kiện typing (BE-R01)
      const conv = await this.supportChatService.getConversationById(
        principal,
        payload.cuocTroChuyenId,
      );

      const roomName = `conversation_${payload.cuocTroChuyenId}`;
      if (!client.rooms.has(roomName)) {
        await client.join(roomName);
      }

      const cache = new Map<Socket, AuthPrincipal | null>([[client, principal]]);
      await this.sanitizeConversationRoomRecipients(
        payload.cuocTroChuyenId,
        cache,
        {
          nhaXeId: conv?.nhaXeId,
          khachHangId: conv?.khachHangId,
        },
      );

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
    @MessageBody() rawPayload?: WsClaimConversationDto,
  ) {
    try {
      const payload = this.validateWsPayload(
        WsClaimConversationDto,
        this.extractRawWsPayload(client, rawPayload),
      );
      const principal = await this.revalidatePrincipalSession(client);
      const updatedConv = await this.supportChatService.claimConversation(
        principal,
        payload.cuocTroChuyenId,
      );

      await this.emitConversationClaimed(updatedConv);

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
    @MessageBody() rawPayload?: WsCloseConversationDto,
  ) {
    try {
      const payload = this.validateWsPayload(
        WsCloseConversationDto,
        this.extractRawWsPayload(client, rawPayload),
      );
      const principal = await this.revalidatePrincipalSession(client);
      const closedConv = await this.supportChatService.closeConversation(
        principal,
        payload.cuocTroChuyenId,
        { lyDo: payload.lyDo },
      );

      await this.emitConversationClosed(closedConv);

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
    @MessageBody() rawPayload?: WsMarkReadDto,
  ) {
    try {
      const payload = this.validateWsPayload(
        WsMarkReadDto,
        this.extractRawWsPayload(client, rawPayload),
      );
      const principal = await this.revalidatePrincipalSession(client);
      const result = await this.supportChatService.markMessagesAsRead(
        principal,
        payload.cuocTroChuyenId,
        { tinNhanIds: payload.tinNhanIds },
      );

      await this.emitMessagesReadReceipt({
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
