import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { reminderStillValid } from './departure-reminders.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EmailDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailDeliveryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private transport?: ReturnType<typeof nodemailer.createTransport>;
  private from = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('SMTP_ENABLED') !== 'true') return;
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    this.from = this.config.get<string>('SMTP_FROM')?.trim() ?? '';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '465');
    if (
      !host ||
      !user ||
      !pass ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.from) ||
      ![465, 587].includes(port)
    ) {
      throw new Error(
        'SMTP_ENABLED requires host, user, password, FROM address and port465/587',
      );
    }
    this.transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: true,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.error('Email worker failed; inspect outbox status.'),
      );
    }, 15000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.transport?.close();
  }

  async tick(): Promise<void> {
    if (!this.transport || this.running) return;
    this.running = true;
    try {
      const now = new Date();
      // A crash after SMTP acceptance is ambiguous. Never automatically resend
      // those jobs: SMTP has no provider idempotency guarantee.
      await this.prisma.emailThongBao.updateMany({
        where: { trangThai: 'SENDING', leaseUntil: { lt: now } },
        data: { trangThai: 'UNKNOWN', leaseToken: null, leaseUntil: null },
      });
      const jobs = await this.prisma.emailThongBao.findMany({
        where: {
          trangThai: 'PENDING',
          thuLaiLuc: { lte: now },
          soLanThu: { lt: 5 },
        },
        orderBy: { emailThongBaoId: 'asc' },
        take: 10,
      });
      for (const job of jobs) {
        if (
          !(await reminderStillValid(
            this.prisma,
            job.eventKey,
            now,
            this.config.get<string>('BUSINESS_TIME_ZONE') || 'Asia/Ho_Chi_Minh',
          ))
        ) {
          await this.prisma.emailThongBao.updateMany({
            where: {
              emailThongBaoId: job.emailThongBaoId,
              trangThai: 'PENDING',
            },
            data: { trangThai: 'SKIPPED' },
          });
          continue;
        }
        const leaseToken = randomUUID();
        const claimed = await this.prisma.emailThongBao.updateMany({
          where: {
            emailThongBaoId: job.emailThongBaoId,
            trangThai: 'PENDING',
            soLanThu: job.soLanThu,
          },
          data: {
            trangThai: 'SENDING',
            soLanThu: { increment: 1 },
            leaseToken,
            leaseUntil: new Date(Date.now() + 120000),
          },
        });
        if (claimed.count !== 1) continue;
        let state = 'SENT';
        try {
          const result = await this.transport.sendMail({
            from: this.from,
            to: job.nguoiNhan,
            subject: job.tieuDe,
            text: job.noiDung,
            messageId: `<${job.eventKey.replace(/[^a-zA-Z0-9-]/g, '-')}@${this.from.split('@')[1]}>`,
          });
          if (!result.accepted?.length) state = 'FAILED';
        } catch (error: unknown) {
          // Retry explicit rejection or connection failure before the envelope.
          // Network timeouts/disconnects after DATA may already have delivered.
          const e = error as {
            code?: string;
            command?: string;
            responseCode?: number;
          };
          const definitelyRejected =
            (e.responseCode !== undefined && e.responseCode >= 400) ||
            e.code === 'EAUTH' ||
            e.code === 'EDNS' ||
            (e.code === 'ECONNECTION' && e.command === 'CONN');
          state = definitelyRejected
            ? job.soLanThu + 1 < 5
              ? 'PENDING'
              : 'FAILED'
            : 'UNKNOWN';
        }
        // If persisting SENT fails, leave SENDING for UNKNOWN recovery, never resend immediately.
        await this.prisma.emailThongBao.updateMany({
          where: {
            emailThongBaoId: job.emailThongBaoId,
            leaseToken,
            trangThai: 'SENDING',
          },
          data: {
            trangThai: state,
            leaseToken: null,
            leaseUntil: null,
            thuLaiLuc: new Date(Date.now() + 60000 * 2 ** job.soLanThu),
          },
        });
        if (state !== 'SENT')
          this.logger.warn(`Email job #${job.emailThongBaoId}: ${state}`);
      }
    } finally {
      this.running = false;
    }
  }
}
