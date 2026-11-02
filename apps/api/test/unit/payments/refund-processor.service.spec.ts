import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { RefundProcessorService } from '../../../src/payments/refund-processor.service.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Support-only refunds', () => {
  it.each([
    {},
    {
      REFUND_PROVIDER_URL: 'https://provider.example.test/refunds',
      REFUND_PROVIDER_TOKEN: 'old-config',
      REFUND_PROCESS_INTERVAL_MS: '1000',
    },
  ])(
    'never dispatches or settles refunds despite legacy provider settings: %j',
    async (settings) => {
      const databaseAccess = vi.fn(() => {
        throw new Error('Manual refunds must not touch the DB');
      });
      const prisma = new Proxy({}, { get: databaseAccess }) as PrismaService;
      const config = {
        get: vi.fn((key: string) => (settings as Record<string, string>)[key]),
      };
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const service = new RefundProcessorService(
        prisma,
        config as unknown as ConfigService,
      );
      service.onApplicationBootstrap();
      service.enqueueRefund(77);
      await service.processPendingRefunds();
      await service.processRefund(77);
      await service.processRefund(77);
      await vi.advanceTimersByTimeAsync(120000);
      service.onApplicationShutdown();
      expect(fetch).not.toHaveBeenCalled();
      expect(databaseAccess).not.toHaveBeenCalled();
      expect(config.get).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
