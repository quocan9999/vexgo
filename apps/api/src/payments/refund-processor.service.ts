import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

type RefundProviderResponse = { status?: unknown };

@Injectable()
export class RefundProcessorService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RefundProcessorService.name);
  private readonly providerUrl?: string;
  private readonly providerToken?: string;
  private readonly intervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.providerUrl = config.get<string>('REFUND_PROVIDER_URL')?.trim();
    this.providerToken = config.get<string>('REFUND_PROVIDER_TOKEN')?.trim();
    const configuredInterval = Number(
      config.get<string>('REFUND_PROCESS_INTERVAL_MS'),
    );
    this.intervalMs =
      Number.isSafeInteger(configuredInterval) && configuredInterval >= 1_000
        ? configuredInterval
        : 30_000;
  }

  onApplicationBootstrap() {
    if (!this.providerUrl) {
      this.logger.warn(
        'REFUND_PROVIDER_URL is not configured; refunds remain pending until a provider is configured.',
      );
      return;
    }

    void this.processPendingRefunds();
    this.timer = setInterval(() => {
      void this.processPendingRefunds();
    }, this.intervalMs);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  enqueueRefund(refundId: number) {
    if (!this.providerUrl) return;
    queueMicrotask(() => {
      void this.processRefund(refundId);
    });
  }

  async processPendingRefunds() {
    if (!this.providerUrl) return;

    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    await this.prisma.thanhToan.updateMany({
      where: {
        loaiGiaoDich: 'HOAN_TIEN',
        trangThai: 'DANG_GUI',
        updatedAt: { lt: staleBefore },
      },
      data: { trangThai: 'DANG_XU_LY' },
    });

    const pending = await this.prisma.thanhToan.findMany({
      where: { loaiGiaoDich: 'HOAN_TIEN', trangThai: 'DANG_XU_LY' },
      select: { thanhToanId: true },
      orderBy: { thanhToanId: 'asc' },
      take: 50,
    });
    await Promise.all(
      pending.map(({ thanhToanId }) => this.processRefund(thanhToanId)),
    );
  }

  async processRefund(refundId: number) {
    if (!this.providerUrl) return;

    const refund = await this.prisma.thanhToan.findUnique({
      where: { thanhToanId: refundId },
    });
    if (
      !refund ||
      refund.loaiGiaoDich !== 'HOAN_TIEN' ||
      refund.trangThai !== 'DANG_XU_LY'
    ) {
      return;
    }

    const claimed = await this.prisma.thanhToan.updateMany({
      where: { thanhToanId: refundId, trangThai: 'DANG_XU_LY' },
      data: { trangThai: 'DANG_GUI' },
    });
    if (claimed.count !== 1) return;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': `refund-${refundId}`,
      };
      if (this.providerToken) {
        headers.Authorization = `Bearer ${this.providerToken}`;
      }
      const response = await fetch(this.providerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          refundId,
          transactionId: refund.donGiaoDichId,
          ticketId: refund.veId,
          amount: refund.soTien.toString(),
          paymentMethod: refund.phuongThuc,
        }),
      });
      const body = (await response
        .json()
        .catch(() => null)) as RefundProviderResponse | null;
      if (!response.ok || body?.status !== 'SUCCEEDED') {
        throw new Error(`Refund provider returned HTTP ${response.status}.`);
      }

      await this.prisma.thanhToan.updateMany({
        where: { thanhToanId: refundId, trangThai: 'DANG_GUI' },
        data: { trangThai: 'THANH_CONG' },
      });
    } catch (error) {
      await this.prisma.thanhToan.updateMany({
        where: { thanhToanId: refundId, trangThai: 'DANG_GUI' },
        data: { trangThai: 'DANG_XU_LY' },
      });
      this.logger.error(
        `Refund ${refundId} failed and was returned to the pending queue.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
