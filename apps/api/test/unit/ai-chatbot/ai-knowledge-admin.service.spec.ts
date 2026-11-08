import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AiKnowledgeAdminService } from '../../../src/ai-chatbot/admin/ai-knowledge-admin.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { EmbeddingProviderService } from '../../../src/ai-chatbot/embedding/embedding-provider.service.js';
import type { TextChunkerService } from '../../../src/ai-chatbot/chunking/text-chunker.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

describe('AiKnowledgeAdminService', () => {
  let service: AiKnowledgeAdminService;

  const superAdminPrincipal: AuthPrincipal = {
    taiKhoanId: 1,
    sessionId: 'session-super',
    roles: ['SUPER_ADMIN'],
    permissions: [],
    nhanVienId: null,
    nhaXeId: null,
  };

  const tenantAdminPrincipal: AuthPrincipal = {
    taiKhoanId: 2,
    sessionId: 'session-tenant',
    roles: ['NHA_XE_ADMIN'],
    permissions: [],
    nhanVienId: 10,
    nhaXeId: 5,
  };

  const mockTextChunker = {
    splitText: vi.fn().mockImplementation((text: string, hierarchy: string) => [
      {
        chunkIndex: 0,
        headerPrefix: hierarchy,
        rawContent: text,
        groundedContent: `${hierarchy}\n\n${text}`,
      },
    ]),
  } as unknown as TextChunkerService;

  const mockEmbeddingProvider = {
    embedPassages: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  } as unknown as EmbeddingProviderService;

  const mockPrisma = {
    aiKnowledgeDocument: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    aiKnowledgeChunk: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      return callback(mockPrisma);
    }),
  } as unknown as PrismaService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiKnowledgeAdminService(
      mockPrisma,
      mockEmbeddingProvider,
      mockTextChunker,
    );
  });

  describe('1. getDocuments (Query & Multi-tenant Scoping)', () => {
    it('should allow SUPER_ADMIN to query all documents with pagination and filters', async () => {
      const mockDocs = [
        { id: 1, title: 'Chính sách hoàn hủy', documentCode: 'DOC-CANCEL-POLICY' },
      ];
      vi.mocked(mockPrisma.aiKnowledgeDocument.count).mockResolvedValue(1);
      vi.mocked(mockPrisma.aiKnowledgeDocument.findMany).mockResolvedValue(mockDocs as any);

      const result = await service.getDocuments(
        { page: 1, pageSize: 10, search: 'hoàn hủy' },
        superAdminPrincipal,
      );

      expect(result.data).toEqual(mockDocs);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      });
      expect(mockPrisma.aiKnowledgeDocument.findMany).toHaveBeenCalled();
    });

    it('should restrict TENANT_ADMIN to GLOBAL documents and their own nhaXeId', async () => {
      vi.mocked(mockPrisma.aiKnowledgeDocument.count).mockResolvedValue(0);
      vi.mocked(mockPrisma.aiKnowledgeDocument.findMany).mockResolvedValue([]);

      await service.getDocuments({ page: 1, pageSize: 10 } as any, tenantAdminPrincipal);

      const callArgs = vi.mocked(mockPrisma.aiKnowledgeDocument.findMany).mock.calls[0][0];
      expect(callArgs?.where?.OR).toEqual([
        { scope: 'GLOBAL' },
        { scope: 'TENANT', nhaXeId: 5 },
      ]);
    });

    it('should throw ForbiddenException if TENANT_ADMIN attempts to query another carrier', async () => {
      await expect(
        service.getDocuments({ page: 1, pageSize: 10, nhaXeId: 99 } as any, tenantAdminPrincipal),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. getDocumentDetail', () => {
    it('should return document detail with ordered chunks', async () => {
      const mockDoc = {
        id: 1,
        title: 'Quy định hành lý',
        scope: 'GLOBAL',
        chunks: [{ id: 10, chunkIndex: 0 }],
      };
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue(mockDoc as any);

      const result = await service.getDocumentDetail(1, tenantAdminPrincipal);
      expect(result.data).toEqual(mockDoc);
    });

    it('should throw NotFoundException when document does not exist', async () => {
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue(null);

      await expect(service.getDocumentDetail(999, superAdminPrincipal)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when TENANT_ADMIN accesses another carrier document', async () => {
      const otherTenantDoc = {
        id: 2,
        title: 'Quy định riêng nhà xe khác',
        scope: 'TENANT',
        nhaXeId: 99,
      };
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue(otherTenantDoc as any);

      await expect(
        service.getDocumentDetail(2, tenantAdminPrincipal),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. createDocument (Pipeline Chunking & Embedding)', () => {
    it('should allow SUPER_ADMIN to create a GLOBAL document and trigger chunking & embedding pipeline', async () => {
      (mockPrisma.aiKnowledgeDocument.findUnique as any).mockImplementation(async ({ where }: any) => {
        if ('documentCode' in where) return null; // code not taken
        return { id: 10, title: 'Quy định đón trả khách', chunks: [{ id: 1 }] };
      });
      vi.mocked(mockPrisma.aiKnowledgeDocument.create).mockResolvedValue({ id: 10 } as any);

      const dto = {
        title: 'Quy định đón trả khách',
        category: 'FAQ_CHUNG',
        scope: 'GLOBAL' as const,
        hierarchyPath: '[VexGo] > [Đón trả]',
        rawContent: 'Đón khách đúng giờ tại văn phòng trung chuyển.',
      };

      const result = await service.createDocument(dto, superAdminPrincipal);

      expect(mockTextChunker.splitText).toHaveBeenCalledWith(dto.rawContent, dto.hierarchyPath);
      expect(mockEmbeddingProvider.embedPassages).toHaveBeenCalled();
      expect(mockPrisma.aiKnowledgeChunk.create).toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });

    it('should reject TENANT_ADMIN when attempting to create a GLOBAL document', async () => {
      const dto = {
        title: 'Quy định toàn sàn',
        category: 'FAQ_CHUNG',
        scope: 'GLOBAL' as const,
        hierarchyPath: '[VexGo] > [Chung]',
        rawContent: 'Nội dung quy chế',
      };

      await expect(service.createDocument(dto, tenantAdminPrincipal)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if documentCode already exists', async () => {
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue({ id: 1 } as any);

      const dto = {
        documentCode: 'DOC-DUPLICATE-CODE',
        title: 'Trùng mã',
        category: 'FAQ_CHUNG',
        hierarchyPath: '[VexGo]',
        rawContent: 'Nội dung',
      };

      await expect(service.createDocument(dto, superAdminPrincipal)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('4. updateDocument (Re-chunking & Re-embedding)', () => {
    it('should update metadata only without re-chunking if content and hierarchy did not change', async () => {
      const existingDoc = {
        id: 5,
        title: 'Tiêu đề cũ',
        category: 'FAQ_CHUNG',
        scope: 'GLOBAL',
        rawContent: 'Nội dung không đổi',
        hierarchyPath: '[VexGo]',
      };
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue(existingDoc as any);
      vi.mocked(mockPrisma.aiKnowledgeDocument.update).mockResolvedValue({
        ...existingDoc,
        title: 'Tiêu đề mới',
      } as any);

      await service.updateDocument(5, { title: 'Tiêu đề mới' }, superAdminPrincipal);

      expect(mockTextChunker.splitText).not.toHaveBeenCalled();
      expect(mockEmbeddingProvider.embedPassages).not.toHaveBeenCalled();
      expect(mockPrisma.aiKnowledgeChunk.deleteMany).not.toHaveBeenCalled();
    });

    it('should re-chunk, re-embed, and replace chunks when rawContent is modified', async () => {
      const existingDoc = {
        id: 5,
        title: 'Chính sách hoàn hủy',
        category: 'CHINH_SACH_HOAN_HUY',
        scope: 'GLOBAL',
        rawContent: 'Phí hủy vé là 10%.',
        hierarchyPath: '[VexGo] > [Hủy vé]',
      };
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue(existingDoc as any);
      vi.mocked(mockPrisma.aiKnowledgeDocument.update).mockResolvedValue(existingDoc as any);

      await service.updateDocument(
        5,
        { rawContent: 'Phí hủy vé cập nhật mới là 15% trước 24 giờ.' },
        superAdminPrincipal,
      );

      expect(mockTextChunker.splitText).toHaveBeenCalledWith(
        'Phí hủy vé cập nhật mới là 15% trước 24 giờ.',
        '[VexGo] > [Hủy vé]',
      );
      expect(mockEmbeddingProvider.embedPassages).toHaveBeenCalled();
      expect(mockPrisma.aiKnowledgeChunk.deleteMany).toHaveBeenCalledWith({
        where: { documentId: 5 },
      });
      expect(mockPrisma.aiKnowledgeChunk.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if TENANT_ADMIN tries to edit a GLOBAL document', async () => {
      const globalDoc = {
        id: 1,
        title: 'Chính sách toàn sàn',
        scope: 'GLOBAL',
        nhaXeId: null,
      };
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue(globalDoc as any);

      await expect(
        service.updateDocument(1, { title: 'Sửa trái phép' }, tenantAdminPrincipal),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. toggleDocumentStatus', () => {
    it('should flip isActive boolean from true to false', async () => {
      const existingDoc = {
        id: 7,
        scope: 'TENANT',
        nhaXeId: 5,
        isActive: true,
      };
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue(existingDoc as any);
      vi.mocked(mockPrisma.aiKnowledgeDocument.update).mockResolvedValue({
        ...existingDoc,
        isActive: false,
      } as any);

      const result = await service.toggleDocumentStatus(7, tenantAdminPrincipal);

      expect(mockPrisma.aiKnowledgeDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7 },
          data: { isActive: false },
        }),
      );
      expect(result.data.isActive).toBe(false);
    });

    it('should reject TENANT_ADMIN toggling a GLOBAL document', async () => {
      const globalDoc = {
        id: 1,
        scope: 'GLOBAL',
        isActive: true,
      };
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue(globalDoc as any);

      await expect(
        service.toggleDocumentStatus(1, tenantAdminPrincipal),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('6. deleteDocument', () => {
    it('should delete document and let foreign key cascade delete chunks', async () => {
      const tenantDoc = {
        id: 12,
        scope: 'TENANT',
        nhaXeId: 5,
      };
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue(tenantDoc as any);
      vi.mocked(mockPrisma.aiKnowledgeDocument.delete).mockResolvedValue(tenantDoc as any);

      const result = await service.deleteDocument(12, tenantAdminPrincipal);

      expect(mockPrisma.aiKnowledgeDocument.delete).toHaveBeenCalledWith({
        where: { id: 12 },
      });
      expect(result.data.success).toBe(true);
    });

    it('should reject TENANT_ADMIN deleting a GLOBAL document', async () => {
      const globalDoc = {
        id: 1,
        scope: 'GLOBAL',
        nhaXeId: null,
      };
      vi.mocked(mockPrisma.aiKnowledgeDocument.findUnique).mockResolvedValue(globalDoc as any);

      await expect(
        service.deleteDocument(1, tenantAdminPrincipal),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
