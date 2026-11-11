import type { Prisma } from '../generated/prisma/client.js';
import { enqueuePushNotice } from './push-outbox.js';

export interface CustomerNotice {
  eventKey: string;
  customerId: number | null;
  email: string | null | undefined;
  bookingId: number;
  ticketId: number;
  title: string;
  content: string;
}

// Must run inside the transaction that commits the corresponding business event.
export async function enqueueCustomerNotice(
  tx: Prisma.TransactionClient,
  notice: CustomerNotice,
) {
  if (notice.customerId !== null) {
    const notification = await tx.thongBao.upsert({
      where: { eventKey: notice.eventKey },
      update: {},
      create: {
        eventKey: notice.eventKey,
        category: 'TRIP',
        bookingId: notice.bookingId,
        ticketId: notice.ticketId,
        tieuDe: notice.title,
        noiDung: notice.content,
        thoiGian: new Date(),
        trangThai: 'DA_GUI',
        nguoiNhans: {
          create: { khachHangId: notice.customerId, daDoc: false },
        },
      },
    });
    await enqueuePushNotice(
      tx,
      notification.thongBaoId,
      notice.customerId,
      notice.eventKey,
      notification.thoiGian,
    );
  }
  const email = notice.email?.trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await tx.emailThongBao.upsert({
      where: { eventKey: notice.eventKey },
      update: {},
      create: {
        eventKey: notice.eventKey,
        nguoiNhan: email,
        tieuDe: notice.title,
        noiDung: `${notice.content}\n\nMở VexGo để xem trạng thái vé mới nhất.`,
      },
    });
  }
}

export async function enqueueRefundConfirmation(
  tx: Prisma.TransactionClient,
  refundId: number,
) {
  const refund = await tx.thanhToan.findUniqueOrThrow({
    where: { thanhToanId: refundId },
    include: {
      ve: { include: { phieuDatVe: { include: { donGiaoDich: true } } } },
    },
  });
  if (
    refund.loaiGiaoDich !== 'HOAN_TIEN' ||
    refund.trangThai !== 'THANH_CONG' ||
    !refund.thoiDiemHoanTat ||
    !refund.ve
  ) {
    throw new Error('Refund notice requires a completed ticket refund');
  }
  const ticket = refund.ve;
  const order = ticket.phieuDatVe.donGiaoDich;
  await enqueueCustomerNotice(tx, {
    eventKey: `refund-succeeded:${refundId}`,
    customerId: order.khachHangId,
    email: order.emailKhachHang,
    bookingId: ticket.phieuDatVeId,
    ticketId: ticket.veId,
    title: 'Hoàn tiền vé thành công',
    content: `Yêu cầu hoàn tiền cho vé ${ticket.maVe} đã được nhà cung cấp xác nhận hoàn tất. Số tiền: ${refund.soTien.toString()} VND. Thời điểm tiền hiển thị trong tài khoản phụ thuộc ngân hàng.`,
  });
}
