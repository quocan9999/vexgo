import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config as loadDotenv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../../src/generated/prisma/client.js';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
loadDotenv({ path: resolve(process.cwd(), '.env') });

function createTestClient(): PrismaClient {
  const configuredDatabaseUrl = process.env.DATABASE_URL;
  if (!configuredDatabaseUrl) {
    throw new Error('DATABASE_URL is required for integration tests');
  }
  const databaseUrl = new URL(configuredDatabaseUrl);
  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: databaseUrl.hostname,
      port: Number(databaseUrl.port || 3306),
      user: decodeURIComponent(databaseUrl.username),
      password: decodeURIComponent(databaseUrl.password),
      database: decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, '')),
      allowPublicKeyRetrieval: true,
    }),
  });
}

describe('Lịch sử trạng thái Phiếu đặt vé & Vé DB Foundation', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Backfill baseline verification', () => {
    it('số baseline LichSuTrangThaiPhieuDatVe bằng số PhieuDatVe hiện có', async () => {
      const [bookingCount, historyCount] = await Promise.all([
        prisma.phieuDatVe.count(),
        prisma.lichSuTrangThaiPhieuDatVe.count(),
      ]);

      expect(historyCount).toBeGreaterThan(0);
      expect(historyCount).toBe(bookingCount);
    });

    it('số baseline LichSuTrangThaiVe bằng số Ve hiện có', async () => {
      const [ticketCount, historyCount] = await Promise.all([
        prisma.ve.count(),
        prisma.lichSuTrangThaiVe.count(),
      ]);

      expect(historyCount).toBeGreaterThan(0);
      expect(historyCount).toBe(ticketCount);
    });

    it('baseline của PhieuDatVe có đầy đủ thuộc tính chuẩn theo spec', async () => {
      const bookings = await prisma.phieuDatVe.findMany({
        include: {
          lichSuTrangThais: true,
        },
      });

      expect(bookings.length).toBeGreaterThan(0);

      const opIds = new Set<string>();

      for (const booking of bookings) {
        expect(booking.lichSuTrangThais).toHaveLength(1);
        const baseline = booking.lichSuTrangThais[0];
        expect(baseline.trangThaiCu).toBeNull();
        expect(baseline.trangThaiMoi).toBe(booking.trangThai);
        expect(baseline.nguonThayDoi).toBe('SYSTEM');
        expect(baseline.taiKhoanId).toBeNull();
        expect(baseline.laOverride).toBe(false);
        expect(baseline.lyDo).toBe('Khởi tạo lịch sử trạng thái từ dữ liệu hiện có');
        expect(baseline.maThaoTac).toMatch(/^[0-9a-fA-F-]{36}$/);
        opIds.add(baseline.maThaoTac);
      }

      // Mỗi baseline record có UUID maThaoTac riêng
      expect(opIds.size).toBe(bookings.length);
    });

    it('baseline của Ve có đầy đủ thuộc tính chuẩn theo spec', async () => {
      const tickets = await prisma.ve.findMany({
        include: {
          lichSuTrangThais: true,
        },
      });

      expect(tickets.length).toBeGreaterThan(0);

      const opIds = new Set<string>();

      for (const ticket of tickets) {
        expect(ticket.lichSuTrangThais).toHaveLength(1);
        const baseline = ticket.lichSuTrangThais[0];
        expect(baseline.trangThaiCu).toBeNull();
        expect(baseline.trangThaiMoi).toBe(ticket.trangThai);
        expect(baseline.nguonThayDoi).toBe('SYSTEM');
        expect(baseline.taiKhoanId).toBeNull();
        expect(baseline.laOverride).toBe(false);
        expect(baseline.lyDo).toBe('Khởi tạo lịch sử trạng thái từ dữ liệu hiện có');
        expect(baseline.maThaoTac).toMatch(/^[0-9a-fA-F-]{36}$/);
        opIds.add(baseline.maThaoTac);
      }

      // Mỗi baseline record có UUID maThaoTac riêng
      expect(opIds.size).toBe(tickets.length);
    });
  });

  describe('2. CHECK constraints enforcement', () => {
    let existingBookingId: number;
    let existingTicketId: number;
    let existingStaffAccountId: number;

    beforeAll(async () => {
      const booking = await prisma.phieuDatVe.findFirstOrThrow();
      existingBookingId = booking.phieuDatVeId;
      const ticket = await prisma.ve.findFirstOrThrow();
      existingTicketId = ticket.veId;
      const account = await prisma.taiKhoan.findFirstOrThrow();
      existingStaffAccountId = account.taiKhoanId;
    });

    it('CHECK reject source ngoài CUSTOMER|STAFF|SYSTEM', async () => {
      await expect(
        prisma.lichSuTrangThaiPhieuDatVe.create({
          data: {
            phieuDatVeId: existingBookingId,
            trangThaiCu: 'CHO_THANH_TOAN',
            trangThaiMoi: 'DA_THANH_TOAN',
            thoiDiem: new Date(),
            nguonThayDoi: 'ADMIN', // Invalid source
            taiKhoanId: existingStaffAccountId,
            lyDo: 'Thử nghiệm invalid source',
            laOverride: false,
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toThrow();
    });

    it('CHECK reject CUSTOMER hoặc STAFF thiếu taiKhoanId', async () => {
      await expect(
        prisma.lichSuTrangThaiPhieuDatVe.create({
          data: {
            phieuDatVeId: existingBookingId,
            trangThaiCu: 'CHO_THANH_TOAN',
            trangThaiMoi: 'DA_THANH_TOAN',
            thoiDiem: new Date(),
            nguonThayDoi: 'CUSTOMER',
            taiKhoanId: null, // Vi phạm: CUSTOMER phải có taiKhoanId
            lyDo: 'Khách đổi trạng thái',
            laOverride: false,
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.lichSuTrangThaiVe.create({
          data: {
            veId: existingTicketId,
            trangThaiCu: 'DA_DAT',
            trangThaiMoi: 'HUY',
            thoiDiem: new Date(),
            nguonThayDoi: 'STAFF',
            taiKhoanId: null, // Vi phạm: STAFF phải có taiKhoanId
            lyDo: 'Nhân viên hủy vé',
            laOverride: false,
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toThrow();
    });

    it('CHECK reject SYSTEM có taiKhoanId', async () => {
      await expect(
        prisma.lichSuTrangThaiPhieuDatVe.create({
          data: {
            phieuDatVeId: existingBookingId,
            trangThaiCu: 'CHO_THANH_TOAN',
            trangThaiMoi: 'DA_THANH_TOAN',
            thoiDiem: new Date(),
            nguonThayDoi: 'SYSTEM',
            taiKhoanId: existingStaffAccountId, // Vi phạm: SYSTEM phải có taiKhoanId = null
            lyDo: 'Tự động thanh toán',
            laOverride: false,
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toThrow();
    });

    it('CHECK reject CUSTOMER hoặc SYSTEM có laOverride = true', async () => {
      await expect(
        prisma.lichSuTrangThaiPhieuDatVe.create({
          data: {
            phieuDatVeId: existingBookingId,
            trangThaiCu: 'CHO_THANH_TOAN',
            trangThaiMoi: 'DA_THANH_TOAN',
            thoiDiem: new Date(),
            nguonThayDoi: 'CUSTOMER',
            taiKhoanId: existingStaffAccountId,
            lyDo: 'Override từ khách',
            laOverride: true, // Vi phạm: chỉ STAFF mới được override
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.lichSuTrangThaiVe.create({
          data: {
            veId: existingTicketId,
            trangThaiCu: 'DA_DAT',
            trangThaiMoi: 'HUY',
            thoiDiem: new Date(),
            nguonThayDoi: 'SYSTEM',
            taiKhoanId: null,
            lyDo: 'Override từ system',
            laOverride: true, // Vi phạm: chỉ STAFF mới được override
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toThrow();
    });

    it('CHECK reject trangThaiCu = trangThaiMoi', async () => {
      await expect(
        prisma.lichSuTrangThaiPhieuDatVe.create({
          data: {
            phieuDatVeId: existingBookingId,
            trangThaiCu: 'DA_THANH_TOAN',
            trangThaiMoi: 'DA_THANH_TOAN', // Vi phạm: trạng thái không đổi
            thoiDiem: new Date(),
            nguonThayDoi: 'STAFF',
            taiKhoanId: existingStaffAccountId,
            lyDo: 'Transition rỗng',
            laOverride: false,
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.lichSuTrangThaiVe.create({
          data: {
            veId: existingTicketId,
            trangThaiCu: 'DA_DAT',
            trangThaiMoi: 'DA_DAT', // Vi phạm: trạng thái không đổi
            thoiDiem: new Date(),
            nguonThayDoi: 'STAFF',
            taiKhoanId: existingStaffAccountId,
            lyDo: 'Transition rỗng',
            laOverride: false,
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toThrow();
    });

    it('cho phép STAFF có laOverride = true và taiKhoanId hợp lệ', async () => {
      const opId = randomUUID();
      const record = await prisma.lichSuTrangThaiPhieuDatVe.create({
        data: {
          phieuDatVeId: existingBookingId,
          trangThaiCu: 'CHO_THANH_TOAN',
          trangThaiMoi: 'DA_HUY',
          thoiDiem: new Date(),
          nguonThayDoi: 'STAFF',
          taiKhoanId: existingStaffAccountId,
          lyDo: 'Nhân viên đặc cách hủy phiếu đặt vé',
          laOverride: true,
          maThaoTac: opId,
        },
      });

      expect(record.lichSuTrangThaiPhieuDatVeId).toBeDefined();
      expect(record.laOverride).toBe(true);

      // Dọn dẹp bản ghi kiểm thử
      await prisma.lichSuTrangThaiPhieuDatVe.delete({
        where: { lichSuTrangThaiPhieuDatVeId: record.lichSuTrangThaiPhieuDatVeId },
      });
    });
  });

  describe('3. UNIQUE constraint enforcement', () => {
    let existingBookingId: number;
    let existingTicketId: number;

    beforeAll(async () => {
      const booking = await prisma.phieuDatVe.findFirstOrThrow();
      existingBookingId = booking.phieuDatVeId;
      const ticket = await prisma.ve.findFirstOrThrow();
      existingTicketId = ticket.veId;
    });

    it('reject duplicate (maThaoTac, phieuDatVeId)', async () => {
      const duplicateOp = randomUUID();

      const first = await prisma.lichSuTrangThaiPhieuDatVe.create({
        data: {
          phieuDatVeId: existingBookingId,
          trangThaiCu: 'CHO_THANH_TOAN',
          trangThaiMoi: 'DA_THANH_TOAN',
          thoiDiem: new Date(),
          nguonThayDoi: 'SYSTEM',
          taiKhoanId: null,
          lyDo: 'Lần ghi 1',
          laOverride: false,
          maThaoTac: duplicateOp,
        },
      });

      // Lần ghi thứ hai với cùng maThaoTac và phieuDatVeId phải bị từ chối
      await expect(
        prisma.lichSuTrangThaiPhieuDatVe.create({
          data: {
            phieuDatVeId: existingBookingId,
            trangThaiCu: 'DA_THANH_TOAN',
            trangThaiMoi: 'HUY',
            thoiDiem: new Date(),
            nguonThayDoi: 'SYSTEM',
            taiKhoanId: null,
            lyDo: 'Lần ghi 2 trùng maThaoTac',
            laOverride: false,
            maThaoTac: duplicateOp,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      await prisma.lichSuTrangThaiPhieuDatVe.delete({
        where: { lichSuTrangThaiPhieuDatVeId: first.lichSuTrangThaiPhieuDatVeId },
      });
    });

    it('reject duplicate (maThaoTac, veId)', async () => {
      const duplicateOp = randomUUID();

      const first = await prisma.lichSuTrangThaiVe.create({
        data: {
          veId: existingTicketId,
          trangThaiCu: 'DA_DAT',
          trangThaiMoi: 'HUY',
          thoiDiem: new Date(),
          nguonThayDoi: 'SYSTEM',
          taiKhoanId: null,
          lyDo: 'Lần ghi 1',
          laOverride: false,
          maThaoTac: duplicateOp,
        },
      });

      // Lần ghi thứ hai với cùng maThaoTac và veId phải bị từ chối
      await expect(
        prisma.lichSuTrangThaiVe.create({
          data: {
            veId: existingTicketId,
            trangThaiCu: 'HUY',
            trangThaiMoi: 'DA_DAT',
            thoiDiem: new Date(),
            nguonThayDoi: 'SYSTEM',
            taiKhoanId: null,
            lyDo: 'Lần ghi 2 trùng maThaoTac',
            laOverride: false,
            maThaoTac: duplicateOp,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      await prisma.lichSuTrangThaiVe.delete({
        where: { lichSuTrangThaiVeId: first.lichSuTrangThaiVeId },
      });
    });
  });

  describe('4. Foreign Key Restrict enforcement', () => {
    it('không cho phép xóa PhieuDatVe đang có history', async () => {
      const bookingWithHistory = await prisma.phieuDatVe.findFirstOrThrow({
        where: { lichSuTrangThais: { some: {} } },
      });

      await expect(
        prisma.phieuDatVe.delete({
          where: { phieuDatVeId: bookingWithHistory.phieuDatVeId },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('không cho phép xóa Ve đang có history', async () => {
      const ticketWithHistory = await prisma.ve.findFirstOrThrow({
        where: { lichSuTrangThais: { some: {} } },
      });

      await expect(
        prisma.ve.delete({
          where: { veId: ticketWithHistory.veId },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('không cho phép xóa TaiKhoan đang được history tham chiếu', async () => {
      const account = await prisma.taiKhoan.findFirstOrThrow();
      const booking = await prisma.phieuDatVe.findFirstOrThrow();

      // Ghi một history tham chiếu account
      const record = await prisma.lichSuTrangThaiPhieuDatVe.create({
        data: {
          phieuDatVeId: booking.phieuDatVeId,
          trangThaiCu: 'CHO_THANH_TOAN',
          trangThaiMoi: 'DA_HUY',
          thoiDiem: new Date(),
          nguonThayDoi: 'STAFF',
          taiKhoanId: account.taiKhoanId,
          lyDo: 'Audit actor test',
          laOverride: false,
          maThaoTac: randomUUID(),
        },
      });

      // Thử xóa TaiKhoan phải bị FK Restrict chặn
      await expect(
        prisma.taiKhoan.delete({
          where: { taiKhoanId: account.taiKhoanId },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });

      // Dọn dẹp bản ghi test
      await prisma.lichSuTrangThaiPhieuDatVe.delete({
        where: { lichSuTrangThaiPhieuDatVeId: record.lichSuTrangThaiPhieuDatVeId },
      });
    });

    it('reject insert history với phieuDatVeId, veId hoặc taiKhoanId không tồn tại', async () => {
      await expect(
        prisma.lichSuTrangThaiPhieuDatVe.create({
          data: {
            phieuDatVeId: 999999999,
            trangThaiCu: null,
            trangThaiMoi: 'CHO_THANH_TOAN',
            thoiDiem: new Date(),
            nguonThayDoi: 'SYSTEM',
            taiKhoanId: null,
            lyDo: 'Non existent booking',
            laOverride: false,
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });

      await expect(
        prisma.lichSuTrangThaiVe.create({
          data: {
            veId: 999999999,
            trangThaiCu: null,
            trangThaiMoi: 'DA_DAT',
            thoiDiem: new Date(),
            nguonThayDoi: 'SYSTEM',
            taiKhoanId: null,
            lyDo: 'Non existent ticket',
            laOverride: false,
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });

      const booking = await prisma.phieuDatVe.findFirstOrThrow();
      await expect(
        prisma.lichSuTrangThaiPhieuDatVe.create({
          data: {
            phieuDatVeId: booking.phieuDatVeId,
            trangThaiCu: 'CHO_THANH_TOAN',
            trangThaiMoi: 'DA_THANH_TOAN',
            thoiDiem: new Date(),
            nguonThayDoi: 'STAFF',
            taiKhoanId: 999999999,
            lyDo: 'Non existent account',
            laOverride: false,
            maThaoTac: randomUUID(),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });
  });
});
