import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto.js';
import type { VehicleTypeQueryDto } from './dto/vehicle-type-query.dto.js';
import type { VehicleTypeSortField } from './dto/vehicle-type-query.dto.js';
import type { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto.js';

const VEHICLE_TYPE_SELECT = {
  loaiXeId: true,
  tenLoai: true,
  moTa: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LoaiXeSelect;

type VehicleTypeRecord = Prisma.LoaiXeGetPayload<{
  select: typeof VEHICLE_TYPE_SELECT;
}>;

export function mapVehicleType(vehicleType: VehicleTypeRecord) {
  return {
    vehicleTypeId: vehicleType.loaiXeId,
    name: vehicleType.tenLoai,
    description: vehicleType.moTa,
    createdAt: vehicleType.createdAt.toISOString(),
    updatedAt: vehicleType.updatedAt.toISOString(),
  };
}

function isVehicleTypeNameUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const isNameTarget = (value: unknown) =>
    value === 'tenLoai' || value === 'LoaiXe_index_0';
  const target = error.meta?.target;

  if (
    Array.isArray(target)
      ? target.length === 1 && isNameTarget(target[0])
      : isNameTarget(target)
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
    constraint.index === 'LoaiXe_index_0'
  );
}

function throwVehicleTypeNameExists(): never {
  throw new ConflictException({
    error: 'VEHICLE_TYPE_NAME_EXISTS',
    message: 'Tên loại xe đã tồn tại.',
  });
}

const sortFieldMap = {
  name: 'tenLoai',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} satisfies Record<VehicleTypeSortField, keyof Prisma.LoaiXeOrderByWithRelationInput>;

@Injectable()
export class VehicleTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateVehicleTypeDto) {
    try {
      const vehicleType = await this.prisma.loaiXe.create({
        data: {
          tenLoai: input.name,
          moTa: input.description ?? null,
        },
        select: VEHICLE_TYPE_SELECT,
      });

      return { data: mapVehicleType(vehicleType) };
    } catch (error) {
      if (isVehicleTypeNameUniqueViolation(error)) {
        throwVehicleTypeNameExists();
      }
      throw error;
    }
  }

  async update(id: number, input: UpdateVehicleTypeDto) {
    try {
      const vehicleType = await this.prisma.loaiXe.update({
        where: { loaiXeId: id },
        data: {
          tenLoai: input.name,
          moTa: input.description ?? null,
        },
        select: VEHICLE_TYPE_SELECT,
      });

      return { data: mapVehicleType(vehicleType) };
    } catch (error) {
      if (isVehicleTypeNameUniqueViolation(error)) {
        throwVehicleTypeNameExists();
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException({
          error: 'VEHICLE_TYPE_NOT_FOUND',
          message: 'Không tìm thấy loại xe.',
        });
      }

      throw error;
    }
  }

  async findAll(query: VehicleTypeQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.LoaiXeWhereInput = {};

    if (search) {
      where.OR = [
        { tenLoai: { contains: search } },
        { moTa: { contains: search } },
      ];
    }

    const orderBy: Prisma.LoaiXeOrderByWithRelationInput = {
      [sortFieldMap[query.sortBy]]: query.sortDirection ?? 'asc',
    };
    const skip = (query.page - 1) * query.pageSize;

    const [vehicleTypes, totalItems] = await Promise.all([
      this.prisma.loaiXe.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
        select: VEHICLE_TYPE_SELECT,
      }),
      this.prisma.loaiXe.count({ where }),
    ]);

    return {
      data: vehicleTypes.map(mapVehicleType),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async findOne(id: number) {
    const vehicleType = await this.prisma.loaiXe.findUnique({
      where: { loaiXeId: id },
      select: VEHICLE_TYPE_SELECT,
    });

    if (!vehicleType) {
      throw new NotFoundException({
        error: 'VEHICLE_TYPE_NOT_FOUND',
        message: 'Không tìm thấy loại xe.',
      });
    }

    return { data: mapVehicleType(vehicleType) };
  }
}
