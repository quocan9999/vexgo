import type {
  ChatbotMessageResponse,
  AiSuggestionItem,
} from '../types/ai-chatbot.types.js';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const aiChatbotService = {
  /**
   * Gửi tin nhắn tới API Trợ lý ảo AI
   */
  async sendMessage(payload: {
    message: string;
    sessionToken?: string;
    nhaXeId?: number;
  }): Promise<ChatbotMessageResponse> {
    const res = await fetch(`${API_BASE_URL}/ai-chatbot/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Gửi tin nhắn thất bại (HTTP ${res.status})`);
    }

    const json = await res.json();
    return (json.data || json) as ChatbotMessageResponse;
  },

  /**
   * Lấy danh sách câu hỏi gợi ý nhanh mặc định
   */
  async getSuggestions(): Promise<AiSuggestionItem[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/ai-chatbot/suggestions`);
      if (res.ok) {
        const json = await res.json();
        return (json.data || json) as AiSuggestionItem[];
      }
    } catch {
      // Fallback nếu mạng lỗi
    }
    return [
      {
        id: '1',
        category: 'CHINH_SACH',
        question: 'Chính sách hoàn hủy vé thế nào?',
        description: 'Biểu phí hủy vé theo thời gian',
      },
      {
        id: '2',
        category: 'QUY_DINH',
        question: 'Quy định hành lý mang theo ra sao?',
        description: 'Hành lý xách tay và ký gửi',
      },
      {
        id: '3',
        category: 'TIM_CHUYEN',
        question: 'Tìm chuyến xe từ TP.HCM đi Đà Lạt',
        description: 'Tra cứu chuyến xe hôm nay',
      },
      {
        id: '4',
        category: 'UU_DAI',
        question: 'Các mã khuyến mãi đang áp dụng?',
        description: 'Mã giảm giá đặt vé hiện hành',
      },
    ];
  },

  /**
   * Khôi phục lịch sử tin nhắn của phiên
   */
  async getSessionHistory(sessionToken: string) {
    const res = await fetch(
      `${API_BASE_URL}/ai-chatbot/sessions/${encodeURIComponent(sessionToken)}/messages`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || json;
  },
};
