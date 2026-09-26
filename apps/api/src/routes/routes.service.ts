import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RouteQueryDto, RouteSortField } from './dto/route-query.dto.js';

const ROUTE_SELECT = {
  tuyenXeId: true,
  maTuyenXe: true,
  diemDi: true,
  diemDen: true,
  trangThai: true,
  createdAt: true,
  updatedAt: true,
  nhaXe: { select: { nhaXeId: true, maNhaXe: true, tenNhaXe: true } },
} satisfies Prisma.TuyenXeSelect;

type RouteRecord = Prisma.TuyenXeGetPayload<{ select: typeof ROUTE_SELECT }>;

const sortFieldMap = {
  code: 'maTuyenXe',
  origin: 'diemDi',
  destination: 'diemDen',
  status: 'trangThai',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} satisfies Record<RouteSortField, keyof Prisma.TuyenXeOrderByWithRelationInput>;

function mapRoute(route: RouteRecord) {
  return {
    routeId: route.tuyenXeId,
    code: route.maTuyenXe,
    origin: route.diemDi,
    destination: route.diemDen,
    status: route.trangThai,
    busCompany: {
      busCompanyId: route.nhaXe.nhaXeId,
      code: route.nhaXe.maNhaXe,
      name: route.nhaXe.tenNhaXe,
    },
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString(),
  };
}

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: RouteQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.TuyenXeWhereInput = {};
    if (search) {
      where.OR = [
        { maTuyenXe: { contains: search } },
        { diemDi: { contains: search } },
        { diemDen: { contains: search } },
        { nhaXe: { is: { maNhaXe: { contains: search } } } },
        { nhaXe: { is: { tenNhaXe: { contains: search } } } },
      ];
    }
    if (query.status) where.trangThai = query.status;
    if (query.busCompanyId) where.nhaXeId = query.busCompanyId;

    const [routes, totalItems] = await Promise.all([
      this.prisma.tuyenXe.findMany({
        where,
        orderBy: { [sortFieldMap[query.sortBy]]: query.sortDirection ?? 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: ROUTE_SELECT,
      }),
      this.prisma.tuyenXe.count({ where }),
    ]);

    return {
      data: routes.map(mapRoute),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async findOne(id: number) {
    const route = await this.prisma.tuyenXe.findUnique({
      where: { tuyenXeId: id },
      select: ROUTE_SELECT,
    });
    if (!route) {
      throw new NotFoundException({
        error: 'ROUTE_NOT_FOUND',
        message: 'Không tìm thấy tuyến xe.',
      });
    }
    return { data: mapRoute(route) };
  }
}
