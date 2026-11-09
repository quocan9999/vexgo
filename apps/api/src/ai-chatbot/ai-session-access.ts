import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Thời hạn không hoạt động của phiên chat AI (Rolling TTL: 7 ngày tính từ tin nhắn gần nhất) */
export const SESSION_INACTIVITY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Guest UUIDs are capabilities. An account-owned session additionally requires
 * that account's verified principal, for both reads and writes. Never claim a
 * guest session on login: a holder of its old capability must not see new PII. */
export async function assertAiSessionAccess(
  prisma: PrismaService,
  customerId: number | null,
  accountId?: number,
): Promise<void> {
  if (customerId === null && accountId === undefined) return;
  if (customerId !== null && accountId !== undefined) {
    const customer = await prisma.khachHang.findUnique({
      where: { khachHangId: customerId },
      select: { taiKhoanId: true },
    });
    if (customer?.taiKhoanId === accountId) return;
  }
  throw new ForbiddenException({
    error: 'AI_SESSION_FORBIDDEN',
    message:
      'Bạn không có quyền truy cập phiên hội thoại này. Hãy bắt đầu phiên mới nếu đã đổi tài khoản.',
  });
}
