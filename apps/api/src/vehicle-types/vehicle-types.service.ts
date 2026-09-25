import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { VehicleTypeQueryDto } from './dto/vehicle-type-query.dto.js';
import type { VehicleTypeSortField } from './dto/vehicle-type-query.dto.js';

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

const sortFieldMap = {
  name: 'tenLoai',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} satisfies Record<VehicleTypeSortField, keyof Prisma.LoaiXeOrderByWithRelationInput>;

@Injectable()
export class VehicleTypesService {
  constructor(private readonly prisma: PrismaService) {}

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
