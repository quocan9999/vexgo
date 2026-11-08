import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthPrincipal } from '../../auth/tokens/auth-principal.js';
import { EmbeddingProviderService } from '../embedding/embedding-provider.service.js';
import { TextChunkerService } from '../chunking/text-chunker.service.js';
import type { QueryKnowledgeDocumentsDto } from './dto/query-knowledge-documents.dto.js';
import type { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto.js';
import type { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto.js';

@Injectable()
export class AiKnowledgeAdminService {
  private readonly logger = new Logger(AiKnowledgeAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingProvider: EmbeddingProviderService,
    private readonly textChunker: TextChunkerService,
  ) {}

  private isSuperAdmin(principal: AuthPrincipal): boolean {
    return Array.isArray(principal.roles) && principal.roles.includes('SUPER_ADMIN');
  }

  /**
   * Truy vấn danh sách tài liệu tri thức kèm phân trang, tìm kiếm và lọc đa điều kiện
   */
  async getDocuments(query: QueryKnowledgeDocumentsDto, principal: AuthPrincipal) {
    const {
      page = 1,
      pageSize = 10,
      search,
      keyword,
      category,
      scope,
      nhaXeId,
      isActive,
      sortBy = 'createdAt',
      sortDirection = 'desc',
    } = query;

    const isSuper = this.isSuperAdmin(principal);
    const tenantId = principal.nhaXeId ?? null;

    const where: Prisma.AiKnowledgeDocumentWhereInput = {};

    // 1. Phân quyền truy cập theo Tenant / Super Admin
    if (isSuper) {
      if (scope) {
        where.scope = scope;
      }
      if (nhaXeId !== undefined) {
        where.nhaXeId = nhaXeId;
      }
    } else {
      if (!tenantId) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'TENANT_SCOPE_REQUIRED',
          message: 'Tài khoản chưa được gán nhà xe hợp lệ.',
        });
      }

      if (query.nhaXeId !== undefined && query.nhaXeId !== tenantId) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'TENANT_SCOPE_VIOLATION',
          message: 'Không được truy cập dữ liệu của nhà xe khác.',
        });
      }

      if (scope === 'GLOBAL') {
        where.scope = 'GLOBAL';
      } else if (scope === 'TENANT') {
        where.scope = 'TENANT';
        where.nhaXeId = tenantId;
      } else {
        where.OR = [{ scope: 'GLOBAL' }, { scope: 'TENANT', nhaXeId: tenantId }];
      }
    }

    // 2. Lọc theo danh mục
    if (category) {
      where.category = category;
    }

    // 3. Lọc theo trạng thái hoạt động
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // 4. Tìm kiếm từ khóa theo tiêu đề hoặc mã tài liệu
    const rawSearch = (keyword ?? search)?.trim();
    if (rawSearch) {
      const searchCondition = {
        OR: [
          { title: { contains: rawSearch } },
          { documentCode: { contains: rawSearch } },
        ],
      };

      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchCondition];
        delete where.OR;
      } else {
        where.AND = [searchCondition];
      }
    }

    const take = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const skip = (currentPage - 1) * take;

    const allowedSortFields = ['createdAt', 'updatedAt', 'title', 'documentCode'];
    const resolvedSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const resolvedSortDir = sortDirection === 'asc' ? 'asc' : 'desc';

    const [totalItems, items] = await Promise.all([
      this.prisma.aiKnowledgeDocument.count({ where }),
      this.prisma.aiKnowledgeDocument.findMany({
        where,
        skip,
        take,
        orderBy: {
          [resolvedSortBy]: resolvedSortDir,
        },
        include: {
          _count: {
            select: { chunks: true },
          },
          nhaXe: {
            select: {
              nhaXeId: true,
              tenNhaXe: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / take) || 1;

    return {
      data: items,
      meta: {
        page: currentPage,
        pageSize: take,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Lấy chi tiết tài liệu kèm danh sách phân đoạn (chunks) đối soát
   */
  async getDocumentDetail(id: number, principal: AuthPrincipal) {
    const doc = await this.prisma.aiKnowledgeDocument.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
        nhaXe: {
          select: {
            nhaXeId: true,
            tenNhaXe: true,
          },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'DOCUMENT_NOT_FOUND',
        message: 'Không tìm thấy tài liệu tri thức.',
      });
    }

    if (!this.isSuperAdmin(principal)) {
      const tenantId = principal.nhaXeId;
      if (doc.scope === 'TENANT' && doc.nhaXeId !== tenantId) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'TENANT_SCOPE_VIOLATION',
          message: 'Không có quyền truy cập tài liệu của nhà xe khác.',
        });
      }
    }

    return { data: doc };
  }

  /**
   * Tạo mới tài liệu tri thức và tự động chạy quy trình chunking & embedding
   */
  async createDocument(dto: CreateKnowledgeDocumentDto, principal: AuthPrincipal) {
    const isSuper = this.isSuperAdmin(principal);
    const tenantId = principal.nhaXeId ?? null;

    let targetScope: 'GLOBAL' | 'TENANT' = dto.scope ?? 'GLOBAL';
    let targetNhaXeId: number | null = dto.nhaXeId ?? null;

    if (!isSuper) {
      if (!tenantId) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'TENANT_SCOPE_REQUIRED',
          message: 'Tài khoản chưa được gán nhà xe hợp lệ.',
        });
      }
      if (dto.scope === 'GLOBAL') {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'ROLE_FORBIDDEN',
          message: 'Quản trị viên nhà xe chỉ được tạo tài liệu trong phạm vi nhà xe của mình.',
        });
      }
      targetScope = 'TENANT';
      targetNhaXeId = tenantId;
    } else {
      if (targetScope === 'TENANT' && !targetNhaXeId) {
        throw new ForbiddenException({
          statusCode: 400,
          error: 'NHA_XE_ID_REQUIRED',
          message: 'Vui lòng chọn nhà xe khi tạo tài liệu cấp TENANT.',
        });
      }
      if (targetScope === 'GLOBAL') {
        targetNhaXeId = null;
      }
    }

    // Tạo mã documentCode tự động nếu không truyền vào
    let docCode = dto.documentCode?.trim();
    if (!docCode) {
      const sanitizedCat = dto.category.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      docCode = `DOC-${sanitizedCat}-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
    } else {
      const existing = await this.prisma.aiKnowledgeDocument.findUnique({
        where: { documentCode: docCode },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          statusCode: 409,
          error: 'DOCUMENT_CODE_EXISTS',
          message: `Mã tài liệu '${docCode}' đã tồn tại trong hệ thống.`,
        });
      }
    }

    const rawContent = dto.rawContent.trim();
    const hierarchyPath = dto.hierarchyPath.trim();

    // 1. Phân đoạn nội dung ngoài transaction
    const chunks = this.textChunker.splitText(rawContent, hierarchyPath);

    // 2. Nhúng vector cho toàn bộ chunks (gọi external service ngoài transaction)
    const passageTexts = chunks.map((c) => c.groundedContent);
    const embeddings =
      passageTexts.length > 0
        ? await this.embeddingProvider.embedPassages(passageTexts)
        : [];

    // 3. Lưu trữ nguyên tử tài liệu và các đoạn phân mảnh trong database transaction
    const created = await this.prisma.$transaction(async (tx) => {
      const document = await tx.aiKnowledgeDocument.create({
        data: {
          documentCode: docCode!,
          title: dto.title.trim(),
          category: dto.category.trim(),
          scope: targetScope,
          nhaXeId: targetNhaXeId,
          hierarchyPath,
          rawContent,
          isActive: dto.isActive ?? true,
        },
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i] || [];
        await tx.aiKnowledgeChunk.create({
          data: {
            documentId: document.id,
            chunkIndex: chunk.chunkIndex,
            headerPrefix: chunk.headerPrefix,
            rawContent: chunk.rawContent,
            groundedContent: chunk.groundedContent,
            embedding,
            embeddingModel: 'jina-embeddings-v3',
          },
        });
      }

      return tx.aiKnowledgeDocument.findUnique({
        where: { id: document.id },
        include: {
          _count: { select: { chunks: true } },
          nhaXe: { select: { nhaXeId: true, tenNhaXe: true } },
        },
      });
    });

    this.logger.log(`Created document [${docCode}] with ${chunks.length} chunks.`);
    return { data: created };
  }

  /**
   * Cập nhật tài liệu tri thức; tự động re-chunk và re-embed nếu nội dung hoặc đường dẫn thay đổi
   */
  async updateDocument(
    id: number,
    dto: UpdateKnowledgeDocumentDto,
    principal: AuthPrincipal,
  ) {
    const existing = await this.prisma.aiKnowledgeDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'DOCUMENT_NOT_FOUND',
        message: 'Không tìm thấy tài liệu tri thức.',
      });
    }

    const isSuper = this.isSuperAdmin(principal);
    const tenantId = principal.nhaXeId ?? null;

    if (!isSuper) {
      if (existing.scope === 'GLOBAL') {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'ROLE_FORBIDDEN',
          message: 'Quản trị viên nhà xe không được chỉnh sửa tài liệu toàn sàn.',
        });
      }
      if (existing.nhaXeId !== tenantId) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'TENANT_SCOPE_VIOLATION',
          message: 'Không có quyền chỉnh sửa tài liệu của nhà xe khác.',
        });
      }
      if (dto.scope === 'GLOBAL') {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'ROLE_FORBIDDEN',
          message: 'Quản trị viên nhà xe không được chuyển tài liệu thành toàn sàn.',
        });
      }
    }

    const newRawContent =
      dto.rawContent !== undefined ? dto.rawContent.trim() : existing.rawContent;
    const newHierarchyPath =
      dto.hierarchyPath !== undefined ? dto.hierarchyPath.trim() : existing.hierarchyPath;

    const contentChanged =
      dto.rawContent !== undefined && newRawContent !== existing.rawContent;
    const hierarchyChanged =
      dto.hierarchyPath !== undefined && newHierarchyPath !== existing.hierarchyPath;
    const shouldReindex = contentChanged || hierarchyChanged;

    let newChunks: ReturnType<typeof this.textChunker.splitText> = [];
    let newEmbeddings: number[][] = [];

    if (shouldReindex) {
      newChunks = this.textChunker.splitText(newRawContent, newHierarchyPath);
      const passageTexts = newChunks.map((c) => c.groundedContent);
      newEmbeddings =
        passageTexts.length > 0
          ? await this.embeddingProvider.embedPassages(passageTexts)
          : [];
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.aiKnowledgeDocument.update({
        where: { id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() : undefined,
          category: dto.category !== undefined ? dto.category.trim() : undefined,
          scope: isSuper && dto.scope !== undefined ? dto.scope : undefined,
          nhaXeId:
            isSuper && dto.nhaXeId !== undefined ? dto.nhaXeId : undefined,
          hierarchyPath: newHierarchyPath,
          rawContent: newRawContent,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        },
      });

      if (shouldReindex) {
        // Xóa phân mảnh cũ
        await tx.aiKnowledgeChunk.deleteMany({
          where: { documentId: id },
        });

        // Chèn phân mảnh mới
        for (let i = 0; i < newChunks.length; i++) {
          const chunk = newChunks[i];
          const embedding = newEmbeddings[i] || [];
          await tx.aiKnowledgeChunk.create({
            data: {
              documentId: id,
              chunkIndex: chunk.chunkIndex,
              headerPrefix: chunk.headerPrefix,
              rawContent: chunk.rawContent,
              groundedContent: chunk.groundedContent,
              embedding,
              embeddingModel: 'jina-embeddings-v3',
            },
          });
        }
      }

      return tx.aiKnowledgeDocument.findUnique({
        where: { id },
        include: {
          _count: { select: { chunks: true } },
          nhaXe: { select: { nhaXeId: true, tenNhaXe: true } },
        },
      });
    });

    if (shouldReindex) {
      this.logger.log(`Re-indexed document ID ${id} with ${newChunks.length} chunks.`);
    }

    return { data: updated };
  }

  /**
   * Bật hoặc tắt trạng thái hoạt động của tài liệu
   */
  async toggleDocumentStatus(id: number, principal: AuthPrincipal) {
    const doc = await this.prisma.aiKnowledgeDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'DOCUMENT_NOT_FOUND',
        message: 'Không tìm thấy tài liệu tri thức.',
      });
    }

    const isSuper = this.isSuperAdmin(principal);
    const tenantId = principal.nhaXeId ?? null;

    if (!isSuper) {
      if (doc.scope === 'GLOBAL') {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'ROLE_FORBIDDEN',
          message: 'Quản trị viên nhà xe không được thay đổi trạng thái tài liệu toàn sàn.',
        });
      }
      if (doc.nhaXeId !== tenantId) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'TENANT_SCOPE_VIOLATION',
          message: 'Không có quyền thay đổi trạng thái tài liệu của nhà xe khác.',
        });
      }
    }

    const updated = await this.prisma.aiKnowledgeDocument.update({
      where: { id },
      data: {
        isActive: !doc.isActive,
      },
      include: {
        _count: { select: { chunks: true } },
        nhaXe: { select: { nhaXeId: true, tenNhaXe: true } },
      },
    });

    return { data: updated };
  }

  /**
   * Xóa tài liệu khỏi hệ thống (các phân đoạn chunks tự động xóa theo quan hệ Cascade)
   */
  async deleteDocument(id: number, principal: AuthPrincipal) {
    const doc = await this.prisma.aiKnowledgeDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'DOCUMENT_NOT_FOUND',
        message: 'Không tìm thấy tài liệu tri thức.',
      });
    }

    const isSuper = this.isSuperAdmin(principal);
    const tenantId = principal.nhaXeId ?? null;

    if (!isSuper) {
      if (doc.scope === 'GLOBAL') {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'ROLE_FORBIDDEN',
          message: 'Quản trị viên nhà xe không được xóa tài liệu toàn sàn.',
        });
      }
      if (doc.nhaXeId !== tenantId) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'TENANT_SCOPE_VIOLATION',
          message: 'Không có quyền xóa tài liệu của nhà xe khác.',
        });
      }
    }

    await this.prisma.aiKnowledgeDocument.delete({
      where: { id },
    });

    return {
      data: {
        success: true,
        message: 'Đã xóa tài liệu và các đoạn phân mảnh thành công.',
      },
    };
  }
}
