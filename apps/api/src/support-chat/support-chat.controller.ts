import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { SupportChatService } from './support-chat.service.js';
import { SupportChatGateway } from './support-chat.gateway.js';
import { CHAT_EVENTS } from './constants/chat-events.constants.js';
import {
  CloseConversationDto,
  CreateConversationDto,
  GetMessagesQueryDto,
  ListConversationsQueryDto,
  MarkReadDto,
  SendMessageDto,
} from './dto/index.js';

@Controller('support-chat')
export class SupportChatController {
  constructor(
    private readonly chatService: SupportChatService,
    private readonly chatGateway: SupportChatGateway,
  ) {}

  @Post('conversations')
  async createConversation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.chatService.createConversation(principal, dto);

    // Thông báo cho nhà xe qua room socket
    try {
      this.chatGateway.server
        ?.to(`company_${conversation.nhaXeId}`)
        .emit(CHAT_EVENTS.MESSAGE_NEW, {
          cuocTroChuyenId: conversation.cuocTroChuyenId,
          maCuocTroChuyen: conversation.maCuocTroChuyen,
          tieuDe: conversation.tieuDe,
          khachHang: (conversation as any).khachHang,
        });
    } catch {
      // Ignored if socket server not ready
    }

    return conversation;
  }

  @Get('conversations')
  async listConversations(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.chatService.listConversations(principal, query);
  }

  @Get('bus-companies/:nhaXeId/active-conversation')
  async getActiveConversation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('nhaXeId', ParseIntPipe) nhaXeId: number,
  ) {
    return this.chatService.getActiveConversation(principal, nhaXeId);
  }

  @Get('conversations/:id')
  async getConversationById(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chatService.getConversationById(principal, id);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatService.getMessages(principal, id, query);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
  ) {
    dto.cuocTroChuyenId = id;
    const message = await this.chatService.sendMessage(principal, dto);

    try {
      const conv = await this.chatService.getConversationById(principal, id);
      this.chatGateway.server
        ?.to(`conversation_${id}`)
        .emit(CHAT_EVENTS.MESSAGE_NEW, message);

      if (message.loaiNguoiGui === 'KHACH_HANG') {
        this.chatGateway.server
          ?.to(`company_${conv.nhaXeId}`)
          .emit(CHAT_EVENTS.MESSAGE_NEW, message);
      }
    } catch {
      // Socket emission best-effort
    }

    return message;
  }

  @Post('conversations/:id/claim')
  async claimConversation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const updated = await this.chatService.claimConversation(principal, id);

    try {
      this.chatGateway.server
        ?.to(`conversation_${id}`)
        .emit(CHAT_EVENTS.CONVERSATION_CLAIMED, updated);

      this.chatGateway.server
        ?.to(`company_${updated.nhaXeId}`)
        .emit(CHAT_EVENTS.CONVERSATION_CLAIMED, updated);
    } catch {
      // Socket emission best-effort
    }

    return updated;
  }

  @Post('conversations/:id/close')
  async closeConversation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseConversationDto,
  ) {
    const closed = await this.chatService.closeConversation(principal, id, dto);

    try {
      this.chatGateway.server
        ?.to(`conversation_${id}`)
        .emit(CHAT_EVENTS.CONVERSATION_CLOSED, closed);

      this.chatGateway.server
        ?.to(`company_${closed.nhaXeId}`)
        .emit(CHAT_EVENTS.CONVERSATION_CLOSED, closed);
    } catch {
      // Socket emission best-effort
    }

    return closed;
  }

  @Post('conversations/:id/read')
  async markAsRead(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkReadDto,
  ) {
    const result = await this.chatService.markMessagesAsRead(principal, id, dto);

    try {
      this.chatGateway.server
        ?.to(`conversation_${id}`)
        .emit(CHAT_EVENTS.MESSAGES_READ_RECEIPT, {
          cuocTroChuyenId: id,
          readByTaiKhoanId: principal.taiKhoanId,
          tinNhanIds: dto?.tinNhanIds,
          updatedCount: result.updatedCount,
        });
    } catch {
      // Socket emission best-effort
    }

    return result;
  }
}
