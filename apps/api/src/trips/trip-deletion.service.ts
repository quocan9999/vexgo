import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ALLOWED_DELETE_STATUSES = new Set(['CHUA_KHOI_HANH', 'DA_HUY']);
const RELEASABLE_HOLD_STATUSES = new Set([
  'DANG_GIU',
  'HET_HAN',
  'DA_GIAI_PHONG',
]);

@Injectable()
export class TripDeletionService {
  constructor(private readonly prisma: PrismaService) {}

  async delete(id: number, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);

    try {
      const deletedTrip = await this.prisma.$transaction(async (tx) => {
        // Hold the trip row while checking and deleting so new holds or shipments
        // cannot begin between the checks and the final delete.
        const trips = await tx.$queryRaw<
          Array<{ chuyenXeId: number; trangThai: string; maChuyenXe: string }>
        >(Prisma.sql`
          SELECT chuyenXeId, trangThai, maChuyenXe
          FROM ChuyenXe
          WHERE chuyenXeId = ${id} AND nhaXeId = ${nhaXeId}
          FOR UPDATE
        `);
        const trip = trips[0];

        if (!trip) {
          throw new NotFoundException({
            error: 'TRIP_NOT_FOUND',
            message: 'Không tìm thấy chuyến xe.',
          });
        }

        if (!ALLOWED_DELETE_STATUSES.has(trip.trangThai)) {
          throw new ConflictException({
            error: 'TRIP_DELETE_STATUS_NOT_ALLOWED',
            message:
              'Chỉ có thể xóa chuyến chưa khởi hành hoặc đã hủy. Chuyến đang chạy và đã hoàn thành cần được giữ để lưu lịch sử vận hành.',
          });
        }

        const ticket = await tx.ve.findFirst({
          where: { gheChuyenXe: { chuyenXeId: id } },
          select: { veId: true },
        });
        if (ticket) {
          throw new ConflictException({
            error: 'TRIP_HAS_TICKET_HISTORY',
            message:
              'Không thể xóa chuyến đã từng phát sinh vé. Hãy giữ chuyến để bảo toàn lịch sử đặt vé và thanh toán.',
          });
        }

        const now = new Date();
        const holds = await tx.giuCho.findMany({
          where: { chuyenXeId: id },
          select: { trangThai: true, hetHanLuc: true },
        });
        const blockingHold = holds.some(
          ({ trangThai, hetHanLuc }) =>
            !RELEASABLE_HOLD_STATUSES.has(trangThai) ||
            (trangThai === 'DANG_GIU' && hetHanLuc > now),
        );
        if (blockingHold) {
          throw new ConflictException({
            error: 'TRIP_HAS_ACTIVE_BOOKINGS',
            message:
              'Không thể xóa chuyến đang có khách giữ chỗ hoặc dữ liệu đặt ghế. Hãy chờ giữ chỗ hết hạn hoặc xử lý giao dịch trước.',
          });
        }

        const recentlyHeldLegacySeat = await tx.gheChuyenXe.findFirst({
          where: {
            chuyenXeId: id,
            trangThai: 'DANG_GIU',
            giuChoId: null,
            updatedAt: { gt: new Date(now.getTime() - 10 * 60 * 1000) },
          },
          select: { gheChuyenXeId: true },
        });
        const bookedSeat = await tx.gheChuyenXe.findFirst({
          where: { chuyenXeId: id, trangThai: 'DA_DAT' },
          select: { gheChuyenXeId: true },
        });
        if (recentlyHeldLegacySeat || bookedSeat) {
          throw new ConflictException({
            error: 'TRIP_HAS_ACTIVE_BOOKINGS',
            message:
              'Không thể xóa chuyến đang có khách giữ chỗ hoặc dữ liệu đặt ghế. Hãy chờ giữ chỗ hết hạn hoặc xử lý giao dịch trước.',
          });
        }

        const shipment = await tx.phieuGuiHang.findFirst({
          where: { chuyenXeId: id },
          select: { phieuGuiHangId: true },
        });
        if (shipment) {
          throw new ConflictException({
            error: 'TRIP_HAS_SHIPMENT_HISTORY',
            message:
              'Không thể xóa chuyến đã phát sinh vận đơn, kể cả vận đơn đã giao hoặc đã hủy, để bảo toàn lịch sử gửi hàng.',
          });
        }

        const review = await tx.phanHoi.findFirst({
          where: { chuyenXeId: id },
          select: { phanHoiId: true },
        });
        if (review) {
          throw new ConflictException({
            error: 'TRIP_HAS_REVIEW_HISTORY',
            message:
              'Không thể xóa chuyến đã có đánh giá của khách hàng để bảo toàn lịch sử phản hồi.',
          });
        }

        // Expired or released holds are temporary reservation records, so they
        // can be cleaned with an otherwise unused trip.
        await tx.giuCho.deleteMany({ where: { chuyenXeId: id } });
        await tx.gheChuyenXe.deleteMany({ where: { chuyenXeId: id } });
        await tx.chuyenXe.delete({ where: { chuyenXeId: id } });

        return { tripId: trip.chuyenXeId, code: trip.maChuyenXe };
      });

      return { data: deletedTrip };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException({
          error: 'TRIP_DELETE_CONFLICT',
          message:
            'Chuyến vừa phát sinh dữ liệu liên quan nên chưa thể xóa. Hãy tải lại thông tin chuyến và xử lý giao dịch trước.',
        });
      }
      throw error;
    }
  }
}
