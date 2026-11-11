import type { BusCompany, SupportConversation, SupportMessage } from '../types';

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

export function mapBusCompanyDto(raw: unknown): BusCompany {
  if (!raw || typeof raw !== 'object') {
    throw new SupportChatApiError(
      500,
      'INVALID_BUS_COMPANY_RESPONSE',
      'Dữ liệu nhà xe không hợp lệ.',
    );
  }
  const record = raw as Record<string, unknown>;
  const busCompanyId = Number(record.busCompanyId);
  const name = typeof record.name === 'string' ? record.name.trim() : '';

  if (!Number.isInteger(busCompanyId) || busCompanyId <= 0 || !name) {
    throw new SupportChatApiError(
      500,
      'INVALID_BUS_COMPANY_RESPONSE',
      'Dữ liệu nhà xe không hợp lệ.',
    );
  }

  return {
    busCompanyId,
    code: typeof record.code === 'string' ? record.code : '',
    name,
    contactInfo:
      typeof record.contactInfo === 'string' &&
      record.contactInfo.trim().length > 0
        ? record.contactInfo.trim()
        : null,
    status: typeof record.status === 'string' ? record.status : 'HOAT_DONG',
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

function assertValidBusCompanyId(nhaXeId: number): void {
  if (!Number.isInteger(nhaXeId) || nhaXeId <= 0) {
    throw new SupportChatApiError(
      400,
      'INVALID_BUS_COMPANY_ID',
      'Mã nhà xe không hợp lệ.',
    );
  }
}

export const supportChatApi = {
  async markMessagesAsRead(
    conversationId: number,
    token: string,
    messageIds: number[],
  ): Promise<{ updatedCount: number }> {
    if (messageIds.length === 0) return { updatedCount: 0 };
    const res = await fetch(
      `${API_BASE_URL}/support-chat/conversations/${conversationId}/read`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tinNhanIds: messageIds }),
      },
    );
    return handleResponse<{ updatedCount: number }>(res);
  },
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

    const res = await fetch(
      `${API_BASE_URL}/bus-companies?${params.toString()}`,
    );
    const items = await handleResponse<unknown[]>(res);
    if (!Array.isArray(items)) return [];
    return items.map(mapBusCompanyDto);
  },

  /**
   * Kiểm tra cuộc trò chuyện đang mở với nhà xe này
   */
  async getActiveConversation(
    nhaXeId: number,
    token: string,
  ): Promise<SupportConversation | null> {
    assertValidBusCompanyId(nhaXeId);
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
    data: {
      nhaXeId: number;
      tieuDe?: string;
      tinNhanDauTien?: string;
      clientMessageId?: string;
    },
    token: string,
  ): Promise<SupportConversation> {
    assertValidBusCompanyId(data.nhaXeId);
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
   * Lấy chi tiết cuộc trò chuyện theo ID
   */
  async getConversationById(
    conversationId: number,
    token: string,
  ): Promise<SupportConversation> {
    const res = await fetch(
      `${API_BASE_URL}/support-chat/conversations/${conversationId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return handleResponse<SupportConversation>(res);
  },

  /**
   * Lấy lịch sử tin nhắn của cuộc trò chuyện (hỗ trợ beforeId để tải tin cũ hơn)
   */
  async getMessages(
    conversationId: number,
    token: string,
    beforeIdOrOptions?: number | { beforeId?: number; pageSize?: number },
  ): Promise<SupportMessage[]> {
    const params = new URLSearchParams();
    let beforeId: number | undefined;
    let pageSize = 40;

    if (typeof beforeIdOrOptions === 'number') {
      beforeId = beforeIdOrOptions;
    } else if (beforeIdOrOptions) {
      beforeId = beforeIdOrOptions.beforeId;
      if (beforeIdOrOptions.pageSize) pageSize = beforeIdOrOptions.pageSize;
    }

    params.set('pageSize', String(pageSize));
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

  /**
   * Lấy danh sách các cuộc trò chuyện của khách hàng (kể cả đã đóng)
   */
  async listConversations(
    params: {
      nhaXeId?: number;
      trangThai?: string;
      page?: number;
      pageSize?: number;
    } = {},
    token: string,
  ): Promise<{
    data: SupportConversation[];
    meta?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const q = new URLSearchParams();
    if (params.nhaXeId) q.set('nhaXeId', String(params.nhaXeId));
    if (params.trangThai) q.set('trangThai', params.trangThai);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));

    const res = await fetch(
      `${API_BASE_URL}/support-chat/conversations?${q.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new SupportChatApiError(
        res.status,
        errorBody.error || 'API_ERROR',
        errorBody.message || 'Có lỗi xảy ra khi tải danh sách cuộc trò chuyện.',
      );
    }
    return res.json();
  },
};
