import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Compatibility boundary for existing cancellation callers.
 * Refunds are handled by support outside the app. Legacy provider settings
 * must never cause a bank request or mark a pending refund as settled.
 */
@Injectable()
export class RefundProcessorService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RefundProcessorService.name);

  constructor(_prisma: PrismaService, _config: ConfigService) {}

  onApplicationBootstrap() {
    this.logger.log(
      'Online refunds are disabled. Customers must contact support after cancellation.',
    );
  }

  onApplicationShutdown() {}

  enqueueRefund(_refundId: number) {
    // Cancellation keeps the existing pending record for manual reconciliation.
  }

  async processPendingRefunds() {
    // No background retry or provider dispatch in the support-only refund flow.
  }

  async processRefund(_refundId: number) {
    // Kept callable for older integrations, intentionally without side effects.
  }
}
