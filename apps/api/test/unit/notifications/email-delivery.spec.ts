import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { EmailDeliveryService } from '../../../src/notifications/email-delivery.service.js';

const smtp = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn() }));
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => smtp) },
}));
const workers: EmailDeliveryService[] = [];
afterEach(() => {
  workers.forEach((w) => w.onModuleDestroy());
  workers.length = 0;
  vi.clearAllMocks();
});

function harness(enabled = true) {
  const job = {
    emailThongBaoId: 1,
    eventKey: 'booking-paid:12',
    nguoiNhan: 'owner@example.com',
    tieuDe: 'Paid',
    noiDung: 'Ticket',
    soLanThu: 0,
    trangThai: 'PENDING',
    leaseToken: null as string | null,
    leaseUntil: null as Date | null,
  };
  const table = {
    findMany: vi.fn(async () => [{ ...job }]),
    updateMany: vi.fn(async ({ where, data }) => {
      if (
        where.emailThongBaoId !== 1 ||
        where.trangThai !== job.trangThai ||
        (where.leaseToken && where.leaseToken !== job.leaseToken)
      )
        return { count: 0 };
      if (where.soLanThu !== undefined && where.soLanThu !== job.soLanThu)
        return { count: 0 };
      const next = { ...data };
      if (typeof next.soLanThu === 'object') next.soLanThu = job.soLanThu + 1;
      Object.assign(job, next);
      return { count: 1 };
    }),
  };
  const config = new ConfigService({
    SMTP_ENABLED: String(enabled),
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '465',
    SMTP_USER: 'user',
    SMTP_PASSWORD: 'test-secret',
    SMTP_FROM: 'tickets@example.com',
  });
  const create = () => {
    const w = new EmailDeliveryService(
      { emailThongBao: table } as unknown as PrismaService,
      config,
    );
    workers.push(w);
    w.onModuleInit();
    return w;
  };
  return { job, table, create };
}

describe('SMTP outbox worker', () => {
  it('does nothing while SMTP disabled, preserving durable pending work', async () => {
    const h = harness(false);
    await h.create().tick();
    expect(h.table.findMany).not.toHaveBeenCalled();
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });
  it('claims atomically across two workers and records accepted email once', async () => {
    const h = harness();
    smtp.sendMail.mockResolvedValue({ accepted: ['owner@example.com'] });
    await Promise.all([h.create().tick(), h.create().tick()]);
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
    expect(h.job.trangThai).toBe('SENT');
  });
  it('retries explicit server rejection without changing payment records', async () => {
    const h = harness();
    smtp.sendMail.mockRejectedValue({ responseCode: 451 });
    await h.create().tick();
    expect(h.job.trangThai).toBe('PENDING');
    expect(h.job.soLanThu).toBe(1);
  });
  it('keeps ambiguous DATA timeout UNKNOWN instead of blindly sending again', async () => {
    const h = harness();
    smtp.sendMail.mockRejectedValue({ code: 'ETIMEDOUT', command: 'DATA' });
    const w = h.create();
    await w.tick();
    await w.tick();
    expect(h.job.trangThai).toBe('UNKNOWN');
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
  });
  it('marks exhausted definite rejection FAILED', async () => {
    const h = harness();
    h.job.soLanThu = 4;
    smtp.sendMail.mockRejectedValue({ code: 'EAUTH' });
    await h.create().tick();
    expect(h.job.trangThai).toBe('FAILED');
  });
  it('never resends after successful SMTP followed by DB acknowledgement failure', async () => {
    const h = harness();
    smtp.sendMail.mockResolvedValue({ accepted: ['owner@example.com'] });
    const original = h.table.updateMany.getMockImplementation()!;
    h.table.updateMany.mockImplementation(async (arg) => {
      if (arg.data.trangThai === 'SENT') throw new Error('DB unavailable');
      return original(arg);
    });
    const w = h.create();
    await expect(w.tick()).rejects.toThrow();
    await w.tick();
    expect(h.job.trangThai).toBe('SENDING');
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
  });
});
