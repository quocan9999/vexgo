import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRouteDto } from './dto/create-route.dto.js';
import type { RouteQueryDto, RouteSortField } from './dto/route-query.dto.js';
import type { UpdateRouteDto } from './dto/update-route.dto.js';
import type { UpdateRouteStatusDto } from './dto/update-route-status.dto.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

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
} satisfies Record<
  RouteSortField,
  keyof Prisma.TuyenXeOrderByWithRelationInput
>;

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

function routeNotFound() {
  return new NotFoundException({
    error: 'ROUTE_NOT_FOUND',
    message: 'Không tìm thấy tuyến xe.',
  });
}

function busCompanyNotFound() {
  return new NotFoundException({
    error: 'BUS_COMPANY_NOT_FOUND',
    message: 'Không tìm thấy nhà xe.',
  });
}

function requireTenantId(principal: AuthPrincipal | undefined): number {
  if (!principal?.roles.includes('NHA_XE_ADMIN')) {
    throw new ForbiddenException({
      error: 'ROLE_FORBIDDEN',
      message: 'Chỉ quản trị viên nhà xe được quản lý tuyến xe.',
    });
  }
  const nhaXeId = principal.nhaXeId;
  if (
    typeof nhaXeId !== 'number' ||
    !Number.isInteger(nhaXeId) ||
    nhaXeId <= 0
  ) {
    throw new ForbiddenException({
      error: 'TENANT_SCOPE_REQUIRED',
      message: 'Tài khoản chưa được gán nhà xe hợp lệ.',
    });
  }
  return nhaXeId;
}

function tenantIdForRead(
  principal: AuthPrincipal | undefined,
): number | undefined {
  return principal?.roles.includes('NHA_XE_ADMIN')
    ? requireTenantId(principal)
    : undefined;
}

function isRouteCodeUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  )
    return false;
  const target = error.meta?.target;
  if (target === 'TuyenXe_index_2') return true;
  if (
    Array.isArray(target) &&
    target.length === 2 &&
    target.includes('nhaXeId') &&
    target.includes('maTuyenXe')
  )
    return true;

  const adapterError = error.meta?.driverAdapterError;
  if (
    typeof adapterError !== 'object' ||
    adapterError === null ||
    !('cause' in adapterError)
  )
    return false;
  const cause = adapterError.cause;
  if (
    typeof cause !== 'object' ||
    cause === null ||
    !('kind' in cause) ||
    cause.kind !== 'UniqueConstraintViolation' ||
    !('constraint' in cause)
  )
    return false;
  const constraint = cause.constraint;
  return (
    typeof constraint === 'object' &&
    constraint !== null &&
    'index' in constraint &&
    constraint.index === 'TuyenXe_index_2'
  );
}

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateRouteDto, principal?: AuthPrincipal) {
    const nhaXeId = requireTenantId(principal);
    if (input.busCompanyId !== nhaXeId) {
      throw new ForbiddenException({
        error: 'TENANT_SCOPE_VIOLATION',
        message: 'Không được thao tác dữ liệu của nhà xe khác.',
      });
    }
    const company = await this.prisma.nhaXe.findUnique({
      where: { nhaXeId },
      select: { nhaXeId: true },
    });
    if (!company) throw busCompanyNotFound();

    try {
      const route = await this.prisma.tuyenXe.create({
        data: {
          maTuyenXe: input.code,
          diemDi: input.origin,
          diemDen: input.destination,
          nhaXeId,
          trangThai: input.status,
        },
        select: ROUTE_SELECT,
      });
      return { data: mapRoute(route) };
    } catch (error) {
      if (isRouteCodeUniqueViolation(error)) {
        throw new ConflictException({
          error: 'ROUTE_CODE_EXISTS',
          message: 'Mã tuyến đã tồn tại trong nhà xe này.',
        });
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw busCompanyNotFound();
      }
      throw error;
    }
  }

  async update(id: number, input: UpdateRouteDto, principal?: AuthPrincipal) {
    const nhaXeId = requireTenantId(principal);
    const result = await this.prisma.tuyenXe.updateMany({
      where: { tuyenXeId: id, nhaXeId },
      data: { diemDi: input.origin, diemDen: input.destination },
    });
    if (result.count === 0) throw routeNotFound();

    const route = await this.prisma.tuyenXe.findFirst({
      where: { tuyenXeId: id, nhaXeId },
      select: ROUTE_SELECT,
    });
    if (!route) throw routeNotFound();
    return { data: mapRoute(route) };
  }

  async updateStatus(
    id: number,
    status: UpdateRouteStatusDto['status'],
    principal?: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantId(principal);
    const result = await this.prisma.tuyenXe.updateMany({
      where: { tuyenXeId: id, nhaXeId },
      data: { trangThai: status },
    });
    if (result.count === 0) throw routeNotFound();

    const route = await this.prisma.tuyenXe.findFirst({
      where: { tuyenXeId: id, nhaXeId },
      select: ROUTE_SELECT,
    });
    if (!route) throw routeNotFound();
    return { data: mapRoute(route) };
  }

  async findAll(query: RouteQueryDto, principal?: AuthPrincipal) {
    const nhaXeId = tenantIdForRead(principal);
    if (
      nhaXeId !== undefined &&
      query.busCompanyId !== undefined &&
      query.busCompanyId !== nhaXeId
    ) {
      throw new ForbiddenException({
        error: 'TENANT_SCOPE_VIOLATION',
        message: 'Không được truy vấn dữ liệu của nhà xe khác.',
      });
    }
    const search = query.search?.trim();
    const where: Prisma.TuyenXeWhereInput =
      nhaXeId === undefined ? {} : { nhaXeId };
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
    if (nhaXeId === undefined && query.busCompanyId)
      where.nhaXeId = query.busCompanyId;

    const [routes, totalItems] = await Promise.all([
      this.prisma.tuyenXe.findMany({
        where,
        orderBy: [
          { [sortFieldMap[query.sortBy]]: query.sortDirection ?? 'asc' },
          { tuyenXeId: 'asc' },
        ],
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

  async findOne(id: number, principal?: AuthPrincipal) {
    const nhaXeId = tenantIdForRead(principal);
    const route =
      nhaXeId === undefined
        ? await this.prisma.tuyenXe.findUnique({
            where: { tuyenXeId: id },
            select: ROUTE_SELECT,
          })
        : await this.prisma.tuyenXe.findFirst({
            where: { tuyenXeId: id, nhaXeId },
            select: ROUTE_SELECT,
          });
    if (!route) {
      throw routeNotFound();
    }
    return { data: mapRoute(route) };
  }
}
