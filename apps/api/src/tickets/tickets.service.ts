import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  businessDateStartUtc,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { TicketQueryDto } from './dto/ticket-query.dto.js';
import type { TicketLookupQueryDto } from './dto/ticket-lookup-query.dto.js';

function combineDeparture(
  date: Date,
  time: Date,
  businessTimeZone: string,
): Date {
  const businessDate = date.toISOString().slice(0, 10);
  const businessDayStart = businessDateStartUtc(businessDate, businessTimeZone);
  const elapsedSinceMidnight =
    ((time.getUTCHours() * 60 + time.getUTCMinutes()) * 60 +
      time.getUTCSeconds()) *
    1000;
  return new Date(businessDayStart.getTime() + elapsedSinceMidnight);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) {
    return '0' + digits.slice(2);
  }
  return digits;
}

function phonesMatch(phone1: string, phone2: string): boolean {
  const d1 = normalizePhone(phone1);
  const d2 = normalizePhone(phone2);
  if (!d1 || !d2) return false;
  return d1 === d2 || (d1.length >= 9 && d2.length >= 9 && d1.slice(-9) === d2.slice(-9));
}

const TICKET_INCLUDE = {
  phieuDatVe: {
    include: {
      donGiaoDich: {
        include: {
          khachHang: true,
          nhaXe: true,
          thanhToans: true,
        },
      },
    },
  },
  gheChuyenXe: {
    include: {
      ghe: true,
      chuyenXe: {
        include: {
          tuyenXe: { include: { nhaXe: true } },
          xe: { include: { loaiXe: true } },
        },
      },
    },
  },
} satisfies Prisma.VeInclude;

@Injectable()
export class TicketsService {
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async findCustomerTickets(taiKhoanId: number, query: TicketQueryDto) {
    const customer = await this.prisma.khachHang.findUnique({
      where: { taiKhoanId },
      select: { khachHangId: true },
    });

    if (!customer) {
      throw new NotFoundException({
        error: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ khách hàng.',
      });
    }

    const where: Prisma.VeWhereInput = {
      phieuDatVe: {
        donGiaoDich: {
          khachHangId: customer.khachHangId,
        },
      },
    };

    const andConditions: Prisma.VeWhereInput[] = [];

    if (query.status) {
      andConditions.push({
        trangThai: { equals: query.status },
      });
    }

    if (query.code) {
      andConditions.push({
        OR: [
          { maVe: { contains: query.code } },
          { phieuDatVe: { maPhieuDatVe: { contains: query.code } } },
        ],
      });
    }

    if (query.route) {
      andConditions.push({
        gheChuyenXe: {
          chuyenXe: {
            tuyenXe: {
              OR: [
                { diemDi: { contains: query.route } },
                { diemDen: { contains: query.route } },
              ],
            },
          },
        },
      });
    }

    if (query.departureDate) {
      const targetDate = new Date(`${query.departureDate}T00:00:00.000Z`);
      const nextDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
      andConditions.push({
        gheChuyenXe: {
          chuyenXe: {
            ngayKhoiHanh: {
              gte: targetDate,
              lt: nextDate,
            },
          },
        },
      });
    }

    if (query.search) {
      const s = query.search.trim();
      andConditions.push({
        OR: [
          { maVe: { contains: s } },
          { phieuDatVe: { maPhieuDatVe: { contains: s } } },
          {
            gheChuyenXe: {
              chuyenXe: {
                tuyenXe: {
                  OR: [
                    { diemDi: { contains: s } },
                    { diemDen: { contains: s } },
                    { nhaXe: { tenNhaXe: { contains: s } } },
                  ],
                },
              },
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const totalItems = await this.prisma.ve.count({ where });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const totalPages = Math.ceil(totalItems / pageSize);

    const direction = query.sortDirection ?? 'desc';
    let orderBy: Prisma.VeOrderByWithRelationInput[];
    if (query.sortBy === 'price') {
      orderBy = [{ giaThucTe: direction }, { veId: direction }];
    } else if (query.sortBy === 'departureTime') {
      orderBy = [
        { gheChuyenXe: { chuyenXe: { ngayKhoiHanh: direction } } },
        { gheChuyenXe: { chuyenXe: { gioKhoiHanh: direction } } },
        { veId: direction },
      ];
    } else {
      orderBy = [{ createdAt: direction }, { veId: direction }];
    }

    const tickets = await this.prisma.ve.findMany({
      where,
      include: TICKET_INCLUDE,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    });

    const data = tickets.map((t) => this.mapTicket(t));

    return {
      data,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async findCustomerTicketById(taiKhoanId: number, ticketId: number) {
    const ticket = await this.prisma.ve.findUnique({
      where: { veId: ticketId },
      include: TICKET_INCLUDE,
    });

    if (!ticket) {
      throw new NotFoundException({
        error: 'TICKET_NOT_FOUND',
        message: 'Không tìm thấy vé.',
      });
    }

    if (ticket.phieuDatVe.donGiaoDich.khachHang.taiKhoanId !== taiKhoanId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_TICKET_ACCESS',
        message: 'Bạn không có quyền truy cập vé này.',
      });
    }

    return { data: this.mapTicket(ticket) };
  }

  async lookupTicket(query: TicketLookupQueryDto) {
    const ticket = await this.prisma.ve.findUnique({
      where: { maVe: query.ticketCode.trim() },
      include: TICKET_INCLUDE,
    });

    if (!ticket) {
      throw new NotFoundException({
        error: 'TICKET_NOT_FOUND',
        message: 'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
      });
    }

    const customerPhone =
      ticket.phieuDatVe.donGiaoDich.soDienThoaiKhachHang || '';
    if (!phonesMatch(customerPhone, query.phoneNumber)) {
      throw new NotFoundException({
        error: 'TICKET_NOT_FOUND',
        message: 'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
      });
    }

    return { data: this.mapTicket(ticket) };
  }

  private mapTicket(ticket: any) {
    const chuyenXe = ticket.gheChuyenXe?.chuyenXe;
    const tuyenXe = chuyenXe?.tuyenXe;
    const nhaXe = ticket.phieuDatVe?.donGiaoDich?.nhaXe ?? tuyenXe?.nhaXe;
    const loaiXe = chuyenXe?.xe?.loaiXe;

    let departureTime: string | null = null;
    if (chuyenXe?.ngayKhoiHanh && chuyenXe?.gioKhoiHanh) {
      departureTime = combineDeparture(
        chuyenXe.ngayKhoiHanh,
        chuyenXe.gioKhoiHanh,
        this.businessTimeZone,
      ).toISOString();
    }

    const route =
      tuyenXe?.diemDi && tuyenXe?.diemDen
        ? `${tuyenXe.diemDi} - ${tuyenXe.diemDen}`
        : null;

    const order = ticket.phieuDatVe?.donGiaoDich;
    const latestPayment = order?.thanhToans?.[0];

    return {
      ticketId: ticket.veId,
      ticketCode: ticket.maVe,
      bookingId: ticket.phieuDatVeId,
      bookingCode: ticket.phieuDatVe?.maPhieuDatVe ?? null,
      route,
      origin: tuyenXe?.diemDi ?? null,
      destination: tuyenXe?.diemDen ?? null,
      busCompanyName: nhaXe?.tenNhaXe ?? null,
      vehicleType: loaiXe?.tenLoai ?? null,
      departureTime,
      seatNumber: ticket.gheChuyenXe?.ghe?.soGhe ?? null,
      seatPosition: ticket.gheChuyenXe?.ghe?.viTri ?? null,
      price: Number(ticket.giaThucTe ?? ticket.giaNiemYet ?? 0),
      status: ticket.trangThai,
      bookingStatus: ticket.phieuDatVe?.trangThai ?? null,
      paymentStatus: order?.trangThai ?? null,
      paymentMethod: latestPayment?.phuongThuc ?? null,
      pickup: ticket.diemDon ?? null,
      dropoff: tuyenXe?.diemDen ?? null,
      passengerName: order?.tenKhachHang ?? null,
      passengerPhone: order?.soDienThoaiKhachHang ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }
}
