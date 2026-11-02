import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { TrangThaiTaiKhoan } from '../generated/prisma/enums.js';

export function formatDateOnly(date: Date | null | undefined): string | null {
  if (!date) return null;
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}-${m}-${y}`;
}

export function parseDateOnly(val: string): Date | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(val);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export type AccountStatusSubject = {
  taiKhoanId: number;
  trangThai: TrangThaiTaiKhoan;
  khoaDenNgay?: Date | null;
  lyDoKhoa?: string | null;
};

/**
 * Kiểm tra trạng thái tài khoản.
 * Nếu tài khoản đang là TAM_KHOA nhưng ngày hiện tại đã vượt quá khoaDenNgay,
 * tự động cập nhật trạng thái về HOAT_DONG trong database (auto-unlock).
 * Nếu đang bị khóa/tạm khóa, ném ForbiddenException tương ứng.
 */
export async function assertAccountActive(
  prisma: {
    taiKhoan: {
      update: (args: Prisma.TaiKhoanUpdateArgs) => Promise<unknown>;
    };
  },
  account: AccountStatusSubject,
): Promise<void> {
  if (account.trangThai === TrangThaiTaiKhoan.TAM_KHOA) {
    if (account.khoaDenNgay) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const expiry = new Date(account.khoaDenNgay);
      expiry.setUTCHours(0, 0, 0, 0);

      if (today > expiry) {
        // Đã hết hạn tạm khóa -> tự động mở khóa
        await prisma.taiKhoan.update({
          where: { taiKhoanId: account.taiKhoanId },
          data: {
            trangThai: TrangThaiTaiKhoan.HOAT_DONG,
            khoaDenNgay: null,
            lyDoKhoa: null,
          },
        });
        account.trangThai = TrangThaiTaiKhoan.HOAT_DONG;
        account.khoaDenNgay = null;
        account.lyDoKhoa = null;
        return;
      }
    }

    const formattedDate = formatDateOnly(account.khoaDenNgay);
    const dateMessage = formattedDate ? ` đến ngày ${formattedDate}` : '';
    const reasonMessage = account.lyDoKhoa ? ` (Lý do: ${account.lyDoKhoa})` : '';
    throw new ForbiddenException({
      error: 'ACCOUNT_SUSPENDED',
      message: `Tài khoản của bạn đang bị tạm khóa${dateMessage}.${reasonMessage} Vui lòng liên hệ nhà xe hoặc tổng đài hỗ trợ.`,
      lockedUntil: formattedDate,
    });
  }

  if (account.trangThai === TrangThaiTaiKhoan.BI_KHOA) {
    const reasonMessage = account.lyDoKhoa ? ` (Lý do: ${account.lyDoKhoa})` : '';
    throw new ForbiddenException({
      error: 'ACCOUNT_LOCKED',
      message: `Tài khoản của bạn đã bị khóa vĩnh viễn.${reasonMessage} Vui lòng liên hệ nhà xe hoặc tổng đài hỗ trợ.`,
    });
  }

  if (account.trangThai !== TrangThaiTaiKhoan.HOAT_DONG) {
    throw new ForbiddenException({
      error: 'ACCOUNT_INACTIVE',
      message: 'Tài khoản không hoạt động. Vui lòng liên hệ hỗ trợ.',
    });
  }
}
