import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UpdateAiSettingsDto } from './dto/update-ai-settings.dto.js';
import { Prisma } from '../../generated/prisma/client.js';

export interface AiChatbotSettingsData {
  id: number;
  idempotencyTtlDays: number;
  leaseDurationSeconds: number;
  contextHistoryLimit: number;
  temperature: number;
  updatedAt: Date;
}

const DEFAULT_SETTINGS: AiChatbotSettingsData = {
  id: 1,
  idempotencyTtlDays: 7,
  leaseDurationSeconds: 60,
  contextHistoryLimit: 10,
  temperature: 0.15,
  updatedAt: new Date(),
};

@Injectable()
export class AiChatbotSettingsService {
  private readonly logger = new Logger(AiChatbotSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AiChatbotSettingsData> {
    try {
      const setting = await this.prisma.aiChatbotSetting.findUnique({
        where: { id: 1 },
      });
      if (!setting) {
        return DEFAULT_SETTINGS;
      }
      return {
        id: setting.id,
        idempotencyTtlDays: setting.idempotencyTtlDays,
        leaseDurationSeconds: setting.leaseDurationSeconds,
        contextHistoryLimit: setting.contextHistoryLimit,
        temperature: Number(setting.temperature),
        updatedAt: setting.updatedAt,
      };
    } catch (err) {
      this.logger.warn(`Could not read AI settings, falling back to default: ${String(err)}`);
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(dto: UpdateAiSettingsDto): Promise<AiChatbotSettingsData> {
    const data: Prisma.AiChatbotSettingUpdateInput = {};
    if (dto.idempotencyTtlDays !== undefined) data.idempotencyTtlDays = dto.idempotencyTtlDays;
    if (dto.leaseDurationSeconds !== undefined) data.leaseDurationSeconds = dto.leaseDurationSeconds;
    if (dto.contextHistoryLimit !== undefined) data.contextHistoryLimit = dto.contextHistoryLimit;
    if (dto.temperature !== undefined) data.temperature = new Prisma.Decimal(dto.temperature);

    const updated = await this.prisma.aiChatbotSetting.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        idempotencyTtlDays: dto.idempotencyTtlDays ?? DEFAULT_SETTINGS.idempotencyTtlDays,
        leaseDurationSeconds: dto.leaseDurationSeconds ?? DEFAULT_SETTINGS.leaseDurationSeconds,
        contextHistoryLimit: dto.contextHistoryLimit ?? DEFAULT_SETTINGS.contextHistoryLimit,
        temperature: new Prisma.Decimal(dto.temperature ?? DEFAULT_SETTINGS.temperature),
      },
      update: data,
    });

    this.logger.log(
      `AI Chatbot settings updated: TTL=${updated.idempotencyTtlDays}d, Lease=${updated.leaseDurationSeconds}s, ContextLimit=${updated.contextHistoryLimit}, Temp=${updated.temperature}`,
    );

    return {
      id: updated.id,
      idempotencyTtlDays: updated.idempotencyTtlDays,
      leaseDurationSeconds: updated.leaseDurationSeconds,
      contextHistoryLimit: updated.contextHistoryLimit,
      temperature: Number(updated.temperature),
      updatedAt: updated.updatedAt,
    };
  }
}
