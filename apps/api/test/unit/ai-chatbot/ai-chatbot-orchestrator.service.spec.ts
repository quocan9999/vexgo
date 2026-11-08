import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AiChatbotOrchestratorService } from '../../../src/ai-chatbot/orchestrator/ai-chatbot-orchestrator.service.js';
import type { HybridRetrievalService, RetrievedChunk } from '../../../src/ai-chatbot/retrieval/hybrid-retrieval.service.js';
import type { AiBusinessToolsService } from '../../../src/ai-chatbot/tools/ai-business-tools.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('AiChatbotOrchestratorService', () => {
  const mockConfig = new ConfigService({
    AI_LLM_MODEL: 'llama-3.3-70b-versatile',
    AI_LLM_BASE_URL: 'https://api.groq.com/openai/v1',
  });

  const mockRetrievalService = {
    retrieve: vi.fn(),
  } as unknown as HybridRetrievalService;

  const mockBusinessTools = {
    searchAvailableTrips: vi.fn(),
    lookupTicketStatus: vi.fn(),
    lookupShipmentStatus: vi.fn(),
    getActivePromotions: vi.fn(),
  } as unknown as AiBusinessToolsService;

  const mockPrisma = {
    aiChatSession: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      update: vi.fn(),
    },
    aiChatMessage: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;

  const orchestrator = new AiChatbotOrchestratorService(
    mockConfig,
    mockRetrievalService,
    mockBusinessTools,
    mockPrisma,
  );

  describe('Human Handoff Conditions', () => {
    it('1. should trigger handoff on EXPLICIT_HUMAN_REQUEST', async () => {
      const response = await orchestrator.processUserMessage({
        message: 'Tôi muốn gặp nhân viên tư vấn hoặc tổng đài viên trực tiếp',
      });

      expect(response.requiresHumanHandoff).toBe(true);
      expect(response.handoffReason).toBe('EXPLICIT_HUMAN_REQUEST');
      expect(response.reply).toContain('nhân viên');
    });

    it('2. should trigger handoff on NEGATIVE_SENTIMENT_CRISIS', async () => {
      const response = await orchestrator.processUserMessage({
        message: 'Nhà xe làm ăn lừa đảo, tôi sẽ báo công an và kiện ra tòa!',
      });

      expect(response.requiresHumanHandoff).toBe(true);
      expect(response.handoffReason).toBe('NEGATIVE_SENTIMENT_CRISIS');
    });

    it('3. should trigger handoff on EMERGENCY_INCIDENT', async () => {
      const response = await orchestrator.processUserMessage({
        message: 'Xe đang đi trên đèo thì bị tai nạn hỏng xe và thất lạc hành lý!',
      });

      expect(response.requiresHumanHandoff).toBe(true);
      expect(response.handoffReason).toBe('EMERGENCY_INCIDENT');
    });

    it('4. should trigger handoff on RAG_KNOWLEDGE_GAP when no chunks match policy question', async () => {
      vi.mocked(mockRetrievalService.retrieve).mockResolvedValueOnce([]); // Rỗng, dưới ngưỡng 0.60

      const response = await orchestrator.processUserMessage({
        message: 'Quy định đặc thù về việc vận chuyển hóa chất phóng xạ trên xe khách thế nào?',
      });

      expect(response.requiresHumanHandoff).toBe(true);
      expect(response.handoffReason).toBe('RAG_KNOWLEDGE_GAP');
    });

    it('5. should trigger handoff on TOOL_EXECUTION_CONFLICT when tool throws an error', async () => {
      vi.mocked(mockBusinessTools.lookupTicketStatus).mockRejectedValueOnce(
        new Error('Database lock conflict / connection refused'),
      );

      const response = await orchestrator.processUserMessage({
        message: 'Tra cứu vé TK-99999 cho số điện thoại 0912345678',
      });

      expect(response.requiresHumanHandoff).toBe(true);
      expect(response.handoffReason).toBe('TOOL_EXECUTION_CONFLICT');
    });
  });

  describe('Prompting & Temperature Configuration', () => {
    it('should use temperature = 0.15 for strictly grounded generation', () => {
      expect(orchestrator.getTemperature()).toBe(0.15);
    });

    it('should build prompt wrapped with <context>, <realtime_data>, and <user_query>', () => {
      const contextChunks: RetrievedChunk[] = [
        {
          chunkId: 1,
          documentId: 1,
          documentCode: 'DOC-CANCEL-POLICY',
          documentTitle: 'Chính sách hoàn hủy',
          hierarchyPath: '[Quy chế] > [Hủy vé]',
          rawContent: 'Phí hủy vé trước 24h là 10%.',
          groundedContent: '[Quy chế] > [Hủy vé]\n\nPhí hủy vé trước 24h là 10%.',
          denseScore: 0.85,
          lexicalScore: 0.70,
          hybridScore: 0.81,
          tier: 'HIGH',
        },
      ];

      const realtimeData = { trips: [] };
      const userQuery = 'Hủy vé trước 24h mất bao nhiêu tiền?';

      const prompt = orchestrator.buildGroundedPrompt(
        contextChunks,
        realtimeData,
        userQuery,
      );

      expect(prompt).toContain('<context>');
      expect(prompt).toContain('DOC-CANCEL-POLICY');
      expect(prompt).toContain('</context>');
      expect(prompt).toContain('<realtime_data>');
      expect(prompt).toContain('</realtime_data>');
      expect(prompt).toContain('<user_query>');
      expect(prompt).toContain(userQuery);
      expect(prompt).toContain('</user_query>');
    });

    it('should strip technical document codes and brackets from reply text (Clean Output)', () => {
      const dirtyReply =
        'Thời gian hoàn tiền 【DOC-CANCEL-POLICY】 sẽ từ 24-48 giờ làm việc. Quy định hành lý [DOC-BAGGAGE] áp dụng tối đa 20kg. (Nguồn: Quy chế chung)';
      const cleaned = orchestrator.cleanReplyText(dirtyReply);

      expect(cleaned).not.toContain('【DOC-CANCEL-POLICY】');
      expect(cleaned).not.toContain('[DOC-BAGGAGE]');
      expect(cleaned).not.toContain('(Nguồn: Quy chế chung)');
      expect(cleaned).toBe(
        'Thời gian hoàn tiền sẽ từ 24-48 giờ làm việc. Quy định hành lý áp dụng tối đa 20kg.',
      );
    });
  });
});
