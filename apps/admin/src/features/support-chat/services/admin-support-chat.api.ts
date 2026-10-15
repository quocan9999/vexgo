import { AdminSupportConversation, AdminSupportMessage } from '../types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class AdminChatApiError extends Error {
  status: number;
  error: string;

  constructor(status: number, error: string, message: string) {
    super(message);
    this.name = 'AdminChatApiError';
    this.status = status;
    this.error = error;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new AdminChatApiError(
      res.status,
      errorBody.error || 'API_ERROR',
      errorBody.message || 'Có lỗi xảy ra khi kết nối tới máy chủ.',
    );
  }
  const envelope = await res.json();
  return envelope.data !== undefined ? envelope.data : envelope;
}

export const adminSupportChatApi = {
  /**
   * Lấy danh sách cuộc trò chuyện thuộc phạm vi nhà xe
   */
  async listConversations(
    params: {
      trangThai?: string;
      page?: number;
      pageSize?: number;
    },
    token: string,
  ): Promise<{ data: AdminSupportConversation[]; meta?: Record<string, unknown> }> {
    const query = new URLSearchParams();
    if (params.trangThai) query.set('trangThai', params.trangThai);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));

    const res = await fetch(`${API_BASE_URL}/support-chat/conversations?${query.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new AdminChatApiError(
        res.status,
        errorBody.error || 'API_ERROR',
        errorBody.message || 'Có lỗi xảy ra khi tải danh sách cuộc trò chuyện.',
      );
    }
    return res.json();
  },

  /**
   * Lấy chi tiết cuộc trò chuyện
   */
  async getConversationById(
    id: number,
    token: string,
  ): Promise<AdminSupportConversation> {
    const res = await fetch(`${API_BASE_URL}/support-chat/conversations/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<AdminSupportConversation>(res);
  },

  /**
   * Lấy lịch sử tin nhắn
   */
  async getMessages(
    conversationId: number,
    token: string,
    beforeId?: number,
  ): Promise<AdminSupportMessage[]> {
    const query = new URLSearchParams();
    query.set('pageSize', '50');
    if (beforeId) query.set('beforeId', String(beforeId));

    const res = await fetch(
      `${API_BASE_URL}/support-chat/conversations/${conversationId}/messages?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return handleResponse<AdminSupportMessage[]>(res);
  },

  /**
   * Nhân viên gửi tin nhắn phản hồi
   */
  async sendMessage(
    conversationId: number,
    content: string,
    token: string,
    clientMessageId?: string,
  ): Promise<AdminSupportMessage> {
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
    return handleResponse<AdminSupportMessage>(res);
  },

  /**
   * Nhân viên tiếp nhận cuộc trò chuyện
   */
  async claimConversation(
    conversationId: number,
    token: string,
  ): Promise<AdminSupportConversation> {
    const res = await fetch(
      `${API_BASE_URL}/support-chat/conversations/${conversationId}/claim`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return handleResponse<AdminSupportConversation>(res);
  },

  /**
   * Kết thúc cuộc trò chuyện
   */
  async closeConversation(
    conversationId: number,
    token: string,
    lyDo?: string,
  ): Promise<AdminSupportConversation> {
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
    return handleResponse<AdminSupportConversation>(res);
  },

  /**
   * Đánh dấu đã đọc
   */
  async markMessagesAsRead(
    conversationId: number,
    token: string,
    tinNhanIds?: number[],
  ): Promise<{ updatedCount: number }> {
    const res = await fetch(
      `${API_BASE_URL}/support-chat/conversations/${conversationId}/read`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tinNhanIds }),
      },
    );
    return handleResponse<{ updatedCount: number }>(res);
  },
};
