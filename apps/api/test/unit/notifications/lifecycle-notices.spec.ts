import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../../src/generated/prisma/client.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import {
  enqueueCustomerNotice,
  enqueueRefundConfirmation,
} from '../../../src/notifications/customer-notice.js';
import {
  DepartureRemindersService,
  ticketPickupTime,
  reminderStillValid,
} from '../../../src/notifications/departure-reminders.service.js';
import { PushDevicesService } from '../../../src/notifications/push-devices.controller.js';

function harness() {
  const inbox = new Map<string, any>();
  const emails = new Map<string, any>();
  const pushes = new Map<string, any>();
  const upsert = (table: Map<string, any>) =>
    vi.fn(async ({ where, create }) => {
      if (!table.has(where.eventKey))
        table.set(where.eventKey, { thongBaoId: 88, ...create });
      return table.get(where.eventKey);
    });
  const ticket = {
    veId: 1,
    maVe: 'TICKET',
    phieuDatVeId: 3,
    trangThai: 'DA_THANH_TOAN',
    diemDon: 'Bến A',
    diemDonSnapshot: { phutLech: 90 },
    phieuDatVe: {
      trangThai: 'DA_THANH_TOAN',
      donGiaoDich: {
        trangThai: 'DA_THANH_TOAN',
        khachHangId: 4,
        emailKhachHang: 'owner@example.test',
      },
    },
    gheChuyenXe: {
      chuyenXe: {
        trangThai: 'CHUA_KHOI_HANH',
        ngayKhoiHanh: new Date('2026-11-03'),
        gioKhoiHanh: new Date('1970-01-01T23:00:00Z'),
      },
    },
  };
  const refund = {
    loaiGiaoDich: 'HOAN_TIEN',
    trangThai: 'THANH_CONG',
    thoiDiemHoanTat: new Date(),
    soTien: 123000,
    ve: ticket,
  };
  const db = {
    thongBao: { upsert: upsert(inbox) },
    emailThongBao: { upsert: upsert(emails) },
    pushThongBao: { upsert: upsert(pushes) },
    thietBiThongBao: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { thietBiThongBaoId: 7, sessionId: 'sid', tokenHash: 'hash' },
        ]),
    },
    thanhToan: { findUniqueOrThrow: vi.fn().mockResolvedValue(refund) },
    ve: {
      findUnique: vi.fn().mockResolvedValue(ticket),
      findMany: vi.fn().mockResolvedValue([ticket]),
    },
  };
  const p = { ...db, $transaction: vi.fn(async (cb) => cb(db)) };
  return {
    db,
    p,
    ticket,
    refund,
    inbox,
    emails,
    pushes,
    tx: db as unknown as Prisma.TransactionClient,
  };
}
describe('customer lifecycle notifications', () => {
  it('atomically deduplicates inbox/email/push events and routes to the owned ticket', async () => {
    const h = harness();
    const notice = {
      eventKey: 'ticket-cancelled:1',
      customerId: 4,
      email: 'owner@example.test',
      bookingId: 3,
      ticketId: 1,
      title: 'Cancelled',
      content: 'Refund pending',
    };
    await enqueueCustomerNotice(h.tx, notice);
    await enqueueCustomerNotice(h.tx, notice);
    expect(h.inbox.size).toBe(1);
    expect(h.emails.size).toBe(1);
    expect(h.pushes.size).toBe(1);
    expect([...h.pushes.values()][0]).toMatchObject({
      khachHangId: 4,
      sessionId: 'sid',
      thongBaoId: 88,
    });
    expect(h.inbox.get(notice.eventKey)).toMatchObject({
      ticketId: 1,
      nguoiNhans: { create: { khachHangId: 4 } },
    });
  });
  it('guest cancellation creates email only and never matches an account by phone', async () => {
    const h = harness();
    await enqueueCustomerNotice(h.tx, {
      eventKey: 'ticket-cancelled:1',
      customerId: null,
      email: 'owner@example.test',
      bookingId: 3,
      ticketId: 1,
      title: 'Cancelled',
      content: 'No refund',
    });
    expect(h.inbox.size).toBe(0);
    expect(h.pushes.size).toBe(0);
    expect(h.emails.size).toBe(1);
  });
  it('requires provider-confirmed refund completion before issuing confirmation', async () => {
    const h = harness();
    h.refund.trangThai = 'DANG_XU_LY';
    await expect(enqueueRefundConfirmation(h.tx, 5)).rejects.toThrow();
    expect(h.inbox.size + h.emails.size).toBe(0);
    h.refund.trangThai = 'THANH_CONG';
    await enqueueRefundConfirmation(h.tx, 5);
    expect(h.emails.get('refund-succeeded:5').noiDung).toContain('123000');
  });
  it('reminds against the pickup snapshot across midnight, once per departure time', async () => {
    const h = harness();
    const departure = ticketPickupTime(h.ticket as never, 'Asia/Ho_Chi_Minh');
    expect(departure.toISOString()).toBe('2026-11-03T17:30:00.000Z');
    const service = new DepartureRemindersService(
      h.p as unknown as PrismaService,
      new ConfigService({ BUSINESS_TIME_ZONE: 'Asia/Ho_Chi_Minh' }),
    );
    await service.tick(new Date('2026-11-03T16:00:00Z'));
    await service.tick(new Date('2026-11-03T16:01:00Z'));
    expect(h.inbox.size).toBe(1);
    expect(h.emails.size).toBe(1);
    expect(h.pushes.size).toBe(1);
    expect([...h.inbox.values()][0].noiDung).toContain('00:30');
  });
  it('does not remind outside the 2-hour window or after pickup', async () => {
    const h = harness();
    const service = new DepartureRemindersService(
      h.p as unknown as PrismaService,
      new ConfigService({}),
    );
    await service.tick(new Date('2026-11-03T14:00:00Z'));
    await service.tick(new Date('2026-11-03T18:00:00Z'));
    expect(h.inbox.size).toBe(0);
  });
  it('suppresses queued reminders after cancellation or schedule change', async () => {
    const h = harness();
    const time = ticketPickupTime(
      h.ticket as never,
      'Asia/Ho_Chi_Minh',
    ).getTime();
    const key = `departure-reminder:1:${time}`;
    expect(await reminderStillValid(h.tx, key, new Date(time - 1))).toBe(true);
    h.ticket.trangThai = 'HUY';
    expect(await reminderStillValid(h.tx, key, new Date(time - 1))).toBe(false);
    h.ticket.trangThai = 'DA_THANH_TOAN';
    h.ticket.diemDonSnapshot.phutLech = 100;
    expect(await reminderStillValid(h.tx, key, new Date(time - 1))).toBe(false);
  });
  it('binds a device to the authenticated customer/session and scopes unregister', async () => {
    const db = {
      khachHang: { findUnique: vi.fn().mockResolvedValue({ khachHangId: 4 }) },
      thietBiThongBao: {
        upsert: vi.fn().mockResolvedValue({ thietBiThongBaoId: 9 }),
        updateMany: vi.fn(),
      },
      pushThongBao: { updateMany: vi.fn() },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(db),
      ),
    };
    const service = new PushDevicesService(db as unknown as PrismaService);
    const principal = {
      taiKhoanId: 2,
      sessionId: 'sid',
      roles: ['CUSTOMER'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };
    expect(await service.register(principal, 'abcdefghijklmnopqrstuv')).toEqual(
      { data: { registered: true } },
    );
    expect(db.thietBiThongBao.upsert.mock.calls[0][0].create).toMatchObject({
      khachHangId: 4,
      taiKhoanId: 2,
      sessionId: 'sid',
    });
    expect(db.pushThongBao.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          khachHangId: 4,
          trangThai: 'PENDING',
        }),
        data: { sessionId: 'sid' },
      }),
    );
    await service.unregister(principal, 'abcdefghijklmnopqrstuv');
    expect(
      db.thietBiThongBao.updateMany.mock.calls[0][0].where.taiKhoanId,
    ).toBe(2);
    db.khachHang.findUnique.mockResolvedValue(null);
    await expect(
      service.register(principal, 'abcdefghijklmnopqrstuv'),
    ).rejects.toThrow();
  });
});
