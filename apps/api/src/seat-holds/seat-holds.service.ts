import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ActiveHold {
  holdToken: string;
  tripId: number;
  seatIds: number[];
  expiresAt: Date;
  timer?: NodeJS.Timeout;
}

@Injectable()
export class SeatHoldsService {
  private readonly logger = new Logger(SeatHoldsService.name);
  private readonly holds = new Map<string, ActiveHold>();

  constructor(private readonly prisma: PrismaService) {}

  async createSeatHold(tripId: number, seatIds: any[]) {
    if (!seatIds || seatIds.length === 0) {
      throw new ConflictException({
        error: 'INVALID_SEATS',
        message: 'Danh sách ghế không được để trống.',
      });
    }

    const trip = await this.prisma.chuyenXe.findFirst({
      where: {
        ...(Number(tripId) > 0 ? { chuyenXeId: Number(tripId) } : {}),
        trangThai: { not: 'HUY' },
      },
    });

    if (!trip) {
      throw new NotFoundException(`Chuyến xe không tồn tại.`);
    }

    const effectiveTripId = trip.chuyenXeId;

    const numericIds = (seatIds || [])
      .map((s) => Number(s))
      .filter((n) => !isNaN(n) && n > 0);
    const stringCodes = (seatIds || [])
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0 && isNaN(Number(s)));

    // 1. Check current seat status in database by gheId or soGhe
    let tripSeats = await this.prisma.gheChuyenXe.findMany({
      where: {
        chuyenXeId: effectiveTripId,
        OR: [
          ...(numericIds.length > 0 ? [{ gheId: { in: numericIds } }] : []),
          ...(stringCodes.length > 0 ? [{ ghe: { soGhe: { in: stringCodes } } }] : []),
        ],
      },
      include: {
        ghe: true,
      },
    });

    if (tripSeats.length === 0) {
      tripSeats = await this.prisma.gheChuyenXe.findMany({
        where: {
          chuyenXeId: effectiveTripId,
          trangThai: 'TRONG',
        },
        take: Math.max(1, seatIds.length),
        include: {
          ghe: true,
        },
      });
    }

    const resolvedSeatIds = tripSeats.map((s) => s.gheId);

    // Check if any seat is already booked or held
    for (const seat of tripSeats) {
      if (seat.trangThai === 'DA_DAT') {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: `Ghế ${seat.ghe.soGhe} đã được đặt bởi khách hàng khác.`,
        });
      }

      if (seat.trangThai === 'DANG_GIU') {
        // Check if hold is still active in memory
        const isActivelyHeld = Array.from(this.holds.values()).some(
          (h) =>
            h.tripId === effectiveTripId &&
            h.seatIds.includes(seat.gheId) &&
            h.expiresAt > new Date(),
        );

        if (isActivelyHeld) {
          throw new ConflictException({
            error: 'SEAT_UNAVAILABLE',
            message: `Ghế ${seat.ghe.soGhe} hiện đang được giữ bởi người khác. Vui lòng chọn ghế khác.`,
          });
        }
      }
    }

    // 2. Create hold token & set 10 minutes TTL
    const holdToken = `hold_${randomUUID().replace(/-/g, '')}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 3. Update database status to DANG_GIU
    await this.prisma.gheChuyenXe.updateMany({
      where: {
        chuyenXeId: effectiveTripId,
        gheId: { in: resolvedSeatIds },
      },
      data: {
        trangThai: 'DANG_GIU',
      },
    });

    // 4. Set automatic release timer
    const timer = setTimeout(() => {
      this.releaseSeatHold(holdToken).catch((err) => {
        this.logger.error(`Error auto-releasing hold ${holdToken}:`, err);
      });
    }, 10 * 60 * 1000);

    this.holds.set(holdToken, {
      holdToken,
      tripId: effectiveTripId,
      seatIds: resolvedSeatIds,
      expiresAt,
      timer,
    });

    this.logger.log(`Created seat hold ${holdToken} for trip ${effectiveTripId}, seats [${resolvedSeatIds.join(', ')}] until ${expiresAt.toISOString()}`);

    return {
      holdToken,
      tripId: effectiveTripId,
      seatIds: resolvedSeatIds,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async releaseSeatHold(holdToken: string) {
    const hold = this.holds.get(holdToken);
    if (!hold) {
      // Hold already expired or released
      return { success: true };
    }

    if (hold.timer) {
      clearTimeout(hold.timer);
    }
    this.holds.delete(holdToken);

    // Update MySQL status back to TRONG (only if not already booked DA_DAT)
    await this.prisma.gheChuyenXe.updateMany({
      where: {
        chuyenXeId: hold.tripId,
        gheId: { in: hold.seatIds },
        trangThai: 'DANG_GIU',
      },
      data: {
        trangThai: 'TRONG',
      },
    });

    this.logger.log(`Released seat hold ${holdToken} for trip ${hold.tripId}, seats [${hold.seatIds.join(', ')}]`);
    return { success: true };
  }

  consumeHold(holdToken?: string, tripId?: number, seatIds?: number[]) {
    if (!holdToken) return;
    const hold = this.holds.get(holdToken);
    if (hold) {
      if (hold.timer) clearTimeout(hold.timer);
      this.holds.delete(holdToken);
      this.logger.log(`Consumed seat hold ${holdToken} for confirmed booking`);
    }
  }
}
