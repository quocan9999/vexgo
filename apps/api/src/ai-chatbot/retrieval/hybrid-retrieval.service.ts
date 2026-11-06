import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmbeddingProviderService } from '../embedding/embedding-provider.service.js';
import { TextChunkerService } from '../chunking/text-chunker.service.js';
import { DEFAULT_KNOWLEDGE_DOCUMENTS } from '../seed/default-knowledge.data.js';

export interface RetrievedChunk {
  chunkId: number;
  documentId: number;
  documentCode: string;
  documentTitle: string;
  hierarchyPath: string;
  rawContent: string;
  groundedContent: string;
  denseScore: number;
  lexicalScore: number;
  hybridScore: number;
  tier: 'HIGH' | 'MEDIUM';
}

const DENSE_WEIGHT = 0.75;
const LEXICAL_WEIGHT = 0.25;
const SIMILARITY_THRESHOLD = 0.60;
const HIGH_TIER_THRESHOLD = 0.75;
const DEFAULT_TOP_K = 4;

function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const COMMON_STOP_WORDS = new Set([
  'va', 'nhu', 'the', 'nao', 'la', 'cua', 'duoc', 'khi', 'cho', 'voi', 'trong',
  'cac', 'nhung', 'thi', 'o', 'co', 'nay', 'do', 'de', 'tai', 'ra', 'vao',
  'mot', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay', 'tam', 'chin', 'muoi',
  'hoac', 'hay', 'ma', 'vi', 'nen', 'neu', 'tuy', 'du', 'gi', 'sao', 'ai'
]);

@Injectable()
export class HybridRetrievalService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HybridRetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingProvider: EmbeddingProviderService,
    private readonly textChunker: TextChunkerService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureKnowledgeIndexed();
    } catch (err) {
      this.logger.warn(`Knowledge auto-indexing postponed: ${String(err)}`);
    }
  }

  /**
   * Tính điểm tương đồng lai:
   * S_hybrid = 0.75 * S_dense + 0.25 * S_lexical
   */
  calculateHybridScore(denseScore: number, lexicalScore: number): number {
    return DENSE_WEIGHT * denseScore + LEXICAL_WEIGHT * lexicalScore;
  }

  /**
   * Phân vùng độ tin cậy kết quả:
   * HIGH: S_dense >= 0.75
   * MEDIUM: 0.60 <= S_dense < 0.75
   * LOW: S_dense < 0.60
   */
  resolveTier(denseScore: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (denseScore >= HIGH_TIER_THRESHOLD) return 'HIGH';
    if (denseScore >= SIMILARITY_THRESHOLD) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Thực thi truy hồi lai trên kho tri thức chính sách VexGo
   */
  async retrieve(
    query: string,
    nhaXeId?: number,
    topK = DEFAULT_TOP_K,
  ): Promise<RetrievedChunk[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    // 1. Nhúng vector cho câu truy vấn
    const queryVector = await this.embeddingProvider.embedQuery(trimmedQuery);

    // 2. Tải toàn bộ chunks hợp lệ theo phạm vi (GLOBAL hoặc thuộc nhà xe)
    const chunks = await this.prisma.aiKnowledgeChunk.findMany({
      where: {
        document: {
          isActive: true,
          OR: [
            { scope: 'GLOBAL' },
            ...(nhaXeId ? [{ scope: 'TENANT', nhaXeId }] : []),
          ],
        },
      },
      include: {
        document: {
          select: {
            id: true,
            documentCode: true,
            title: true,
            scope: true,
            nhaXeId: true,
          },
        },
      },
    });

    if (!chunks || chunks.length === 0) {
      return [];
    }

    const queryTerms = this.extractLexicalTerms(trimmedQuery);
    const scoredChunks: RetrievedChunk[] = [];

    for (const chunk of chunks) {
      // Parse vector nhúng lưu trữ trong DB
      const chunkVector = Array.isArray(chunk.embedding)
        ? (chunk.embedding as number[])
        : [];
      if (chunkVector.length === 0) continue;

      // 3. Tính Dense Score: dot product giữa hai vector đã chuẩn hóa L2
      const denseScore = this.computeDotProduct(queryVector, chunkVector);

      // 4. Tính Lexical Score: Term overlap có đối soát hư từ
      const lexicalScore = this.computeLexicalOverlap(
        queryTerms,
        chunk.groundedContent || chunk.rawContent,
      );

      // 5. Tính Hybrid Score
      const hybridScore = this.calculateHybridScore(denseScore, lexicalScore);

      // 6. Lọc ngưỡng cứng tau = 0.60 (chấp nhận ngoại lệ nếu khớp mã quy chế chính xác)
      const isExactCodeMatch =
        trimmedQuery.toLowerCase().includes(chunk.document.documentCode.toLowerCase());
      const tier = this.resolveTier(denseScore);

      if (denseScore >= SIMILARITY_THRESHOLD || (isExactCodeMatch && hybridScore >= SIMILARITY_THRESHOLD)) {
        scoredChunks.push({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentCode: chunk.document.documentCode,
          documentTitle: chunk.document.title,
          hierarchyPath: chunk.headerPrefix,
          rawContent: chunk.rawContent,
          groundedContent: chunk.groundedContent,
          denseScore,
          lexicalScore,
          hybridScore,
          tier: tier === 'LOW' ? 'MEDIUM' : tier,
        });
      }
    }

    // 7. Sắp xếp theo S_hybrid giảm dần và lấy top K
    scoredChunks.sort((a, b) => b.hybridScore - a.hybridScore);
    return scoredChunks.slice(0, topK);
  }

  /**
   * Tính tích vô hướng giữa hai vector:
   * S_dense = sum(q_i * p_i)
   */
  private computeDotProduct(vecA: number[], vecB: number[]): number {
    const len = Math.min(vecA.length, vecB.length);
    let dot = 0;
    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i];
    }
    return dot;
  }

  /**
   * Trích xuất các terms từ khóa loại bỏ hư từ
   */
  private extractLexicalTerms(text: string): Set<string> {
    const cleaned = text.toLowerCase();
    const noDiacritics = removeVietnameseDiacritics(cleaned);
    const tokens = noDiacritics.split(/[\s,.;:!?()'"\-\\/[\]{}]+/i).filter(Boolean);
    const result = new Set<string>();

    for (const token of tokens) {
      if (token.length >= 2 && !COMMON_STOP_WORDS.has(token)) {
        result.add(token);
      }
    }
    return result;
  }

  /**
   * Điểm khớp từ khóa Term Overlap chuẩn hóa [0, 1]
   */
  private computeLexicalOverlap(queryTerms: Set<string>, content: string): number {
    if (queryTerms.size === 0) return 0;
    const contentTerms = this.extractLexicalTerms(content);
    if (contentTerms.size === 0) return 0;

    let matched = 0;
    for (const term of queryTerms) {
      if (contentTerms.has(term)) {
        matched++;
      }
    }
    return Math.min(1.0, matched / queryTerms.size);
  }

  /**
   * Đảm bảo kho tri thức được nạp và lập chỉ mục vector đầy đủ trong DB
   */
  async ensureKnowledgeIndexed(): Promise<void> {
    if (!this.prisma.aiKnowledgeDocument || !this.prisma.aiKnowledgeChunk) {
      return;
    }

    // 1. Kiểm tra tài liệu đã tồn tại hay chưa, nếu chưa thì nạp DEFAULT_KNOWLEDGE_DOCUMENTS
    for (const docData of DEFAULT_KNOWLEDGE_DOCUMENTS) {
      const existing = await this.prisma.aiKnowledgeDocument.findUnique({
        where: { documentCode: docData.documentCode },
        include: { chunks: { select: { id: true } } },
      });

      let docId: number;
      let hasChunks = false;

      if (!existing) {
        const created = await this.prisma.aiKnowledgeDocument.create({
          data: {
            documentCode: docData.documentCode,
            title: docData.title,
            category: docData.category,
            scope: docData.scope,
            hierarchyPath: docData.hierarchyPath,
            rawContent: docData.rawContent,
            isActive: true,
          },
        });
        docId = created.id;
      } else {
        docId = existing.id;
        hasChunks = existing.chunks.length > 0;
      }

      // 2. Nếu tài liệu chưa có chunks, tiến hành chunking và embedding
      if (!hasChunks) {
        const chunks = this.textChunker.splitText(
          docData.rawContent,
          docData.hierarchyPath,
        );
        if (chunks.length > 0) {
          const passageTexts = chunks.map((c) => c.groundedContent);
          const embeddings = await this.embeddingProvider.embedPassages(passageTexts);

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = embeddings[i] || [];

            await this.prisma.aiKnowledgeChunk.create({
              data: {
                documentId: docId,
                chunkIndex: chunk.chunkIndex,
                headerPrefix: chunk.headerPrefix,
                rawContent: chunk.rawContent,
                groundedContent: chunk.groundedContent,
                embedding: embedding,
                embeddingModel: 'jina-embeddings-v3',
              },
            });
          }
          this.logger.log(`Indexed document [${docData.documentCode}] with ${chunks.length} chunks.`);
        }
      }
    }
  }
}
