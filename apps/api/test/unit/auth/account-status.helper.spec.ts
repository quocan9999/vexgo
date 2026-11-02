import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  assertAccountActive,
  formatDateOnly,
  parseDateOnly,
} from '../../../src/auth/account-status.helper.js';
import { TrangThaiTaiKhoan } from '../../../src/generated/prisma/enums.js';

describe('account-status.helper', () => {
  describe('formatDateOnly and parseDateOnly', () => {
    it('formats UTC date into DD-MM-YYYY', () => {
      const date = new Date(Date.UTC(2026, 10, 15)); // Month index 10 is November
      expect(formatDateOnly(date)).toBe('15-11-2026');
    });

    it('returns null when formatting null or undefined', () => {
      expect(formatDateOnly(null)).toBeNull();
      expect(formatDateOnly(undefined)).toBeNull();
    });

    it('parses valid DD-MM-YYYY into Date UTC', () => {
      const parsed = parseDateOnly('15-11-2026');
      expect(parsed).not.toBeNull();
      expect(parsed?.getUTCDate()).toBe(15);
      expect(parsed?.getUTCMonth()).toBe(10);
      expect(parsed?.getUTCFullYear()).toBe(2026);
    });

    it('returns null for invalid dates or non-calendar dates', () => {
      expect(parseDateOnly('invalid')).toBeNull();
      expect(parseDateOnly('31-02-2026')).toBeNull(); // February 31st does not exist
      expect(parseDateOnly('2026-11-15')).toBeNull(); // Wrong format
    });
  });

  describe('assertAccountActive', () => {
    it('does not throw when account is HOAT_DONG', async () => {
      const mockPrisma = {
        taiKhoan: { update: vi.fn() },
      };
      const account = {
        taiKhoanId: 1,
        trangThai: TrangThaiTaiKhoan.HOAT_DONG,
      };

      await expect(
        assertAccountActive(mockPrisma as any, account),
      ).resolves.toBeUndefined();
      expect(mockPrisma.taiKhoan.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException with ACCOUNT_LOCKED when account is BI_KHOA', async () => {
      const mockPrisma = {
        taiKhoan: { update: vi.fn() },
      };
      const account = {
        taiKhoanId: 1,
        trangThai: TrangThaiTaiKhoan.BI_KHOA,
        lyDoKhoa: 'Vi phạm quy định nghiêm trọng',
      };

      await expect(
        assertAccountActive(mockPrisma as any, account),
      ).rejects.toThrow(ForbiddenException);

      try {
        await assertAccountActive(mockPrisma as any, account);
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          error: 'ACCOUNT_LOCKED',
          message:
            'Tài khoản của bạn đã bị khóa vĩnh viễn. (Lý do: Vi phạm quy định nghiêm trọng) Vui lòng liên hệ nhà xe hoặc tổng đài hỗ trợ.',
        });
      }
    });

    it('throws ForbiddenException with ACCOUNT_SUSPENDED when account is TAM_KHOA and not expired', async () => {
      const mockPrisma = {
        taiKhoan: { update: vi.fn() },
      };
      // Date in future
      const futureDate = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      const account = {
        taiKhoanId: 1,
        trangThai: TrangThaiTaiKhoan.TAM_KHOA,
        khoaDenNgay: futureDate,
        lyDoKhoa: 'Tạm khóa để xác minh thông tin',
      };

      try {
        await assertAccountActive(mockPrisma as any, account);
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const resp = err.getResponse();
        expect(resp.error).toBe('ACCOUNT_SUSPENDED');
        expect(resp.lockedUntil).toBe(formatDateOnly(futureDate));
        expect(resp.message).toContain('Tài khoản của bạn đang bị tạm khóa');
      }
    });

    it('auto-unlocks account when TAM_KHOA expiry date has passed', async () => {
      const mockPrisma = {
        taiKhoan: { update: vi.fn().mockResolvedValue({}) },
      };
      // Date in past
      const pastDate = new Date(Date.now() - 2 * 24 * 3600 * 1000);
      const account = {
        taiKhoanId: 10,
        trangThai: TrangThaiTaiKhoan.TAM_KHOA,
        khoaDenNgay: pastDate,
        lyDoKhoa: 'Tạm khóa quá khứ',
      };

      await expect(
        assertAccountActive(mockPrisma as any, account),
      ).resolves.toBeUndefined();

      expect(mockPrisma.taiKhoan.update).toHaveBeenCalledWith({
        where: { taiKhoanId: 10 },
        data: {
          trangThai: TrangThaiTaiKhoan.HOAT_DONG,
          khoaDenNgay: null,
          lyDoKhoa: null,
        },
      });
      expect(account.trangThai).toBe(TrangThaiTaiKhoan.HOAT_DONG);
      expect(account.khoaDenNgay).toBeNull();
    });
  });
});
