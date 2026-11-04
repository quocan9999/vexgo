import { describe, expect, it, vi } from 'vitest';
import { enqueuePaymentConfirmation } from '../../../src/notifications/payment-confirmation.js';
import type { Prisma } from '../../../src/generated/prisma/client.js';

function harness(
  customerId: number | null = 7,
  email: string | null = 'owner@example.com',
) {
  const notifications = new Map();
  const emails = new Map();
  const booking = {
    phieuDatVeId: 12,
    maPhieuDatVe: 'BOOK-12',
    trangThai: 'DA_THANH_TOAN',
    donGiaoDich: {
      trangThai: 'DA_THANH_TOAN',
      khachHangId: customerId,
      emailKhachHang: email,
      tongTien: 240000,
    },
    ves: [1, 2].map((id) => ({
      veId: id,
      maVe: `TICKET-${id}`,
      gheChuyenXe: {
        chuyenXe: {
          tuyenXe: { diemDi: 'TP.HCM', diemDen: 'Đà Lạt' },
          ngayKhoiHanh: new Date('2026-11-05'),
          gioKhoiHanh: new Date('1970-01-01T08:00:00Z'),
        },
      },
    })),
  };
  const upsert = (rows: Map<string, unknown>) =>
    vi.fn(async ({ where, create }) => {
      if (!rows.has(where.eventKey)) rows.set(where.eventKey, create);
      return rows.get(where.eventKey);
    });
  const tx = {
    thietBiThongBao: { findMany: vi.fn().mockResolvedValue([]) },
    pushThongBao: { upsert: vi.fn() },
    phieuDatVe: { findUniqueOrThrow: vi.fn(async () => booking) },
    thongBao: { upsert: upsert(notifications) },
    emailThongBao: { upsert: upsert(emails) },
  };
  return {
    booking,
    tx,
    notifications,
    emails,
    client: tx as unknown as Prisma.TransactionClient,
  };
}

describe('paid booking notification snapshot', () => {
  it('enqueues one inbox and email event for a booking with all issued tickets and order total', async () => {
    const h = harness();
    await enqueuePaymentConfirmation(h.client, 12);
    await enqueuePaymentConfirmation(h.client, 12);
    expect(h.notifications.size).toBe(1);
    expect(h.emails.size).toBe(1);
    const inbox = h.notifications.get('booking-paid:12');
    expect(inbox).toMatchObject({
      category: 'TRIP',
      bookingId: 12,
      ticketId: 1,
      nguoiNhans: { create: { khachHangId: 7, daDoc: false } },
    });
    expect(inbox.noiDung).toContain('TICKET-1, TICKET-2');
    expect(inbox.noiDung).toContain('240.000');
    expect(inbox.noiDung).toContain('08:00');
  });
  it('sends guests email only without creating an inbox owned by another customer', async () => {
    const h = harness(null);
    await enqueuePaymentConfirmation(h.client, 12);
    expect(h.notifications.size).toBe(0);
    expect(h.emails.size).toBe(1);
  });
  it.each([null, 'bad\r\nBcc:other@example.com', 'invalid'])(
    'skips invalid/missing email (%s), keeps inbox',
    async (email) => {
      const h = harness(7, email);
      await enqueuePaymentConfirmation(h.client, 12);
      expect(h.notifications.size).toBe(1);
      expect(h.emails.size).toBe(0);
    },
  );
  it.each(['unpaid', 'no tickets'])(
    'never enqueues a success event for %s',
    async (reason) => {
      const h = harness();
      if (reason === 'unpaid') h.booking.trangThai = 'CHO_THANH_TOAN';
      else h.booking.ves = [];
      await expect(enqueuePaymentConfirmation(h.client, 12)).rejects.toThrow();
      expect(h.notifications.size + h.emails.size).toBe(0);
    },
  );
  it('propagates persistence failure for settlement transaction rollback rather than silently losing the event', async () => {
    const h = harness();
    h.tx.emailThongBao.upsert.mockRejectedValueOnce(
      new Error('DB unavailable'),
    );
    await expect(enqueuePaymentConfirmation(h.client, 12)).rejects.toThrow(
      'DB unavailable',
    );
  });
});
