import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import type { CreateFarePriceDto } from './dto/create-fare-price.dto.js';
import type { UpdateFarePriceDto } from './dto/update-fare-price.dto.js';
import {
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { QueryFarePricesDto } from './dto/query-fare-prices.dto.js';
import type { FarePriceSortField } from './dto/query-fare-prices.dto.js';
import {
  deriveEffectiveState,
  type FarePriceStatus,
} from './fare-price.domain.js';
import {
  assertNoActiveFareOverlap,
  assertValidFarePeriod,
  assertValidListedPrice,
  runFarePriceWriteTransaction,
  validateFarePriceRelations,
} from './fare-price-integrity.js';

const FARE_PRICE_SELECT = {
  bangGiaId: true,
  giaNiemYet: true,
  tuNgay: true,
  denNgay: true,
  trangThai: true,
  tuyenXeId: true,
  loaiXeId: true,
  createdAt: true,
  updatedAt: true,
  tuyenXe: {
    select: {
      tuyenXeId: true,
      maTuyenXe: true,
      diemDi: true,
      diemDen: true,
    },
  },
  loaiXe: { select: { loaiXeId: true, tenLoai: true } },
} satisfies Prisma.BangGiaSelect;

type FarePriceRecord = Prisma.BangGiaGetPayload<{
  select: typeof FARE_PRICE_SELECT;
}>;

const sortFieldMap = {
  listedPrice: 'giaNiemYet',
  validFrom: 'tuNgay',
  validTo: 'denNgay',
  status: 'trangThai',
} satisfies Record<
  FarePriceSortField,
  keyof Prisma.BangGiaOrderByWithRelationInput
>;

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toUtcDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function mapFarePrice(record: FarePriceRecord, businessDate: string) {
  const listedPrice = record.giaNiemYet.toNumber();
  if (!Number.isSafeInteger(listedPrice) || listedPrice <= 0) {
    throw new Error('BangGia contains an invalid listed VND price.');
  }

  const validFrom = toDateOnly(record.tuNgay);
  const validTo = record.denNgay === null ? null : toDateOnly(record.denNgay);
  const status = record.trangThai as FarePriceStatus;

  return {
    farePriceId: record.bangGiaId,
    listedPrice,
    currency: 'VND' as const,
    validFrom,
    validTo,
    status,
    effectiveState: deriveEffectiveState(
      record.trangThai,
      validFrom,
      validTo,
      businessDate,
    ),
    route: {
      routeId: record.tuyenXe.tuyenXeId,
      code: record.tuyenXe.maTuyenXe,
      origin: record.tuyenXe.diemDi,
      destination: record.tuyenXe.diemDen,
    },
    vehicleType: {
      vehicleTypeId: record.loaiXe.loaiXeId,
      name: record.loaiXe.tenLoai,
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildSearchConditions(search: string): Prisma.BangGiaWhereInput[] {
  return [
    { tuyenXe: { is: { maTuyenXe: { contains: search } } } },
    { tuyenXe: { is: { diemDi: { contains: search } } } },
    { tuyenXe: { is: { diemDen: { contains: search } } } },
    { loaiXe: { is: { tenLoai: { contains: search } } } },
  ];
}

@Injectable()
export class FarePricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(input: CreateFarePriceDto) {
    assertValidListedPrice(input.listedPrice);
    assertValidFarePeriod(input.validFrom, input.validTo);
    const validTo = input.validTo ?? null;

    const record = await runFarePriceWriteTransaction(
      this.prisma,
      async (transaction) => {
        await validateFarePriceRelations(
          transaction,
          input.routeId,
          input.vehicleTypeId,
        );

        if (input.status === 'HOAT_DONG') {
          await assertNoActiveFareOverlap(transaction, {
            routeId: input.routeId,
            vehicleTypeId: input.vehicleTypeId,
            validFrom: input.validFrom,
            validTo,
          });
        }

        return transaction.bangGia.create({
          data: {
            giaNiemYet: new Prisma.Decimal(input.listedPrice),
            tuNgay: toUtcDate(input.validFrom),
            denNgay: validTo === null ? null : toUtcDate(validTo),
            trangThai: input.status,
            tuyenXeId: input.routeId,
            loaiXeId: input.vehicleTypeId,
          },
          select: FARE_PRICE_SELECT,
        });
      },
    );

    const businessDate = getBusinessDate(
      resolveBusinessTimeZone(this.config.get<string>('BUSINESS_TIME_ZONE')),
    );
    return { data: mapFarePrice(record, businessDate) };
  }

  async update(id: number, input: UpdateFarePriceDto) {
    const hasChanges =
      input.listedPrice !== undefined ||
      input.validFrom !== undefined ||
      input.validTo !== undefined;
    if (!hasChanges) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Dữ liệu yêu cầu không hợp lệ.',
        details: [{ field: 'body', message: 'Cần cập nhật ít nhất một trường.' }],
      });
    }
    if (input.listedPrice !== undefined) {
      assertValidListedPrice(input.listedPrice);
    }

    const record = await runFarePriceWriteTransaction(
      this.prisma,
      async (transaction) => {
        const current = await transaction.bangGia.findUnique({
          where: { bangGiaId: id },
          select: FARE_PRICE_SELECT,
        });
        if (!current) {
          throw new NotFoundException({
            error: 'FARE_PRICE_NOT_FOUND',
            message: 'Không tìm thấy bảng giá.',
          });
        }
        if (current.trangThai !== 'HOAT_DONG' && current.trangThai !== 'TAM_NGUNG') {
          throw new Error(`BangGia contains an invalid persisted status: ${current.trangThai}`);
        }

        const currentListedPrice = current.giaNiemYet.toNumber();
        if (
          input.listedPrice === undefined &&
          (!Number.isSafeInteger(currentListedPrice) || currentListedPrice <= 0)
        ) {
          throw new Error('BangGia contains an invalid listed VND price.');
        }
        const candidateListedPrice = input.listedPrice ?? currentListedPrice;
        const currentValidFrom = toDateOnly(current.tuNgay);
        const candidateValidFrom = input.validFrom ?? currentValidFrom;
        const currentValidTo = current.denNgay === null ? null : toDateOnly(current.denNgay);
        const candidateValidTo = input.validTo === undefined ? currentValidTo : input.validTo;

        assertValidFarePeriod(candidateValidFrom, candidateValidTo);

        if (current.trangThai === 'HOAT_DONG') {
          await assertNoActiveFareOverlap(transaction, {
            routeId: current.tuyenXeId,
            vehicleTypeId: current.loaiXeId,
            validFrom: candidateValidFrom,
            validTo: candidateValidTo,
            excludeFarePriceId: current.bangGiaId,
          });
        }

        const unchanged =
          candidateListedPrice === currentListedPrice &&
          candidateValidFrom === currentValidFrom &&
          candidateValidTo === currentValidTo;
        if (unchanged) return current;

        const data: Prisma.BangGiaUpdateInput = {
          ...(input.listedPrice === undefined
            ? {}
            : { giaNiemYet: new Prisma.Decimal(candidateListedPrice) }),
          ...(input.validFrom === undefined
            ? {}
            : { tuNgay: toUtcDate(candidateValidFrom) }),
          ...(input.validTo === undefined
            ? {}
            : {
                denNgay: candidateValidTo === null
                  ? null
                  : toUtcDate(candidateValidTo),
              }),
        };

        return transaction.bangGia.update({
          where: { bangGiaId: current.bangGiaId },
          data,
          select: FARE_PRICE_SELECT,
        });
      },
    );

    const businessDate = getBusinessDate(
      resolveBusinessTimeZone(this.config.get<string>('BUSINESS_TIME_ZONE')),
    );
    return { data: mapFarePrice(record, businessDate) };
  }

  async findAll(query: QueryFarePricesDto) {
    const businessTimeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const businessDate = getBusinessDate(businessTimeZone);
    const where: Prisma.BangGiaWhereInput = {};
    const search = query.search?.trim();

    if (search) where.OR = buildSearchConditions(search);
    if (query.routeId !== undefined) where.tuyenXeId = query.routeId;
    if (query.vehicleTypeId !== undefined) {
      where.loaiXeId = query.vehicleTypeId;
    }
    if (query.status) where.trangThai = query.status;

    if (query.effectiveState) {
      const date = toUtcDate(businessDate);
      const conditions: Prisma.BangGiaWhereInput[] = [];

      switch (query.effectiveState) {
        case 'TAM_NGUNG':
          conditions.push({ trangThai: 'TAM_NGUNG' });
          break;
        case 'CHUA_HIEU_LUC':
          conditions.push(
            { trangThai: 'HOAT_DONG' },
            { tuNgay: { gt: date } },
          );
          break;
        case 'DANG_HIEU_LUC':
          conditions.push(
            { trangThai: 'HOAT_DONG' },
            { tuNgay: { lte: date } },
            { OR: [{ denNgay: null }, { denNgay: { gte: date } }] },
          );
          break;
        case 'HET_HIEU_LUC':
          conditions.push(
            { trangThai: 'HOAT_DONG' },
            { denNgay: { lt: date } },
          );
          break;
      }

      where.AND = conditions;
    }

    const sortDirection = query.sortDirection ?? 'desc';
    const [records, totalItems] = await Promise.all([
      this.prisma.bangGia.findMany({
        where,
        orderBy: [
          { [sortFieldMap[query.sortBy]]: sortDirection },
          { bangGiaId: 'desc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: FARE_PRICE_SELECT,
      }),
      this.prisma.bangGia.count({ where }),
    ]);

    return {
      data: records.map((record) => mapFarePrice(record, businessDate)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async findOne(id: number) {
    const businessTimeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const businessDate = getBusinessDate(businessTimeZone);
    const record = await this.prisma.bangGia.findUnique({
      where: { bangGiaId: id },
      select: FARE_PRICE_SELECT,
    });

    if (!record) {
      throw new NotFoundException({
        error: 'FARE_PRICE_NOT_FOUND',
        message: 'Không tìm thấy bảng giá.',
      });
    }

    return { data: mapFarePrice(record, businessDate) };
  }
}
