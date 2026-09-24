import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
      throw new NotFoundException({
        error: 'VEHICLE_NOT_FOUND',
        message: 'Không tìm thấy xe.',
      });
    }

    return { data: mapVehicleDetail(vehicle) };
  }
}
