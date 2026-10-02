import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  combineBusinessDateAndTime,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSeatHoldDto } from './dto/create-seat-hold.dto.js';

const SEAT_HOLD_TTL_MS = 5 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isPrismaConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

@Injectable()
export class SeatHoldsService {
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async create(dto: CreateSeatHoldDto, principal: AuthPrincipal) {
    if (
      !Array.isArray(dto.tripSeatIds) ||
      dto.tripSeatIds.length === 0 ||
      new Set(dto.tripSeatIds).size !== dto.tripSeatIds.length
    ) {
      throw new BadRequestException({
        error: 'SEAT_SELECTION_INVALID',
        message: 'Danh sách ghế không hợp lệ.',
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SEAT_HOLD_TTL_MS);
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const seatIds = [...dto.tripSeatIds].sort((left, right) => left - right);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ chuyenXeId: number }>>(Prisma.sql`
          SELECT chuyenXeId
          FROM ChuyenXe
          WHERE chuyenXeId = ${dto.tripId}
          FOR UPDATE
        `);

        const trip = await tx.chuyenXe.findUnique({
          where: { chuyenXeId: dto.tripId },
          select: {
            chuyenXeId: true,
            trangThai: true,
            ngayKhoiHanh: true,
            gioKhoiHanh: true,
          },
        });
        if (!trip) {
          throw new NotFoundException({
            error: 'TRIP_NOT_FOUND',
            message: 'Không tìm thấy chuyến xe.',
          });
        }
        if (trip.trangThai !== 'CHUA_KHOI_HANH') {
          throw new ConflictException({
            error: 'TRIP_NOT_AVAILABLE',
            message: 'Chuyến xe này hiện không mở bán.',
          });
        }
        if (
          combineBusinessDateAndTime(
            trip.ngayKhoiHanh,
            trip.gioKhoiHanh,
            this.businessTimeZone,
          ) <= now
        ) {
          throw new ConflictException({
            error: 'TRIP_ALREADY_DEPARTED',
            message: 'Chuyến xe này đã khởi hành.',
          });
        }

        const customer = await tx.khachHang.findUnique({
          where: { taiKhoanId: principal.taiKhoanId },
          select: { khachHangId: true },
        });
        if (!customer) {
          throw new NotFoundException({
            error: 'CUSTOMER_PROFILE_NOT_FOUND',
            message: 'Không tìm thấy hồ sơ khách hàng.',
          });
        }

        const lockedSeats = await tx.$queryRaw<
          Array<{ gheChuyenXeId: number }>
        >(Prisma.sql`
          SELECT gheChuyenXeId
          FROM GheChuyenXe
          WHERE chuyenXeId = ${dto.tripId}
            AND gheChuyenXeId IN (${Prisma.join(seatIds)})
          ORDER BY gheChuyenXeId
          FOR UPDATE
        `);
        if (lockedSeats.length !== seatIds.length) {
          throw new BadRequestException({
            error: 'SEAT_SELECTION_INVALID',
            message: 'Ghế phải tồn tại và thuộc chuyến xe đã chọn.',
          });
        }

        const seats = await tx.gheChuyenXe.findMany({
          where: { chuyenXeId: dto.tripId, gheChuyenXeId: { in: seatIds } },
          select: { gheChuyenXeId: true, trangThai: true },
        });
        if (seats.some(({ trangThai }) => trangThai !== 'TRONG')) {
          throw new ConflictException({
            error: 'SEAT_UNAVAILABLE',
            message: 'Một hoặc nhiều ghế không còn trống.',
          });
        }

        await tx.giuCho.deleteMany({
          where: {
            hetHanLuc: { lte: now },
            gheChuyenXes: { some: { gheChuyenXeId: { in: seatIds } } },
          },
        });
        const activeHold = await tx.giuChoGhe.findFirst({
          where: {
            gheChuyenXeId: { in: seatIds },
            giuCho: { is: { hetHanLuc: { gt: now } } },
          },
          select: { giuChoGheId: true },
        });
        if (activeHold) {
          throw new ConflictException({
            error: 'SEAT_UNAVAILABLE',
            message: 'Một hoặc nhiều ghế đang được giữ.',
          });
        }

        await tx.giuCho.create({
          data: {
            tokenHash,
            chuyenXeId: dto.tripId,
            taiKhoanId: principal.taiKhoanId,
            sessionId: principal.sessionId,
            hetHanLuc: expiresAt,
            gheChuyenXes: {
              create: seatIds.map((gheChuyenXeId) => ({ gheChuyenXeId })),
            },
          },
        });
      });
    } catch (error) {
      if (isPrismaConflict(error)) {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: 'Một hoặc nhiều ghế không còn trống.',
        });
      }
      throw error;
    }

    return {
      data: {
        token,
        tripId: dto.tripId,
        tripSeatIds: [...dto.tripSeatIds],
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async release(token: string, principal: AuthPrincipal) {
    const now = new Date();
    const result = await this.prisma.giuCho.deleteMany({
      where: {
        tokenHash: hashToken(token),
        taiKhoanId: principal.taiKhoanId,
        sessionId: principal.sessionId,
        hetHanLuc: { gt: now },
      },
    });
    if (result.count !== 1) {
      throw new NotFoundException({
        error: 'SEAT_HOLD_NOT_FOUND',
        message: 'Không tìm thấy lượt giữ ghế hợp lệ.',
      });
    }
    return { data: { released: true } };
  }
}
