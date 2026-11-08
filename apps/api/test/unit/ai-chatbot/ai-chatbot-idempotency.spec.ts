import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChatbotService } from '../../../src/ai-chatbot/ai-chatbot.service.js';
import type { AiChatbotOrchestratorService } from '../../../src/ai-chatbot/orchestrator/ai-chatbot-orchestrator.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { AiChatbotSettingsService } from '../../../src/ai-chatbot/admin/ai-chatbot-settings.service.js';

describe('AiChatbotService - Idempotency & Request Recovery (Mục 3)', () => {
  let service: AiChatbotService;
  let mockOrchestrator: { processUserMessage: ReturnType<typeof vi.fn> };
  let mockPrisma: any;
  let mockSettingsService: { getSettings: ReturnType<typeof vi.fn> };

  const REQUEST_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const RECOVERY_KEY = 'my-secret-recovery-token';
  const RECOVERY_KEY_HASH = crypto
    .createHash('sha256')
    .update(RECOVERY_KEY)
    .digest('hex');

  beforeEach(() => {
    mockOrchestrator = {
      processUserMessage: vi.fn().mockResolvedValue({
        sessionToken: 'c2e4293e-2b5d-4f1a-8c65-0d2d3e9501a2',
        reply: 'Chào bạn, VexGo có chuyến đi Đà Lạt lúc 8h sáng nhé.',
        intent: 'TRIP_SEARCH',
        citations: [],
        requiresHumanHandoff: false,
        latencyMs: 120,
        requestId: REQUEST_ID,
      }),
    };

    mockPrisma = {
      aiChatRequest: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockSettingsService = {
      getSettings: vi.fn().mockResolvedValue({
        id: 1,
        idempotencyTtlDays: 7,
        leaseDurationSeconds: 60,
        contextHistoryLimit: 10,
        temperature: 0.15,
        updatedAt: new Date(),
      }),
    };

    service = new AiChatbotService(
      mockOrchestrator as unknown as AiChatbotOrchestratorService,
      mockPrisma as unknown as PrismaService,
      mockSettingsService as unknown as AiChatbotSettingsService,
    );
  });

  describe('1. Idempotency on sendMessage', () => {
    it('should process normally without touching AiChatRequest when requestId is omitted', async () => {
      const res = await service.sendMessage({
        message: 'Tìm xe đi Đà Lạt',
      });

      expect(res.reply).toContain('Đà Lạt');
      expect(mockOrchestrator.processUserMessage).toHaveBeenCalledTimes(1);
      expect(mockPrisma.aiChatRequest.create).not.toHaveBeenCalled();
    });

    it('should create AiChatRequest with PROCESSING, call orchestrator, and mark COMPLETED on first send', async () => {
      const dto = {
        message: 'Tìm xe đi Đà Lạt',
        requestId: REQUEST_ID,
        recoveryKey: RECOVERY_KEY,
      };

      const res = await service.sendMessage(dto, 101);

      expect(mockPrisma.aiChatRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestId: REQUEST_ID,
            status: 'PROCESSING',
            taiKhoanId: 101,
            recoveryKeyHash: RECOVERY_KEY_HASH,
          }),
        }),
      );

      expect(mockOrchestrator.processUserMessage).toHaveBeenCalledTimes(1);

      expect(mockPrisma.aiChatRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requestId: REQUEST_ID },
          data: expect.objectContaining({
            status: 'COMPLETED',
            leaseUntil: null,
          }),
        }),
      );

      expect(res.reply).toContain('Đà Lạt');
    });

    it('should return cached response immediately without calling LLM when identical retry occurs', async () => {
      const dto = {
        message: 'Tìm xe đi Đà Lạt',
        requestId: REQUEST_ID,
      };
      const payloadHash = service.computePayloadHash(dto);

      const cachedResponse = {
        sessionToken: 'c2e4293e-2b5d-4f1a-8c65-0d2d3e9501a2',
        reply: 'Kết quả đã lưu sẵn từ lần gửi trước.',
        intent: 'TRIP_SEARCH',
        citations: [],
        requiresHumanHandoff: false,
        latencyMs: 5,
        requestId: REQUEST_ID,
      };

      mockPrisma.aiChatRequest.findUnique.mockResolvedValueOnce({
        id: 1,
        requestId: REQUEST_ID,
        payloadHash,
        status: 'COMPLETED',
        responsePayload: cachedResponse,
        taiKhoanId: 101,
      });

      const res = await service.sendMessage(dto, 101);

      expect(res).toEqual(cachedResponse);
      // Zero LLM calls on idempotent retry!
      expect(mockOrchestrator.processUserMessage).not.toHaveBeenCalled();
      expect(mockPrisma.aiChatRequest.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException (IDEMPOTENCY_PAYLOAD_MISMATCH) when same requestId has different payload', async () => {
      const dto = {
        message: 'Câu hỏi mới hoàn toàn',
        requestId: REQUEST_ID,
      };

      mockPrisma.aiChatRequest.findUnique.mockResolvedValueOnce({
        id: 1,
        requestId: REQUEST_ID,
        payloadHash: 'different-sha256-hash',
        status: 'COMPLETED',
        taiKhoanId: 101,
      });

      await expect(service.sendMessage(dto, 101)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException (IDEMPOTENCY_CONCURRENT_PROCESSING) when request is actively being processed', async () => {
      const dto = {
        message: 'Tìm xe đi Đà Lạt',
        requestId: REQUEST_ID,
      };
      const payloadHash = service.computePayloadHash(dto);

      mockPrisma.aiChatRequest.findUnique.mockResolvedValueOnce({
        id: 1,
        requestId: REQUEST_ID,
        payloadHash,
        status: 'PROCESSING',
        leaseUntil: new Date(Date.now() + 50_000), // active lease
        taiKhoanId: 101,
      });

      await expect(service.sendMessage(dto, 101)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reclaim lease and reprocess when request was PROCESSING but lease expired (Crash Window)', async () => {
      const dto = {
        message: 'Tìm xe đi Đà Lạt',
        requestId: REQUEST_ID,
      };
      const payloadHash = service.computePayloadHash(dto);

      mockPrisma.aiChatRequest.findUnique.mockResolvedValueOnce({
        id: 1,
        requestId: REQUEST_ID,
        payloadHash,
        status: 'PROCESSING',
        leaseUntil: new Date(Date.now() - 10_000), // expired lease! Server crashed previously
        taiKhoanId: 101,
      });

      const res = await service.sendMessage(dto, 101);

      expect(mockPrisma.aiChatRequest.updateMany).toHaveBeenCalled();
      expect(mockOrchestrator.processUserMessage).toHaveBeenCalledTimes(1);
      expect(res.reply).toContain('Đà Lạt');
    });

    it('should mark request FAILED when orchestrator throws an error', async () => {
      mockOrchestrator.processUserMessage.mockRejectedValueOnce(
        new Error('Groq LLM connection timeout'),
      );

      const dto = {
        message: 'Tìm xe đi Đà Lạt',
        requestId: REQUEST_ID,
      };

      await expect(service.sendMessage(dto, 101)).rejects.toThrow(
        'Groq LLM connection timeout',
      );

      expect(mockPrisma.aiChatRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requestId: REQUEST_ID },
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: 'Groq LLM connection timeout',
            leaseUntil: null,
          }),
        }),
      );
    });
  });

  describe('2. Request Recovery via getRequestStatus', () => {
    it('should throw NotFoundException when requestId does not exist', async () => {
      mockPrisma.aiChatRequest.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getRequestStatus('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when authenticated customer tries to read another user request', async () => {
      mockPrisma.aiChatRequest.findUnique.mockResolvedValueOnce({
        requestId: REQUEST_ID,
        taiKhoanId: 999, // User 999
        status: 'COMPLETED',
      });

      // User 101 attempts to read
      await expect(
        service.getRequestStatus(REQUEST_ID, undefined, 101),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when guest lacks recoveryKey', async () => {
      mockPrisma.aiChatRequest.findUnique.mockResolvedValueOnce({
        requestId: REQUEST_ID,
        taiKhoanId: null,
        recoveryKeyHash: RECOVERY_KEY_HASH,
        status: 'COMPLETED',
      });

      await expect(
        service.getRequestStatus(REQUEST_ID, undefined, undefined),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when guest provides wrong recoveryKey', async () => {
      mockPrisma.aiChatRequest.findUnique.mockResolvedValueOnce({
        requestId: REQUEST_ID,
        taiKhoanId: null,
        recoveryKeyHash: RECOVERY_KEY_HASH,
        status: 'COMPLETED',
      });

      await expect(
        service.getRequestStatus(REQUEST_ID, 'wrong-token', undefined),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully return completed request with result when guest provides valid recoveryKey', async () => {
      const mockResult = {
        reply: 'Thông tin chuyến xe đã phục hồi.',
      };

      mockPrisma.aiChatRequest.findUnique.mockResolvedValueOnce({
        requestId: REQUEST_ID,
        taiKhoanId: null,
        recoveryKeyHash: RECOVERY_KEY_HASH,
        status: 'COMPLETED',
        sessionToken: 'test-session-token',
        responsePayload: mockResult,
      });

      const res = await service.getRequestStatus(
        REQUEST_ID,
        RECOVERY_KEY,
        undefined,
      );

      expect(res.data).toEqual({
        requestId: REQUEST_ID,
        status: 'COMPLETED',
        sessionToken: 'test-session-token',
        result: mockResult,
      });
    });

    it('should return PROCESSING status when request is still working', async () => {
      mockPrisma.aiChatRequest.findUnique.mockResolvedValueOnce({
        requestId: REQUEST_ID,
        taiKhoanId: 101,
        status: 'PROCESSING',
        sessionToken: 'test-session-token',
      });

      const res = await service.getRequestStatus(
        REQUEST_ID,
        undefined,
        101,
      );

      expect(res.data).toEqual({
        requestId: REQUEST_ID,
        status: 'PROCESSING',
        sessionToken: 'test-session-token',
      });
    });
  });
});
