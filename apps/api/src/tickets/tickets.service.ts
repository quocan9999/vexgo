import {
  BadRequestException,
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
import type { CancelTicketDto } from './dto/cancel-ticket.dto.js';

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

function combineArrival(
  departureDate: Date,
  departureTime: Date,
  arrivalTime: Date | null,
  businessTimeZone: string,
): string | null {
  if (!arrivalTime) return null;
  const depTime = combineDeparture(departureDate, departureTime, businessTimeZone);
  let arrTime = combineDeparture(departureDate, arrivalTime, businessTimeZone);
  if (arrTime < depTime) {
    arrTime = new Date(arrTime.getTime() + 24 * 60 * 60 * 1000);
  }
  return arrTime.toISOString();
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
  return (
    d1 === d2 ||
    (d1.length >= 9 && d2.length >= 9 && d1.slice(-9) === d2.slice(-9))
  );
}

const TICKET_INCLUDE = {
  phieuDatVe: {
    include: {
      donGiaoDich: {
        include: {
          khachHang: true,
          nhaXe: true,
          thanhToans: {
            orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
            take: 1,
          },
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

  async cancelTicket(dto: CancelTicketDto) {
    const ticket = await this.prisma.ve.findUnique({
      where: { maVe: dto.ticketCode.trim() },
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
    if (!phonesMatch(customerPhone, dto.phoneNumber)) {
      throw new NotFoundException({
        error: 'TICKET_NOT_FOUND',
        message: 'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
      });
    }

    if (ticket.trangThai === 'HUY') {
      throw new BadRequestException({
        error: 'TICKET_ALREADY_CANCELLED',
        message: 'Vé này đã được hủy trước đó.',
      });
    }

    const chuyenXe = ticket.gheChuyenXe?.chuyenXe;
    if (chuyenXe?.ngayKhoiHanh && chuyenXe?.gioKhoiHanh) {
      const departureDateTime = combineDeparture(
        chuyenXe.ngayKhoiHanh,
        chuyenXe.gioKhoiHanh,
        this.businessTimeZone,
      );
      if (new Date() >= departureDateTime) {
        throw new BadRequestException({
          error: 'TRIP_ALREADY_DEPARTED',
          message: 'Không thể hủy vé sau khi chuyến xe đã khởi hành.',
        });
      }
    }

    const price = Number(ticket.giaThucTe);
    const cancelFee = Math.round(price * 0.1);
    const refundAmount = price - cancelFee;

    await this.prisma.$transaction(async (tx) => {
      await tx.ve.update({
        where: { veId: ticket.veId },
        data: { trangThai: 'HUY' },
      });

      await tx.gheChuyenXe.update({
        where: { gheChuyenXeId: ticket.gheChuyenXeId },
        data: { trangThai: 'TRONG' },
      });

      const remainingActiveTickets = await tx.ve.count({
        where: {
          phieuDatVeId: ticket.phieuDatVeId,
          trangThai: { not: 'HUY' },
        },
      });

      if (remainingActiveTickets === 0) {
        await tx.phieuDatVe.update({
          where: { phieuDatVeId: ticket.phieuDatVeId },
          data: { trangThai: 'DA_HUY' },
        });
        await tx.donGiaoDich.update({
          where: { donGiaoDichId: ticket.phieuDatVe.donGiaoDichId },
          data: { trangThai: 'DA_HUY' },
        });
      }
    });

    return {
      data: {
        ticketId: ticket.veId,
        ticketCode: ticket.maVe,
        status: 'HUY',
        cancelFee,
        refundAmount,
        message: 'Hủy vé thành công.',
      },
    };
  }

  private mapTicket(ticket: any) {
    const chuyenXe = ticket.gheChuyenXe?.chuyenXe;
    const tuyenXe = chuyenXe?.tuyenXe;
    const nhaXe = ticket.phieuDatVe?.donGiaoDich?.nhaXe ?? tuyenXe?.nhaXe;
    const loaiXe = chuyenXe?.xe?.loaiXe;

    let departureTime: string | null = null;
    let arrivalTime: string | null = null;
    if (chuyenXe?.ngayKhoiHanh && chuyenXe?.gioKhoiHanh) {
      departureTime = combineDeparture(
        chuyenXe.ngayKhoiHanh,
        chuyenXe.gioKhoiHanh,
        this.businessTimeZone,
      ).toISOString();

      if (chuyenXe?.gioDen) {
        arrivalTime = combineArrival(
          chuyenXe.ngayKhoiHanh,
          chuyenXe.gioKhoiHanh,
          chuyenXe.gioDen,
          this.businessTimeZone,
        );
      }
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
      arrivalTime,
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
