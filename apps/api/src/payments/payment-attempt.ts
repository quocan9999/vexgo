import type { Prisma } from '../generated/prisma/client.js';

export function createSepayPaymentAttempt(
  tx: Prisma.TransactionClient,
  input: {
    donGiaoDichId: number;
    amount: Prisma.Decimal;
    createdAt: Date;
  },
) {
  return tx.thanhToan.create({
    data: {
      soTien: input.amount,
      phuongThuc: 'SEPAY',
      loaiGiaoDich: 'THANH_TOAN',
      thoiGian: input.createdAt,
      trangThai: 'DANG_XU_LY',
      donGiaoDichId: input.donGiaoDichId,
    },
    select: { thanhToanId: true, trangThai: true },
  });
}
