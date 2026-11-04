import type { Prisma } from '../generated/prisma/client.js';
import { enqueuePushNotice } from './push-outbox.js';

/** Called only after valid settlement and ticket issuance, using the SAME tx. */
export async function enqueuePaymentConfirmation(
  tx: Prisma.TransactionClient,
  bookingId: number,
): Promise<void> {
  const booking = await tx.phieuDatVe.findUniqueOrThrow({
    where: { phieuDatVeId: bookingId },
    include: {
      donGiaoDich: true,
      ves: {
        where: { trangThai: 'DA_THANH_TOAN' },
        orderBy: { veId: 'asc' },
        include: {
          gheChuyenXe: {
            include: { chuyenXe: { include: { tuyenXe: true } } },
          },
        },
      },
    },
  });
  const order = booking.donGiaoDich;
  if (
    booking.trangThai !== 'DA_THANH_TOAN' ||
    order.trangThai !== 'DA_THANH_TOAN' ||
    !booking.ves.length
  ) {
    throw new Error(
      'Payment notification requires settled booking and issued tickets',
    );
  }
  const eventKey = `booking-paid:${bookingId}`;
  const trip = booking.ves[0].gheChuyenXe.chuyenXe;
  const route = `${trip.tuyenXe.diemDi} → ${trip.tuyenXe.diemDen}`;
  // Time fields are business wall-clock values in the current trip contract.
  const departure = `${trip.ngayKhoiHanh.toISOString().slice(0, 10)} ${trip.gioKhoiHanh.toISOString().slice(11, 16)} (giờ Việt Nam)`;
  const title = 'Thanh toán vé thành công';
  const content = `Đơn ${booking.maPhieuDatVe} đã thanh toán. ${route}. Khởi hành: ${departure}. Vé: ${booking.ves.map((t) => t.maVe).join(', ')}. Tổng đơn: ${Number(order.tongTien).toLocaleString('vi-VN')}đ.`;
  if (order.khachHangId !== null) {
    const notification = await tx.thongBao.upsert({
      where: { eventKey },
      update: {},
      create: {
        eventKey,
        category: 'TRIP',
        bookingId,
        ticketId: booking.ves[0].veId,
        tieuDe: title,
        noiDung: content,
        thoiGian: new Date(),
        trangThai: 'DA_GUI',
        nguoiNhans: {
          create: { khachHangId: order.khachHangId, daDoc: false },
        },
      },
    });
    await enqueuePushNotice(
      tx,
      notification.thongBaoId,
      order.khachHangId,
      eventKey,
      notification.thoiGian,
    );
  }
  const email = order.emailKhachHang?.trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await tx.emailThongBao.upsert({
      where: { eventKey },
      update: {},
      create: {
        eventKey,
        nguoiNhan: email,
        tieuDe: title,
        noiDung: `${content}\n\nMở Vé của tôi trong VexGo để xem tất cả vé và QR lên xe. Email này không thay thế QR lên xe.`,
      },
    });
  }
}
