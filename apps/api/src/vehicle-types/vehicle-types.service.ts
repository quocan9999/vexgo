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
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  assertTenantScope,
  requireTenantPrincipal,
} from '../auth/tenant-scope.js';

const VEHICLE_TYPE_SELECT = {
  loaiXeId: true,
  tenLoai: true,
  moTa: true,
  sucChuaXeMayMacDinh: true,
  sucChuaHangCongKenhMacDinh: true,
  sucChuaHangNheMacDinh: true,
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
    motorbikeCapacityDefault: vehicleType.sucChuaXeMayMacDinh,
    bulkyCargoCapacityDefault: vehicleType.sucChuaHangCongKenhMacDinh,
    lightCargoCapacityDefault: vehicleType.sucChuaHangNheMacDinh,
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
    value === 'tenLoai' ||
    value === 'LoaiXe_nhaXeId_tenLoai_key' ||
    value === 'LoaiXe_index_0';
  const target = error.meta?.target;

  if (
    Array.isArray(target)
      ? target.includes('tenLoai') &&
        (target.length === 1 || target.includes('nhaXeId'))
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
    (constraint.index === 'LoaiXe_nhaXeId_tenLoai_key' ||
      constraint.index === 'LoaiXe_index_0')
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
} satisfies Record<
  VehicleTypeSortField,
  keyof Prisma.LoaiXeOrderByWithRelationInput
>;

@Injectable()
export class VehicleTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateVehicleTypeDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    assertTenantScope(input.busCompanyId, nhaXeId);
    const busCompany = await this.prisma.nhaXe.findUnique({
      where: { nhaXeId },
      select: { nhaXeId: true },
    });
    if (!busCompany) {
      throw new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe.',
      });
    }

    try {
      const vehicleType = await this.prisma.loaiXe.create({
        data: {
          nhaXeId,
          tenLoai: input.name,
          moTa: input.description ?? null,
          sucChuaXeMayMacDinh: input.motorbikeCapacityDefault ?? 0,
          sucChuaHangCongKenhMacDinh: input.bulkyCargoCapacityDefault ?? 0,
          sucChuaHangNheMacDinh: input.lightCargoCapacityDefault ?? 0,
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

  async update(
    id: number,
    input: UpdateVehicleTypeDto,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    const where = { loaiXeId: id, nhaXeId };
    try {
      const result = await this.prisma.loaiXe.updateMany({
        where,
        data: {
          tenLoai: input.name,
          moTa: input.description ?? null,
          ...(input.motorbikeCapacityDefault !== undefined && {
            sucChuaXeMayMacDinh: input.motorbikeCapacityDefault,
          }),
          ...(input.bulkyCargoCapacityDefault !== undefined && {
            sucChuaHangCongKenhMacDinh: input.bulkyCargoCapacityDefault,
          }),
          ...(input.lightCargoCapacityDefault !== undefined && {
            sucChuaHangNheMacDinh: input.lightCargoCapacityDefault,
          }),
        },
      });

      if (result.count === 0) {
        throw new NotFoundException({
          error: 'VEHICLE_TYPE_NOT_FOUND',
          message: 'Không tìm thấy loại xe.',
        });
      }

      const vehicleType = await this.prisma.loaiXe.findFirst({
        where,
        select: VEHICLE_TYPE_SELECT,
      });
      if (!vehicleType) {
        throw new NotFoundException({
          error: 'VEHICLE_TYPE_NOT_FOUND',
          message: 'Không tìm thấy loại xe.',
        });
      }

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

  async findAll(query: VehicleTypeQueryDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    const search = query.search?.trim();
    const where: Prisma.LoaiXeWhereInput = { nhaXeId };

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

  async findOne(id: number, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    const vehicleType = await this.prisma.loaiXe.findFirst({
      where: { loaiXeId: id, nhaXeId },
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
