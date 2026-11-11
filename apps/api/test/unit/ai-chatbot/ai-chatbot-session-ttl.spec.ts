import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiChatbotService } from '../../../src/ai-chatbot/ai-chatbot.service.js';
import { AiChatbotOrchestratorService } from '../../../src/ai-chatbot/orchestrator/ai-chatbot-orchestrator.service.js';
import { SESSION_INACTIVITY_TTL_MS } from '../../../src/ai-chatbot/ai-session-access.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { HybridRetrievalService } from '../../../src/ai-chatbot/retrieval/hybrid-retrieval.service.js';
import type { AiBusinessToolsService } from '../../../src/ai-chatbot/tools/ai-business-tools.service.js';

describe('AI Chatbot Session Rolling 7-Day TTL', () => {
  const SESSION_TOKEN = '11111111-2222-3333-4444-555555555555';

  it('1. getSessionMessages returns session data when last activity is within 7 days', async () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const mockPrisma = {
      aiChatSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          sessionToken: SESSION_TOKEN,
          khachHangId: null,
          status: 'ACTIVE',
          createdAt: recentDate,
          updatedAt: recentDate,
          messages: [
            {
              id: 10,
              role: 'USER',
              content: 'Tìm xe đi Đà Lạt',
              createdAt: recentDate,
            },
            {
              id: 11,
              role: 'ASSISTANT',
              content: 'Dạ có chuyến xe...',
              createdAt: recentDate,
            },
          ],
        }),
        update: vi.fn(),
      },
    } as unknown as PrismaService;

    const mockOrchestrator = {} as unknown as AiChatbotOrchestratorService;
    const service = new AiChatbotService(mockOrchestrator, mockPrisma);

    const result = await service.getSessionMessages(SESSION_TOKEN);
    expect(result.sessionToken).toBe(SESSION_TOKEN);
    expect(result.status).toBe('ACTIVE');
    expect(result.messages).toHaveLength(2);
    expect(mockPrisma.aiChatSession.update).not.toHaveBeenCalled();
  });

  it('2. getSessionMessages throws SESSION_EXPIRED and marks session EXPIRED when inactive > 7 days', async () => {
    const expiredDate = new Date(Date.now() - (SESSION_INACTIVITY_TTL_MS + 10000)); // > 7 days ago
    const mockPrisma = {
      aiChatSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          sessionToken: SESSION_TOKEN,
          khachHangId: null,
          status: 'ACTIVE',
          createdAt: expiredDate,
          updatedAt: expiredDate,
          messages: [
            {
              id: 10,
              role: 'USER',
              content: 'Tin nhắn cũ',
              createdAt: expiredDate,
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: 1, status: 'EXPIRED' }),
      },
    } as unknown as PrismaService;

    const mockOrchestrator = {} as unknown as AiChatbotOrchestratorService;
    const service = new AiChatbotService(mockOrchestrator, mockPrisma);

    await expect(service.getSessionMessages(SESSION_TOKEN)).rejects.toThrow(
      NotFoundException,
    );

    expect(mockPrisma.aiChatSession.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'EXPIRED' },
    });
  });

  it('3. getSessionMessages immediately throws SESSION_EXPIRED if status is already EXPIRED', async () => {
    const mockPrisma = {
      aiChatSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          sessionToken: SESSION_TOKEN,
          khachHangId: null,
          status: 'EXPIRED',
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
        }),
        update: vi.fn(),
      },
    } as unknown as PrismaService;

    const mockOrchestrator = {} as unknown as AiChatbotOrchestratorService;
    const service = new AiChatbotService(mockOrchestrator, mockPrisma);

    await expect(service.getSessionMessages(SESSION_TOKEN)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('4. processUserMessage generates a new session and marks old session EXPIRED when inactive > 7 days', async () => {
    const expiredDate = new Date(Date.now() - (SESSION_INACTIVITY_TTL_MS + 50000));
    let createdSessionToken = '';

    const mockPrisma = {
      aiChatSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          sessionToken: SESSION_TOKEN,
          khachHangId: null,
          status: 'ACTIVE',
          createdAt: expiredDate,
          updatedAt: expiredDate,
        }),
        update: vi.fn().mockResolvedValue({ id: 1, status: 'EXPIRED' }),
        create: vi.fn().mockImplementation(({ data }) => {
          createdSessionToken = data.sessionToken;
          return Promise.resolve({ id: 2, ...data });
        }),
      },
      aiChatMessage: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 99, ...data })),
      },
    } as unknown as PrismaService;

    const mockRetrieval = {
      retrieve: vi.fn().mockResolvedValue([]),
    } as unknown as HybridRetrievalService;

    const mockTools = {
      searchAvailableTrips: vi.fn(),
      lookupTicketStatus: vi.fn(),
      lookupShipmentStatus: vi.fn(),
      getActivePromotions: vi.fn(),
    } as unknown as AiBusinessToolsService;

    const orchestrator = new AiChatbotOrchestratorService(
      new ConfigService({}),
      mockRetrieval,
      mockTools,
      mockPrisma,
    );

    const response = await orchestrator.processUserMessage({
      message: 'Xin chào VexGo',
      sessionToken: SESSION_TOKEN,
    });

    // Cũ bị đánh dấu EXPIRED
    expect(mockPrisma.aiChatSession.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'EXPIRED' },
    });

    // Mới được tạo với sessionToken khác
    expect(createdSessionToken).not.toBe(SESSION_TOKEN);
    expect(response.sessionToken).toBe(createdSessionToken);
  });

  it('5. processUserMessage updates updatedAt to refresh rolling TTL when session is active', async () => {
    const recentDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago

    const mockPrisma = {
      aiChatSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          sessionToken: SESSION_TOKEN,
          khachHangId: null,
          status: 'ACTIVE',
          createdAt: recentDate,
          updatedAt: recentDate,
        }),
        update: vi.fn().mockResolvedValue({ id: 1 }),
      },
      aiChatMessage: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 99, ...data })),
      },
    } as unknown as PrismaService;

    const mockRetrieval = {
      retrieve: vi.fn().mockResolvedValue([]),
    } as unknown as HybridRetrievalService;

    const mockTools = {
      searchAvailableTrips: vi.fn(),
      lookupTicketStatus: vi.fn(),
      lookupShipmentStatus: vi.fn(),
      getActivePromotions: vi.fn(),
    } as unknown as AiBusinessToolsService;

    const orchestrator = new AiChatbotOrchestratorService(
      new ConfigService({}),
      mockRetrieval,
      mockTools,
      mockPrisma,
    );

    const response = await orchestrator.processUserMessage({
      message: 'Xin chào VexGo',
      sessionToken: SESSION_TOKEN,
    });

    expect(response.sessionToken).toBe(SESSION_TOKEN);
    expect(mockPrisma.aiChatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      }),
    );
  });
});
