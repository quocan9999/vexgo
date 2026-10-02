import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  businessDateStartUtc,
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';
import type { TripQueryDto, TripSortField } from './dto/trip-query.dto.js';
import { UpdateTripDto } from './dto/update-trip.dto.js';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto.js';
import { TripSeatsQueryDto } from './dto/trip-seats-query.dto.js';
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

  async getCustomerSeats(id: number) {
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: id },
      select: { chuyenXeId: true, trangThai: true },
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

  async getSeats(
    id: number,
    query: TripSeatsQueryDto,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);

    const trip = await this.prisma.chuyenXe.findFirst({
      where: {
        chuyenXeId: id,
        nhaXeId,
      },
      select: {
        chuyenXeId: true,
      },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const allSeats = await this.prisma.gheChuyenXe.findMany({
      where: { chuyenXeId: id },
      include: {
        ghe: {
          select: {
            gheId: true,
            soGhe: true,
            viTri: true,
          },
        },
      },
    });

    allSeats.sort((a, b) => {
      const codeCompare = a.ghe.soGhe.localeCompare(b.ghe.soGhe, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (codeCompare !== 0) return codeCompare;
      return a.gheId - b.gheId;
    });

    const total = allSeats.length;
    let available = 0;
    let held = 0;
    let booked = 0;

    for (const seat of allSeats) {
      if (seat.trangThai === 'TRONG') available++;
      else if (seat.trangThai === 'DANG_GIU') held++;
      else if (seat.trangThai === 'DA_DAT') booked++;
    }

    const filtered = query.status
      ? allSeats.filter((seat) => seat.trangThai === query.status)
      : allSeats;

    const data = filtered.map((item) => ({
      tripSeatId: item.gheChuyenXeId,
      status: item.trangThai,
      seat: {
        seatId: item.ghe.gheId,
        code: item.ghe.soGhe,
        position: item.ghe.viTri,
      },
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return {
      data,
      meta: {
        tripId: id,
        total,
        available,
        held,
        booked,
      },
    };
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

  async create(dto: CreateTripDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);

    const route = await this.prisma.tuyenXe.findFirst({
      where: { tuyenXeId: dto.routeId, nhaXeId },
    });
    if (!route) {
      throw new NotFoundException({
        error: 'ROUTE_NOT_FOUND',
        message: 'Không tìm thấy tuyến xe trong nhà xe.',
      });
    }

    if (route.trangThai !== 'HOAT_DONG') {
      throw new ConflictException({
        error: 'ROUTE_NOT_ACTIVE',
        message: 'Tuyến xe đang tạm ngưng hoạt động, không thể lập chuyến.',
      });
    }

    const vehicle = await this.prisma.xe.findFirst({
      where: { xeId: dto.vehicleId, nhaXeId },
      include: { ghes: true },
    });
    if (!vehicle) {
      throw new NotFoundException({
        error: 'VEHICLE_NOT_FOUND',
        message: 'Không tìm thấy xe trong nhà xe.',
      });
    }

    if (vehicle.trangThai !== 'HOAT_DONG') {
      throw new ConflictException({
        error: 'VEHICLE_NOT_ACTIVE',
        message: 'Xe đang không hoạt động, không thể phân công vào chuyến.',
      });
    }

    if (vehicle.ghes.length === 0) {
      throw new ConflictException({
        error: 'VEHICLE_HAS_NO_SEATS',
        message: 'Xe chưa được cấu hình ghế nên chưa thể lập chuyến.',
      });
    }

    const departureDate = new Date(`${dto.departureDate}T00:00:00.000Z`);
    const departureTime = new Date(`1970-01-01T${dto.departureTime}.000Z`);

    const existingCode = await this.prisma.chuyenXe.findFirst({
      where: { maChuyenXe: dto.code },
    });
    if (existingCode) {
      throw new ConflictException({
        error: 'TRIP_CODE_EXISTS',
        message: 'Mã chuyến xe đã tồn tại.',
      });
    }

    try {
      const trip = await this.prisma.$transaction(async (tx) => {
        const scheduleConflict = await tx.chuyenXe.findFirst({
          where: {
            xeId: dto.vehicleId,
            ngayKhoiHanh: departureDate,
            gioKhoiHanh: departureTime,
            trangThai: { not: 'DA_HUY' },
          },
          select: { chuyenXeId: true },
        });
        if (scheduleConflict) {
          throw new ConflictException({
            error: 'TRIP_VEHICLE_SCHEDULE_CONFLICT',
            message:
              'Xe đã được phân công cho một chuyến xe khác trong cùng khung giờ.',
          });
        }

        return tx.chuyenXe.create({
          data: {
            maChuyenXe: dto.code,
            ngayKhoiHanh: departureDate,
            gioKhoiHanh: departureTime,
            trangThai: 'CHUA_KHOI_HANH',
            nhaXeId,
            tuyenXeId: dto.routeId,
            xeId: dto.vehicleId,
            gheChuyenXes: {
              create: vehicle.ghes.map((ghe) => ({
                gheId: ghe.gheId,
                trangThai: 'TRONG',
              })),
            },
          },
          include: {
            tuyenXe: true,
            xe: { include: { loaiXe: true } },
            gheChuyenXes: { select: { trangThai: true } },
          },
        });
      });

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
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          error: 'TRIP_CODE_EXISTS',
          message: 'Mã chuyến xe đã tồn tại.',
        });
      }
      throw err;
    }
  }

  private formatTripWithSummary(trip: {
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
    gheChuyenXes: Array<{ trangThai: string }>;
  }) {
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

  async update(id: number, dto: UpdateTripDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);

    const existing = await this.prisma.chuyenXe.findFirst({
      where: { chuyenXeId: id, nhaXeId },
    });
    if (!existing) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (existing.trangThai !== 'CHUA_KHOI_HANH') {
      throw new ConflictException({
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Chỉ có thể cập nhật chuyến xe khi chưa khởi hành.',
      });
    }

    const departureDate = new Date(`${dto.departureDate}T00:00:00.000Z`);
    const departureTime = new Date(`1970-01-01T${dto.departureTime}.000Z`);

    const trip = await this.prisma.$transaction(async (tx) => {
      const scheduleConflict = await tx.chuyenXe.findFirst({
        where: {
          xeId: existing.xeId,
          ngayKhoiHanh: departureDate,
          gioKhoiHanh: departureTime,
          trangThai: { not: 'DA_HUY' },
          chuyenXeId: { not: id },
        },
        select: { chuyenXeId: true },
      });
      if (scheduleConflict) {
        throw new ConflictException({
          error: 'TRIP_VEHICLE_SCHEDULE_CONFLICT',
          message:
            'Xe đã được phân công cho một chuyến xe khác trong cùng khung giờ.',
        });
      }

      const result = await tx.chuyenXe.updateMany({
        where: {
          chuyenXeId: id,
          nhaXeId,
          trangThai: 'CHUA_KHOI_HANH',
        },
        data: {
          ngayKhoiHanh: departureDate,
          gioKhoiHanh: departureTime,
        },
      });

      if (result.count === 0) {
        const reRead = await tx.chuyenXe.findFirst({
          where: { chuyenXeId: id, nhaXeId },
        });
        if (!reRead) {
          throw new NotFoundException({
            error: 'TRIP_NOT_FOUND',
            message: 'Không tìm thấy chuyến xe.',
          });
        }
        throw new ConflictException({
          error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
          message: 'Chỉ có thể cập nhật chuyến xe khi chưa khởi hành.',
        });
      }

      return tx.chuyenXe.findFirstOrThrow({
        where: { chuyenXeId: id, nhaXeId },
        include: {
          tuyenXe: true,
          xe: { include: { loaiXe: true } },
          gheChuyenXes: { select: { trangThai: true } },
        },
      });
    });

    return this.formatTripWithSummary(trip);
  }

  async updateStatus(
    id: number,
    dto: UpdateTripStatusDto,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);

    const existing = await this.prisma.chuyenXe.findFirst({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (existing.trangThai === dto.status) {
      return this.formatTripWithSummary(existing);
    }

    const isValidTransition =
      (existing.trangThai === 'CHUA_KHOI_HANH' &&
        dto.status === 'DANG_CHAY') ||
      (existing.trangThai === 'DANG_CHAY' && dto.status === 'HOAN_THANH');

    if (!isValidTransition) {
      throw new ConflictException({
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể chuyển chuyến xe sang trạng thái yêu cầu.',
      });
    }

    const result = await this.prisma.chuyenXe.updateMany({
      where: {
        chuyenXeId: id,
        nhaXeId,
        trangThai: existing.trangThai,
      },
      data: {
        trangThai: dto.status,
      },
    });

    if (result.count === 0) {
      const reRead = await this.prisma.chuyenXe.findFirst({
        where: { chuyenXeId: id, nhaXeId },
        include: {
          tuyenXe: true,
          xe: { include: { loaiXe: true } },
          gheChuyenXes: { select: { trangThai: true } },
        },
      });
      if (!reRead) {
        throw new NotFoundException({
          error: 'TRIP_NOT_FOUND',
          message: 'Không tìm thấy chuyến xe.',
        });
      }
      if (reRead.trangThai === dto.status) {
        return this.formatTripWithSummary(reRead);
      }
      throw new ConflictException({
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể chuyển chuyến xe sang trạng thái yêu cầu.',
      });
    }

    const updated = await this.prisma.chuyenXe.findFirstOrThrow({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });

    return this.formatTripWithSummary(updated);
  }

  async cancel(id: number, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);

    const existing = await this.prisma.chuyenXe.findFirst({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (existing.trangThai === 'DA_HUY') {
      return this.formatTripWithSummary(existing);
    }

    if (existing.trangThai !== 'CHUA_KHOI_HANH') {
      throw new ConflictException({
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể hủy chuyến xe đang chạy hoặc đã hoàn thành.',
      });
    }

    const activeBooking = await this.prisma.gheChuyenXe.findFirst({
      where: {
        chuyenXeId: id,
        OR: [
          { trangThai: { in: ['DANG_GIU', 'DA_DAT'] } },
          { ves: { some: { trangThai: { not: 'HUY' } } } },
        ],
      },
      select: { gheChuyenXeId: true },
    });

    if (activeBooking) {
      throw new ConflictException({
        error: 'TRIP_HAS_ACTIVE_BOOKINGS',
        message: 'Không thể hủy chuyến xe đã có vé hoặc đang có khách giữ chỗ.',
      });
    }

    const activeShipment = await this.prisma.phieuGuiHang.findFirst({
      where: {
        chuyenXeId: id,
        trangThai: { notIn: ['DA_GIAO', 'DA_HUY'] },
      },
      select: { phieuGuiHangId: true },
    });

    if (activeShipment) {
      throw new ConflictException({
        error: 'TRIP_HAS_ACTIVE_SHIPMENTS',
        message: 'Không thể hủy chuyến xe đang có vận đơn được điều phối.',
      });
    }

    const result = await this.prisma.chuyenXe.updateMany({
      where: {
        chuyenXeId: id,
        nhaXeId,
        trangThai: 'CHUA_KHOI_HANH',
      },
      data: {
        trangThai: 'DA_HUY',
      },
    });

    if (result.count === 0) {
      const reRead = await this.prisma.chuyenXe.findFirst({
        where: { chuyenXeId: id, nhaXeId },
        include: {
          tuyenXe: true,
          xe: { include: { loaiXe: true } },
          gheChuyenXes: { select: { trangThai: true } },
        },
      });
      if (!reRead) {
        throw new NotFoundException({
          error: 'TRIP_NOT_FOUND',
          message: 'Không tìm thấy chuyến xe.',
        });
      }
      if (reRead.trangThai === 'DA_HUY') {
        return this.formatTripWithSummary(reRead);
      }
      throw new ConflictException({
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể hủy chuyến xe đang chạy hoặc đã hoàn thành.',
      });
    }

    const updated = await this.prisma.chuyenXe.findFirstOrThrow({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });

    return this.formatTripWithSummary(updated);
  }
}
