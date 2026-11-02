import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';

export async function enqueuePushNotice(
  tx: Prisma.TransactionClient,
  notificationId: number,
  customerId: number,
  eventKey: string,
  noticeTime: Date,
) {
  const devices = await tx.thietBiThongBao.findMany({
    where: {
      khachHangId: customerId,
      hoatDong: true,
      // ThongBao.thoiGian is DATETIME(0): compare at the same one-second
      // precision, otherwise a device created just before the event is excluded.
      createdAt: {
        lt: new Date(Math.floor(noticeTime.getTime() / 1000) * 1000 + 1000),
      },
    },
  });
  for (const device of devices) {
    const key = createHash('sha256')
      .update(`${eventKey}:${device.thietBiThongBaoId}`)
      .digest('hex');
    await tx.pushThongBao.upsert({
      where: { eventKey: key },
      update: {},
      create: {
        eventKey: key,
        thongBaoId: notificationId,
        khachHangId: customerId,
        thietBiThongBaoId: device.thietBiThongBaoId,
        sessionId: device.sessionId,
        tokenHash: device.tokenHash,
      },
    });
  }
}
