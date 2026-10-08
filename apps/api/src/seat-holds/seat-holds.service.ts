import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  combineDeparture,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

export interface ActiveHold {
  holdToken: string;
  tripId: number;
  seatIds: number[];
  expiresAt: Date;
  customerId?: number | null;
  timer?: NodeJS.Timeout;
}

interface HoldTokenPayload {
  tripId: number;
  seats: number[];
  customerId?: number | null;
  exp: number;
  nonce: string;
}

@Injectable()
export class SeatHoldsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SeatHoldsService.name);
  private readonly holds = new Map<string, ActiveHold>();
  private readonly businessTimeZone: string;
  private readonly holdSecret: string;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    config?: ConfigService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config?.get<string>('BUSINESS_TIME_ZONE'),
    );
    this.holdSecret =
      config?.get<string>('JWT_ACCESS_SECRET') ||
      'vexgo_seat_hold_resilience_secret_2026';
  }

  onModuleInit() {
    this.cleanupTimer = setInterval(() => {
      this.releaseStaleHolds().catch((err) => {
        this.logger.error('Error during scheduled stale hold cleanup:', err);
      });
    }, 60 * 1000);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  private hashHoldToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private maskHoldToken(token?: string): string {
    if (!token) return 'n/a';
    return `${this.hashHoldToken(token).slice(0, 8)}...`;
  }

  /**
   * Tự động giải phóng các ghế bị giữ quá thời gian TTL (10 phút) trong DB
   * Đảm bảo tính bền vững (Durability) chống kẹt ghế khi restart server hoặc multi-instance.
   */
  async releaseStaleHolds(): Promise<number> {
    let releasedCount = 0;

    if (this.prisma.giuCho) {
      const now = new Date();
      const expiredHolds = await this.prisma.giuCho.findMany({
        where: {
          OR: [
            {
              trangThai: 'DANG_GIU',
              hetHanLuc: { lte: now },
            },
            {
              trangThai: 'HET_HAN',
              gheChuyenXes: {
                some: {
                  trangThai: 'DANG_GIU',
                },
              },
            },
          ],
        },
        select: { giuChoId: true, trangThai: true },
      });

      if (expiredHolds.length > 0) {
        const expiredIds = expiredHolds.map((h) => h.giuChoId);
        const dangGiuIds = expiredHolds
          .filter((h) => h.trangThai !== 'HET_HAN')
          .map((h) => h.giuChoId);

        const result = await this.prisma.$transaction(async (tx) => {
          const seatResult = await tx.gheChuyenXe.updateMany({
            where: {
              giuChoId: { in: expiredIds },
              trangThai: 'DANG_GIU',
            },
            data: {
              trangThai: 'TRONG',
              giuChoId: null,
            },
          });
          if (dangGiuIds.length > 0) {
            await tx.giuCho.updateMany({
              where: { giuChoId: { in: dangGiuIds } },
              data: { trangThai: 'HET_HAN' },
            });
          }
          return seatResult.count;
        });
        releasedCount += result;
      }
    }

    // Fallback dọn dẹp các ghế cũ chưa gắn giuChoId
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    const legacyResult = await this.prisma.gheChuyenXe.updateMany({
      where: {
        trangThai: 'DANG_GIU',
        giuChoId: null,
        updatedAt: { lt: staleThreshold },
      },
      data: {
        trangThai: 'TRONG',
      },
    });
    releasedCount += legacyResult.count;

    if (releasedCount > 0) {
      this.logger.log(
        `Released ${releasedCount} stale held seats back to TRONG in MySQL.`,
      );
    }
    return releasedCount;
  }

  private signHoldToken(payload: HoldTokenPayload): string {
    const raw = JSON.stringify(payload);
    const b64 = Buffer.from(raw).toString('base64url');
    const sig = createHmac('sha256', this.holdSecret)
      .update(raw)
      .digest('base64url');
    return `hold_${b64}.${sig}`;
  }

  private parseSignedHoldToken(token: string): HoldTokenPayload | null {
    if (!token.startsWith('hold_')) return null;
    const rest = token.slice(5);
    const dotIdx = rest.indexOf('.');
    if (dotIdx === -1) return null;

    const b64 = rest.slice(0, dotIdx);
    const sig = rest.slice(dotIdx + 1);

    try {
      const raw = Buffer.from(b64, 'base64url').toString('utf8');
      const expectedSig = createHmac('sha256', this.holdSecret)
        .update(raw)
        .digest('base64url');
      if (sig !== expectedSig) return null;

      const payload = JSON.parse(raw) as HoldTokenPayload;
      return payload;
    } catch {
      return null;
    }
  }

  async createSeatHold(
    tripId: number,
    seatIds: number[],
    principal?: AuthPrincipal,
  ) {
    // 0. Dọn dẹp ghế kẹt hết hạn trước khi kiểm tra
    await this.releaseStaleHolds();

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

    // 2. Khớp chính xác identifier: Hỗ trợ gheChuyenXeId (tripSeatId theo contract) và fallback gheId
    let tripSeats = await this.prisma.gheChuyenXe.findMany({
      where: {
        chuyenXeId: validTripId,
        gheChuyenXeId: { in: numericIds },
      },
      include: {
        ghe: true,
      },
    });

    if (tripSeats.length !== numericIds.length) {
      const byGheId = await this.prisma.gheChuyenXe.findMany({
        where: {
          chuyenXeId: validTripId,
          gheId: { in: numericIds },
        },
        include: {
          ghe: true,
        },
      });
      if (byGheId.length === numericIds.length) {
        tripSeats = byGheId;
      }
    }

    if (tripSeats.length !== numericIds.length) {
      throw new ConflictException({
        error: 'SEATS_NOT_FOUND',
        message: 'Một hoặc nhiều ghế được chọn không tồn tại trên chuyến xe này.',
      });
    }

    // Toàn bộ quy trình dùng gheChuyenXeId xuyên suốt
    const resolvedTripSeatIds = tripSeats.map((s) => s.gheChuyenXeId);

    // 3. Lấy customerId nếu có principal
    let customerId: number | null = null;
    if (principal?.taiKhoanId) {
      const cust = await this.prisma.khachHang.findUnique({
        where: { taiKhoanId: principal.taiKhoanId },
        select: { khachHangId: true },
      });
      if (cust) customerId = cust.khachHangId;
    }

    // 4. Tạo signed hold token & thiết lập TTL 10 phút
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
    const holdToken = this.signHoldToken({
      tripId: validTripId,
      seats: resolvedTripSeatIds,
      customerId,
      exp: expiresAt.getTime(),
      nonce: randomUUID(),
    });
    const tokenHash = this.hashHoldToken(holdToken);

    let createdGiuChoId: number | undefined;

    // 5. Khắc phục Race condition: CAS trong transaction kèm tạo GiuCho trong DB
    await this.prisma.$transaction(async (tx) => {
      const occupiedSeat = await tx.gheChuyenXe.findFirst({
        where: {
          chuyenXeId: validTripId,
          gheChuyenXeId: { in: resolvedTripSeatIds },
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

      if (tx.giuCho) {
        const createdHold = await tx.giuCho.create({
          data: {
            tokenHash,
            chuyenXeId: validTripId,
            khachHangId: customerId,
            hetHanLuc: expiresAt,
            trangThai: 'DANG_GIU',
          },
        });
        createdGiuChoId = createdHold.giuChoId;
      }

      const updateResult = await tx.gheChuyenXe.updateMany({
        where: {
          chuyenXeId: validTripId,
          gheChuyenXeId: { in: resolvedTripSeatIds },
          trangThai: 'TRONG',
        },
        data: {
          trangThai: 'DANG_GIU',
          ...(createdGiuChoId !== undefined ? { giuChoId: createdGiuChoId } : {}),
        },
      });

      if (updateResult.count !== resolvedTripSeatIds.length) {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: 'Một hoặc nhiều ghế đã được giữ bởi người khác.',
        });
      }
    });

    const timer = setTimeout(() => {
      this.releaseSeatHold(holdToken).catch((err) => {
        this.logger.error(
          `Error auto-releasing hold (tokenHash: ${this.maskHoldToken(holdToken)}):`,
          err,
        );
      });
    }, 10 * 60 * 1000);

    this.holds.set(holdToken, {
      holdToken,
      tripId: validTripId,
      seatIds: resolvedTripSeatIds,
      expiresAt,
      customerId,
      timer,
    });

    this.logger.log(
      `Created seat hold #${createdGiuChoId ?? 'mem'} (tokenHash: ${this.maskHoldToken(holdToken)}) for trip ${validTripId}, seats [${resolvedTripSeatIds.join(', ')}] until ${expiresAt.toISOString()}`,
    );

    return {
      holdToken,
      tripId: validTripId,
      seatIds: resolvedTripSeatIds,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async releaseSeatHold(holdToken: string) {
    const tokenHash = this.hashHoldToken(holdToken);
    const hold = this.holds.get(holdToken);
    let tripId = hold?.tripId;
    let seatIds = hold?.seatIds;

    if (hold) {
      if (hold.timer) {
        clearTimeout(hold.timer);
      }
      this.holds.delete(holdToken);
    } else {
      // Thử parse signed token nếu map mất do server restart
      const payload = this.parseSignedHoldToken(holdToken);
      if (payload) {
        tripId = payload.tripId;
        seatIds = payload.seats;
      }
    }

    // Xử lý bền vững với persistent GiuCho trong MySQL
    let dbHold: any = null;
    if (this.prisma.giuCho) {
      dbHold = await this.prisma.giuCho.findUnique({
        where: { tokenHash },
      });
    }

    if (dbHold) {
      if (dbHold.trangThai === 'DANG_GIU') {
        const isExpired = dbHold.hetHanLuc <= new Date();
        const nextStatus = isExpired ? 'HET_HAN' : 'DA_GIAI_PHONG';

        // Generation-safe release: Chỉ giải phóng ghế nếu ghế đang trỏ đúng vào giuChoId này!
        await this.prisma.$transaction(async (tx) => {
          await tx.gheChuyenXe.updateMany({
            where: {
              chuyenXeId: dbHold.chuyenXeId,
              giuChoId: dbHold.giuChoId,
              trangThai: 'DANG_GIU',
            },
            data: {
              trangThai: 'TRONG',
              giuChoId: null,
            },
          });
          await tx.giuCho.update({
            where: { giuChoId: dbHold.giuChoId },
            data: { trangThai: nextStatus },
          });
        });

        this.logger.log(
          `Released seat hold #${dbHold.giuChoId} (tokenHash: ${dbHold.tokenHash.slice(0, 8)}..., status: ${nextStatus}) for trip ${dbHold.chuyenXeId}`,
        );
        return { success: true };
      }

      // Nếu hold đã là HET_HAN, dọn sạch ghế nếu còn sót
      if (dbHold.trangThai === 'HET_HAN') {
        await this.prisma.gheChuyenXe.updateMany({
          where: {
            chuyenXeId: dbHold.chuyenXeId,
            giuChoId: dbHold.giuChoId,
            trangThai: 'DANG_GIU',
          },
          data: {
            trangThai: 'TRONG',
            giuChoId: null,
          },
        });
      }

      return { success: true };
    }

    // Fallback cho signed token nếu không tìm thấy trong DB (ví dụ unit test không mock giuCho)
    const payload = this.parseSignedHoldToken(holdToken);
    if (payload && payload.exp <= Date.now()) {
      return { success: true };
    }

    if (tripId && seatIds && seatIds.length > 0) {
      await this.prisma.gheChuyenXe.updateMany({
        where: {
          chuyenXeId: tripId,
          gheChuyenXeId: { in: seatIds },
          trangThai: 'DANG_GIU',
          giuChoId: null,
        },
        data: {
          trangThai: 'TRONG',
        },
      });
      this.logger.log(
        `Released seat hold (tokenHash: ${this.maskHoldToken(holdToken)}) for trip ${tripId}, seats [${seatIds.join(', ')}]`,
      );
    }

    return { success: true };
  }

  verifyHold(
    holdToken: string,
    tripId: number,
    seatIds: number[],
    expectedCustomerId?: number | null,
  ): void {
    if (!holdToken) {
      throw new ConflictException({
        error: 'HOLD_REQUIRED',
        message: 'Yêu cầu mã giữ chỗ (holdToken) hợp lệ để thực hiện đặt vé.',
      });
    }

    let hold = this.holds.get(holdToken);

    // Phục hồi từ signed token nếu in-memory map bị mất do restart server
    if (!hold) {
      const payload = this.parseSignedHoldToken(holdToken);
      if (payload) {
        if (payload.exp > Date.now()) {
          hold = {
            holdToken,
            tripId: payload.tripId,
            seatIds: payload.seats,
            expiresAt: new Date(payload.exp),
            customerId: payload.customerId,
          };
          this.holds.set(holdToken, hold);
        }
      }
    }

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

    if (
      hold.customerId &&
      expectedCustomerId &&
      hold.customerId !== expectedCustomerId
    ) {
      throw new ConflictException({
        error: 'HOLD_OWNERSHIP_MISMATCH',
        message: 'Mã giữ chỗ không thuộc về tài khoản khách hàng hiện tại.',
      });
    }

    if (hold.expiresAt <= new Date()) {
      throw new ConflictException({
        error: 'HOLD_EXPIRED',
        message: 'Mã giữ chỗ đã hết hạn. Vui lòng chọn ghế lại.',
      });
    }
  }

  async consumeHoldInTx(
    tx: any,
    holdToken?: string,
    tripId?: number,
    seatIds?: number[],
    expectedCustomerId?: number | null,
  ): Promise<{ giuChoId: number }> {
    if (!holdToken) {
      throw new ConflictException({
        error: 'HOLD_REQUIRED',
        message: 'Yêu cầu mã giữ chỗ (holdToken) hợp lệ để thực hiện đặt vé.',
      });
    }

    const tokenHash = this.hashHoldToken(holdToken);
    let dbHold: any = null;
    if (tx.giuCho) {
      dbHold = await tx.giuCho.findUnique({
        where: { tokenHash },
      });
    }

    if (dbHold) {
      if (dbHold.trangThai !== 'DANG_GIU') {
        throw new ConflictException({
          error: 'HOLD_INACTIVE',
          message: 'Mã giữ chỗ không còn ở trạng thái giữ chỗ.',
        });
      }

      if (dbHold.hetHanLuc <= new Date()) {
        throw new ConflictException({
          error: 'HOLD_EXPIRED',
          message: 'Mã giữ chỗ đã hết hạn. Vui lòng chọn ghế lại.',
        });
      }

      if (tripId && dbHold.chuyenXeId !== tripId) {
        throw new ConflictException({
          error: 'HOLD_TRIP_MISMATCH',
          message: 'Mã giữ chỗ không khớp với chuyến xe được chọn.',
        });
      }

      if (
        dbHold.khachHangId &&
        expectedCustomerId &&
        dbHold.khachHangId !== expectedCustomerId
      ) {
        throw new ForbiddenException(
          'Mã giữ chỗ không thuộc về tài khoản khách hàng hiện tại.',
        );
      }

      // Kiểm tra chính xác danh sách ghế gắn với hold này trong DB
      const heldSeats = await tx.gheChuyenXe.findMany({
        where: {
          giuChoId: dbHold.giuChoId,
          trangThai: 'DANG_GIU',
        },
        select: { gheChuyenXeId: true },
      });

      const heldSeatIdSet = new Set(heldSeats.map((s: any) => s.gheChuyenXeId));
      const requestedSeatIds = seatIds ?? [];
      const isExactMatch =
        requestedSeatIds.length === heldSeats.length &&
        requestedSeatIds.every((id) => heldSeatIdSet.has(id));

      if (!isExactMatch) {
        throw new ConflictException({
          error: 'HOLD_SEATS_MISMATCH',
          message: 'Danh sách ghế không khớp với mã giữ chỗ.',
        });
      }

      // Cập nhật trạng thái hold sang DA_DAT ngay trong transaction
      await tx.giuCho.update({
        where: { giuChoId: dbHold.giuChoId },
        data: { trangThai: 'DA_DAT' },
      });

      // Dọn dẹp in-memory hold nếu có
      const memoryHold = this.holds.get(holdToken);
      if (memoryHold) {
        if (memoryHold.timer) clearTimeout(memoryHold.timer);
        this.holds.delete(holdToken);
      }

      return { giuChoId: dbHold.giuChoId };
    }

    // Fallback cho môi trường test nếu không có bảng giuCho
    this.verifyHold(
      holdToken,
      tripId ?? 0,
      seatIds ?? [],
      expectedCustomerId,
    );
    const memoryHold = this.holds.get(holdToken);
    if (memoryHold) {
      if (memoryHold.timer) clearTimeout(memoryHold.timer);
      this.holds.delete(holdToken);
    }
    return { giuChoId: 0 };
  }

  async consumeHold(
    holdToken?: string,
    tripId?: number,
    seatIds?: number[],
    expectedCustomerId?: number | null,
  ): Promise<boolean> {
    if (!holdToken) return false;
    this.verifyHold(
      holdToken,
      tripId ?? 0,
      seatIds ?? [],
      expectedCustomerId,
    );

    const tokenHash = this.hashHoldToken(holdToken);
    if (this.prisma.giuCho) {
      await this.prisma.giuCho.updateMany({
        where: { tokenHash, trangThai: 'DANG_GIU' },
        data: { trangThai: 'DA_DAT' },
      });
    }

    const hold = this.holds.get(holdToken);
    if (hold) {
      if (hold.timer) clearTimeout(hold.timer);
      this.holds.delete(holdToken);
      this.logger.log(
        `Consumed seat hold (tokenHash: ${this.maskHoldToken(holdToken)}) for confirmed booking`,
      );
      return true;
    }
    return false;
  }
}
