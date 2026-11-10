import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiKnowledgeAdminController } from '../../../src/ai-chatbot/admin/ai-knowledge-admin.controller.js';
import type { AiKnowledgeAdminService } from '../../../src/ai-chatbot/admin/ai-knowledge-admin.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

describe('AiKnowledgeAdminController', () => {
  let controller: AiKnowledgeAdminController;

  const mockService = {
    getDocuments: vi.fn(),
    getDocumentDetail: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    toggleDocumentStatus: vi.fn(),
    deleteDocument: vi.fn(),
  } as unknown as AiKnowledgeAdminService;

  const principal: AuthPrincipal = {
    taiKhoanId: 1,
    sessionId: 'session-id',
    roles: ['SUPER_ADMIN'],
    permissions: [],
    nhanVienId: null,
    nhaXeId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AiKnowledgeAdminController(mockService);
  });

  it('should delegate getDocuments to service', async () => {
    vi.mocked(mockService.getDocuments).mockResolvedValue({ data: [], meta: {} as any });
    const query = { page: 1, pageSize: 10 };

    await controller.getDocuments(query, principal);
    expect(mockService.getDocuments).toHaveBeenCalledWith(query, principal);
  });

  it('should delegate getDocumentDetail to service', async () => {
    vi.mocked(mockService.getDocumentDetail).mockResolvedValue({ data: { id: 1 } as any });

    await controller.getDocumentDetail(1, principal);
    expect(mockService.getDocumentDetail).toHaveBeenCalledWith(1, principal);
  });

  it('should delegate createDocument to service', async () => {
    const dto = {
      title: 'Chính sách test',
      category: 'FAQ_CHUNG',
      hierarchyPath: '[Test]',
      rawContent: 'Nội dung test',
    };
    vi.mocked(mockService.createDocument).mockResolvedValue({ data: { id: 1 } as any });

    await controller.createDocument(dto, principal);
    expect(mockService.createDocument).toHaveBeenCalledWith(dto, principal);
  });

  it('should delegate updateDocument to service', async () => {
    const dto = { title: 'Tiêu đề cập nhật' };
    vi.mocked(mockService.updateDocument).mockResolvedValue({ data: { id: 1 } as any });

    await controller.updateDocument(1, dto, principal);
    expect(mockService.updateDocument).toHaveBeenCalledWith(1, dto, principal);
  });

  it('should delegate toggleDocumentStatus to service', async () => {
    vi.mocked(mockService.toggleDocumentStatus).mockResolvedValue({ data: { id: 1, isActive: false } as any });

    await controller.toggleDocumentStatus(1, principal);
    expect(mockService.toggleDocumentStatus).toHaveBeenCalledWith(1, principal);
  });

  it('should delegate deleteDocument to service', async () => {
    vi.mocked(mockService.deleteDocument).mockResolvedValue({ data: { success: true, message: 'Đã xóa' } });

    await controller.deleteDocument(1, principal);
    expect(mockService.deleteDocument).toHaveBeenCalledWith(1, principal);
  });
});
