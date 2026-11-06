import { describe, expect, it, vi } from 'vitest';
import { HybridRetrievalService, type RetrievedChunk } from '../../../src/ai-chatbot/retrieval/hybrid-retrieval.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { EmbeddingProviderService } from '../../../src/ai-chatbot/embedding/embedding-provider.service.js';
import type { TextChunkerService } from '../../../src/ai-chatbot/chunking/text-chunker.service.js';

describe('HybridRetrievalService', () => {
  const mockChunks = [
    {
      id: 1,
      documentId: 10,
      chunkIndex: 0,
      headerPrefix: '[Quy chế] > [Hủy vé]',
      rawContent: 'Phí hủy vé trước 24 giờ là 10%, hoàn lại 90% số tiền vé.',
      groundedContent: '[Quy chế] > [Hủy vé]\n\nPhí hủy vé trước 24 giờ là 10%, hoàn lại 90% số tiền vé.',
      embedding: [1, 0, 0], // simplified 3-d for formula verification
      document: {
        id: 10,
        documentCode: 'DOC-CANCEL-POLICY',
        title: 'Chính sách hủy vé',
        scope: 'GLOBAL',
        nhaXeId: null,
      },
    },
    {
      id: 2,
      documentId: 11,
      chunkIndex: 0,
      headerPrefix: '[Quy chế] > [Hành lý]',
      rawContent: 'Hành lý xách tay tối đa 20kg miễn phí.',
      groundedContent: '[Quy chế] > [Hành lý]\n\nHành lý xách tay tối đa 20kg miễn phí.',
      embedding: [0, 1, 0],
      document: {
        id: 11,
        documentCode: 'DOC-BAGGAGE-POLICY',
        title: 'Quy định hành lý',
        scope: 'GLOBAL',
        nhaXeId: null,
      },
    },
    {
      id: 3,
      documentId: 12,
      chunkIndex: 0,
      headerPrefix: '[Quy chế] > [Ẩm thực]',
      rawContent: 'Khám phá các món ăn ngon đặc sản địa phương.',
      groundedContent: '[Quy chế] > [Ẩm thực]\n\nKhám phá các món ăn ngon đặc sản địa phương.',
      embedding: [0, 0, 1], // Nhiễu, không liên quan
      document: {
        id: 12,
        documentCode: 'DOC-FOOD',
        title: 'Ẩm thực',
        scope: 'GLOBAL',
        nhaXeId: null,
      },
    },
  ];

  const mockPrisma = {
    aiKnowledgeChunk: {
      findMany: vi.fn().mockResolvedValue(mockChunks),
    },
  } as unknown as PrismaService;

  const mockEmbeddingProvider = {
    embedQuery: vi.fn().mockResolvedValue([0.9, 0.4358, 0]), // norm = 1.0
  } as unknown as EmbeddingProviderService;

  const mockTextChunker = {} as TextChunkerService;

  const service = new HybridRetrievalService(
    mockPrisma,
    mockEmbeddingProvider,
    mockTextChunker,
  );

  it('should compute hybrid score following formula: S_hybrid = 0.75 * S_dense + 0.25 * S_lexical', () => {
    const denseScore = 0.8;
    const lexicalScore = 0.6;
    const expected = 0.75 * denseScore + 0.25 * lexicalScore; // 0.6 + 0.15 = 0.75
    const actual = service.calculateHybridScore(denseScore, lexicalScore);
    expect(actual).toBeCloseTo(expected, 4);
  });

  it('should filter out out-of-domain chunks where S_dense < 0.60', async () => {
    // Với query embedding [0.9, 0.4358, 0]:
    // Chunk 1 dot product: 0.9 * 1 + 0 + 0 = 0.90 (>= 0.75 -> HIGH)
    // Chunk 2 dot product: 0.9 * 0 + 0.4358 * 1 + 0 = 0.4358 (< 0.60 -> bị loại)
    // Chunk 3 dot product: 0 (< 0.60 -> bị loại)
    const results = await service.retrieve('hủy vé hoàn tiền xe');

    expect(results.length).toBe(1);
    expect(results[0].documentCode).toBe('DOC-CANCEL-POLICY');
    expect(results[0].denseScore).toBeCloseTo(0.9, 2);
    expect(results[0].tier).toBe('HIGH');
  });

  it('should correctly classify confidence tiers HIGH vs MEDIUM', () => {
    expect(service.resolveTier(0.85)).toBe('HIGH');
    expect(service.resolveTier(0.75)).toBe('HIGH');
    expect(service.resolveTier(0.74)).toBe('MEDIUM');
    expect(service.resolveTier(0.60)).toBe('MEDIUM');
    expect(service.resolveTier(0.59)).toBe('LOW');
  });
});
