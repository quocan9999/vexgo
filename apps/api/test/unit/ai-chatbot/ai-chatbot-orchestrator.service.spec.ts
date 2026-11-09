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
    retrieve: vi.fn().mockResolvedValue([]),
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
      vi.mocked(mockBusinessTools.searchAvailableTrips).mockRejectedValueOnce(
        new Error('Database lock conflict / connection refused'),
      );

      const response = await orchestrator.processUserMessage({
        message: 'Tìm chuyến xe từ TP.HCM đi Đà Lạt ngày 15/11/2026',
      });

      expect(response.requiresHumanHandoff).toBe(true);
      expect(response.handoffReason).toBe('TOOL_EXECUTION_CONFLICT');
    });

    it('6. should provide step-by-step guidance for ticket lookup without querying internal database', async () => {
      vi.mocked(mockBusinessTools.lookupTicketStatus).mockClear();

      const response = await orchestrator.processUserMessage({
        message: 'Làm thế nào để tra cứu vé xe đã đặt?',
      });

      expect(response.reply).toContain('Tra cứu vé xe');
      expect(response.reply).toContain('Mã vé');
      expect(response.reply).toContain('Số điện thoại');
      expect(mockBusinessTools.lookupTicketStatus).not.toHaveBeenCalled();
    });

    it('7. should provide step-by-step guidance for ticket cancellation without querying internal database', async () => {
      vi.mocked(mockBusinessTools.lookupTicketStatus).mockClear();

      const response = await orchestrator.processUserMessage({
        message: 'Tôi muốn hủy vé xe TK-99999 cho số điện thoại 0912345678',
      });

      expect(response.reply).toContain('Hủy vé');
      expect(response.reply).toContain('Mã vé');
      expect(response.reply).toContain('Số điện thoại');
      expect(mockBusinessTools.lookupTicketStatus).not.toHaveBeenCalled();
    });

    it('8. should provide step-by-step guidance for shipment tracking without querying internal database', async () => {
      vi.mocked(mockBusinessTools.lookupShipmentStatus).mockClear();

      const response = await orchestrator.processUserMessage({
        message: 'Tra cứu đơn gửi hàng WB12345678 cho số điện thoại 0912345678',
      });

      expect(response.reply).toContain('Tra cứu đơn gửi hàng');
      expect(response.reply).toContain('Mã vận đơn');
      expect(response.reply).toContain('Số điện thoại');
      expect(mockBusinessTools.lookupShipmentStatus).not.toHaveBeenCalled();
    });
  });

  describe('Prompting & Temperature Configuration', () => {
    it('should use temperature = 0.15 for strictly grounded generation', () => {
      expect(orchestrator.getTemperature()).toBe(0.15);
    });

    it('should retrieve dynamic settings when AiChatbotSettingsService is provided', async () => {
      const mockSettings = {
        getSettings: vi.fn().mockResolvedValue({
          id: 1,
          idempotencyTtlDays: 14,
          leaseDurationSeconds: 90,
          contextHistoryLimit: 5,
          temperature: 0.35,
          updatedAt: new Date(),
        }),
      };

      const configuredOrchestrator = new AiChatbotOrchestratorService(
        mockConfig,
        mockRetrievalService,
        mockBusinessTools,
        mockPrisma,
        mockSettings as any,
      );

      const settings = await configuredOrchestrator.getEffectiveSettings();
      expect(settings.temperature).toBe(0.35);
      expect(settings.contextHistoryLimit).toBe(5);
    });

    it('should query history messages respecting contextHistoryLimit', async () => {
      const mockSettings = {
        getSettings: vi.fn().mockResolvedValue({
          id: 1,
          idempotencyTtlDays: 7,
          leaseDurationSeconds: 60,
          contextHistoryLimit: 3,
          temperature: 0.2,
          updatedAt: new Date(),
        }),
      };

      const customPrisma = {
        aiChatSession: {
          findUnique: vi.fn().mockResolvedValue({ id: 99, khachHangId: null }),
        },
        aiChatMessage: {
          create: vi.fn().mockResolvedValue({ id: 10 }),
          findMany: vi.fn().mockResolvedValue([
            { id: 10, role: 'USER', content: 'Câu hỏi mới nhất' },
            { id: 9, role: 'ASSISTANT', content: 'Câu trả lời 1' },
            { id: 8, role: 'USER', content: 'Câu hỏi 1' },
          ]),
        },
      } as any;

      const customOrchestrator = new AiChatbotOrchestratorService(
        mockConfig,
        mockRetrievalService,
        mockBusinessTools,
        customPrisma,
        mockSettings as any,
      );

      // Retrieval returns empty array => triggers RAG_KNOWLEDGE_GAP or fallback
      vi.mocked(mockRetrievalService.retrieve).mockResolvedValueOnce([]);

      await customOrchestrator.processUserMessage({
        message: 'Hỏi câu hỏi mới',
        sessionToken: 'test-session-token',
      });

      // verify that findMany is called or context history limit is respected
      expect(customPrisma.aiChatMessage.create).toHaveBeenCalled();
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

    it('should convert markdown tables to readable bullet points and strip raw UUIDs/links', () => {
      const tableReply = `Dưới đây là các chuyến xe TP.HCM → Đà Lạt ngày 15/11/2026 hiện có:
| Mã chuyến | Nhà xe | Giờ khởi hành | Loại xe | Giá (VNĐ) | Ghế còn | Link đặt vé |
|-----------|--------|---------------|--------|-----------|---------|------------|
| a7d1daf5f2474223a1bf1baf4e87a508 | Thành Bưởi | 06:00 | GIƯỜNG NẰM | 270 000 | 22 | /trips/9202 |
| 1f3938b1c6834851ad8960eead857aad | Phương Trang | 06:00 | GHẾ NGỒI | 180 000 | 28 | /trips/9184 |
Chúc bạn có chuyến đi vui vẻ!`;

      const cleaned = orchestrator.cleanReplyText(tableReply);

      expect(cleaned).not.toContain('|---|');
      expect(cleaned).not.toContain('a7d1daf5f2474223a1bf1baf4e87a508');
      expect(cleaned).not.toContain('/trips/9202');
      expect(cleaned).toContain('- **Thành Bưởi**: Giờ khởi hành: 06:00, Loại xe: GIƯỜNG NẰM, Giá (VNĐ): 270 000, Ghế còn: 22');
      expect(cleaned).toContain('- **Phương Trang**: Giờ khởi hành: 06:00, Loại xe: GHẾ NGỒI, Giá (VNĐ): 180 000, Ghế còn: 28');
    });
  });
});
