import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  businessDateStartUtc,
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';
import type { TripQueryDto, TripSortField } from './dto/trip-query.dto.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
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
  tuNgay: Date;
  denNgay: Date | null;
};

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
    departureTime: combineDeparture(
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
      ({ trangThai }) => trangThai === 'TRONG',
    ).length,
  };
}

function formatTripDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTripTime(d: Date): string {
  return d.toISOString().slice(11, 19);
}

function mapTripItem(trip: {
  chuyenXeId: number;
  maChuyenXe: string;
  ngayKhoiHanh: Date;
  gioKhoiHanh: Date;
  trangThai: string;
  createdAt: Date;
  updatedAt: Date;
  tuyenXe: {
    tuyenXeId: number;
    maTuyenXe: string;
    diemDi: string;
    diemDen: string;
  };
  xe: {
    xeId: number;
    bienSoXe: string;
    trangThai: string;
    loaiXe: {
      loaiXeId: number;
      tenLoai: string;
    };
  };
}) {
  return {
    tripId: trip.chuyenXeId,
    code: trip.maChuyenXe,
    departureDate: formatTripDate(trip.ngayKhoiHanh),
    departureTime: formatTripTime(trip.gioKhoiHanh),
    status: trip.trangThai,
    route: {
      routeId: trip.tuyenXe.tuyenXeId,
      code: trip.tuyenXe.maTuyenXe,
      origin: trip.tuyenXe.diemDi,
      destination: trip.tuyenXe.diemDen,
    },
    vehicle: {
      vehicleId: trip.xe.xeId,
      licensePlate: trip.xe.bienSoXe,
      status: trip.xe.trangThai,
      vehicleType: {
        vehicleTypeId: trip.xe.loaiXe.loaiXeId,
        name: trip.xe.loaiXe.tenLoai,
      },
    },
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
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
        combineDeparture(
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
      .map((trip) => mapTrip(trip, businessTimeZone, findFare(trip, prices)))
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

    const departureAt = combineDeparture(
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

    return mapTrip(cx, businessTimeZone, bangGia ?? undefined);
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
      tripSeatId: gx.gheChuyenXeId,
      seatNumber: gx.ghe.soGhe,
      position: gx.ghe.viTri,
      status: gx.trangThai,
    }));
  }

  async findAll(query: TripQueryDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    const where: Prisma.ChuyenXeWhereInput = {
      nhaXeId,
    };

    if (query.status) {
      where.trangThai = query.status;
    }

    if (query.routeId) {
      where.tuyenXeId = query.routeId;
    }

    if (query.vehicleId) {
      where.xeId = query.vehicleId;
    }

    if (query.departureDate) {
      where.ngayKhoiHanh = new Date(`${query.departureDate}T00:00:00.000Z`);
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { maChuyenXe: { contains: term } },
        { tuyenXe: { is: { maTuyenXe: { contains: term } } } },
        { tuyenXe: { is: { diemDi: { contains: term } } } },
        { tuyenXe: { is: { diemDen: { contains: term } } } },
        { xe: { is: { bienSoXe: { contains: term } } } },
      ];
    }

    const direction = query.sortDirection ?? 'asc';
    const sortFieldMap: Record<
      TripSortField,
      Prisma.ChuyenXeOrderByWithRelationInput
    > = {
      code: { maChuyenXe: direction },
      departureDate: { ngayKhoiHanh: direction },
      departureTime: { gioKhoiHanh: direction },
      status: { trangThai: direction },
      createdAt: { createdAt: direction },
      updatedAt: { updatedAt: direction },
    };

    const sortBy = query.sortBy ?? 'departureDate';
    const orderBy: Prisma.ChuyenXeOrderByWithRelationInput[] = [
      sortFieldMap[sortBy],
      { chuyenXeId: 'asc' },
    ];

    const [trips, totalItems] = await Promise.all([
      this.prisma.chuyenXe.findMany({
        where,
        include: {
          tuyenXe: true,
          xe: { include: { loaiXe: true } },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.chuyenXe.count({ where }),
    ]);

    return {
      data: trips.map(mapTripItem),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async findOne(id: number, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    const trip = await this.prisma.chuyenXe.findFirst({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const total = trip.gheChuyenXes.length;
    const available = trip.gheChuyenXes.filter(
      (g) => g.trangThai === 'TRONG',
    ).length;
    const held = trip.gheChuyenXes.filter(
      (g) => g.trangThai === 'DANG_GIU',
    ).length;
    const booked = trip.gheChuyenXes.filter(
      (g) => g.trangThai === 'DA_DAT',
    ).length;

    return {
      data: {
        ...mapTripItem(trip),
        seatSummary: {
          total,
          available,
          held,
          booked,
        },
      },
    };
  }
}
