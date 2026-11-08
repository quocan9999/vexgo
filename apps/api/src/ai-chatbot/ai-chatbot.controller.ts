import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public, OptionalAuth } from '../auth/decorators/public.decorator.js';
import { OptionalPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { AiChatbotService } from './ai-chatbot.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Trợ lý ảo AI (AI Chatbot)')
@Controller('ai-chatbot')
export class AiChatbotController {
  constructor(private readonly chatbotService: AiChatbotService) {}

  @Post('messages')
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi tin nhắn tới Trợ lý ảo VexGo AI',
    description:
      'Gửi câu hỏi hoặc yêu cầu hỗ trợ tới Trợ lý ảo AI. Hệ thống sử dụng Hybrid RAG để tra cứu quy chế và Tool Calling thời gian thực để tra cứu chuyến xe, vé xe, bưu kiện và khuyến mãi.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Phản hồi từ Trợ lý ảo AI kèm trích dẫn và thẻ gợi ý chuyến xe (nếu có).',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu tin nhắn không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  async sendMessage(
    @Body() dto: SendMessageDto,
    @OptionalPrincipal() principal?: AuthPrincipal,
  ) {
    const response = await this.chatbotService.sendMessage(
      dto,
      principal?.taiKhoanId,
    );
    return response;
  }

  @Get('sessions/:sessionToken/messages')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Khôi phục lịch sử hội thoại AI',
    description:
      'Khôi phục phiên khách vãng lai bằng UUID bí mật; phiên gắn tài khoản yêu cầu đăng nhập đúng chủ sở hữu.',
  })
  @ApiParam({
    name: 'sessionToken',
    description: 'Mã định danh phiên hội thoại (UUID)',
    example: 'c2e4293e-2b5d-4f1a-8c65-0d2d3e9501a2',
  })
  @ApiResponse({
    status: 200,
    description: 'Lịch sử tin nhắn của phiên hội thoại.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phiên hội thoại.',
    type: ApiErrorResponseDto,
  })
  async getSessionMessages(
    @Param('sessionToken', new ParseUUIDPipe()) sessionToken: string,
    @OptionalPrincipal() principal?: AuthPrincipal,
  ) {
    return this.chatbotService.getSessionMessages(
      sessionToken,
      principal?.taiKhoanId,
    );
  }

  @Get('suggestions')
  @Public()
  @ApiOperation({
    summary: 'Danh sách câu hỏi gợi ý nhanh mặc định',
    description:
      'Cung cấp các câu hỏi mẫu để hiển thị dạng nút gợi ý nhanh cho khách hàng khi bắt đầu trò chuyện.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách các câu hỏi gợi ý nhanh.',
  })
  getSuggestions() {
    return this.chatbotService.getSuggestions();
  }
}
