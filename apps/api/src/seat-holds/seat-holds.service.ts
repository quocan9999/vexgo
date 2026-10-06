import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  combineDeparture,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';

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
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config?: ConfigService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config?.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async createSeatHold(tripId: number, seatIds: number[]) {
    const validTripId = Number(tripId);
    if (!validTripId || isNaN(validTripId) || validTripId <= 0) {
      throw new NotFoundException('Mã chuyến xe không hợp lệ.');
    }

    const numericIds = (seatIds || [])
      .map((s) => Number(s))
      .filter((n) => !isNaN(n) && n > 0);

    if (numericIds.length === 0) {
      throw new ConflictException({
        error: 'INVALID_SEATS',
        message: 'Danh sách ghế không được để trống.',
      });
    }

    // 1. Kiểm tra chuyến xe tồn tại, trạng thái CHUA_KHOI_HANH và thời gian chưa qua
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: validTripId },
    });

    if (!trip) {
      throw new NotFoundException('Chuyến xe không tồn tại.');
    }

    if (trip.trangThai !== 'CHUA_KHOI_HANH') {
      throw new ConflictException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe không còn mở bán hoặc không ở trạng thái sẵn sàng.',
      });
    }

    const departureDateTime = combineDeparture(
      trip.ngayKhoiHanh,
      trip.gioKhoiHanh,
      this.businessTimeZone,
    );
    if (departureDateTime <= new Date()) {
      throw new ConflictException({
        error: 'TRIP_DEPARTED',
        message: 'Chuyến xe đã khởi hành hoặc đã qua giờ xuất bến.',
      });
    }

    // 2. Tìm chính xác các ghế thuộc chuyến xe (KHÔNG fallback, KHÔNG silent substitution)
    const tripSeats = await this.prisma.gheChuyenXe.findMany({
      where: {
        chuyenXeId: validTripId,
        gheId: { in: numericIds },
      },
      include: {
        ghe: true,
      },
    });

    if (tripSeats.length !== numericIds.length) {
      throw new ConflictException({
        error: 'SEATS_NOT_FOUND',
        message: 'Một hoặc nhiều ghế được chọn không tồn tại trên chuyến xe này.',
      });
    }

    // 3. Khắc phục Race condition: Thực hiện so sánh và cập nhật nguyên tử (Compare-and-Set) trong transaction
    const resolvedSeatIds = numericIds;
    await this.prisma.$transaction(async (tx) => {
      // Kiểm tra xem có ghế nào không ở trạng thái TRONG
      const occupiedSeat = await tx.gheChuyenXe.findFirst({
        where: {
          chuyenXeId: validTripId,
          gheId: { in: resolvedSeatIds },
          trangThai: { not: 'TRONG' },
        },
        include: { ghe: true },
      });

      if (occupiedSeat) {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: `Ghế ${occupiedSeat.ghe.soGhe} hiện không còn trống (đã được đặt hoặc đang giữ).`,
        });
      }

      const updateResult = await tx.gheChuyenXe.updateMany({
        where: {
          chuyenXeId: validTripId,
          gheId: { in: resolvedSeatIds },
          trangThai: 'TRONG',
        },
        data: {
          trangThai: 'DANG_GIU',
        },
      });

      if (updateResult.count !== resolvedSeatIds.length) {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: 'Một hoặc nhiều ghế đã được giữ bởi người khác.',
        });
      }
    });

    // 4. Tạo hold token & thiết lập TTL 10 phút
    const holdToken = `hold_${randomUUID().replace(/-/g, '')}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    const timer = setTimeout(() => {
      this.releaseSeatHold(holdToken).catch((err) => {
        this.logger.error(`Error auto-releasing hold ${holdToken}:`, err);
      });
    }, 10 * 60 * 1000);

    this.holds.set(holdToken, {
      holdToken,
      tripId: validTripId,
      seatIds: resolvedSeatIds,
      expiresAt,
      timer,
    });

    this.logger.log(
      `Created seat hold ${holdToken} for trip ${validTripId}, seats [${resolvedSeatIds.join(', ')}] until ${expiresAt.toISOString()}`,
    );

    return {
      holdToken,
      tripId: validTripId,
      seatIds: resolvedSeatIds,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async releaseSeatHold(holdToken: string) {
    const hold = this.holds.get(holdToken);
    if (!hold) {
      return { success: true };
    }

    if (hold.timer) {
      clearTimeout(hold.timer);
    }
    this.holds.delete(holdToken);

    // Cập nhật trạng thái MySQL về TRONG (chỉ khi vẫn là DANG_GIU, không đè DA_DAT)
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

    this.logger.log(
      `Released seat hold ${holdToken} for trip ${hold.tripId}, seats [${hold.seatIds.join(', ')}]`,
    );
    return { success: true };
  }

  verifyHold(holdToken: string, tripId: number, seatIds: number[]): void {
    if (!holdToken) {
      throw new ConflictException({
        error: 'HOLD_REQUIRED',
        message: 'Yêu cầu mã giữ chỗ (holdToken) hợp lệ để thực hiện đặt vé.',
      });
    }

    const hold = this.holds.get(holdToken);
    if (!hold) {
      throw new ConflictException({
        error: 'HOLD_EXPIRED',
        message: 'Mã giữ chỗ không tồn tại hoặc đã hết hạn. Vui lòng chọn ghế lại.',
      });
    }

    if (hold.tripId !== tripId) {
      throw new ConflictException({
        error: 'HOLD_MISMATCH',
        message: 'Mã giữ chỗ không khớp với chuyến xe được chọn.',
      });
    }

    const holdSet = new Set(hold.seatIds);
    const isMatch =
      seatIds.length === hold.seatIds.length &&
      seatIds.every((id) => holdSet.has(id));
    if (!isMatch) {
      throw new ConflictException({
        error: 'HOLD_SEATS_MISMATCH',
        message: 'Danh sách ghế không khớp với mã giữ chỗ.',
      });
    }

    if (hold.expiresAt <= new Date()) {
      throw new ConflictException({
        error: 'HOLD_EXPIRED',
        message: 'Mã giữ chỗ đã hết hạn. Vui lòng chọn ghế lại.',
      });
    }
  }

  consumeHold(holdToken?: string, _tripId?: number, _seatIds?: number[]) {
    if (!holdToken) return;
    const hold = this.holds.get(holdToken);
    if (hold) {
      if (hold.timer) clearTimeout(hold.timer);
      this.holds.delete(holdToken);
      this.logger.log(`Consumed seat hold ${holdToken} for confirmed booking`);
    }
  }
}
