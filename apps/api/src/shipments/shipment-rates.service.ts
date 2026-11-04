import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  isShipmentRateDateOnly,
  type CreateShipmentRateDto,
  type QueryShipmentRatesDto,
  type ShipmentRateEffectiveState,
  type ShipmentRateSortField,
  type ShipmentRateStatus,
  type UpdateShipmentRateDto,
} from './dto/shipment-rates.dto.js';

const MAX_TRANSACTION_ATTEMPTS = 3;

const SHIPMENT_RATE_SELECT = {
  bangCuocGuiHangId: true,
  tuyenXeId: true,
  loaiHangHoaId: true,
  khoiLuongTu: true,
  khoiLuongDen: true,
  mucCuoc: true,
  tuNgay: true,
  denNgay: true,
  trangThai: true,
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
  loaiHangHoa: {
    select: {
      loaiHangHoaId: true,
      tenLoai: true,
      nhomSucChua: true,
    },
  },
} satisfies Prisma.BangCuocGuiHangSelect;

type ShipmentRateRecord = Prisma.BangCuocGuiHangGetPayload<{
  select: typeof SHIPMENT_RATE_SELECT;
}>;

const sortFieldMap = {
  fee: 'mucCuoc',
  weightFrom: 'khoiLuongTu',
  validFrom: 'tuNgay',
  validTo: 'denNgay',
  status: 'trangThai',
} satisfies Record<
  ShipmentRateSortField,
  keyof Prisma.BangCuocGuiHangOrderByWithRelationInput
>;

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toUtcDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function deriveEffectiveState(
  status: string,
  validFrom: string,
  validTo: string | null,
  businessDate: string,
): ShipmentRateEffectiveState {
  if (status === 'TAM_NGUNG') return 'TAM_NGUNG';
  if (status === 'HET_HIEU_LUC') return 'HET_HIEU_LUC';
  if (businessDate < validFrom) return 'CHUA_HIEU_LUC';
  if (validTo === null || businessDate <= validTo) return 'DANG_HIEU_LUC';
  return 'HET_HIEU_LUC';
}

function mapShipmentRate(record: ShipmentRateRecord, businessDate: string) {
  const fee = new Prisma.Decimal(record.mucCuoc).toNumber();
  const weightFrom = new Prisma.Decimal(record.khoiLuongTu).toNumber();
  const weightTo =
    record.khoiLuongDen === null
      ? null
      : new Prisma.Decimal(record.khoiLuongDen).toNumber();
  const validFrom = toDateOnly(record.tuNgay);
  const validTo = record.denNgay === null ? null : toDateOnly(record.denNgay);
  const status = (
    record.trangThai === 'TAM_NGUNG' ? 'TAM_NGUNG' : 'HOAT_DONG'
  ) as ShipmentRateStatus;

  return {
    shipmentRateId: record.bangCuocGuiHangId,
    weightFrom,
    weightTo,
    fee,
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
    cargoType: {
      cargoTypeId: record.loaiHangHoa.loaiHangHoaId,
      name: record.loaiHangHoa.tenLoai,
      capacityGroup: record.loaiHangHoa.nhomSucChua,
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function assertValidRatePeriod(
  validFrom: string,
  validTo: string | null | undefined,
): void {
  if (!isShipmentRateDateOnly(validFrom)) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ.',
      details: [
        {
          field: 'validFrom',
          message: 'Ngày bắt đầu phải là ngày hợp lệ dạng YYYY-MM-DD.',
        },
      ],
    });
  }
  if (validTo !== undefined && validTo !== null && !isShipmentRateDateOnly(validTo)) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ.',
      details: [
        {
          field: 'validTo',
          message: 'Ngày kết thúc phải là ngày hợp lệ dạng YYYY-MM-DD.',
        },
      ],
    });
  }
  if (validTo !== undefined && validTo !== null && validTo < validFrom) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ.',
      details: [
        {
          field: 'validTo',
          message: 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
        },
      ],
    });
  }
}

function assertValidWeightRange(
  weightFrom: number,
  weightTo: number | null | undefined,
): void {
  if (!Number.isFinite(weightFrom) || weightFrom < 0) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ.',
      details: [
        {
          field: 'weightFrom',
          message: 'Khối lượng bắt đầu phải từ 0 kg trở lên.',
        },
      ],
    });
  }
  if (weightTo !== undefined && weightTo !== null) {
    if (!Number.isFinite(weightTo) || weightTo <= weightFrom) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ.',
        details: [
          {
            field: 'weightTo',
            message: 'Khối lượng kết thúc phải lớn hơn khối lượng bắt đầu.',
          },
        ],
      });
    }
  }
}

function assertValidFee(fee: number): void {
  if (!Number.isSafeInteger(fee) || fee <= 0) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ.',
      details: [
        {
          field: 'fee',
          message: 'Mức cước phải là số nguyên VND lớn hơn 0.',
        },
      ],
    });
  }
}

function buildSearchConditions(
  search: string,
): Prisma.BangCuocGuiHangWhereInput[] {
  return [
    { tuyenXe: { is: { maTuyenXe: { contains: search } } } },
    { tuyenXe: { is: { diemDi: { contains: search } } } },
    { tuyenXe: { is: { diemDen: { contains: search } } } },
    { loaiHangHoa: { is: { tenLoai: { contains: search } } } },
  ];
}

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

async function runShipmentRateWriteTransaction<T>(
  prisma: Pick<PrismaService, '$transaction'>,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationConflict(error)) throw error;
      if (attempt === MAX_TRANSACTION_ATTEMPTS) {
        throw new ConflictException({
          error: 'SHIPMENT_RATE_CONCURRENT_MODIFICATION',
          message:
            'Dữ liệu bảng cước gửi hàng vừa thay đổi đồng thời. Vui lòng thử lại.',
        });
      }
    }
  }
  throw new ConflictException({
    error: 'SHIPMENT_RATE_CONCURRENT_MODIFICATION',
    message:
      'Dữ liệu bảng cước gửi hàng vừa thay đổi đồng thời. Vui lòng thử lại.',
  });
}

async function assertNoActiveShipmentRateOverlap(
  transaction: Prisma.TransactionClient,
  candidate: {
    routeId: number;
    cargoTypeId: number;
    weightFrom: number;
    weightTo: number | null;
    validFrom: string;
    validTo: string | null;
    excludeRateId?: number;
  },
  message = 'Khoảng khối lượng và thời gian hiệu lực bị trùng với một mức cước đang hoạt động của cùng tuyến xe và loại hàng hóa.',
): Promise<void> {
  const dateConditions: Prisma.BangCuocGuiHangWhereInput[] = [
    {
      OR: [
        { denNgay: null },
        { denNgay: { gte: toUtcDate(candidate.validFrom) } },
      ],
    },
  ];
  if (candidate.validTo !== null) {
    dateConditions.push({ tuNgay: { lte: toUtcDate(candidate.validTo) } });
  }

  const activeRates = await transaction.bangCuocGuiHang.findMany({
    where: {
      tuyenXeId: candidate.routeId,
      loaiHangHoaId: candidate.cargoTypeId,
      trangThai: 'HOAT_DONG',
      ...(candidate.excludeRateId === undefined
        ? {}
        : { bangCuocGuiHangId: { not: candidate.excludeRateId } }),
      AND: dateConditions,
    },
    select: {
      bangCuocGuiHangId: true,
      khoiLuongTu: true,
      khoiLuongDen: true,
    },
  });

  const candidateUpper =
    candidate.weightTo === null ? Number.POSITIVE_INFINITY : candidate.weightTo;

  const hasOverlap = activeRates.some((existing) => {
    const existingFrom = new Prisma.Decimal(existing.khoiLuongTu).toNumber();
    const existingTo =
      existing.khoiLuongDen === null
        ? Number.POSITIVE_INFINITY
        : new Prisma.Decimal(existing.khoiLuongDen).toNumber();

    const maxLower = Math.max(existingFrom, candidate.weightFrom);
    const minUpper = Math.min(existingTo, candidateUpper);
    return maxLower < minUpper;
  });

  if (hasOverlap) {
    throw new ConflictException({
      error: 'SHIPMENT_RATE_OVERLAP',
      message,
    });
  }
}

@Injectable()
export class ShipmentRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll(query: QueryShipmentRatesDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    const businessTimeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const businessDate = getBusinessDate(businessTimeZone);
    const where: Prisma.BangCuocGuiHangWhereInput = {
      tuyenXe: { is: { nhaXeId } },
    };
    const search = query.search?.trim();

    if (search) where.OR = buildSearchConditions(search);
    if (query.routeId !== undefined) where.tuyenXeId = query.routeId;
    if (query.cargoTypeId !== undefined) where.loaiHangHoaId = query.cargoTypeId;
    if (query.status) where.trangThai = query.status;

    if (query.effectiveState) {
      const date = toUtcDate(businessDate);
      const conditions: Prisma.BangCuocGuiHangWhereInput[] = [];

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
          conditions.push({
            OR: [
              { trangThai: 'HET_HIEU_LUC' },
              {
                AND: [
                  { trangThai: 'HOAT_DONG' },
                  { denNgay: { lt: date } },
                ],
              },
            ],
          });
          break;
      }

      where.AND = conditions;
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const sortBy = query.sortBy ?? 'weightFrom';
    const sortDirection = query.sortDirection ?? 'asc';

    const [records, totalItems] = await Promise.all([
      this.prisma.bangCuocGuiHang.findMany({
        where,
        orderBy: [
          { [sortFieldMap[sortBy]]: sortDirection },
          { bangCuocGuiHangId: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: SHIPMENT_RATE_SELECT,
      }),
      this.prisma.bangCuocGuiHang.count({ where }),
    ]);

    return {
      data: records.map((record) => mapShipmentRate(record, businessDate)),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async findOne(id: number, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    const businessTimeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const businessDate = getBusinessDate(businessTimeZone);
    const record = await this.prisma.bangCuocGuiHang.findFirst({
      where: {
        bangCuocGuiHangId: id,
        tuyenXe: { is: { nhaXeId } },
      },
      select: SHIPMENT_RATE_SELECT,
    });

    if (!record) {
      throw new NotFoundException({
        error: 'SHIPMENT_RATE_NOT_FOUND',
        message: 'Không tìm thấy mức cước gửi hàng.',
      });
    }

    return { data: mapShipmentRate(record, businessDate) };
  }

  async create(input: CreateShipmentRateDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    const weightTo = input.weightTo ?? null;
    const validTo = input.validTo ?? null;

    assertValidFee(input.fee);
    assertValidWeightRange(input.weightFrom, weightTo);
    assertValidRatePeriod(input.validFrom, validTo);

    const record = await runShipmentRateWriteTransaction(
      this.prisma,
      async (transaction) => {
        const [route, cargoType] = await Promise.all([
          transaction.tuyenXe.findFirst({
            where: { tuyenXeId: input.routeId, nhaXeId },
            select: { tuyenXeId: true, nhaXeId: true },
          }),
          transaction.loaiHangHoa.findFirst({
            where: {
              loaiHangHoaId: input.cargoTypeId,
              trangThai: 'HOAT_DONG',
            },
            select: { loaiHangHoaId: true },
          }),
        ]);

        if (!route) {
          throw new NotFoundException({
            error: 'ROUTE_NOT_FOUND',
            message: 'Không tìm thấy tuyến xe.',
          });
        }
        if (!cargoType) {
          throw new NotFoundException({
            error: 'CARGO_TYPE_NOT_FOUND',
            message: 'Không tìm thấy loại hàng hóa đang hoạt động.',
          });
        }

        if (input.status === 'HOAT_DONG') {
          await assertNoActiveShipmentRateOverlap(transaction, {
            routeId: input.routeId,
            cargoTypeId: input.cargoTypeId,
            weightFrom: input.weightFrom,
            weightTo,
            validFrom: input.validFrom,
            validTo,
          });
        }

        return transaction.bangCuocGuiHang.create({
          data: {
            tuyenXeId: input.routeId,
            loaiHangHoaId: input.cargoTypeId,
            khoiLuongTu: new Prisma.Decimal(input.weightFrom),
            khoiLuongDen:
              weightTo === null ? null : new Prisma.Decimal(weightTo),
            mucCuoc: new Prisma.Decimal(input.fee),
            tuNgay: toUtcDate(input.validFrom),
            denNgay: validTo === null ? null : toUtcDate(validTo),
            trangThai: input.status,
          },
          select: SHIPMENT_RATE_SELECT,
        });
      },
    );

    const businessDate = getBusinessDate(
      resolveBusinessTimeZone(this.config.get<string>('BUSINESS_TIME_ZONE')),
    );
    return { data: mapShipmentRate(record, businessDate) };
  }

  async update(
    id: number,
    input: UpdateShipmentRateDto,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    const hasChanges =
      input.weightFrom !== undefined ||
      input.weightTo !== undefined ||
      input.fee !== undefined ||
      input.validFrom !== undefined ||
      input.validTo !== undefined;

    if (!hasChanges) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Dữ liệu yêu cầu không hợp lệ.',
        details: [
          { field: 'body', message: 'Cần cập nhật ít nhất một trường.' },
        ],
      });
    }

    if (input.fee !== undefined) {
      assertValidFee(input.fee);
    }

    const record = await runShipmentRateWriteTransaction(
      this.prisma,
      async (transaction) => {
        const current = await transaction.bangCuocGuiHang.findFirst({
          where: {
            bangCuocGuiHangId: id,
            tuyenXe: { is: { nhaXeId } },
          },
          select: SHIPMENT_RATE_SELECT,
        });
        if (!current) {
          throw new NotFoundException({
            error: 'SHIPMENT_RATE_NOT_FOUND',
            message: 'Không tìm thấy mức cước gửi hàng.',
          });
        }

        const currentFee = new Prisma.Decimal(current.mucCuoc).toNumber();
        const currentWeightFrom = new Prisma.Decimal(
          current.khoiLuongTu,
        ).toNumber();
        const currentWeightTo =
          current.khoiLuongDen === null
            ? null
            : new Prisma.Decimal(current.khoiLuongDen).toNumber();
        const currentValidFrom = toDateOnly(current.tuNgay);
        const currentValidTo =
          current.denNgay === null ? null : toDateOnly(current.denNgay);

        const candidateFee = input.fee ?? currentFee;
        const candidateWeightFrom = input.weightFrom ?? currentWeightFrom;
        const candidateWeightTo =
          input.weightTo === undefined ? currentWeightTo : input.weightTo;
        const candidateValidFrom = input.validFrom ?? currentValidFrom;
        const candidateValidTo =
          input.validTo === undefined ? currentValidTo : input.validTo;

        assertValidWeightRange(candidateWeightFrom, candidateWeightTo);
        assertValidRatePeriod(candidateValidFrom, candidateValidTo);

        if (current.trangThai === 'HOAT_DONG') {
          await assertNoActiveShipmentRateOverlap(transaction, {
            routeId: current.tuyenXeId,
            cargoTypeId: current.loaiHangHoaId,
            weightFrom: candidateWeightFrom,
            weightTo: candidateWeightTo,
            validFrom: candidateValidFrom,
            validTo: candidateValidTo,
            excludeRateId: current.bangCuocGuiHangId,
          });
        }

        const unchanged =
          candidateFee === currentFee &&
          candidateWeightFrom === currentWeightFrom &&
          candidateWeightTo === currentWeightTo &&
          candidateValidFrom === currentValidFrom &&
          candidateValidTo === currentValidTo;

        if (unchanged) return current;

        const data: Prisma.BangCuocGuiHangUpdateManyMutationInput = {
          ...(input.fee === undefined
            ? {}
            : { mucCuoc: new Prisma.Decimal(candidateFee) }),
          ...(input.weightFrom === undefined
            ? {}
            : { khoiLuongTu: new Prisma.Decimal(candidateWeightFrom) }),
          ...(input.weightTo === undefined
            ? {}
            : {
                khoiLuongDen:
                  candidateWeightTo === null
                    ? null
                    : new Prisma.Decimal(candidateWeightTo),
              }),
          ...(input.validFrom === undefined
            ? {}
            : { tuNgay: toUtcDate(candidateValidFrom) }),
          ...(input.validTo === undefined
            ? {}
            : {
                denNgay:
                  candidateValidTo === null
                    ? null
                    : toUtcDate(candidateValidTo),
              }),
        };

        const updateResult = await transaction.bangCuocGuiHang.updateMany({
          where: {
            bangCuocGuiHangId: current.bangCuocGuiHangId,
            tuyenXe: { is: { nhaXeId } },
          },
          data,
        });
        if (updateResult.count !== 1) {
          throw new NotFoundException({
            error: 'SHIPMENT_RATE_NOT_FOUND',
            message: 'Không tìm thấy mức cước gửi hàng.',
          });
        }

        const updated = await transaction.bangCuocGuiHang.findFirst({
          where: {
            bangCuocGuiHangId: current.bangCuocGuiHangId,
            tuyenXe: { is: { nhaXeId } },
          },
          select: SHIPMENT_RATE_SELECT,
        });
        if (!updated) {
          throw new NotFoundException({
            error: 'SHIPMENT_RATE_NOT_FOUND',
            message: 'Không tìm thấy mức cước gửi hàng.',
          });
        }
        return updated;
      },
    );

    const businessDate = getBusinessDate(
      resolveBusinessTimeZone(this.config.get<string>('BUSINESS_TIME_ZONE')),
    );
    return { data: mapShipmentRate(record, businessDate) };
  }

  async updateStatus(
    id: number,
    status: ShipmentRateStatus,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    const record = await runShipmentRateWriteTransaction(
      this.prisma,
      async (transaction) => {
        const current = await transaction.bangCuocGuiHang.findFirst({
          where: {
            bangCuocGuiHangId: id,
            tuyenXe: { is: { nhaXeId } },
          },
          select: SHIPMENT_RATE_SELECT,
        });
        if (!current) {
          throw new NotFoundException({
            error: 'SHIPMENT_RATE_NOT_FOUND',
            message: 'Không tìm thấy mức cước gửi hàng.',
          });
        }

        if (current.trangThai === status) return current;

        if (status === 'HOAT_DONG') {
          await assertNoActiveShipmentRateOverlap(
            transaction,
            {
              routeId: current.tuyenXeId,
              cargoTypeId: current.loaiHangHoaId,
              weightFrom: new Prisma.Decimal(current.khoiLuongTu).toNumber(),
              weightTo:
                current.khoiLuongDen === null
                  ? null
                  : new Prisma.Decimal(current.khoiLuongDen).toNumber(),
              validFrom: toDateOnly(current.tuNgay),
              validTo:
                current.denNgay === null ? null : toDateOnly(current.denNgay),
              excludeRateId: current.bangCuocGuiHangId,
            },
            'Không thể kích hoạt vì khoảng khối lượng và thời gian hiệu lực bị trùng với một mức cước đang hoạt động của cùng tuyến và loại hàng.',
          );
        }

        const updateResult = await transaction.bangCuocGuiHang.updateMany({
          where: {
            bangCuocGuiHangId: current.bangCuocGuiHangId,
            tuyenXe: { is: { nhaXeId } },
          },
          data: { trangThai: status },
        });
        if (updateResult.count !== 1) {
          throw new NotFoundException({
            error: 'SHIPMENT_RATE_NOT_FOUND',
            message: 'Không tìm thấy mức cước gửi hàng.',
          });
        }

        const updated = await transaction.bangCuocGuiHang.findFirst({
          where: {
            bangCuocGuiHangId: current.bangCuocGuiHangId,
            tuyenXe: { is: { nhaXeId } },
          },
          select: SHIPMENT_RATE_SELECT,
        });
        if (!updated) {
          throw new NotFoundException({
            error: 'SHIPMENT_RATE_NOT_FOUND',
            message: 'Không tìm thấy mức cước gửi hàng.',
          });
        }
        return updated;
      },
    );

    const businessDate = getBusinessDate(
      resolveBusinessTimeZone(this.config.get<string>('BUSINESS_TIME_ZONE')),
    );
    return { data: mapShipmentRate(record, businessDate) };
  }
}
