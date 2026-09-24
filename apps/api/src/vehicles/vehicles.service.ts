import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import type { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto.js';
import type { VehicleQueryDto } from './dto/vehicle-query.dto.js';
import type { VehicleSortField } from './dto/vehicle-query.dto.js';

const VEHICLE_LIST_SELECT = {
  xeId: true,
  bienSoXe: true,
  trangThai: true,
  createdAt: true,
  updatedAt: true,
  nhaXe: {
    select: { nhaXeId: true, maNhaXe: true, tenNhaXe: true },
  },
  loaiXe: { select: { loaiXeId: true, tenLoai: true } },
} satisfies Prisma.XeSelect;

const VEHICLE_DETAIL_SELECT = {
  ...VEHICLE_LIST_SELECT,
  loaiXe: { select: { loaiXeId: true, tenLoai: true, moTa: true } },
} satisfies Prisma.XeSelect;

type VehicleListRecord = Prisma.XeGetPayload<{
  select: typeof VEHICLE_LIST_SELECT;
}>;

type VehicleDetailRecord = Prisma.XeGetPayload<{
  select: typeof VEHICLE_DETAIL_SELECT;
}>;

const sortFieldMap = {
  licensePlate: 'bienSoXe',
  status: 'trangThai',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} satisfies Record<VehicleSortField, keyof Prisma.XeOrderByWithRelationInput>;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVehicleLicensePlateUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const meta = error.meta;
  if (!meta || (meta.modelName !== undefined && meta.modelName !== 'Xe')) {
    return false;
  }

  const isPlateTarget = (target: unknown) =>
    target === 'bienSoXe' || target === 'Xe_bienSoXe_key';
  const target = meta.target;
  if (
    Array.isArray(target)
      ? target.length === 1 && isPlateTarget(target[0])
      : isPlateTarget(target)
  ) {
    return true;
  }

  const adapterError = meta.driverAdapterError;
  if (!isRecord(adapterError) || !isRecord(adapterError.cause)) return false;

  const cause = adapterError.cause;
  if (
    cause.kind !== 'UniqueConstraintViolation' ||
    (cause.table !== undefined && cause.table !== 'Xe') ||
    !isRecord(cause.constraint)
  ) {
    return false;
  }

  return cause.constraint.index === 'Xe_bienSoXe_key';
}

function vehicleNotFoundException() {
  return new NotFoundException({
    error: 'VEHICLE_NOT_FOUND',
    message: 'Không tìm thấy xe.',
  });
}

function busCompanyNotFoundException() {
  return new NotFoundException({
    error: 'BUS_COMPANY_NOT_FOUND',
    message: 'Không tìm thấy nhà xe.',
  });
}

function vehicleTypeNotFoundException() {
  return new NotFoundException({
    error: 'VEHICLE_TYPE_NOT_FOUND',
    message: 'Không tìm thấy loại xe.',
  });
}

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: VehicleQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.XeWhereInput = {};

    if (search) {
      where.OR = [
        { bienSoXe: { contains: search } },
        { nhaXe: { maNhaXe: { contains: search } } },
        { nhaXe: { tenNhaXe: { contains: search } } },
        { loaiXe: { tenLoai: { contains: search } } },
      ];
    }
    if (query.status) where.trangThai = query.status;
    if (query.busCompanyId !== undefined) {
      where.nhaXeId = query.busCompanyId;
    }
    if (query.vehicleTypeId !== undefined) {
      where.loaiXeId = query.vehicleTypeId;
    }

    const orderBy: Prisma.XeOrderByWithRelationInput = {
      [sortFieldMap[query.sortBy]]: query.sortDirection,
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
      throw vehicleNotFoundException();
    }

    return { data: mapVehicleDetail(vehicle) };
  }

  private async assertReferences(busCompanyId: number, vehicleTypeId: number) {
    const [busCompany, vehicleType] = await Promise.all([
      this.prisma.nhaXe.findUnique({
        where: { nhaXeId: busCompanyId },
        select: { nhaXeId: true },
      }),
      this.prisma.loaiXe.findUnique({
        where: { loaiXeId: vehicleTypeId },
        select: { loaiXeId: true },
      }),
    ]);

    if (!busCompany) throw busCompanyNotFoundException();
    if (!vehicleType) throw vehicleTypeNotFoundException();
  }

  async create(input: CreateVehicleDto) {
    await this.assertReferences(input.busCompanyId, input.vehicleTypeId);

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
    if (!existingVehicle) throw vehicleNotFoundException();

    await this.assertReferences(input.busCompanyId, input.vehicleTypeId);

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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw vehicleNotFoundException();
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw vehicleNotFoundException();
      }

      throw error;
    }
  }
}
