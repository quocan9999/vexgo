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

  async findAll(query: VehicleQueryDto) {
    const where: Prisma.XeWhereInput = {};
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
    if (query.busCompanyId !== undefined) where.nhaXeId = query.busCompanyId;
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

  async findOne(id: number) {
    const vehicle = await this.prisma.xe.findUnique({
      where: { xeId: id },
      select: VEHICLE_DETAIL_SELECT,
    });

    if (!vehicle) {
      throw vehicleNotFound();
    }

    return { data: mapVehicleDetail(vehicle) };
  }

  async create(input: CreateVehicleDto) {
    const [busCompany, vehicleType] = await Promise.all([
      this.prisma.nhaXe.findUnique({
        where: { nhaXeId: input.busCompanyId },
        select: { nhaXeId: true },
      }),
      this.prisma.loaiXe.findUnique({
        where: { loaiXeId: input.vehicleTypeId },
        select: { loaiXeId: true },
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
      const vehicle = await this.prisma.xe.create({
        data: {
          bienSoXe: input.licensePlate,
          nhaXeId: input.busCompanyId,
          loaiXeId: input.vehicleTypeId,
          trangThai: input.status,
        },
        select: VEHICLE_DETAIL_SELECT,
      });

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

  async update(id: number, input: UpdateVehicleDto) {
    const existingVehicle = await this.prisma.xe.findUnique({
      where: { xeId: id },
      select: { xeId: true },
    });

    if (!existingVehicle) throw vehicleNotFound();

    const [busCompany, vehicleType] = await Promise.all([
      this.prisma.nhaXe.findUnique({
        where: { nhaXeId: input.busCompanyId },
        select: { nhaXeId: true },
      }),
      this.prisma.loaiXe.findUnique({
        where: { loaiXeId: input.vehicleTypeId },
        select: { loaiXeId: true },
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
      const vehicle = await this.prisma.xe.update({
        where: { xeId: id },
        data: {
          bienSoXe: input.licensePlate,
          nhaXeId: input.busCompanyId,
          loaiXeId: input.vehicleTypeId,
        },
        select: VEHICLE_DETAIL_SELECT,
      });

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

  async updateStatus(id: number, input: UpdateVehicleStatusDto) {
    try {
      const vehicle = await this.prisma.xe.update({
        where: { xeId: id },
        data: { trangThai: input.status },
        select: VEHICLE_DETAIL_SELECT,
      });

      return { data: mapVehicleDetail(vehicle) };
    } catch (error) {
      if (isMissingRecord(error)) throw vehicleNotFound();
      throw error;
    }
  }
}
