import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';

@Injectable()
export class TripDepartureService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TripDepartureService.name);
  private readonly timeZone: string;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  onApplicationBootstrap() {
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, 1_000);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.startDueTrips();
    } catch (error) {
      this.logger.error(
        'Không thể cập nhật chuyến đến giờ khởi hành.',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  async startDueTrips(now = new Date()) {
    const date = getBusinessDate(this.timeZone, now);
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(now);
    // One atomic predicate also protects cancellation/rescheduling races and
    // makes repeated ticks safe across multiple API instances.
    return this.prisma.chuyenXe.updateMany({
      where: {
        trangThai: 'CHUA_KHOI_HANH',
        OR: [
          { ngayKhoiHanh: { lt: new Date(`${date}T00:00:00.000Z`) } },
          {
            ngayKhoiHanh: new Date(`${date}T00:00:00.000Z`),
            gioKhoiHanh: { lte: new Date(`1970-01-01T${time}.000Z`) },
          },
        ],
      },
      data: { trangThai: 'DANG_CHAY' },
    });
  }
}
