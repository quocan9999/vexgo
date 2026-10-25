import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import type {
  VehicleQueryDto,
  VehicleSortField,
} from './dto/vehicle-query.dto.js';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import type { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto.js';
import type { CreateVehicleSeatDto } from './dto/create-vehicle-seat.dto.js';
import type { UpdateVehicleSeatDto } from './dto/update-vehicle-seat.dto.js';
import type { UpdateVehicleSeatLayoutDto } from './dto/vehicle-seat-layout.dto.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  assertTenantScope,
  requireTenantPrincipal,
} from '../auth/tenant-scope.js';

const VEHICLE_LIST_SELECT = {
  xeId: true,
  bienSoXe: true,
  trangThai: true,
  nhaXe: {
    select: { nhaXeId: true, maNhaXe: true, tenNhaXe: true },
  },
  loaiXe: {
    select: { loaiXeId: true, tenLoai: true },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.XeSelect;

const VEHICLE_DETAIL_SELECT = {
  ...VEHICLE_LIST_SELECT,
  loaiXe: {
    select: { loaiXeId: true, tenLoai: true, moTa: true },
  },
} satisfies Prisma.XeSelect;

const sortFieldMap = {
  licensePlate: 'bienSoXe',
  status: 'trangThai',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} satisfies Record<VehicleSortField, keyof Prisma.XeOrderByWithRelationInput>;

type VehicleListRecord = Prisma.XeGetPayload<{
  select: typeof VEHICLE_LIST_SELECT;
}>;

type VehicleDetailRecord = Prisma.XeGetPayload<{
  select: typeof VEHICLE_DETAIL_SELECT;
}>;

function mapVehicleListItem(vehicle: VehicleListRecord) {
  return {
    vehicleId: vehicle.xeId,
    licensePlate: vehicle.bienSoXe,
    status: vehicle.trangThai,
    busCompany: {
      busCompanyId: vehicle.nhaXe.nhaXeId,
      code: vehicle.nhaXe.maNhaXe,
      name: vehicle.nhaXe.tenNhaXe,
    },
    vehicleType: {
      vehicleTypeId: vehicle.loaiXe.loaiXeId,
      name: vehicle.loaiXe.tenLoai,
    },
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

function mapVehicleDetail(vehicle: VehicleDetailRecord) {
  return {
    ...mapVehicleListItem(vehicle),
    vehicleType: {
      vehicleTypeId: vehicle.loaiXe.loaiXeId,
      name: vehicle.loaiXe.tenLoai,
      description: vehicle.loaiXe.moTa,
    },
  };
}

function vehicleNotFound() {
  return new NotFoundException({
    error: 'VEHICLE_NOT_FOUND',
    message: 'Không tìm thấy xe.',
  });
}

function vehicleHasTripsConflict() {
  return new ConflictException({
    error: 'VEHICLE_HAS_TRIPS',
    message:
      'Không thể xóa xe đã được dùng để tạo chuyến. Hãy chuyển xe sang bảo trì để giữ lịch sử.',
  });
}

function isVehicleLicensePlateUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const target = error.meta?.target;
  const isLicensePlateTarget = (value: unknown) =>
    value === 'bienSoXe' || value === 'Xe_bienSoXe_key';

  if (
    Array.isArray(target)
      ? target.length === 1 && isLicensePlateTarget(target[0])
      : isLicensePlateTarget(target)
  ) {
    return true;
  }

  const adapterError = error.meta?.driverAdapterError;
  if (
    typeof adapterError !== 'object' ||
    adapterError === null ||
    !('cause' in adapterError)
  ) {
    return false;
  }

  const cause = adapterError.cause;
  if (
    typeof cause !== 'object' ||
    cause === null ||
    !('kind' in cause) ||
    cause.kind !== 'UniqueConstraintViolation' ||
    !('constraint' in cause)
  ) {
    return false;
  }

  const constraint = cause.constraint;
  return (
    typeof constraint === 'object' &&
    constraint !== null &&
    'index' in constraint &&
    constraint.index === 'Xe_bienSoXe_key'
  );
}

function isMissingRecord(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: VehicleQueryDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    if (query.busCompanyId !== undefined) {
      assertTenantScope(query.busCompanyId, nhaXeId);
    }
    const where: Prisma.XeWhereInput = { nhaXeId };
    const search = query.search?.trim();

    if (search) {
      where.OR = [
        { bienSoXe: { contains: search } },
        {
          nhaXe: {
            is: {
              OR: [
                { maNhaXe: { contains: search } },
                { tenNhaXe: { contains: search } },
              ],
            },
          },
        },
        { loaiXe: { is: { tenLoai: { contains: search } } } },
      ];
    }

    if (query.status) where.trangThai = query.status;
    if (query.vehicleTypeId !== undefined) where.loaiXeId = query.vehicleTypeId;

    const orderBy: Prisma.XeOrderByWithRelationInput = {
      [sortFieldMap[query.sortBy]]: query.sortDirection ?? 'asc',
    };
    const skip = (query.page - 1) * query.pageSize;

    const [vehicles, totalItems] = await Promise.all([
      this.prisma.xe.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
        select: VEHICLE_LIST_SELECT,
      }),
      this.prisma.xe.count({ where }),
    ]);

    return {
      data: vehicles.map(mapVehicleListItem),
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
    const vehicle = await this.prisma.xe.findFirst({
      where: { xeId: id, nhaXeId },
      select: VEHICLE_DETAIL_SELECT,
    });

    if (!vehicle) {
      throw vehicleNotFound();
    }

    return { data: mapVehicleDetail(vehicle) };
  }

  async create(input: CreateVehicleDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    assertTenantScope(input.busCompanyId, nhaXeId);
    if (input.seats) assertUniqueSeatLayout(input.seats);
    const [busCompany, vehicleType] = await Promise.all([
      this.prisma.nhaXe.findUnique({
        where: { nhaXeId },
        select: { nhaXeId: true },
      }),
      this.prisma.loaiXe.findFirst({
        where: { loaiXeId: input.vehicleTypeId, nhaXeId },
        select: { loaiXeId: true, nhaXeId: true },
      }),
    ]);

    if (!busCompany) {
      throw new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe.',
      });
    }
    if (!vehicleType) {
      throw new NotFoundException({
        error: 'VEHICLE_TYPE_NOT_FOUND',
        message: 'Không tìm thấy loại xe.',
      });
    }
    try {
      const vehicle = await this.prisma.$transaction(async (tx) =>
        tx.xe.create({
          data: {
            bienSoXe: input.licensePlate,
            nhaXeId,
            loaiXeId: input.vehicleTypeId,
            trangThai: input.status,
            ...(input.seats
              ? {
                  ghes: {
                    create: input.seats.map((seat) => ({
                      soGhe: seat.seatNumber,
                      viTri: seat.position?.trim() || null,
                      tang: seat.floor,
                      toaDoX: seat.x,
                      toaDoY: seat.y,
                    })),
                  },
                }
              : {}),
          },
          select: VEHICLE_DETAIL_SELECT,
        }),
      );

      return { data: mapVehicleDetail(vehicle) };
    } catch (error) {
      if (isVehicleLicensePlateUniqueViolation(error)) {
        throw new ConflictException({
          error: 'VEHICLE_LICENSE_PLATE_EXISTS',
          message: 'Biển số xe đã tồn tại.',
        });
      }
      if (isVehicleSeatNumberUniqueViolation(error)) {
        throw vehicleSeatNumberConflict();
      }
      if (isVehicleSeatLayoutUniqueViolation(error)) {
        throw vehicleSeatPositionConflict();
      }
      throw error;
    }
  }

  async update(id: number, input: UpdateVehicleDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    assertTenantScope(input.busCompanyId, nhaXeId);
    const existingVehicle = await this.prisma.xe.findFirst({
      where: { xeId: id, nhaXeId },
      select: { xeId: true },
    });

    if (!existingVehicle) throw vehicleNotFound();

    const [busCompany, vehicleType] = await Promise.all([
      this.prisma.nhaXe.findUnique({
        where: { nhaXeId },
        select: { nhaXeId: true },
      }),
      this.prisma.loaiXe.findFirst({
        where: { loaiXeId: input.vehicleTypeId, nhaXeId },
        select: { loaiXeId: true, nhaXeId: true },
      }),
    ]);

    if (!busCompany) {
      throw new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe.',
      });
    }
    if (!vehicleType) {
      throw new NotFoundException({
        error: 'VEHICLE_TYPE_NOT_FOUND',
        message: 'Không tìm thấy loại xe.',
      });
    }
    try {
      const result = await this.prisma.xe.updateMany({
        where: { xeId: id, nhaXeId },
        data: {
          bienSoXe: input.licensePlate,
          nhaXeId,
          loaiXeId: input.vehicleTypeId,
        },
      });

      if (result.count === 0) throw vehicleNotFound();
      const vehicle = await this.prisma.xe.findFirst({
        where: { xeId: id, nhaXeId },
        select: VEHICLE_DETAIL_SELECT,
      });
      if (!vehicle) throw vehicleNotFound();

      return { data: mapVehicleDetail(vehicle) };
    } catch (error) {
      if (isVehicleLicensePlateUniqueViolation(error)) {
        throw new ConflictException({
          error: 'VEHICLE_LICENSE_PLATE_EXISTS',
          message: 'Biển số xe đã tồn tại.',
        });
      }
      throw error;
    }
  }

  async updateStatus(
    id: number,
    input: UpdateVehicleStatusDto,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    try {
      const result = await this.prisma.xe.updateMany({
        where: { xeId: id, nhaXeId },
        data: { trangThai: input.status },
      });

      if (result.count === 0) throw vehicleNotFound();
      const vehicle = await this.prisma.xe.findFirst({
        where: { xeId: id, nhaXeId },
        select: VEHICLE_DETAIL_SELECT,
      });
      if (!vehicle) throw vehicleNotFound();

      return { data: mapVehicleDetail(vehicle) };
    } catch (error) {
      if (isMissingRecord(error)) throw vehicleNotFound();
      throw error;
    }
  }

  async delete(id: number, principal: AuthPrincipal): Promise<void> {
    const nhaXeId = requireTenantPrincipal(principal);

    try {
      await this.prisma.$transaction(async (tx) => {
        const lockedVehicles = await tx.$queryRaw<Array<{ xeId: number }>>`
          SELECT xeId
          FROM Xe
          WHERE xeId = ${id} AND nhaXeId = ${nhaXeId}
          FOR UPDATE
        `;
        if (lockedVehicles.length === 0) throw vehicleNotFound();

        const existingTrip = await tx.chuyenXe.findFirst({
          where: { xeId: id, nhaXeId },
          select: { chuyenXeId: true },
        });
        if (existingTrip) throw vehicleHasTripsConflict();

        await tx.ghe.deleteMany({ where: { xeId: id } });
        const deletedVehicle = await tx.xe.deleteMany({
          where: { xeId: id, nhaXeId },
        });
        if (deletedVehicle.count === 0) throw vehicleNotFound();
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw vehicleHasTripsConflict();
      throw error;
    }
  }

  async findSeats(vehicleId: number, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    const vehicle = await this.prisma.xe.findFirst({
      where: { xeId: vehicleId, nhaXeId },
      select: { xeId: true },
    });
    if (!vehicle) throw vehicleNotFound();

    const seats = await this.prisma.ghe.findMany({
      where: { xeId: vehicleId },
      orderBy: { soGhe: 'asc' },
      select: VEHICLE_SEAT_SELECT,
    });

    return {
      data: seats.map(mapVehicleSeat),
      meta: { totalItems: seats.length },
    };
  }

  async createSeat(
    vehicleId: number,
    input: CreateVehicleSeatDto,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    try {
      const seat = await this.prisma.$transaction(async (tx) => {
        const lockedVehicles = await tx.$queryRaw<Array<{ xeId: number }>>`
          SELECT xeId
          FROM Xe
          WHERE xeId = ${vehicleId} AND nhaXeId = ${nhaXeId}
          FOR UPDATE
        `;
        if (lockedVehicles.length === 0) throw vehicleNotFound();

        const floor = input.floor ?? 1;
        const existingSeats = await tx.ghe.findMany({
          where: { xeId: vehicleId },
          select: { tang: true, toaDoX: true, toaDoY: true },
        });
        if (existingSeats.length >= 120) throw vehicleSeatLimitConflict();
        if (input.x !== undefined && input.y !== undefined) {
          const existingLayout = existingSeats.flatMap((item) =>
            item.toaDoX === null || item.toaDoY === null
              ? []
              : [{ floor: item.tang, x: item.toaDoX, y: item.toaDoY }],
          );
          assertUniqueSeatLayoutPositions([
            ...existingLayout,
            { floor, x: input.x, y: input.y },
          ]);
        }

        return tx.ghe.create({
          data: {
            xeId: vehicleId,
            soGhe: input.seatNumber,
            viTri: input.position?.trim() || null,
            tang: floor,
            toaDoX: input.x ?? null,
            toaDoY: input.y ?? null,
          },
          select: VEHICLE_SEAT_SELECT,
        });
      });
      return { data: mapVehicleSeat(seat) };
    } catch (error) {
      if (isVehicleSeatNumberUniqueViolation(error)) {
        throw vehicleSeatNumberConflict();
      }
      if (isVehicleSeatLayoutUniqueViolation(error)) {
        throw vehicleSeatPositionConflict();
      }
      throw error;
    }
  }

  async updateSeatLayout(
    vehicleId: number,
    input: UpdateVehicleSeatLayoutDto,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    assertUniqueSeatLayoutPositions(input.seats);
    const submittedIds = input.seats.map((seat) => seat.seatId);
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new ConflictException({
        error: 'VEHICLE_SEAT_LAYOUT_INVALID',
        message: 'Sơ đồ có ghế bị lặp. Hãy tải lại cấu hình ghế.',
      });
    }

    const seats = await this.prisma.$transaction(async (tx) => {
      const lockedVehicles = await tx.$queryRaw<Array<{ xeId: number }>>`
        SELECT xeId
        FROM Xe
        WHERE xeId = ${vehicleId} AND nhaXeId = ${nhaXeId}
        FOR UPDATE
      `;
      if (lockedVehicles.length === 0) throw vehicleNotFound();

      const currentSeats = await tx.ghe.findMany({
        where: { xeId: vehicleId },
        select: { gheId: true },
      });
      const currentIds = new Set(currentSeats.map((seat) => seat.gheId));
      if (
        submittedIds.length !== currentIds.size ||
        submittedIds.some((seatId) => !currentIds.has(seatId))
      ) {
        throw new ConflictException({
          error: 'VEHICLE_SEAT_LAYOUT_STALE',
          message:
            'Danh sách ghế đã thay đổi. Hãy tải lại sơ đồ trước khi lưu.',
        });
      }

      await tx.ghe.updateMany({
        where: { xeId: vehicleId },
        data: { toaDoX: null, toaDoY: null },
      });
      for (const seat of input.seats) {
        await tx.ghe.update({
          where: { gheId: seat.seatId, xeId: vehicleId },
          data: { tang: seat.floor, toaDoX: seat.x, toaDoY: seat.y },
        });
      }

      return tx.ghe.findMany({
        where: { xeId: vehicleId },
        orderBy: { soGhe: 'asc' },
        select: VEHICLE_SEAT_SELECT,
      });
    });

    return {
      data: seats.map(mapVehicleSeat),
      meta: { totalItems: seats.length },
    };
  }

  async deleteSeatFloor(
    vehicleId: number,
    floor: number,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    if (floor !== 2) {
      throw new ConflictException({
        error: 'VEHICLE_FLOOR_CANNOT_BE_DELETED',
        message: 'Chỉ có thể xóa tầng trên khỏi sơ đồ xe.',
      });
    }

    try {
      const deletedSeats = await this.prisma.$transaction(async (tx) => {
        const lockedVehicles = await tx.$queryRaw<Array<{ xeId: number }>>`
          SELECT xeId
          FROM Xe
          WHERE xeId = ${vehicleId} AND nhaXeId = ${nhaXeId}
          FOR UPDATE
        `;
        if (lockedVehicles.length === 0) throw vehicleNotFound();

        const floorSeats = await tx.ghe.findMany({
          where: { xeId: vehicleId, tang: floor },
          select: { gheId: true },
        });
        if (floorSeats.length === 0) return 0;

        const seatIds = floorSeats.map((seat) => seat.gheId);
        const tripSeatCount = await tx.gheChuyenXe.count({
          where: { gheId: { in: seatIds } },
        });
        if (tripSeatCount > 0) throw vehicleSeatInUse();

        const result = await tx.ghe.deleteMany({
          where: { xeId: vehicleId, gheId: { in: seatIds } },
        });
        return result.count;
      });
      return { data: { floor, deletedSeats } };
    } catch (error) {
      if (isForeignKeyViolation(error)) throw vehicleSeatInUse();
      throw error;
    }
  }

  private async requireVehicleSeat(vehicleId: number, seatId: number) {
    const seat = await this.prisma.ghe.findFirst({
      where: { gheId: seatId, xeId: vehicleId },
      select: { gheId: true },
    });
    if (!seat) throw vehicleSeatNotFound();
    return seat;
  }

  private async requireUnusedVehicleSeat(seatId: number) {
    const tripSeatCount = await this.prisma.gheChuyenXe.count({
      where: { gheId: seatId },
    });
    if (tripSeatCount > 0) throw vehicleSeatInUse();
  }

  async updateSeat(
    vehicleId: number,
    seatId: number,
    input: UpdateVehicleSeatDto,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    const vehicle = await this.prisma.xe.findFirst({
      where: { xeId: vehicleId, nhaXeId },
      select: { xeId: true },
    });
    if (!vehicle) throw vehicleNotFound();

    await this.requireVehicleSeat(vehicleId, seatId);
    await this.requireUnusedVehicleSeat(seatId);

    if (
      input.floor !== undefined &&
      input.x !== undefined &&
      input.y !== undefined
    ) {
      const otherSeats = await this.prisma.ghe.findMany({
        where: { xeId: vehicleId, gheId: { not: seatId } },
        select: { tang: true, toaDoX: true, toaDoY: true },
      });
      const existingLayout = otherSeats.flatMap((item) =>
        item.toaDoX === null || item.toaDoY === null
          ? []
          : [{ floor: item.tang, x: item.toaDoX, y: item.toaDoY }],
      );
      assertUniqueSeatLayoutPositions([
        ...existingLayout,
        { floor: input.floor, x: input.x, y: input.y },
      ]);
    }

    try {
      const seat = await this.prisma.ghe.update({
        where: {
          gheId: seatId,
          xeId: vehicleId,
          gheChuyenXes: { none: {} },
        },
        data: {
          soGhe: input.seatNumber,
          viTri: input.position?.trim() || null,
          ...(input.floor !== undefined ? { tang: input.floor } : {}),
          ...(input.x !== undefined ? { toaDoX: input.x } : {}),
          ...(input.y !== undefined ? { toaDoY: input.y } : {}),
        },
        select: VEHICLE_SEAT_SELECT,
      });
      return { data: mapVehicleSeat(seat) };
    } catch (error) {
      if (isVehicleSeatNumberUniqueViolation(error)) {
        throw vehicleSeatNumberConflict();
      }
      if (isVehicleSeatLayoutUniqueViolation(error)) {
        throw vehicleSeatPositionConflict();
      }
      if (isMissingRecord(error)) {
        const stillOwned = await this.prisma.ghe.findFirst({
          where: { gheId: seatId, xeId: vehicleId },
          select: { gheId: true },
        });
        if (!stillOwned) throw vehicleSeatNotFound();
        throw vehicleSeatInUse();
      }
      throw error;
    }
  }

  async deleteSeat(
    vehicleId: number,
    seatId: number,
    principal: AuthPrincipal,
  ): Promise<void> {
    const nhaXeId = requireTenantPrincipal(principal);
    try {
      await this.prisma.$transaction(async (tx) => {
        const lockedVehicles = await tx.$queryRaw<Array<{ xeId: number }>>`
          SELECT xeId
          FROM Xe
          WHERE xeId = ${vehicleId} AND nhaXeId = ${nhaXeId}
          FOR UPDATE
        `;
        if (lockedVehicles.length === 0) throw vehicleNotFound();

        const targetSeat = await tx.ghe.findFirst({
          where: { gheId: seatId, xeId: vehicleId },
          select: { gheId: true, soGhe: true, tang: true },
        });
        if (!targetSeat) throw vehicleSeatNotFound();

        const targetTripSeatCount = await tx.gheChuyenXe.count({
          where: { gheId: seatId },
        });
        if (targetTripSeatCount > 0) throw vehicleSeatInUse();

        const labelMatch = targetSeat.soGhe.match(/^([a-z]+)(\d+)$/i);
        const seatsToRename: Array<{ gheId: number; soGhe: string }> = [];
        if (labelMatch) {
          const [, prefix, targetSuffix] = labelMatch;
          const targetNumber = Number(targetSuffix);
          const sameSeries = await tx.ghe.findMany({
            where: {
              xeId: vehicleId,
              tang: targetSeat.tang,
              soGhe: { startsWith: prefix },
            },
            select: { gheId: true, soGhe: true },
          });
          const numberedSeats = sameSeries
            .flatMap((seat) => {
              const match = seat.soGhe.match(/^([a-z]+)(\d+)$/i);
              if (
                !match ||
                match[1].toLocaleUpperCase('vi-VN') !==
                  prefix.toLocaleUpperCase('vi-VN')
              ) {
                return [];
              }
              return [
                {
                  ...seat,
                  numericSuffix: Number(match[2]),
                  suffixWidth: match[2].length,
                },
              ];
            })
            .sort((left, right) => left.numericSuffix - right.numericSuffix);
          for (const seat of numberedSeats) {
            if (seat.gheId === seatId || seat.numericSuffix <= targetNumber) {
              continue;
            }
            const nextNumber = `${prefix}${String(
              seat.numericSuffix - 1,
            ).padStart(seat.suffixWidth, '0')}`;
            if (seat.soGhe !== nextNumber) {
              seatsToRename.push({ gheId: seat.gheId, soGhe: nextNumber });
            }
          }
        }

        if (seatsToRename.length > 0) {
          const referencedSeats = await tx.gheChuyenXe.count({
            where: { gheId: { in: seatsToRename.map((seat) => seat.gheId) } },
          });
          if (referencedSeats > 0) throw vehicleSeatRenumberConflict();
        }

        await tx.ghe.delete({
          where: { gheId: seatId, xeId: vehicleId },
          select: { gheId: true },
        });
        for (const seat of seatsToRename) {
          await tx.ghe.update({
            where: { gheId: seat.gheId },
            data: { soGhe: seat.soGhe },
          });
        }
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw vehicleSeatInUse();
      if (isMissingRecord(error)) throw vehicleSeatNotFound();
      throw error;
    }
  }
}

const VEHICLE_SEAT_SELECT = {
  gheId: true,
  soGhe: true,
  viTri: true,
  xeId: true,
  tang: true,
  toaDoX: true,
  toaDoY: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GheSelect;

type VehicleSeatRecord = Prisma.GheGetPayload<{
  select: typeof VEHICLE_SEAT_SELECT;
}>;

function mapVehicleSeat(seat: VehicleSeatRecord) {
  return {
    seatId: seat.gheId,
    seatNumber: seat.soGhe,
    position: seat.viTri,
    vehicleId: seat.xeId,
    floor: seat.tang,
    x: seat.toaDoX,
    y: seat.toaDoY,
    createdAt: seat.createdAt.toISOString(),
    updatedAt: seat.updatedAt.toISOString(),
  };
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  );
}

function isVehicleSeatNumberUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const target = error.meta?.target;
  const isSeatTarget = (value: unknown) =>
    value === 'Ghe_index_1' || value === 'xeId_soGhe';
  if (
    Array.isArray(target)
      ? target.length === 2 &&
        target.includes('xeId') &&
        target.includes('soGhe')
      : isSeatTarget(target)
  ) {
    return true;
  }

  const adapterError = error.meta?.driverAdapterError;
  if (
    typeof adapterError !== 'object' ||
    adapterError === null ||
    !('cause' in adapterError)
  ) {
    return false;
  }

  const cause = adapterError.cause;
  if (
    typeof cause !== 'object' ||
    cause === null ||
    !('kind' in cause) ||
    cause.kind !== 'UniqueConstraintViolation' ||
    !('constraint' in cause)
  ) {
    return false;
  }

  const constraint = cause.constraint;
  return (
    typeof constraint === 'object' &&
    constraint !== null &&
    'index' in constraint &&
    constraint.index === 'Ghe_index_1'
  );
}

function isVehicleSeatLayoutUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const target = error.meta?.target;
  if (
    target === 'Ghe_xeId_tang_toaDoX_toaDoY_key' ||
    target === 'xeId_tang_toaDoX_toaDoY'
  ) {
    return true;
  }
  if (
    Array.isArray(target) &&
    ['xeId', 'tang', 'toaDoX', 'toaDoY'].every((field) =>
      target.includes(field),
    )
  ) {
    return true;
  }

  const adapterError = error.meta?.driverAdapterError;
  if (
    typeof adapterError !== 'object' ||
    adapterError === null ||
    !('cause' in adapterError)
  ) {
    return false;
  }
  const cause = adapterError.cause;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'kind' in cause &&
    cause.kind === 'UniqueConstraintViolation' &&
    'constraint' in cause &&
    typeof cause.constraint === 'object' &&
    cause.constraint !== null &&
    'index' in cause.constraint &&
    cause.constraint.index === 'Ghe_xeId_tang_toaDoX_toaDoY_key'
  );
}

function assertUniqueSeatLayout(
  seats: readonly { seatNumber: string; floor: number; x: number; y: number }[],
) {
  const seatNumbers = new Set<string>();
  for (const seat of seats) {
    const seatNumber = seat.seatNumber.trim().toLocaleUpperCase('vi-VN');
    if (seatNumbers.has(seatNumber)) throw vehicleSeatNumberConflict();
    seatNumbers.add(seatNumber);
  }
  assertUniqueSeatLayoutPositions(seats);
}

function assertUniqueSeatLayoutPositions(
  seats: readonly { floor: number; x: number; y: number }[],
) {
  for (const [index, seat] of seats.entries()) {
    for (const other of seats.slice(0, index)) {
      if (
        seat.floor === other.floor &&
        Math.abs(seat.x - other.x) < 180 &&
        Math.abs(seat.y - other.y) < 875
      ) {
        throw vehicleSeatPositionConflict();
      }
    }
  }
}

function vehicleSeatNumberConflict() {
  return new ConflictException({
    error: 'VEHICLE_SEAT_NUMBER_EXISTS',
    message: 'Số ghế đã tồn tại trên xe này.',
  });
}

function vehicleSeatPositionConflict() {
  return new ConflictException({
    error: 'VEHICLE_SEAT_POSITION_OCCUPIED',
    message: 'Vị trí ghế bị trùng. Hãy điều chỉnh sơ đồ trước khi lưu.',
  });
}

function vehicleSeatLimitConflict() {
  return new ConflictException({
    error: 'VEHICLE_SEAT_LIMIT_REACHED',
    message: 'Sơ đồ xe không thể có quá 120 ghế.',
  });
}

function vehicleSeatNotFound() {
  return new NotFoundException({
    error: 'VEHICLE_SEAT_NOT_FOUND',
    message: 'Không tìm thấy ghế của xe.',
  });
}

function vehicleSeatInUse() {
  return new ConflictException({
    error: 'VEHICLE_SEAT_IN_USE',
    message: 'Ghế đã được sử dụng trong chuyến xe và không thể thay đổi.',
  });
}

function vehicleSeatRenumberConflict() {
  return new ConflictException({
    error: 'VEHICLE_SEAT_RENUMBER_CONFLICT',
    message:
      'Không thể đánh lại số ghế vì các ghế phía sau đã được dùng trong chuyến xe.',
  });
}
