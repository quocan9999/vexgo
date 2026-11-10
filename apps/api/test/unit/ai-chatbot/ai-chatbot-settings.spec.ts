import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChatbotSettingsService } from '../../../src/ai-chatbot/admin/ai-chatbot-settings.service.js';
import { AiChatbotSettingsController } from '../../../src/ai-chatbot/admin/ai-chatbot-settings.controller.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('AiChatbotSettingsService & Controller (Super Admin Settings)', () => {
  let service: AiChatbotSettingsService;
  let controller: AiChatbotSettingsController;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      aiChatbotSetting: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };

    service = new AiChatbotSettingsService(
      mockPrisma as unknown as PrismaService,
    );
    controller = new AiChatbotSettingsController(service);
  });

  describe('Service getSettings', () => {
    it('should return default settings when record id=1 does not exist in DB', async () => {
      mockPrisma.aiChatbotSetting.findUnique.mockResolvedValueOnce(null);

      const res = await service.getSettings();

      expect(res).toEqual(
        expect.objectContaining({
          id: 1,
          idempotencyTtlDays: 7,
          leaseDurationSeconds: 60,
          contextHistoryLimit: 10,
          temperature: 0.15,
        }),
      );
    });

    it('should return custom settings from DB when record exists', async () => {
      mockPrisma.aiChatbotSetting.findUnique.mockResolvedValueOnce({
        id: 1,
        idempotencyTtlDays: 14,
        leaseDurationSeconds: 120,
        contextHistoryLimit: 20,
        temperature: '0.20',
        updatedAt: new Date('2026-11-09T00:00:00Z'),
      });

      const res = await service.getSettings();

      expect(res.idempotencyTtlDays).toBe(14);
      expect(res.leaseDurationSeconds).toBe(120);
      expect(res.contextHistoryLimit).toBe(20);
      expect(res.temperature).toBe(0.2);
    });
  });

  describe('Service updateSettings', () => {
    it('should upsert settings and return new values', async () => {
      mockPrisma.aiChatbotSetting.upsert.mockResolvedValueOnce({
        id: 1,
        idempotencyTtlDays: 30,
        leaseDurationSeconds: 90,
        contextHistoryLimit: 15,
        temperature: '0.10',
        updatedAt: new Date(),
      });

      const res = await service.updateSettings({
        idempotencyTtlDays: 30,
        leaseDurationSeconds: 90,
        contextHistoryLimit: 15,
        temperature: 0.1,
      });

      expect(mockPrisma.aiChatbotSetting.upsert).toHaveBeenCalled();
      expect(res.idempotencyTtlDays).toBe(30);
      expect(res.leaseDurationSeconds).toBe(90);
      expect(res.temperature).toBe(0.1);
    });
  });

  describe('Controller endpoints', () => {
    it('getSettings should wrap service result in { data } envelope', async () => {
      mockPrisma.aiChatbotSetting.findUnique.mockResolvedValueOnce({
        id: 1,
        idempotencyTtlDays: 7,
        leaseDurationSeconds: 60,
        contextHistoryLimit: 10,
        temperature: '0.15',
        updatedAt: new Date(),
      });

      const res = await controller.getSettings();

      expect(res.data).toBeDefined();
      expect(res.data.idempotencyTtlDays).toBe(7);
    });

    it('updateSettings should pass DTO to service and return { data }', async () => {
      mockPrisma.aiChatbotSetting.upsert.mockResolvedValueOnce({
        id: 1,
        idempotencyTtlDays: 21,
        leaseDurationSeconds: 60,
        contextHistoryLimit: 10,
        temperature: '0.15',
        updatedAt: new Date(),
      });

      const res = await controller.updateSettings({
        idempotencyTtlDays: 21,
      });

      expect(res.data.idempotencyTtlDays).toBe(21);
    });
  });
});
