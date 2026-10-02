import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  combineBusinessDateAndTime,
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';
import { Prisma } from '../generated/prisma/client.js';

const TRIP_INCLUDE = {
  tuyenXe: { include: { nhaXe: true } },
  xe: { include: { loaiXe: true } },
  gheChuyenXes: {
    select: {
      trangThai: true,
      giuChoGhe: {
        select: { giuCho: { select: { hetHanLuc: true } } },
      },
    },
  },
} satisfies Prisma.ChuyenXeInclude;

type TripRecord = Prisma.ChuyenXeGetPayload<{ include: typeof TRIP_INCLUDE }>;

type FareRecord = {
  bangGiaId: number;
  nhaXeId: number;
  tuyenXeId: number;
  loaiXeId: number;
  giaNiemYet: Prisma.Decimal | number;
  tuNgay: Date;
  denNgay: Date | null;
};

function findFare(
  trip: TripRecord,
  fares: FareRecord[],
): FareRecord | undefined {
  return fares.find(
    (fare) =>
      fare.nhaXeId === trip.nhaXeId &&
      fare.tuyenXeId === trip.tuyenXeId &&
      fare.loaiXeId === trip.xe.loaiXeId &&
      fare.tuNgay <= trip.ngayKhoiHanh &&
      (fare.denNgay === null || fare.denNgay >= trip.ngayKhoiHanh),
  );
}

function mapTrip(
  trip: TripRecord,
  businessTimeZone: string,
  fare?: FareRecord,
  now = new Date(),
) {
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
    departureTime: combineBusinessDateAndTime(
      trip.ngayKhoiHanh,
      trip.gioKhoiHanh,
      businessTimeZone,
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
      ({ trangThai, giuChoGhe }) =>
        trangThai === 'TRONG' &&
        (!giuChoGhe || giuChoGhe.giuCho.hetHanLuc <= now),
    ).length,
  };
}

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async search(dto: SearchTripsDto) {
    const businessTimeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const now = new Date();
    const where: Prisma.ChuyenXeWhereInput = {
      trangThai: 'CHUA_KHOI_HANH',
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

    const additionalFilters: Prisma.ChuyenXeWhereInput[] = [];
    if (dto.search) {
      additionalFilters.push({
        OR: [
          { tuyenXe: { diemDi: { contains: dto.search } } },
          { tuyenXe: { diemDen: { contains: dto.search } } },
          { tuyenXe: { nhaXe: { tenNhaXe: { contains: dto.search } } } },
          { xe: { loaiXe: { tenLoai: { contains: dto.search } } } },
        ],
      });
    }
    if (dto.vehicleType) {
      additionalFilters.push({
        xe: { loaiXe: { tenLoai: { contains: dto.vehicleType } } },
      });
    }
    if (additionalFilters.length > 0) where.AND = additionalFilters;

    if (dto.departureDate) {
      where.ngayKhoiHanh = new Date(`${dto.departureDate}T00:00:00.000Z`);
    } else {
      where.ngayKhoiHanh = {
        gte: new Date(
          `${getBusinessDate(businessTimeZone, now)}T00:00:00.000Z`,
        ),
      };
    }

    const queriedTrips = await this.prisma.chuyenXe.findMany({
      where,
      include: TRIP_INCLUDE,
    });
    const chuyenXes = queriedTrips.filter(
      (trip) =>
        combineBusinessDateAndTime(
          trip.ngayKhoiHanh,
          trip.gioKhoiHanh,
          businessTimeZone,
        ) > now,
    );

    const tripDates = chuyenXes.map(({ ngayKhoiHanh }) => ngayKhoiHanh);
    const earliestTripDate = new Date(
      Math.min(...tripDates.map((date) => date.getTime())),
    );
    const latestTripDate = new Date(
      Math.max(...tripDates.map((date) => date.getTime())),
    );
    const prices =
      chuyenXes.length === 0
        ? []
        : await this.prisma.bangGia.findMany({
            where: {
              trangThai: 'HOAT_DONG',
              tuNgay: { lte: latestTripDate },
              OR: [{ denNgay: null }, { denNgay: { gte: earliestTripDate } }],
            },
            select: {
              bangGiaId: true,
              nhaXeId: true,
              tuyenXeId: true,
              loaiXeId: true,
              giaNiemYet: true,
              tuNgay: true,
              denNgay: true,
            },
          });

    const direction = dto.sortDirection === 'desc' ? -1 : 1;
    const mapped = chuyenXes
      .map((trip) =>
        mapTrip(trip, businessTimeZone, findFare(trip, prices), now),
      )
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
    const businessTimeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const now = new Date();

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

    if (cx.trangThai !== 'CHUA_KHOI_HANH') {
      throw new NotFoundException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe này hiện không mở bán.',
      });
    }

    const departureAt = combineBusinessDateAndTime(
      cx.ngayKhoiHanh,
      cx.gioKhoiHanh,
      businessTimeZone,
    );
    if (departureAt <= now) {
      throw new NotFoundException({
        error: 'TRIP_ALREADY_DEPARTED',
        message: 'Chuyến xe này đã khởi hành.',
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

    return mapTrip(cx, businessTimeZone, bangGia ?? undefined, now);
  }

  async getSeats(id: number) {
    const businessTimeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const now = new Date();
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: id },
      select: {
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
      throw new NotFoundException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe này hiện không mở bán.',
      });
    }

    if (
      combineBusinessDateAndTime(
        trip.ngayKhoiHanh,
        trip.gioKhoiHanh,
        businessTimeZone,
      ) <= now
    ) {
      throw new NotFoundException({
        error: 'TRIP_ALREADY_DEPARTED',
        message: 'Chuyến xe này đã khởi hành.',
      });
    }

    const gheChuyenXes = await this.prisma.gheChuyenXe.findMany({
      where: { chuyenXeId: id },
      include: {
        ghe: true,
        giuChoGhe: {
          include: { giuCho: { select: { hetHanLuc: true } } },
        },
      },
      orderBy: { ghe: { soGhe: 'asc' } },
    });

    if (gheChuyenXes.length === 0) {
      throw new NotFoundException({
        error: 'TRIP_SEATS_NOT_FOUND',
        message: 'Không tìm thấy sơ đồ ghế cho chuyến xe này.',
      });
    }

    return gheChuyenXes.map((gx) => ({
      tripSeatId: gx.gheChuyenXeId,
      seatNumber: gx.ghe.soGhe,
      position: gx.ghe.viTri,
      status:
        gx.trangThai === 'TRONG' &&
        gx.giuChoGhe &&
        gx.giuChoGhe.giuCho.hetHanLuc > now
          ? 'DANG_GIU'
          : gx.trangThai,
    }));
  }
}
