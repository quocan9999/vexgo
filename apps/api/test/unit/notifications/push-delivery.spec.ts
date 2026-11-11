import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { PushDeliveryService } from '../../../src/notifications/push-delivery.service.js';
const fcm = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue('accepted') }));
vi.mock('firebase-admin/app', () => ({
  applicationDefault: () => ({}),
  initializeApp: () => ({}),
  deleteApp: vi.fn(),
}));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => fcm }));
const workers: PushDeliveryService[] = [];
afterEach(async () => {
  for (const w of workers) await w.onModuleDestroy();
  workers.length = 0;
  vi.clearAllMocks();
  fcm.send.mockResolvedValue('accepted');
});
function harness() {
  const job = {
    pushThongBaoId: 1,
    thietBiThongBaoId: 2,
    khachHangId: 3,
    sessionId: 'sid',
    tokenHash: 'hash',
    thongBaoId: 9,
    trangThai: 'PENDING',
    leaseToken: null as string | null,
  };
  const db = {
    pushThongBao: {
      findMany: vi.fn(async () => [{ ...job }]),
      updateMany: vi.fn(async ({ where, data }) => {
        if (
          where.pushThongBaoId !== 1 ||
          where.trangThai !== job.trangThai ||
          (where.leaseToken && where.leaseToken !== job.leaseToken)
        )
          return { count: 0 };
        Object.assign(job, data);
        return { count: 1 };
      }),
    },
    thietBiThongBao: {
      findFirst: vi.fn().mockResolvedValue({
        thietBiThongBaoId: 2,
        taiKhoanId: 4,
        token: 'abcdefghijklmnopqrstuv',
      }),
      updateMany: vi.fn(),
    },
    phienDangNhap: {
      findFirst: vi.fn().mockResolvedValue({ sessionId: 'sid' }),
    },
    thongBaoNguoiNhan: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ thongBao: { eventKey: 'ticket-cancelled:1' } }),
    },
  };
  const create = (enabled = true) => {
    const w = new PushDeliveryService(
      db as unknown as PrismaService,
      new ConfigService({
        FCM_ENABLED: String(enabled),
        FCM_PROJECT_ID: 'test-project',
      }),
    );
    workers.push(w);
    w.onModuleInit();
    return w;
  };
  return { db, job, create };
}
describe('session-bound FCM outbox', () => {
  it('sends a standard registration token without treating it as an FID', async () => {
    const h=harness();
    h.db.thietBiThongBao.findFirst.mockResolvedValue({thietBiThongBaoId:2,taiKhoanId:4,token:'x'.repeat(150)});
    await h.create().tick();
    expect(fcm.send.mock.calls[0][0].token).toBe('x'.repeat(150));
    expect(fcm.send.mock.calls[0][0].fid).toBeUndefined();
  });
  it('only one worker sends one generic notification and no customer PII', async () => {
    const h = harness();
    await Promise.all([h.create().tick(), h.create().tick()]);
    expect(fcm.send).toHaveBeenCalledTimes(1);
    expect(h.job.trangThai).toBe('SENT');
    expect(fcm.send.mock.calls[0][0]).toMatchObject({
      fid: 'abcdefghijklmnopqrstuv',
      data: { notificationId: '9', recipientCustomerId: '3' },
    });
    expect(JSON.stringify(fcm.send.mock.calls[0][0])).not.toContain('TICKET');
  });
  it.each(['device', 'session', 'recipient'])(
    'never sends when %s no longer belongs to this session',
    async (which) => {
      const h = harness();
      if (which === 'device')
        h.db.thietBiThongBao.findFirst.mockResolvedValue(null);
      if (which === 'session')
        h.db.phienDangNhap.findFirst.mockResolvedValue(null);
      if (which === 'recipient')
        h.db.thongBaoNguoiNhan.findFirst.mockResolvedValue(null);
      await h.create().tick();
      expect(fcm.send).not.toHaveBeenCalled();
      expect(h.job.trangThai).toBe('SKIPPED');
    },
  );
  it('disables only the stale registration and does not replay ambiguous delivery', async () => {
    const h = harness();
    fcm.send.mockRejectedValueOnce({
      code: 'messaging/registration-token-not-registered',
    });
    await h.create().tick();
    expect(h.job.trangThai).toBe('FAILED');
    expect(h.db.thietBiThongBao.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionId: 'sid', tokenHash: 'hash' }),
      }),
    );
    const other = harness();
    fcm.send.mockRejectedValueOnce(new Error('network lost'));
    const w = other.create();
    await w.tick();
    await w.tick();
    expect(other.job.trangThai).toBe('UNKNOWN');
    expect(fcm.send).toHaveBeenCalledTimes(2);
  });
  it('does no DB or FCM work when disabled', async () => {
    const h = harness();
    await h.create(false).tick();
    expect(h.db.pushThongBao.findMany).not.toHaveBeenCalled();
    expect(fcm.send).not.toHaveBeenCalled();
  });
});
