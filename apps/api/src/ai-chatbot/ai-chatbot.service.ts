import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AiChatbotOrchestratorService,
  type ChatbotResponse,
} from './orchestrator/ai-chatbot-orchestrator.service.js';
import type { SendMessageDto } from './dto/send-message.dto.js';

export interface DefaultSuggestion {
  id: string;
  category: string;
  question: string;
  description: string;
}

const DEFAULT_SUGGESTIONS: DefaultSuggestion[] = [
  {
    id: 'sug-cancel',
    category: 'CHINH_SACH',
    question: 'Chính sách hoàn hủy vé thế nào?',
    description: 'Biểu phí hủy vé theo thời gian và điều kiện hoàn tiền',
  },
  {
    id: 'sug-baggage',
    category: 'QUY_DINH',
    question: 'Quy định hành lý mang theo ra sao?',
    description: 'Hành lý xách tay, ký gửi miễn cước và hàng hóa quá khổ',
  },
  {
    id: 'sug-trip-dalat',
    category: 'TIM_CHUYEN',
    question: 'Tìm chuyến xe từ TP.HCM đi Đà Lạt',
    description: 'Tra cứu chuyến xe, lịch khởi hành và số ghế trống hôm nay',
  },
  {
    id: 'sug-payment-deadline',
    category: 'THANH_TOAN',
    question: 'Thời gian giữ vé thanh toán là bao lâu?',
    description: 'Thời hạn hoàn tất thanh toán sau khi đặt giữ ghế',
  },
  {
    id: 'sug-promotion',
    category: 'UU_DAI',
    question: 'Các mã khuyến mãi đang áp dụng?',
    description: 'Mã giảm giá đặt vé và ưu đãi bưu kiện hiện hành',
  },
];

@Injectable()
export class AiChatbotService {
  constructor(
    private readonly orchestrator: AiChatbotOrchestratorService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Xử lý tin nhắn người dùng và sinh câu trả lời có căn cứ
   */
  async sendMessage(dto: SendMessageDto, taiKhoanId?: number): Promise<ChatbotResponse> {
    return this.orchestrator.processUserMessage({
      message: dto.message,
      sessionToken: dto.sessionToken,
      nhaXeId: dto.nhaXeId,
      taiKhoanId,
    });
  }

  /**
   * Khôi phục lịch sử tin nhắn của phiên hội thoại AI
   */
  async getSessionMessages(sessionToken: string) {
    const session = await this.prisma.aiChatSession.findUnique({
      where: { sessionToken },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            intent: true,
            citations: true,
            toolCalls: true,
            requiresHumanHandoff: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException({
        error: 'SESSION_NOT_FOUND',
        message: `Không tìm thấy phiên hội thoại với mã "${sessionToken}".`,
      });
    }

    return {
      sessionToken: session.sessionToken,
      status: session.status,
      createdAt: session.createdAt,
      messages: session.messages,
    };
  }

  /**
   * Lấy danh sách câu hỏi gợi ý nhanh mặc định
   */
  getSuggestions(): DefaultSuggestion[] {
    return DEFAULT_SUGGESTIONS;
  }
}
