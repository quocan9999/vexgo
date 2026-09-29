import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';
import { Prisma } from '../generated/prisma/client.js';

const TRIP_INCLUDE = {
  tuyenXe: { include: { nhaXe: true } },
  xe: { include: { loaiXe: true } },
  gheChuyenXes: { select: { trangThai: true } },
} satisfies Prisma.ChuyenXeInclude;

type TripRecord = Prisma.ChuyenXeGetPayload<{ include: typeof TRIP_INCLUDE }>;

type FareRecord = {
  bangGiaId: number;
  nhaXeId: number;
  tuyenXeId: number;
  loaiXeId: number;
  giaNiemYet: Prisma.Decimal | number;
};

function combineDeparture(date: Date, time: Date): Date {
  const departure = new Date(date);
  departure.setUTCHours(
    time.getUTCHours(),
    time.getUTCMinutes(),
    time.getUTCSeconds(),
    0,
  );
  return departure;
}

function findFare(
  trip: TripRecord,
  fares: FareRecord[],
): FareRecord | undefined {
  return fares.find(
    (fare) =>
      fare.nhaXeId === trip.nhaXeId &&
      fare.tuyenXeId === trip.tuyenXeId &&
      fare.loaiXeId === trip.xe.loaiXeId,
  );
}

function mapTrip(trip: TripRecord, fare?: FareRecord) {
  return {
    id: trip.chuyenXeId,
    code: trip.maChuyenXe,
    status: trip.trangThai,
    busCompany: {
      id: trip.tuyenXe.nhaXe.nhaXeId,
      name: trip.tuyenXe.nhaXe.tenNhaXe,
      logo: null,
      rating: null,
      reviewsCount: null,
    },
    route: {
      id: trip.tuyenXe.tuyenXeId,
      code: trip.tuyenXe.maTuyenXe,
      origin: trip.tuyenXe.diemDi,
      destination: trip.tuyenXe.diemDen,
      distance: null,
      durationMinutes: null,
    },
    departureTime: combineDeparture(
      trip.ngayKhoiHanh,
      trip.gioKhoiHanh,
    ).toISOString(),
    arrivalTime: null,
    vehicle: {
      id: trip.xe.xeId,
      typeId: trip.xe.loaiXeId,
      type: trip.xe.loaiXe.tenLoai,
      licensePlate: trip.xe.bienSoXe,
      capacity: trip.gheChuyenXes.length,
      amenities: [],
    },
    price: fare ? Number(fare.giaNiemYet) : null,
    availableSeats: trip.gheChuyenXes.filter(
      ({ trangThai }) => trangThai === 'TRONG',
    ).length,
  };
}

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchTripsDto) {
    const where: Prisma.ChuyenXeWhereInput = {
      trangThai: 'MO_BAN',
    };

    if (dto.from || dto.to || dto.busCompanyId) {
      where.tuyenXe = {};
      if (dto.from) {
        where.tuyenXe.diemDi = { contains: dto.from };
      }
      if (dto.to) {
        where.tuyenXe.diemDen = { contains: dto.to };
      }
      if (dto.busCompanyId) {
        where.tuyenXe.nhaXeId = dto.busCompanyId;
      }
    }

    if (dto.vehicleTypeId) {
      where.xe = { loaiXeId: dto.vehicleTypeId };
    }

    if (dto.departureDate) {
      where.ngayKhoiHanh = new Date(`${dto.departureDate}T00:00:00.000Z`);
    }

    const chuyenXes = await this.prisma.chuyenXe.findMany({
      where,
      include: TRIP_INCLUDE,
    });

    const fareDate = dto.departureDate
      ? new Date(`${dto.departureDate}T00:00:00.000Z`)
      : new Date();
    const prices = await this.prisma.bangGia.findMany({
      where: {
        trangThai: 'HOAT_DONG',
        tuNgay: { lte: fareDate },
        OR: [{ denNgay: null }, { denNgay: { gte: fareDate } }],
      },
      select: {
        bangGiaId: true,
        nhaXeId: true,
        tuyenXeId: true,
        loaiXeId: true,
        giaNiemYet: true,
      },
    });

    const direction = dto.sortDirection === 'desc' ? -1 : 1;
    const mapped = chuyenXes
      .map((trip) => mapTrip(trip, findFare(trip, prices)))
      .filter(
        (trip) =>
          dto.minPrice === undefined ||
          (trip.price !== null && trip.price >= dto.minPrice),
      )
      .filter(
        (trip) =>
          dto.maxPrice === undefined ||
          (trip.price !== null && trip.price <= dto.maxPrice),
      )
      .sort((left, right) => {
        if (dto.sortBy === 'price') {
          if (left.price === null) return 1;
          if (right.price === null) return -1;
          return (left.price - right.price) * direction;
        }
        if (dto.sortBy === 'availableSeats') {
          return (left.availableSeats - right.availableSeats) * direction;
        }
        return (
          left.departureTime.localeCompare(right.departureTime) * direction
        );
      });

    const totalItems = mapped.length;
    const start = (dto.page - 1) * dto.pageSize;
    return {
      data: mapped.slice(start, start + dto.pageSize),
      meta: {
        page: dto.page,
        pageSize: dto.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / dto.pageSize),
      },
    };
  }

  async getDetails(id: number) {
    const cx = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: id },
      include: TRIP_INCLUDE,
    });

    if (!cx) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const bangGia = await this.prisma.bangGia.findFirst({
      where: {
        trangThai: 'HOAT_DONG',
        nhaXeId: cx.nhaXeId,
        tuyenXeId: cx.tuyenXeId,
        loaiXeId: cx.xe.loaiXeId,
        tuNgay: { lte: cx.ngayKhoiHanh },
        OR: [{ denNgay: null }, { denNgay: { gte: cx.ngayKhoiHanh } }],
      },
    });

    return mapTrip(cx, bangGia ?? undefined);
  }

  async getSeats(id: number) {
    const gheChuyenXes = await this.prisma.gheChuyenXe.findMany({
      where: { chuyenXeId: id },
      include: { ghe: true },
      orderBy: { ghe: { soGhe: 'asc' } },
    });

    if (gheChuyenXes.length === 0) {
      throw new NotFoundException({
        error: 'TRIP_SEATS_NOT_FOUND',
        message: 'Không tìm thấy sơ đồ ghế cho chuyến xe này.',
      });
    }

    return gheChuyenXes.map((gx) => ({
      gheChuyenXeId: gx.gheChuyenXeId,
      soGhe: gx.ghe.soGhe,
      viTri: gx.ghe.viTri,
      trangThai: gx.trangThai,
    }));
  }
}
