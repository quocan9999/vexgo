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
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminHistoryQueryDto,
  AdminTicketQueryDto,
} from '../bookings/dto/admin-booking-query.dto.js';

const TICKET_LIST_SELECT = {
  veId: true,
  maVe: true,
  giaThucTe: true,
  trangThai: true,
  createdAt: true,
  phieuDatVe: {
    select: {
      phieuDatVeId: true,
      maPhieuDatVe: true,
      ngayDat: true,
      donGiaoDich: {
        select: {
          nhaXeId: true,
          tenKhachHang: true,
          soDienThoaiKhachHang: true,
        },
      },
    },
  },
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
} satisfies Prisma.VeSelect;

const TICKET_DETAIL_SELECT = {
  veId: true,
  maVe: true,
  diemDon: true,
  giaNiemYet: true,
  giaThucTe: true,
  trangThai: true,
  phieuDatVe: {
    select: {
      phieuDatVeId: true,
      maPhieuDatVe: true,
      ngayDat: true,
      soLuongVeBanDau: true,
      tongTienBanDau: true,
      trangThai: true,
      donGiaoDich: {
        select: {
          nhaXeId: true,
          trangThai: true,
          tenKhachHang: true,
          soDienThoaiKhachHang: true,
          thanhToans: {
            where: { loaiGiaoDich: 'HOAN_TIEN' },
            orderBy: [{ thoiGian: 'asc' }, { thanhToanId: 'asc' }],
            select: {
              thanhToanId: true,
              soTien: true,
              phuongThuc: true,
              trangThai: true,
              thoiGian: true,
              veId: true,
            },
          },
        },
      },
    },
  },
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
} satisfies Prisma.VeSelect;

const TICKET_HISTORY_SELECT = {
  lichSuTrangThaiVeId: true,
  trangThaiCu: true,
  trangThaiMoi: true,
  thoiDiem: true,
  nguonThayDoi: true,
  lyDo: true,
  laOverride: true,
  maThaoTac: true,
  taiKhoan: { select: { hoTen: true } },
} satisfies Prisma.LichSuTrangThaiVeSelect;

type TicketListRecord = Prisma.VeGetPayload<{
  select: typeof TICKET_LIST_SELECT;
}>;

type TicketDetailRecord = Prisma.VeGetPayload<{
  select: typeof TICKET_DETAIL_SELECT;
}>;

function dateRange(query: AdminTicketQueryDto, timeZone: string) {
  const and: Prisma.VeWhereInput[] = [];
  if (query.bookedFrom) {
    and.push({
      phieuDatVe: {
        ngayDat: { gte: businessDateStartUtc(query.bookedFrom, timeZone) },
      },
    });
  }
  if (query.bookedTo) {
    const [year, month, day] = query.bookedTo.split('-').map(Number);
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
    const dateOnly = `${String(nextDay.getUTCFullYear()).padStart(4, '0')}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`;
    and.push({
      phieuDatVe: {
        ngayDat: { lt: businessDateStartUtc(dateOnly, timeZone) },
      },
    });
  }
  const departure: Prisma.DateTimeFilter = {};
  if (query.departureFrom) {
    departure.gte = new Date(`${query.departureFrom}T00:00:00.000Z`);
  }
  if (query.departureTo) {
    const [year, month, day] = query.departureTo.split('-').map(Number);
    departure.lt = new Date(Date.UTC(year, month - 1, day + 1));
  }
  if (Object.keys(departure).length) {
    and.push({
      gheChuyenXe: {
        chuyenXe: {
          ngayKhoiHanh: departure,
        },
      },
    });
  }
  return and;
}

function notFoundTicket(): NotFoundException {
  return new NotFoundException({
    error: 'TICKET_NOT_FOUND',
    message: 'Không tìm thấy vé.',
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
export class AdminTicketsService {
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async list(principal: AuthPrincipal, query: AdminTicketQueryDto) {
    const nhaXeId = requireTenantPrincipal(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const and: Prisma.VeWhereInput[] = [
      {
        gheChuyenXe: { chuyenXe: { nhaXeId } },
      },
    ];
    if (query.status) and.push({ trangThai: query.status });
    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { maVe: { contains: search } },
          { phieuDatVe: { maPhieuDatVe: { contains: search } } },
          {
            phieuDatVe: {
              donGiaoDich: {
                tenKhachHang: { contains: search },
              },
            },
          },
          {
            phieuDatVe: {
              donGiaoDich: {
                soDienThoaiKhachHang: { contains: search },
              },
            },
          },
        ],
      });
    }
    and.push(...dateRange(query, this.businessTimeZone));
    const where: Prisma.VeWhereInput = {
      phieuDatVe: { donGiaoDich: { nhaXeId } },
      AND: and,
    };
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'bookedAt';
    const orderBy: Prisma.VeOrderByWithRelationInput[] =
      sortBy === 'ticketPrice'
        ? [{ giaThucTe: direction }, { veId: direction }]
        : sortBy === 'departureTime'
          ? [
              {
                gheChuyenXe: {
                  chuyenXe: { ngayKhoiHanh: direction },
                },
              },
              {
                gheChuyenXe: {
                  chuyenXe: { gioKhoiHanh: direction },
                },
              },
              { veId: direction },
            ]
          : [{ phieuDatVe: { ngayDat: direction } }, { veId: direction }];

    const [totalItems, rows] = await Promise.all([
      this.prisma.ve.count({ where }),
      this.prisma.ve.findMany({
        where,
        select: TICKET_LIST_SELECT,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return statusPage(
      rows.map((ticket) => this.mapListItem(ticket, nhaXeId)),
      page,
      pageSize,
      totalItems,
    );
  }

  async detail(principal: AuthPrincipal, ticketId: number) {
    const nhaXeId = requireTenantPrincipal(principal);
    this.assertValidId(ticketId);
    const ticket = await this.prisma.ve.findFirst({
      where: {
        veId: ticketId,
        phieuDatVe: { donGiaoDich: { nhaXeId } },
      },
      select: TICKET_DETAIL_SELECT,
    });
    if (!ticket) throw notFoundTicket();

    const transaction = ticket.phieuDatVe.donGiaoDich;
    const refunds = transaction.thanhToans.filter(
      ({ veId }) => veId === ticket.veId,
    );
    const trip =
      ticket.gheChuyenXe.chuyenXe.nhaXeId === nhaXeId
        ? this.mapTrip(ticket)
        : null;
    return {
      data: {
        ticketId: ticket.veId,
        ticketCode: ticket.maVe,
        booking: {
          bookingId: ticket.phieuDatVe.phieuDatVeId,
          bookingCode: ticket.phieuDatVe.maPhieuDatVe,
          bookedAt: ticket.phieuDatVe.ngayDat.toISOString(),
          status: ticket.phieuDatVe.trangThai,
          initialTicketCount: ticket.phieuDatVe.soLuongVeBanDau,
          initialTicketAmount: ticket.phieuDatVe.tongTienBanDau.toString(),
          transactionStatus: transaction.trangThai,
        },
        customer: {
          name: transaction.tenKhachHang,
          phoneNumber: transaction.soDienThoaiKhachHang,
        },
        trip,
        tripIntegrity: trip ? 'CONSISTENT' : 'TRIP_UNAVAILABLE',
        seatNumber:
          ticket.gheChuyenXe.chuyenXe.nhaXeId === nhaXeId
            ? ticket.gheChuyenXe.ghe.soGhe
            : null,
        listedPrice: ticket.giaNiemYet.toString(),
        actualPrice: ticket.giaThucTe.toString(),
        pickup: ticket.diemDon,
        status: ticket.trangThai,
        refunds: refunds.map((refund) => ({
          refundId: refund.thanhToanId,
          amountVnd: refund.soTien.toString(),
          method: refund.phuongThuc,
          status: refund.trangThai,
          occurredAt: refund.thoiGian.toISOString(),
          ticketId: ticket.veId,
        })),
      },
    };
  }

  async history(
    principal: AuthPrincipal,
    ticketId: number,
    query: AdminHistoryQueryDto,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    this.assertValidId(ticketId);
    const owner = await this.prisma.ve.findFirst({
      where: {
        veId: ticketId,
        phieuDatVe: { donGiaoDich: { nhaXeId } },
      },
      select: { veId: true },
    });
    if (!owner) throw notFoundTicket();

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const where: Prisma.LichSuTrangThaiVeWhereInput = {
      veId: ticketId,
      ve: { phieuDatVe: { donGiaoDich: { nhaXeId } } },
    };
    const [totalItems, rows] = await Promise.all([
      this.prisma.lichSuTrangThaiVe.count({ where }),
      this.prisma.lichSuTrangThaiVe.findMany({
        where,
        select: TICKET_HISTORY_SELECT,
        orderBy: [{ thoiDiem: 'asc' }, { lichSuTrangThaiVeId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return statusPage(
      rows.map((row) => ({
        historyId: row.lichSuTrangThaiVeId,
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

  private mapListItem(ticket: TicketListRecord, nhaXeId: number) {
    const trip =
      ticket.gheChuyenXe.chuyenXe.nhaXeId === nhaXeId
        ? this.mapTrip(ticket)
        : null;
    return {
      ticketId: ticket.veId,
      ticketCode: ticket.maVe,
      bookingId: ticket.phieuDatVe.phieuDatVeId,
      bookingCode: ticket.phieuDatVe.maPhieuDatVe,
      customer: {
        name: ticket.phieuDatVe.donGiaoDich.tenKhachHang,
        phoneNumber: ticket.phieuDatVe.donGiaoDich.soDienThoaiKhachHang,
      },
      trip,
      tripIntegrity: trip ? 'CONSISTENT' : 'TRIP_UNAVAILABLE',
      seatNumber: ticket.gheChuyenXe.ghe.soGhe,
      actualPrice: ticket.giaThucTe.toString(),
      status: ticket.trangThai,
      bookedAt: ticket.phieuDatVe.ngayDat.toISOString(),
    };
  }

  private mapTrip(ticket: TicketListRecord | TicketDetailRecord) {
    const trip = ticket.gheChuyenXe.chuyenXe;
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
        error: 'INVALID_TICKET_ID',
        message: 'Mã vé không hợp lệ.',
      });
    }
  }
}
