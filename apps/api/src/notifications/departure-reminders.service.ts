import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  combineDeparture,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { enqueueCustomerNotice } from './customer-notice.js';

type ReminderTicket = Prisma.VeGetPayload<{
  include: {
    gheChuyenXe: { include: { chuyenXe: true } };
    phieuDatVe: { include: { donGiaoDich: true } };
  };
}>;
export function ticketPickupTime(
  ticket: ReminderTicket,
  timeZone: string,
): Date {
  const trip = ticket.gheChuyenXe.chuyenXe;
  const snapshot = ticket.diemDonSnapshot as { phutLech?: unknown } | null;
  const offset =
    typeof snapshot?.phutLech === 'number' && Number.isFinite(snapshot.phutLech)
      ? snapshot.phutLech
      : 0;
  return new Date(
    combineDeparture(trip.ngayKhoiHanh, trip.gioKhoiHanh, timeZone).getTime() +
      offset * 60000,
  );
}
const reminderInclude = {
  gheChuyenXe: { include: { chuyenXe: true } },
  phieuDatVe: { include: { donGiaoDich: true } },
} as const;

export async function reminderStillValid(
  db: Prisma.TransactionClient,
  eventKey: string,
  now = new Date(),
  timeZone = 'Asia/Ho_Chi_Minh',
) {
  if (!eventKey.startsWith('departure-reminder:')) return true;
  const [, id, expectedTime] = eventKey.split(':');
  const ticket = await db.ve.findUnique({
    where: { veId: Number(id) },
    include: reminderInclude,
  });
  return (
    !!ticket &&
    ticket.trangThai === 'DA_THANH_TOAN' &&
    ['CHUA_KHOI_HANH', 'DANG_CHAY'].includes(
      ticket.gheChuyenXe.chuyenXe.trangThai,
    ) &&
    ticket.phieuDatVe.trangThai === 'DA_THANH_TOAN' &&
    ticket.phieuDatVe.donGiaoDich.trangThai === 'DA_THANH_TOAN' &&
    ticketPickupTime(ticket, timeZone).getTime() === Number(expectedTime) &&
    Number(expectedTime) > now.getTime()
  );
}

@Injectable()
export class DepartureRemindersService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private cursor = 0;
  private readonly timeZone: string;
  private readonly logger = new Logger(DepartureRemindersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.timeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }
  onModuleInit() {
    if (this.config.get<string>('NOTIFICATION_REMINDERS_ENABLED') !== 'true')
      return;
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.error('Departure reminder scan failed'),
      );
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      // Bounded rotating scan: does not starve later tickets on a busy tenant.
      const tickets = await this.prisma.ve.findMany({
        where: {
          veId: { gt: this.cursor },
          trangThai: 'DA_THANH_TOAN',
          gheChuyenXe: {
            chuyenXe: { trangThai: { in: ['CHUA_KHOI_HANH', 'DANG_CHAY'] } },
          },
        },
        include: reminderInclude,
        orderBy: { veId: 'asc' },
        take: 100,
      });
      this.cursor =
        tickets.length === 100 ? tickets[tickets.length - 1].veId : 0;
      for (const candidate of tickets) {
        const departure = ticketPickupTime(candidate, this.timeZone);
        if (
          departure.getTime() <= now.getTime() ||
          departure.getTime() > now.getTime() + 2 * 3600000
        )
          continue;
        await this.prisma.$transaction(
          async (tx) => {
            const eventKey = `departure-reminder:${candidate.veId}:${departure.getTime()}`;
            if (!(await reminderStillValid(tx, eventKey, now, this.timeZone)))
              return;
            const order = candidate.phieuDatVe.donGiaoDich;
            const localTime = new Intl.DateTimeFormat('vi-VN', {
              timeZone: this.timeZone,
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(departure);
            await enqueueCustomerNotice(tx, {
              eventKey,
              customerId: order.khachHangId,
              email: order.emailKhachHang,
              bookingId: candidate.phieuDatVeId,
              ticketId: candidate.veId,
              title: 'Sắp đến giờ đón',
              content: `Vé ${candidate.maVe}: giờ đón dự kiến ${localTime} (giờ Việt Nam). Điểm đón: ${candidate.diemDon || 'Xem chi tiết vé'}. Vui lòng kiểm tra vé và có mặt đúng giờ nhà xe yêu cầu.`,
            });
          },
          { isolationLevel: 'Serializable' },
        );
      }
    } finally {
      this.running = false;
    }
  }
}
