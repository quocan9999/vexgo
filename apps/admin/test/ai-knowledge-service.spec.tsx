import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeDocumentDetail,
  getKnowledgeDocuments,
  toggleKnowledgeDocumentStatus,
  updateKnowledgeDocument,
  sendTestChatMessage,
} from '@/features/ai-knowledge/services/ai-knowledge-service';
import type { AiKnowledgeDocumentItem } from '@/features/ai-knowledge/types/ai-knowledge';

const state = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/admin-api-client', () => ({ adminApiFetch: state.fetch }));

const mockDocument: AiKnowledgeDocumentItem = {
  id: 1,
  documentCode: 'DOC-CANCEL-POLICY',
  title: 'Chính sách Hủy vé và Hoàn tiền VexGo',
  category: 'CHINH_SACH_HOAN_HUY',
  scope: 'GLOBAL',
  nhaXeId: null,
  hierarchyPath: '[Quy chế VexGo] > [Chương II: Đổi trả và Hủy vé]',
  rawContent: 'Phí hủy vé trước 24 giờ là 10%...',
  isActive: true,
  createdAt: '2026-11-06T08:05:00.000Z',
  updatedAt: '2026-11-06T08:05:00.000Z',
  _count: { chunks: 2 },
  chunks: [
    {
      id: 101,
      documentId: 1,
      chunkIndex: 0,
      headerPrefix: '[Quy chế VexGo] > [Chương II: Đổi trả và Hủy vé]',
      rawContent: 'Phí hủy vé trước 24 giờ là 10%...',
      groundedContent: '[Quy chế VexGo]\n\nPhí hủy vé trước 24 giờ là 10%...',
      embeddingModel: 'jina-embeddings-v3',
      createdAt: '2026-11-06T08:05:00.000Z',
      updatedAt: '2026-11-06T08:05:00.000Z',
    },
  ],
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4002';
});

afterEach(() => {
  state.fetch.mockReset();
});

describe('AiKnowledgeService (Admin API Client)', () => {
  it('1. should query documents with pagination and query parameters', async () => {
    state.fetch.mockResolvedValue(
      response({
        data: [mockDocument],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      }),
    );

    const result = await getKnowledgeDocuments({
      page: 1,
      pageSize: 10,
      search: 'hủy vé',
      category: 'CHINH_SACH_HOAN_HUY',
      scope: 'GLOBAL',
      isActive: true,
    });

    const calledUrl = state.fetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('/api/v1/ai-chatbot/admin/documents?');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('pageSize=10');
    expect(calledUrl).toContain('search=h%E1%BB%A7y+v%C3%A9');
    expect(calledUrl).toContain('category=CHINH_SACH_HOAN_HUY');
    expect(calledUrl).toContain('scope=GLOBAL');
    expect(calledUrl).toContain('isActive=true');
    expect(result.data[0]?.documentCode).toBe('DOC-CANCEL-POLICY');
  });

  it('2. should fetch document detail by ID', async () => {
    state.fetch.mockResolvedValue(response({ data: mockDocument }));

    const result = await getKnowledgeDocumentDetail(1);

    expect(state.fetch.mock.calls[0]?.[0]).toBe(
      'http://localhost:4002/api/v1/ai-chatbot/admin/documents/1',
    );
    expect(result.title).toBe('Chính sách Hủy vé và Hoàn tiền VexGo');
    expect(result.chunks?.length).toBe(1);
  });

  it('3. should post create request with JSON body', async () => {
    state.fetch.mockResolvedValue(response({ data: mockDocument }));

    const input = {
      title: 'Quy định đón trả khách',
      category: 'FAQ_CHUNG',
      scope: 'GLOBAL' as const,
      hierarchyPath: '[VexGo] > [Đón trả]',
      rawContent: 'Đón khách trước 15 phút tại bến xe.',
    };

    await createKnowledgeDocument(input);

    const [url, init] = state.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4002/api/v1/ai-chatbot/admin/documents');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(input);
  });

  it('4. should send PUT update request for document', async () => {
    state.fetch.mockResolvedValue(
      response({ data: { ...mockDocument, title: 'Tiêu đề cập nhật' } }),
    );

    const updateInput = {
      title: 'Tiêu đề cập nhật',
      rawContent: 'Nội dung mới cập nhật...',
    };

    await updateKnowledgeDocument(1, updateInput);

    const [url, init] = state.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4002/api/v1/ai-chatbot/admin/documents/1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual(updateInput);
  });

  it('5. should send PATCH request to toggle status', async () => {
    state.fetch.mockResolvedValue(
      response({ data: { ...mockDocument, isActive: false } }),
    );

    const result = await toggleKnowledgeDocumentStatus(1);

    const [url, init] = state.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4002/api/v1/ai-chatbot/admin/documents/1/status');
    expect(init.method).toBe('PATCH');
    expect(result.isActive).toBe(false);
  });

  it('6. should send DELETE request to remove document', async () => {
    state.fetch.mockResolvedValue(
      response({
        data: { success: true, message: 'Đã xóa tài liệu thành công.' },
      }),
    );

    const result = await deleteKnowledgeDocument(1);

    const [url, init] = state.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4002/api/v1/ai-chatbot/admin/documents/1');
    expect(init.method).toBe('DELETE');
    expect(result.success).toBe(true);
  });

  it('7. should handle API error responses gracefully', async () => {
    state.fetch.mockResolvedValue(
      response({ error: 'DOCUMENT_NOT_FOUND', message: 'Không tìm thấy tài liệu.' }, 404),
    );

    await expect(getKnowledgeDocumentDetail(999)).rejects.toMatchObject({
      message: 'Không tìm thấy tài liệu.',
      code: 'DOCUMENT_NOT_FOUND',
      status: 404,
    });
  });

  it('8. should send test chat message to correct /messages endpoint with POST', async () => {
    state.fetch.mockResolvedValue(
      response({
        data: {
          sessionToken: 'test-session-123',
          reply: 'Quy định hành lý cho phép 20kg miễn phí.',
          intent: 'POLICY_QUERY',
          citations: [
            {
              documentCode: 'DOC-BAGGAGE-01',
              title: 'Quy định hành lý',
              hierarchyPath: '[Quy chế] > [Hành lý]',
              relevanceScore: 90,
            },
          ],
          requiresHumanHandoff: false,
        },
      }),
    );

    const result = await sendTestChatMessage('Quy định hành lý mang theo ra sao?');

    const [url, init] = state.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4002/api/v1/ai-chatbot/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      message: 'Quy định hành lý mang theo ra sao?',
      sessionToken: undefined,
    });
    expect(result.reply).toBe('Quy định hành lý cho phép 20kg miễn phí.');
    expect(result.citations.length).toBe(1);
  });
});
