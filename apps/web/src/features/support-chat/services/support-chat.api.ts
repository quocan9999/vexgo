import { BusCompany, SupportConversation, SupportMessage } from '../types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class SupportChatApiError extends Error {
  status: number;
  error: string;

  constructor(status: number, error: string, message: string) {
    super(message);
    this.name = 'SupportChatApiError';
    this.status = status;
    this.error = error;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new SupportChatApiError(
      res.status,
      errorBody.error || 'API_ERROR',
      errorBody.message || 'Có lỗi xảy ra khi kết nối tới máy chủ.',
    );
  }
  const envelope = await res.json();
  return envelope.data !== undefined ? envelope.data : envelope;
}

export const supportChatApi = {
  /**
   * Lấy danh sách nhà xe đang hoạt động (cho phép khách chọn nhà xe hỗ trợ)
   */
  async getActiveBusCompanies(search?: string): Promise<BusCompany[]> {
    const params = new URLSearchParams();
    params.set('status', 'HOAT_DONG');
    params.set('pageSize', '50');
    if (search && search.trim()) {
      params.set('search', search.trim());
    }

    const res = await fetch(`${API_BASE_URL}/bus-companies?${params.toString()}`);
    return handleResponse<BusCompany[]>(res);
  },

  /**
   * Kiểm tra cuộc trò chuyện đang mở với nhà xe này
   */
  async getActiveConversation(
    nhaXeId: number,
    token: string,
  ): Promise<SupportConversation | null> {
    const res = await fetch(
      `${API_BASE_URL}/support-chat/bus-companies/${nhaXeId}/active-conversation`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (res.status === 404) return null;
    return handleResponse<SupportConversation | null>(res);
  },

  /**
   * Tạo cuộc trò chuyện mới với nhà xe
   */
  async createConversation(
    data: { nhaXeId: number; tieuDe?: string; tinNhanDauTien?: string; clientMessageId?: string },
    token: string,
  ): Promise<SupportConversation> {
    const res = await fetch(`${API_BASE_URL}/support-chat/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse<SupportConversation>(res);
  },

  /**
   * Lấy lịch sử tin nhắn của cuộc trò chuyện
   */
  async getMessages(
    conversationId: number,
    token: string,
    beforeId?: number,
  ): Promise<SupportMessage[]> {
    const params = new URLSearchParams();
    params.set('pageSize', '40');
    if (beforeId) {
      params.set('beforeId', String(beforeId));
    }

    const res = await fetch(
      `${API_BASE_URL}/support-chat/conversations/${conversationId}/messages?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return handleResponse<SupportMessage[]>(res);
  },

  /**
   * Gửi tin nhắn qua REST API (fallback)
   */
  async sendMessage(
    conversationId: number,
    content: string,
    token: string,
    clientMessageId?: string,
  ): Promise<SupportMessage> {
    const res = await fetch(
      `${API_BASE_URL}/support-chat/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          noiDung: content,
          loaiTinNhan: 'VAN_BAN',
          clientMessageId,
        }),
      },
    );
    return handleResponse<SupportMessage>(res);
  },

  /**
   * Đóng cuộc trò chuyện
   */
  async closeConversation(
    conversationId: number,
    token: string,
    lyDo?: string,
  ): Promise<SupportConversation> {
    const res = await fetch(
      `${API_BASE_URL}/support-chat/conversations/${conversationId}/close`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lyDo }),
      },
    );
    return handleResponse<SupportConversation>(res);
  },
};
