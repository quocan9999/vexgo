import { AdminSupportConversation, AdminSupportMessage } from '../types';
import { getApiBaseUrl } from '@/lib/api-url';
import { adminApiFetch } from '@/lib/admin-api-client';

function getChatApiBaseUrl(): string {
  return `${getApiBaseUrl()}/api/v1`;
}

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
      errorBody.message || 'An error occurred while connecting to the server.',
    );
  }
  const envelope = await res.json();
  return envelope.data !== undefined ? envelope.data : envelope;
}

export const adminSupportChatApi = {
  /**
   * Get list of conversations within operator scope
   */
  async listConversations(
    params: {
      trangThai?: string;
      page?: number;
      pageSize?: number;
      search?: string;
    },
    token: string,
  ): Promise<{
    data: AdminSupportConversation[];
    meta?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params.trangThai) query.set('trangThai', params.trangThai);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.search && params.search.trim())
      query.set('search', params.search.trim());

    const res = await adminApiFetch(
      `${getChatApiBaseUrl()}/support-chat/conversations?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new AdminChatApiError(
        res.status,
        errorBody.error || 'API_ERROR',
        errorBody.message || 'An error occurred while loading conversation list.',
      );
    }
    return res.json();
  },

  /**
   * Get conversation details
   */
  async getConversationById(
    id: number,
    token: string,
  ): Promise<AdminSupportConversation> {
    const res = await adminApiFetch(
      `${getChatApiBaseUrl()}/support-chat/conversations/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return handleResponse<AdminSupportConversation>(res);
  },

  /**
   * Get message history (supports beforeId for older messages)
   */
  async getMessages(
    conversationId: number,
    token: string,
    beforeIdOrOptions?: number | { beforeId?: number; pageSize?: number },
  ): Promise<AdminSupportMessage[]> {
    const query = new URLSearchParams();
    let beforeId: number | undefined;
    let pageSize = 50;

    if (typeof beforeIdOrOptions === 'number') {
      beforeId = beforeIdOrOptions;
    } else if (beforeIdOrOptions) {
      beforeId = beforeIdOrOptions.beforeId;
      if (beforeIdOrOptions.pageSize) pageSize = beforeIdOrOptions.pageSize;
    }

    query.set('pageSize', String(pageSize));
    if (beforeId) query.set('beforeId', String(beforeId));

    const res = await adminApiFetch(
      `${getChatApiBaseUrl()}/support-chat/conversations/${conversationId}/messages?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return handleResponse<AdminSupportMessage[]>(res);
  },

  /**
   * Staff sends reply message
   */
  async sendMessage(
    conversationId: number,
    content: string,
    token: string,
    clientMessageId?: string,
  ): Promise<AdminSupportMessage> {
    const res = await adminApiFetch(
      `${getChatApiBaseUrl()}/support-chat/conversations/${conversationId}/messages`,
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
   * Staff claims conversation
   */
  async claimConversation(
    conversationId: number,
    token: string,
  ): Promise<AdminSupportConversation> {
    const res = await adminApiFetch(
      `${getChatApiBaseUrl()}/support-chat/conversations/${conversationId}/claim`,
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
   * End conversation
   */
  async closeConversation(
    conversationId: number,
    token: string,
    lyDo?: string,
  ): Promise<AdminSupportConversation> {
    const res = await adminApiFetch(
      `${getChatApiBaseUrl()}/support-chat/conversations/${conversationId}/close`,
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
   * Mark messages as read
   */
  async markMessagesAsRead(
    conversationId: number,
    token: string,
    tinNhanIds?: number[],
  ): Promise<{ updatedCount: number }> {
    const res = await adminApiFetch(
      `${getChatApiBaseUrl()}/support-chat/conversations/${conversationId}/read`,
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
