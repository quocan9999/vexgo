import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  applicationDefault,
  initializeApp,
  deleteApp,
  type App,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { reminderStillValid } from './departure-reminders.service.js';

@Injectable()
export class PushDeliveryService implements OnModuleInit, OnModuleDestroy {
  private app?: App;
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(PushDeliveryService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (this.config.get<string>('FCM_ENABLED') !== 'true') return;
    const projectId = this.config.get<string>('FCM_PROJECT_ID')?.trim();
    if (!projectId)
      throw new Error(
        'FCM_ENABLED requires FCM_PROJECT_ID and server ADC credentials',
      );
    this.app = initializeApp(
      { credential: applicationDefault(), projectId },
      `vexgo-${randomUUID()}`,
    );
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.error('Push delivery failed; inspect outbox'),
      );
    }, 15000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.app) await deleteApp(this.app);
  }
  async tick(now = new Date()) {
    if (!this.app || this.running) return;
    this.running = true;
    try {
      await this.prisma.pushThongBao.updateMany({
        where: { trangThai: 'SENDING', leaseUntil: { lt: now } },
        data: { trangThai: 'UNKNOWN' },
      });
      const jobs = await this.prisma.pushThongBao.findMany({
        where: { trangThai: 'PENDING' },
        orderBy: { pushThongBaoId: 'asc' },
        take: 20,
      });
      for (const job of jobs) {
        const leaseToken = randomUUID();
        const claimed = await this.prisma.pushThongBao.updateMany({
          where: { pushThongBaoId: job.pushThongBaoId, trangThai: 'PENDING' },
          data: {
            trangThai: 'SENDING',
            leaseToken,
            leaseUntil: new Date(now.getTime() + 120000),
          },
        });
        if (claimed.count !== 1) continue;
        let state = 'SKIPPED';
        const device = await this.prisma.thietBiThongBao.findFirst({
          where: {
            thietBiThongBaoId: job.thietBiThongBaoId,
            khachHangId: job.khachHangId,
            sessionId: job.sessionId,
            tokenHash: job.tokenHash,
            hoatDong: true,
          },
        });
        const session =
          device &&
          (await this.prisma.phienDangNhap.findFirst({
            where: {
              sessionId: job.sessionId,
              taiKhoanId: device.taiKhoanId,
              thuHoiLuc: null,
              hetHanLuc: { gt: now },
              taiKhoan: { trangThai: 'HOAT_DONG' },
            },
          }));
        const recipient = await this.prisma.thongBaoNguoiNhan.findFirst({
          where: { thongBaoId: job.thongBaoId, khachHangId: job.khachHangId },
          include: { thongBao: true },
        });
        if (
          device &&
          session &&
          recipient &&
          (await reminderStillValid(
            this.prisma,
            recipient.thongBao.eventKey || '',
            now,
            this.config.get<string>('BUSINESS_TIME_ZONE') || 'Asia/Ho_Chi_Minh',
          ))
        ) {
          state = 'SENT';
          try {
            // Generic lock-screen text: no names, ticket codes, phone or money.
            await getMessaging(this.app).send({
              ...(device.token.length === 22 &&
              /^[A-Za-z0-9_-]+$/.test(device.token)
                ? { fid: device.token }
                : { token: device.token }),
              notification: {
                title: 'VexGo',
                body: 'Bạn có cập nhật mới về vé. Mở ứng dụng để xem.',
              },
              data: {
                notificationId: String(job.thongBaoId),
                recipientCustomerId: String(job.khachHangId),
              },
              android: {
                priority: 'high',
                ttl: 3600000,
                collapseKey: String(job.thongBaoId),
              },
            });
          } catch (error: unknown) {
            const code = (error as { code?: string } | null)?.code;
            const invalid =
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token';
            if (invalid)
              await this.prisma.thietBiThongBao.updateMany({
                where: {
                  thietBiThongBaoId: device.thietBiThongBaoId,
                  tokenHash: job.tokenHash,
                  sessionId: job.sessionId,
                },
                data: { hoatDong: false },
              });
            // Ambiguous delivery is retained for manual reconciliation, never blind replay.
            state =
              invalid || code === 'messaging/mismatched-credential'
                ? 'FAILED'
                : 'UNKNOWN';
          }
        }
        await this.prisma.pushThongBao.updateMany({
          where: {
            pushThongBaoId: job.pushThongBaoId,
            trangThai: 'SENDING',
            leaseToken,
          },
          data: { trangThai: state, leaseToken: null, leaseUntil: null },
        });
      }
    } finally {
      this.running = false;
    }
  }
}
