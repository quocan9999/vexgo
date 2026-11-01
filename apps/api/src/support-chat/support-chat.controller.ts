import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { CHAT_EVENTS } from './constants/chat-events.constants.js';
import {
  CloseConversationDto,
  CreateConversationDto,
  GetMessagesQueryDto,
  ListConversationsQueryDto,
  MarkReadDto,
  SendChatMessageBodyDto,
  SendMessageDto,
} from './dto/index.js';
import { SupportChatGateway } from './support-chat.gateway.js';
import { SupportChatService } from './support-chat.service.js';

@ApiTags('Chat & Tư vấn trực tuyến (Support Chat)')
@ApiBearerAuth('JWT-auth')
@Controller('support-chat')
export class SupportChatController {
  constructor(
    private readonly chatService: SupportChatService,
    private readonly chatGateway: SupportChatGateway,
  ) {}

  @Post('conversations')
  @ApiOperation({
    summary: 'Tạo hoặc mở lại cuộc trò chuyện hỗ trợ',
    description:
      'Khách hàng bắt đầu phiên trò chuyện với một nhà xe. Nếu đã có cuộc trò chuyện đang hoạt động chưa đóng, hệ thống sẽ trả về cuộc trò chuyện hiện tại.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo hoặc kết nối cuộc trò chuyện thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập.',
    type: ApiErrorResponseDto,
  })
  async createConversation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateConversationDto,
  ) {
    const result = await this.chatService.createConversation(principal, dto);

    // Thông báo realtime qua socket server (có xác thực lại recipient rooms trước khi phát - BE-R01/RT-04)
    try {
      // Chỉ phát sự kiện CONVERSATION_NEW khi thực sự là cuộc trò chuyện mới (BE-05)
      if (result.isNew) {
        if (typeof this.chatGateway.emitConversationNew === 'function') {
          await this.chatGateway.emitConversationNew(result.conversation);
        } else {
          this.chatGateway.server
            ?.to(`company_${result.conversation.nhaXeId}`)
            .emit(CHAT_EVENTS.CONVERSATION_NEW, result.conversation);
        }
      }

      // Nếu có tin nhắn đầu tiên được gửi, phát sự kiện MESSAGE_NEW để các client realtime nhận được
      if (result.firstMessage) {
        if (typeof this.chatGateway.emitMessageNew === 'function') {
          await this.chatGateway.emitMessageNew(result.firstMessage, result.conversation);
        } else {
          this.chatGateway.server
            ?.to(`conversation_${result.conversation.cuocTroChuyenId}`)
            .emit(CHAT_EVENTS.MESSAGE_NEW, result.firstMessage);

          this.chatGateway.server
            ?.to(`company_${result.conversation.nhaXeId}`)
            .emit(CHAT_EVENTS.MESSAGE_NEW, {
              ...result.firstMessage,
              cuocTroChuyen: {
                cuocTroChuyenId: result.conversation.cuocTroChuyenId,
                tieuDe: result.conversation.tieuDe,
                khachHang: result.conversation.khachHang,
              },
            });
        }
      }
    } catch {
      // Ignored if socket server not ready
    }

    return result.conversation;
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'Danh sách các cuộc trò chuyện',
    description:
      'Lấy danh sách các cuộc trò chuyện hỗ trợ có phân trang và lọc theo trạng thái (Khách hàng xem danh sách của mình; Nhân viên nhà xe xem danh sách thuộc nhà xe).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách cuộc trò chuyện thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập.',
    type: ApiErrorResponseDto,
  })
  async listConversations(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.chatService.listConversations(principal, query);
  }

  @Get('bus-companies/:nhaXeId/active-conversation')
  @ApiOperation({
    summary: 'Lấy cuộc trò chuyện đang hoạt động với nhà xe',
    description:
      'Tra cứu cuộc trò chuyện chưa đóng hiện tại của khách hàng với một nhà xe cụ thể (nếu có).',
  })
  @ApiParam({
    name: 'nhaXeId',
    type: Number,
    description: 'ID nhà xe',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin cuộc trò chuyện thành công (hoặc null nếu chưa có).',
  })
  async getActiveConversation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('nhaXeId', ParseIntPipe) nhaXeId: number,
  ) {
    return this.chatService.getActiveConversation(principal, nhaXeId);
  }

  @Get('conversations/:id')
  @ApiOperation({
    summary: 'Chi tiết cuộc trò chuyện',
    description: 'Xem thông tin chi tiết một cuộc trò chuyện hỗ trợ.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID cuộc trò chuyện',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết cuộc trò chuyện thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy cuộc trò chuyện.',
    type: ApiErrorResponseDto,
  })
  async getConversationById(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chatService.getConversationById(principal, id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary: 'Danh sách tin nhắn trong cuộc trò chuyện',
    description: 'Tải lịch sử tin nhắn trong cuộc trò chuyện theo trang hoặc theo mốc cursor (beforeId).',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID cuộc trò chuyện',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách tin nhắn thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy cuộc trò chuyện.',
    type: ApiErrorResponseDto,
  })
  async getMessages(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatService.getMessages(principal, id, query);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({
    summary: 'Gửi tin nhắn trong cuộc trò chuyện',
    description: 'Gửi tin nhắn dạng văn bản hoặc hình ảnh vào cuộc trò chuyện và phát realtime tới đối phương.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID cuộc trò chuyện',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Gửi tin nhắn thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu tin nhắn không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  async sendMessage(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() bodyDto: SendChatMessageBodyDto,
  ) {
    const dto = new SendMessageDto();
    dto.cuocTroChuyenId = id;
    dto.noiDung = bodyDto.noiDung;
    dto.loaiTinNhan = bodyDto.loaiTinNhan;
    dto.tepDinhKemUrl = bodyDto.tepDinhKemUrl;
    dto.clientMessageId = bodyDto.clientMessageId;
    const message = await this.chatService.sendMessage(principal, dto);

    try {
      const conv = await this.chatService.getConversationById(principal, id);
      if (typeof this.chatGateway.emitMessageNew === 'function') {
        await this.chatGateway.emitMessageNew(message, conv);
      } else {
        this.chatGateway.server
          ?.to(`conversation_${id}`)
          .emit(CHAT_EVENTS.MESSAGE_NEW, message);

        if (message.loaiNguoiGui === 'KHACH_HANG') {
          this.chatGateway.server
            ?.to(`company_${conv.nhaXeId}`)
            .emit(CHAT_EVENTS.MESSAGE_NEW, {
              ...resultOrMessage(message),
              cuocTroChuyen: {
                cuocTroChuyenId: conv.cuocTroChuyenId,
                tieuDe: conv.tieuDe,
                khachHang: conv.khachHang,
              },
            });
        }
      }
    } catch {
      // Socket emission best-effort
    }

    return message;
  }

  @Post('conversations/:id/claim')
  @ApiOperation({
    summary: 'Nhân viên nhận xử lý cuộc trò chuyện',
    description: 'Nhân viên hỗ trợ của nhà xe tiếp nhận cuộc trò chuyện từ trạng thái CHO_TIEP_NHAN sang DANG_XU_LY.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID cuộc trò chuyện',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Nhận xử lý cuộc trò chuyện thành công.',
  })
  async claimConversation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const updated = await this.chatService.claimConversation(principal, id);

    try {
      if (typeof this.chatGateway.emitConversationClaimed === 'function') {
        await this.chatGateway.emitConversationClaimed(updated);
      } else {
        this.chatGateway.server
          ?.to(`conversation_${id}`)
          .emit(CHAT_EVENTS.CONVERSATION_CLAIMED, updated);

        this.chatGateway.server
          ?.to(`company_${updated.nhaXeId}`)
          .emit(CHAT_EVENTS.CONVERSATION_CLAIMED, updated);
      }
    } catch {
      // Socket emission best-effort
    }

    return updated;
  }

  @Post('conversations/:id/close')
  @ApiOperation({
    summary: 'Đóng cuộc trò chuyện',
    description: 'Kết thúc cuộc trò chuyện hỗ trợ và lưu lý do đóng nếu có.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID cuộc trò chuyện',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Đóng cuộc trò chuyện thành công.',
  })
  async closeConversation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseConversationDto,
  ) {
    const closed = await this.chatService.closeConversation(principal, id, dto);

    try {
      if (typeof this.chatGateway.emitConversationClosed === 'function') {
        await this.chatGateway.emitConversationClosed(closed);
      } else {
        this.chatGateway.server
          ?.to(`conversation_${id}`)
          .emit(CHAT_EVENTS.CONVERSATION_CLOSED, closed);

        this.chatGateway.server
          ?.to(`company_${closed.nhaXeId}`)
          .emit(CHAT_EVENTS.CONVERSATION_CLOSED, closed);
      }
    } catch {
      // Socket emission best-effort
    }

    return closed;
  }

  @Post('conversations/:id/read')
  @ApiOperation({
    summary: 'Đánh dấu tin nhắn đã đọc',
    description: 'Xác nhận đã đọc các tin nhắn trong cuộc trò chuyện và gửi biên nhận (read receipt) tới phía bên kia.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID cuộc trò chuyện',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái đã đọc thành công.',
  })
  async markAsRead(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkReadDto,
  ) {
    const result = await this.chatService.markMessagesAsRead(principal, id, dto);

    try {
      const receiptPayload = {
        cuocTroChuyenId: id,
        readByTaiKhoanId: principal.taiKhoanId,
        tinNhanIds: dto?.tinNhanIds,
        updatedCount: result.updatedCount,
      };
      if (typeof this.chatGateway.emitMessagesReadReceipt === 'function') {
        await this.chatGateway.emitMessagesReadReceipt(receiptPayload);
      } else {
        this.chatGateway.server
          ?.to(`conversation_${id}`)
          .emit(CHAT_EVENTS.MESSAGES_READ_RECEIPT, receiptPayload);
      }
    } catch {
      // Socket emission best-effort
    }

    return result;
  }
}

function resultOrMessage<T extends Record<string, unknown>>(msg: T): T {
  return msg;
}
