import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import {
  businessDateStartUtc,
  combineDeparture,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { escapeSqlLike } from '../common/escape-sql-like.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminBookingQueryDto,
  AdminHistoryQueryDto,
} from './dto/admin-booking-query.dto.js';

type BookingTripAggregateRow = {
  bookingId: number | bigint;
  tripId: number | bigint;
  ticketCount: number | bigint;
  cancelledTicketCount: number | bigint;
};

const BOOKING_LIST_SELECT = {
  phieuDatVeId: true,
  maPhieuDatVe: true,
  ngayDat: true,
  soLuongVeBanDau: true,
  tongTienBanDau: true,
  trangThai: true,
  donGiaoDich: {
    select: {
      nhaXeId: true,
      tenKhachHang: true,
      soDienThoaiKhachHang: true,
    },
  },
} satisfies Prisma.PhieuDatVeSelect;

const BOOKING_DETAIL_SELECT = {
  phieuDatVeId: true,
  maPhieuDatVe: true,
  ngayDat: true,
  soLuongVeBanDau: true,
  tongTienBanDau: true,
  trangThai: true,
  ves: {
    orderBy: { veId: 'asc' },
    select: {
      veId: true,
      maVe: true,
      diemDon: true,
      giaNiemYet: true,
      giaThucTe: true,
      trangThai: true,
      gheChuyenXe: {
        select: {
          ghe: { select: { soGhe: true } },
          chuyenXe: {
            select: {
              chuyenXeId: true,
              maChuyenXe: true,
              ngayKhoiHanh: true,
              gioKhoiHanh: true,
              nhaXeId: true,
              tuyenXe: { select: { diemDi: true, diemDen: true } },
            },
          },
        },
      },
    },
  },
  donGiaoDich: {
    select: {
      nhaXeId: true,
      trangThai: true,
      tongTien: true,
      tenKhachHang: true,
      soDienThoaiKhachHang: true,
      thanhToans: {
        orderBy: [{ thoiGian: 'asc' }, { thanhToanId: 'asc' }],
        select: {
          thanhToanId: true,
          soTien: true,
          phuongThuc: true,
          loaiGiaoDich: true,
          thoiGian: true,
          trangThai: true,
          veId: true,
        },
      },
      phieuGuiHang: {
        select: {
          phieuGuiHangId: true,
          maVanDon: true,
          trangThai: true,
          chuyenXeId: true,
          chuyenXe: { select: { nhaXeId: true } },
          hangHoas: {
            orderBy: { hangHoaId: 'asc' },
            select: {
              tenHang: true,
              soLuong: true,
              loaiHangHoa: { select: { tenLoai: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PhieuDatVeSelect;

const BOOKING_HISTORY_SELECT = {
  lichSuTrangThaiPhieuDatVeId: true,
  trangThaiCu: true,
  trangThaiMoi: true,
  thoiDiem: true,
  nguonThayDoi: true,
  lyDo: true,
  laOverride: true,
  maThaoTac: true,
  taiKhoan: { select: { hoTen: true } },
} satisfies Prisma.LichSuTrangThaiPhieuDatVeSelect;

function nextDateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${String(next.getUTCFullYear()).padStart(4, '0')}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function toCount(value: number | bigint): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Admin booking count exceeded the safe integer range.');
  }
  return count;
}

function notFoundBooking(): NotFoundException {
  return new NotFoundException({
    error: 'BOOKING_NOT_FOUND',
    message: 'Không tìm thấy phiếu đặt vé.',
  });
}

function statusPage<T>(
  data: T[],
  page: number,
  pageSize: number,
  totalItems: number,
) {
  return {
    data,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  };
}

@Injectable()
export class AdminBookingsService {
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async list(principal: AuthPrincipal, query: AdminBookingQueryDto) {
    const nhaXeId = requireTenantPrincipal(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const direction =
      query.sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const predicates: Prisma.Sql[] = [
      Prisma.sql`orderRow.nhaXeId = ${nhaXeId}`,
    ];
    const search = query.search?.trim();

    if (query.status) {
      predicates.push(Prisma.sql`bookingRow.trangThai = ${query.status}`);
    }
    if (search) {
      const escapedSearch = escapeSqlLike(search);
      predicates.push(Prisma.sql`(
        bookingRow.maPhieuDatVe LIKE CONCAT('%', ${escapedSearch}, '%')
        OR orderRow.tenKhachHang LIKE CONCAT('%', ${escapedSearch}, '%')
        OR orderRow.soDienThoaiKhachHang LIKE CONCAT('%', ${escapedSearch}, '%')
        OR EXISTS (
          SELECT 1 FROM Ve AS searchedTicket
          WHERE searchedTicket.phieuDatVeId = bookingRow.phieuDatVeId
            AND searchedTicket.maVe LIKE CONCAT('%', ${escapedSearch}, '%')
        )
      )`);
    }

    const bookedFrom = query.bookedFrom
      ? businessDateStartUtc(query.bookedFrom, this.businessTimeZone)
      : undefined;
    const bookedToExclusive = query.bookedTo
      ? businessDateStartUtc(
          nextDateOnly(query.bookedTo),
          this.businessTimeZone,
        )
      : undefined;
    if (bookedFrom) {
      predicates.push(Prisma.sql`bookingRow.ngayDat >= ${bookedFrom}`);
    }
    if (bookedToExclusive) {
      predicates.push(Prisma.sql`bookingRow.ngayDat < ${bookedToExclusive}`);
    }

    const departurePredicates: Prisma.Sql[] = [];
    if (query.departureFrom) {
      departurePredicates.push(
        Prisma.sql`departureTrip.ngayKhoiHanh >= ${new Date(`${query.departureFrom}T00:00:00.000Z`)}`,
      );
    }
    if (query.departureTo) {
      departurePredicates.push(
        Prisma.sql`departureTrip.ngayKhoiHanh < ${new Date(`${nextDateOnly(query.departureTo)}T00:00:00.000Z`)}`,
      );
    }
    if (departurePredicates.length) {
      predicates.push(Prisma.sql`EXISTS (
        SELECT 1
        FROM Ve AS departureTicket
        INNER JOIN GheChuyenXe AS departureSeat
          ON departureSeat.gheChuyenXeId = departureTicket.gheChuyenXeId
        INNER JOIN ChuyenXe AS departureTrip
          ON departureTrip.chuyenXeId = departureSeat.chuyenXeId
        WHERE departureTicket.phieuDatVeId = bookingRow.phieuDatVeId
          AND departureTrip.nhaXeId = orderRow.nhaXeId
          AND ${Prisma.join(departurePredicates, ' AND ')}
      )`);
    }

    const whereSql = Prisma.join(predicates, ' AND ');
    const sortBy = query.sortBy ?? 'bookedAt';
    const sortExpression =
      sortBy === 'totalTicketAmount'
        ? Prisma.sql`bookingRow.tongTienBanDau`
        : sortBy === 'departureTime'
          ? Prisma.sql`(
              SELECT MIN(TIMESTAMP(sortTrip.ngayKhoiHanh, sortTrip.gioKhoiHanh))
              FROM Ve AS sortTicket
              INNER JOIN GheChuyenXe AS sortSeat
                ON sortSeat.gheChuyenXeId = sortTicket.gheChuyenXeId
              INNER JOIN ChuyenXe AS sortTrip
                ON sortTrip.chuyenXeId = sortSeat.chuyenXeId
              WHERE sortTicket.phieuDatVeId = bookingRow.phieuDatVeId
                AND sortTrip.nhaXeId = orderRow.nhaXeId
            )`
          : Prisma.sql`bookingRow.ngayDat`;
    const offset = (page - 1) * pageSize;

    const [countRows, idRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ totalItems: number | bigint }>>(Prisma.sql`
        SELECT COUNT(*) AS totalItems
        FROM PhieuDatVe AS bookingRow
        INNER JOIN DonGiaoDich AS orderRow
          ON orderRow.donGiaoDichId = bookingRow.donGiaoDichId
        WHERE ${whereSql}
      `),
      this.prisma.$queryRaw<Array<{ bookingId: number | bigint }>>(Prisma.sql`
        SELECT bookingRow.phieuDatVeId AS bookingId
        FROM PhieuDatVe AS bookingRow
        INNER JOIN DonGiaoDich AS orderRow
          ON orderRow.donGiaoDichId = bookingRow.donGiaoDichId
        WHERE ${whereSql}
        ORDER BY ${sortExpression} ${direction}, bookingRow.phieuDatVeId ${direction}
        LIMIT ${offset}, ${pageSize}
      `),
    ]);
    const totalItems = toCount(countRows[0]?.totalItems ?? 0);
    const bookingIds = idRows.map(({ bookingId }) => Number(bookingId));
    if (bookingIds.length === 0) {
      return statusPage([], page, pageSize, totalItems);
    }

    const [bookings, aggregateRows] = await Promise.all([
      this.prisma.phieuDatVe.findMany({
        where: {
          phieuDatVeId: { in: bookingIds },
          donGiaoDich: { nhaXeId },
        },
        select: BOOKING_LIST_SELECT,
      }),
      this.prisma.$queryRaw<BookingTripAggregateRow[]>(Prisma.sql`
        SELECT
          ticket.phieuDatVeId AS bookingId,
          trip.chuyenXeId AS tripId,
          COUNT(*) AS ticketCount,
          SUM(CASE WHEN ticket.trangThai = 'HUY' THEN 1 ELSE 0 END) AS cancelledTicketCount
        FROM Ve AS ticket
        INNER JOIN GheChuyenXe AS tripSeat
          ON tripSeat.gheChuyenXeId = ticket.gheChuyenXeId
        INNER JOIN ChuyenXe AS trip
          ON trip.chuyenXeId = tripSeat.chuyenXeId
        WHERE ticket.phieuDatVeId IN (${Prisma.join(bookingIds)})
        GROUP BY ticket.phieuDatVeId, trip.chuyenXeId
      `),
    ]);

    const tripIds = [
      ...new Set(aggregateRows.map(({ tripId }) => Number(tripId))),
    ];
    const trips = tripIds.length
      ? await this.prisma.chuyenXe.findMany({
          where: { chuyenXeId: { in: tripIds }, nhaXeId },
          select: {
            chuyenXeId: true,
            maChuyenXe: true,
            ngayKhoiHanh: true,
            gioKhoiHanh: true,
            nhaXeId: true,
            tuyenXe: { select: { diemDi: true, diemDen: true } },
          },
        })
      : [];
    const tripById = new Map(trips.map((trip) => [trip.chuyenXeId, trip]));
    const aggregatesByBooking = new Map<number, BookingTripAggregateRow[]>();
    for (const aggregate of aggregateRows) {
      const bookingId = Number(aggregate.bookingId);
      const current = aggregatesByBooking.get(bookingId) ?? [];
      current.push(aggregate);
      aggregatesByBooking.set(bookingId, current);
    }
    const bookingById = new Map(
      bookings.map((booking) => [booking.phieuDatVeId, booking]),
    );
    const data = bookingIds.flatMap((bookingId) => {
      const booking = bookingById.get(bookingId);
      if (!booking) return [];
      const aggregates = aggregatesByBooking.get(bookingId) ?? [];
      const tripIdSet = new Set(aggregates.map(({ tripId }) => Number(tripId)));
      const ticketCount = aggregates.reduce(
        (sum, aggregate) => sum + toCount(aggregate.ticketCount),
        0,
      );
      const cancelledTicketCount = aggregates.reduce(
        (sum, aggregate) => sum + toCount(aggregate.cancelledTicketCount),
        0,
      );
      const tripIntegrity =
        aggregates.length === 0
          ? 'NO_TICKETS'
          : tripIdSet.size > 1
            ? 'MULTIPLE_TRIPS'
            : tripById.has(Number(aggregates[0].tripId))
              ? 'CONSISTENT'
              : 'TRIP_UNAVAILABLE';
      const trip =
        tripIntegrity === 'CONSISTENT'
          ? tripById.get(Number(aggregates[0].tripId))!
          : null;
      return [
        {
          bookingId: booking.phieuDatVeId,
          bookingCode: booking.maPhieuDatVe,
          bookedAt: booking.ngayDat.toISOString(),
          customer: {
            name: booking.donGiaoDich.tenKhachHang,
            phoneNumber: booking.donGiaoDich.soDienThoaiKhachHang,
          },
          trip: trip ? this.mapTrip(trip) : null,
          tripIntegrity,
          initialTicketCount: booking.soLuongVeBanDau,
          ticketCount,
          cancelledTicketCount,
          activeTicketCount: ticketCount - cancelledTicketCount,
          initialTicketAmount: booking.tongTienBanDau.toString(),
          status: booking.trangThai,
          isPartiallyCancelled:
            cancelledTicketCount > 0 && cancelledTicketCount < ticketCount,
        },
      ];
    });

    return statusPage(data, page, pageSize, totalItems);
  }

  async detail(principal: AuthPrincipal, bookingId: number) {
    const nhaXeId = requireTenantPrincipal(principal);
    this.assertValidId(bookingId);
    const booking = await this.prisma.phieuDatVe.findFirst({
      where: { phieuDatVeId: bookingId, donGiaoDich: { nhaXeId } },
      select: BOOKING_DETAIL_SELECT,
    });
    if (!booking) throw notFoundBooking();

    const tickets = booking.ves;
    const cancelledTicketCount = tickets.filter(
      (ticket) => ticket.trangThai === 'HUY',
    ).length;
    const tripIds = new Set(
      tickets.map((ticket) => ticket.gheChuyenXe.chuyenXe.chuyenXeId),
    );
    const tripTenantMismatch = tickets.some(
      (ticket) => ticket.gheChuyenXe.chuyenXe.nhaXeId !== nhaXeId,
    );
    const tripIntegrity =
      tickets.length === 0
        ? 'NO_TICKETS'
        : tripIds.size > 1
          ? 'MULTIPLE_TRIPS'
          : tripTenantMismatch
            ? 'TRIP_UNAVAILABLE'
            : 'CONSISTENT';
    const singleTrip =
      tripIntegrity === 'CONSISTENT' ? tickets[0].gheChuyenXe.chuyenXe : null;
    const ticketIdSet = new Set(tickets.map((ticket) => ticket.veId));
    const payments = booking.donGiaoDich.thanhToans;
    const refunds = payments.filter(
      ({ loaiGiaoDich }) => loaiGiaoDich === 'HOAN_TIEN',
    );
    const mapPayment = (payment: (typeof payments)[number]) => ({
      paymentId: payment.thanhToanId,
      amountVnd: payment.soTien.toString(),
      method: payment.phuongThuc,
      status: payment.trangThai,
      occurredAt: payment.thoiGian.toISOString(),
      ticketId:
        payment.veId !== null && ticketIdSet.has(payment.veId)
          ? payment.veId
          : null,
      allocation:
        payment.veId !== null && ticketIdSet.has(payment.veId)
          ? 'TICKET'
          : 'UNALLOCATED',
    });
    const shipment = booking.donGiaoDich.phieuGuiHang;
    const resolvedBookingTripId =
      tripIntegrity === 'CONSISTENT'
        ? tickets[0]?.gheChuyenXe.chuyenXe.chuyenXeId ?? null
        : null;
    const shipmentSummary = shipment
      ? (() => {
          const isShipmentTripInTenant =
            shipment.chuyenXe.nhaXeId === nhaXeId;
          const hasKnownBookingTrip = resolvedBookingTripId !== null;
          const hasMatchingTrip =
            hasKnownBookingTrip &&
            shipment.chuyenXeId === resolvedBookingTripId;
          const tripIntegrity = !isShipmentTripInTenant
            ? 'TRIP_UNAVAILABLE'
            : !hasKnownBookingTrip
              ? 'TRIP_UNAVAILABLE'
              : hasMatchingTrip
                ? 'CONSISTENT'
                : 'TRIP_MISMATCH';

          return {
            shipmentId: shipment.phieuGuiHangId,
            trackingCode: shipment.maVanDon,
            status: shipment.trangThai,
            tripId: tripIntegrity === 'CONSISTENT' ? shipment.chuyenXeId : null,
            tripIntegrity,
            items: shipment.hangHoas.map((item) => ({
              name: item.tenHang,
              quantity: item.soLuong,
              itemType: item.loaiHangHoa.tenLoai,
            })),
          };
        })()
      : null;

    return {
      data: {
        bookingId: booking.phieuDatVeId,
        bookingCode: booking.maPhieuDatVe,
        bookedAt: booking.ngayDat.toISOString(),
        customer: {
          name: booking.donGiaoDich.tenKhachHang,
          phoneNumber: booking.donGiaoDich.soDienThoaiKhachHang,
        },
        trip: singleTrip ? this.mapTrip(singleTrip) : null,
        tripIntegrity,
        initialTicketCount: booking.soLuongVeBanDau,
        ticketCount: tickets.length,
        cancelledTicketCount,
        activeTicketCount: tickets.length - cancelledTicketCount,
        initialTicketAmount: booking.tongTienBanDau.toString(),
        status: booking.trangThai,
        isPartiallyCancelled:
          cancelledTicketCount > 0 && cancelledTicketCount < tickets.length,
        transactionStatus: booking.donGiaoDich.trangThai,
        transactionTotalAmount: booking.donGiaoDich.tongTien.toString(),
        paymentSummary: {
          originalPayments: payments
            .filter(({ loaiGiaoDich }) => loaiGiaoDich === 'THANH_TOAN')
            .map(mapPayment),
          refunds: {
            pending: refunds
              .filter(({ trangThai }) =>
                ['DANG_XU_LY', 'DANG_GUI'].includes(trangThai),
              )
              .map(mapPayment),
            succeeded: refunds
              .filter(({ trangThai }) => trangThai === 'THANH_CONG')
              .map(mapPayment),
            other: refunds
              .filter(
                ({ trangThai }) =>
                  !['DANG_XU_LY', 'DANG_GUI', 'THANH_CONG'].includes(trangThai),
              )
              .map(mapPayment),
          },
        },
        shipment: shipmentSummary,
        tickets: tickets.map((ticket) => ({
          ticketId: ticket.veId,
          ticketCode: ticket.maVe,
          seatNumber:
            ticket.gheChuyenXe.chuyenXe.nhaXeId === nhaXeId
              ? ticket.gheChuyenXe.ghe.soGhe
              : null,
          status: ticket.trangThai,
          listedPrice: ticket.giaNiemYet.toString(),
          actualPrice: ticket.giaThucTe.toString(),
          pickup: ticket.diemDon,
        })),
      },
    };
  }

  async history(
    principal: AuthPrincipal,
    bookingId: number,
    query: AdminHistoryQueryDto,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    this.assertValidId(bookingId);
    const owner = await this.prisma.phieuDatVe.findFirst({
      where: { phieuDatVeId: bookingId, donGiaoDich: { nhaXeId } },
      select: { phieuDatVeId: true },
    });
    if (!owner) throw notFoundBooking();

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const where: Prisma.LichSuTrangThaiPhieuDatVeWhereInput = {
      phieuDatVeId: bookingId,
      phieuDatVe: { donGiaoDich: { nhaXeId } },
    };
    const [totalItems, rows] = await Promise.all([
      this.prisma.lichSuTrangThaiPhieuDatVe.count({ where }),
      this.prisma.lichSuTrangThaiPhieuDatVe.findMany({
        where,
        select: BOOKING_HISTORY_SELECT,
        orderBy: [{ thoiDiem: 'asc' }, { lichSuTrangThaiPhieuDatVeId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return statusPage(
      rows.map((row) => ({
        historyId: row.lichSuTrangThaiPhieuDatVeId,
        oldStatus: row.trangThaiCu,
        newStatus: row.trangThaiMoi,
        occurredAt: row.thoiDiem.toISOString(),
        source: row.nguonThayDoi,
        reason: row.lyDo,
        isOverride: row.laOverride,
        operationId: row.maThaoTac,
        actorName: row.taiKhoan?.hoTen ?? null,
      })),
      page,
      pageSize,
      totalItems,
    );
  }

  private mapTrip(trip: {
    chuyenXeId: number;
    maChuyenXe: string;
    ngayKhoiHanh: Date;
    gioKhoiHanh: Date;
    tuyenXe: { diemDi: string; diemDen: string };
  }) {
    return {
      tripId: trip.chuyenXeId,
      tripCode: trip.maChuyenXe,
      origin: trip.tuyenXe.diemDi,
      destination: trip.tuyenXe.diemDen,
      departureAt: combineDeparture(
        trip.ngayKhoiHanh,
        trip.gioKhoiHanh,
        this.businessTimeZone,
      ).toISOString(),
    };
  }

  private assertValidId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException({
        error: 'INVALID_BOOKING_ID',
        message: 'Mã phiếu đặt vé không hợp lệ.',
      });
    }
  }
}
