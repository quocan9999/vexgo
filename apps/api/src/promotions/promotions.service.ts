import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type KhuyenMai } from '../generated/prisma/client.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { isDateOnly } from '../fare-prices/fare-price-integrity.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePromotionDto } from './dto/create-promotion.dto.js';
import type { PromotionListQueryDto } from './dto/promotion-list-query.dto.js';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const VALID_ADMIN_STATUSES = ['HOAT_DONG', 'TAM_NGUNG'] as const;

export type PromotionEffectiveState =
  'UPCOMING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'EXHAUSTED' | 'UNAVAILABLE';

export interface PromotionResponse {
  id: number;
  name: string;
  code: string;
  discountType: string;
  discountValue: string;
  maxDiscount: string | null;
  minimumTicketAmount: string | null;
  startsOn: string;
  endsOn: string;
  status: 'HOAT_DONG' | 'TAM_NGUNG';
  usageCount: number;
  usageLimit: number;
  remainingUses: number;
  effectiveState: PromotionEffectiveState;
}

export interface PromotionQuoteInput {
  code: string;
  nhaXeId: number;
  ticketOriginalTotal: Prisma.Decimal;
  khachHangId?: number | null;
  phoneNormalized?: string | null;
}

export interface PromotionQuote {
  promotionId: number;
  code: string;
  discountAmount: Prisma.Decimal;
  identityChecked: boolean;
  quotaLimit: number;
}

function validationError(field: string, message: string): never {
  throw new BadRequestException({
    error: 'VALIDATION_ERROR',
    message: 'Dữ liệu không hợp lệ.',
    details: [{ field, message }],
  });
}

function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function getBusinessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function decimalString(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(2);
}

function hasValidPromotionConfiguration(promotion: KhuyenMai): boolean {
  const discountValue = promotion.giaTriGiam;
  const maximumDiscount = promotion.giamToiDa;
  const minimumAmount = promotion.giaTriDonToiThieu;
  const datesValid =
    promotion.tuNgay instanceof Date &&
    promotion.denNgay instanceof Date &&
    Number.isFinite(promotion.tuNgay.getTime()) &&
    Number.isFinite(promotion.denNgay.getTime()) &&
    dateOnly(promotion.tuNgay) <= dateOnly(promotion.denNgay);
  const quotaValid =
    Number.isSafeInteger(promotion.soLuotToiDa) &&
    promotion.soLuotToiDa > 0 &&
    Number.isSafeInteger(promotion.soLuotDaSuDung) &&
    promotion.soLuotDaSuDung >= 0 &&
    promotion.soLuotDaSuDung <= promotion.soLuotToiDa;
  const commonValid =
    promotion.phamViApDung === 'DAT_VE' &&
    promotion.hinhThucApDung === 'NHAP_MA' &&
    datesValid &&
    quotaValid &&
    discountValue.isFinite() &&
    discountValue.gt(0) &&
    (minimumAmount === null ||
      (minimumAmount.isFinite() && minimumAmount.gte(0)));

  if (!commonValid) return false;
  if (promotion.loaiGiamGia === 'PHAN_TRAM') {
    return (
      discountValue.lte(100) &&
      maximumDiscount !== null &&
      maximumDiscount.isFinite() &&
      maximumDiscount.gt(0)
    );
  }
  if (promotion.loaiGiamGia === 'SO_TIEN') {
    return maximumDiscount === null;
  }
  return false;
}

function effectiveState(
  promotion: KhuyenMai,
  businessDate: string,
): PromotionEffectiveState {
  if (!hasValidPromotionConfiguration(promotion)) return 'UNAVAILABLE';
  if (promotion.trangThai === 'TAM_NGUNG') return 'SUSPENDED';
  if (promotion.trangThai !== 'HOAT_DONG') return 'UNAVAILABLE';
  if (businessDate < dateOnly(promotion.tuNgay)) return 'UPCOMING';
  if (businessDate > dateOnly(promotion.denNgay)) return 'EXPIRED';
  if (promotion.soLuotDaSuDung >= promotion.soLuotToiDa) return 'EXHAUSTED';
  return 'ACTIVE';
}

function toPromotionResponse(
  promotion: KhuyenMai,
  businessDate = getBusinessDate(),
): PromotionResponse {
  const quotaValid =
    Number.isSafeInteger(promotion.soLuotToiDa) &&
    promotion.soLuotToiDa > 0 &&
    Number.isSafeInteger(promotion.soLuotDaSuDung) &&
    promotion.soLuotDaSuDung >= 0;
  const usageLimit = quotaValid ? promotion.soLuotToiDa : 0;
  const usageCount = quotaValid ? promotion.soLuotDaSuDung : 0;
  const status = VALID_ADMIN_STATUSES.includes(
    promotion.trangThai as (typeof VALID_ADMIN_STATUSES)[number],
  )
    ? (promotion.trangThai as PromotionResponse['status'])
    : 'TAM_NGUNG';

  return {
    id: promotion.khuyenMaiId,
    name: promotion.tenChuongTrinh,
    code: promotion.maKhuyenMai,
    discountType: promotion.loaiGiamGia,
    discountValue: promotion.giaTriGiam.toFixed(2),
    maxDiscount: decimalString(promotion.giamToiDa),
    minimumTicketAmount: decimalString(promotion.giaTriDonToiThieu),
    startsOn: dateOnly(promotion.tuNgay),
    endsOn: dateOnly(promotion.denNgay),
    status,
    usageCount,
    usageLimit,
    remainingUses: Math.max(0, usageLimit - usageCount),
    effectiveState: effectiveState(promotion, businessDate),
  };
}

function isPromotionCodeUniqueViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return true;
    const meta = error.meta as
      { code?: unknown; database_error?: unknown } | undefined;
    return (
      meta?.code === '1062' ||
      meta?.code === 1062 ||
      (typeof meta?.database_error === 'string' &&
        meta.database_error.includes('1062'))
    );
  }
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === 'P2002' ||
    candidate.code === 'ER_DUP_ENTRY' ||
    candidate.code === '1062' ||
    (typeof candidate.message === 'string' &&
      /duplicate entry|unique constraint/i.test(candidate.message))
  );
}

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PromotionListQueryDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    if (query.fromDate && !isDateOnly(query.fromDate)) validationError('fromDate', 'Ngày bắt đầu lọc không hợp lệ.');
    if (query.toDate && !isDateOnly(query.toDate)) validationError('toDate', 'Ngày kết thúc lọc không hợp lệ.');
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      validationError('toDate', 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.KhuyenMaiWhereInput = {
      nhaXeId,
      ...(query.fromDate ? { denNgay: { gte: dateOnlyToUtc(query.fromDate) } } : {}),
      ...(query.toDate ? { tuNgay: { lte: dateOnlyToUtc(query.toDate) } } : {}),
      ...(query.status ? { trangThai: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { maKhuyenMai: { contains: query.search } },
              { tenChuongTrinh: { contains: query.search } },
            ],
          }
        : {}),
    };
    const direction = query.sortDirection ?? 'desc';
    const sortField = query.sortBy ?? 'createdAt';
    const orderBy: Prisma.KhuyenMaiOrderByWithRelationInput[] = [
      {
        [{
          name: 'tenChuongTrinh',
          code: 'maKhuyenMai',
          startsOn: 'tuNgay',
          endsOn: 'denNgay',
          usageCount: 'soLuotDaSuDung',
          status: 'trangThai',
          createdAt: 'createdAt',
        }[sortField]]: direction,
      },
      { khuyenMaiId: 'asc' },
    ];
    const [promotions, totalItems] = await Promise.all([
      this.prisma.khuyenMai.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.khuyenMai.count({ where }),
    ]);
    const businessDate = getBusinessDate();

    return {
      data: promotions.map((promotion) =>
        toPromotionResponse(promotion, businessDate),
      ),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async findOne(
    id: number,
    principal: AuthPrincipal,
  ): Promise<PromotionResponse> {
    const nhaXeId = requireTenantPrincipal(principal);
    const promotion = await this.prisma.khuyenMai.findFirst({
      where: { khuyenMaiId: id, nhaXeId },
    });
    if (!promotion) throw this.promotionNotFound();
    return toPromotionResponse(promotion);
  }

  async create(
    input: CreatePromotionDto,
    principal: AuthPrincipal,
  ): Promise<PromotionResponse> {
    const nhaXeId = requireTenantPrincipal(principal);
    const code = input.code.trim().toUpperCase();
    const discountValue = new Prisma.Decimal(input.discountValue);
    const maxDiscount =
      input.maxDiscount == null ? null : new Prisma.Decimal(input.maxDiscount);
    const minimumTicketAmount =
      input.minimumTicketAmount == null
        ? null
        : new Prisma.Decimal(input.minimumTicketAmount);

    if (!isDateOnly(input.startsOn)) {
      validationError(
        'startsOn',
        'Ngày bắt đầu phải có dạng YYYY-MM-DD hợp lệ.',
      );
    }
    if (!isDateOnly(input.endsOn)) {
      validationError(
        'endsOn',
        'Ngày kết thúc phải có dạng YYYY-MM-DD hợp lệ.',
      );
    }
    if (input.endsOn < input.startsOn) {
      validationError(
        'endsOn',
        'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
      );
    }
    if (!discountValue.isFinite() || !discountValue.gt(0)) {
      validationError(
        'discountValue',
        'Mức giảm phải là số tiền dương hợp lệ.',
      );
    }
    if (input.discountType === 'PHAN_TRAM') {
      if (discountValue.gt(100)) {
        validationError(
          'discountValue',
          'Phần trăm giảm không được vượt quá 100.',
        );
      }
      if (!maxDiscount?.isFinite() || !maxDiscount.gt(0)) {
        validationError(
          'maxDiscount',
          'Giảm tối đa bắt buộc và phải lớn hơn 0.',
        );
      }
    } else if (input.discountType === 'SO_TIEN') {
      if (input.maxDiscount != null) {
        validationError(
          'maxDiscount',
          'Không áp dụng giảm tối đa cho loại giảm số tiền.',
        );
      }
    }
    if (
      minimumTicketAmount &&
      (!minimumTicketAmount.isFinite() || minimumTicketAmount.lt(0))
    ) {
      validationError(
        'minimumTicketAmount',
        'Giá trị tối thiểu không được âm.',
      );
    }
    if (!Number.isSafeInteger(input.usageLimit) || input.usageLimit <= 0) {
      validationError('usageLimit', 'Số lượt tối đa phải là số nguyên dương.');
    }

    const duplicate = await this.prisma.khuyenMai.findFirst({
      where: { nhaXeId, maKhuyenMai: code },
      select: { khuyenMaiId: true },
    });
    if (duplicate) throw this.promotionCodeExists();

    try {
      const promotion = await this.prisma.khuyenMai.create({
        data: {
          tenChuongTrinh: input.name.trim(),
          maKhuyenMai: code,
          phamViApDung: 'DAT_VE',
          hinhThucApDung: 'NHAP_MA',
          loaiGiamGia: input.discountType,
          giaTriGiam: discountValue,
          giamToiDa: input.discountType === 'PHAN_TRAM' ? maxDiscount : null,
          giaTriDonToiThieu: minimumTicketAmount,
          dieuKienApDung: null,
          tuNgay: dateOnlyToUtc(input.startsOn),
          denNgay: dateOnlyToUtc(input.endsOn),
          trangThai: 'HOAT_DONG',
          nhaXeId,
          soLuotToiDa: input.usageLimit,
          soLuotDaSuDung: 0,
        },
      });
      return toPromotionResponse(promotion);
    } catch (error) {
      if (isPromotionCodeUniqueViolation(error))
        throw this.promotionCodeExists();
      throw error;
    }
  }

  async updateStatus(
    id: number,
    status: 'HOAT_DONG' | 'TAM_NGUNG',
    principal: AuthPrincipal,
  ): Promise<PromotionResponse> {
    const nhaXeId = requireTenantPrincipal(principal);
    const promotion = await this.prisma.khuyenMai.findFirst({
      where: { khuyenMaiId: id, nhaXeId },
    });
    if (!promotion) throw this.promotionNotFound();
    if (
      !VALID_ADMIN_STATUSES.includes(
        promotion.trangThai as (typeof VALID_ADMIN_STATUSES)[number],
      ) ||
      !hasValidPromotionConfiguration(promotion)
    ) {
      throw new ConflictException({
        error: 'PROMOTION_UNAVAILABLE',
        message:
          'Không thể thay đổi trạng thái chương trình khuyến mãi không hợp lệ.',
      });
    }

    const result = await this.prisma.khuyenMai.updateMany({
      where: {
        khuyenMaiId: id,
        nhaXeId,
        trangThai: { in: [...VALID_ADMIN_STATUSES] },
      },
      data: { trangThai: status },
    });
    if (result.count !== 1) {
      const current = await this.prisma.khuyenMai.findFirst({
        where: { khuyenMaiId: id, nhaXeId },
      });
      if (!current) throw this.promotionNotFound();
      if (!hasValidPromotionConfiguration(current)) {
        throw new ConflictException({
          error: 'PROMOTION_UNAVAILABLE',
          message:
            'Không thể thay đổi trạng thái chương trình khuyến mãi không hợp lệ.',
        });
      }
      throw new ConflictException({
        error: 'PROMOTION_CONCURRENT_MODIFICATION',
        message: 'Chương trình khuyến mãi vừa thay đổi. Vui lòng tải lại.',
      });
    }

    const updated = await this.prisma.khuyenMai.findFirst({
      where: { khuyenMaiId: id, nhaXeId },
    });
    if (!updated) throw this.promotionNotFound();
    return toPromotionResponse(updated);
  }

  async validatePromotion(params: {
    code: string;
    tripId?: number;
    nhaXeId?: number;
    seatCount?: number;
    totalAmount?: number;
  }): Promise<never> {
    void params;
    throw new GoneException({
      error: 'PROMOTION_VALIDATE_DEPRECATED',
      message: 'Vui lòng kiểm tra mã tại báo giá đặt vé.',
    });
  }

  async quotePromotion(input: PromotionQuoteInput): Promise<PromotionQuote> {
    return this.evaluatePromotion(this.prisma, input);
  }

  async lockPromotionForBooking(
    tx: Prisma.TransactionClient,
    input: PromotionQuoteInput,
  ): Promise<PromotionQuote> {
    const code = input.code.trim().toUpperCase();
    const locked = await tx.$queryRaw<Array<{
      khuyenMaiId: number;
      maKhuyenMai: string;
      phamViApDung: string;
      hinhThucApDung: string;
      loaiGiamGia: string;
      giaTriGiam: Prisma.Decimal | string | number;
      giamToiDa: Prisma.Decimal | string | number | null;
      giaTriDonToiThieu: Prisma.Decimal | string | number | null;
      tuNgay: Date;
      denNgay: Date;
      trangThai: string;
      nhaXeId: number;
      soLuotToiDa: number;
      soLuotDaSuDung: number;
    }>>`
      SELECT khuyenMaiId, maKhuyenMai, phamViApDung, hinhThucApDung,
             loaiGiamGia, giaTriGiam, giamToiDa, giaTriDonToiThieu,
             tuNgay, denNgay, trangThai, nhaXeId, soLuotToiDa, soLuotDaSuDung
      FROM KhuyenMai
      WHERE nhaXeId = ${input.nhaXeId} AND maKhuyenMai = ${code}
      FOR UPDATE
    `;
    if (locked.length === 0) this.promotionCodeInvalid();
    const row = locked[0];
    const promotion = {
      ...row,
      giaTriGiam: new Prisma.Decimal(String(row.giaTriGiam)),
      giamToiDa:
        row.giamToiDa === null
          ? null
          : new Prisma.Decimal(String(row.giamToiDa)),
      giaTriDonToiThieu:
        row.giaTriDonToiThieu === null
          ? null
          : new Prisma.Decimal(String(row.giaTriDonToiThieu)),
    } as unknown as KhuyenMai;
    const calculated = this.calculatePromotion(promotion, input);
    if (await this.hasUsageWithCurrentRead(tx, promotion.khuyenMaiId, input)) {
      this.promotionAlreadyUsed();
    }
    return {
      ...calculated,
      identityChecked:
        Boolean(input.phoneNormalized) || Boolean(input.khachHangId),
    };
  }

  async recordUsageInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      promotionId: number;
      bookingId: number;
      customerId: number | null;
      phoneNormalized: string | null;
      discountAmount: Prisma.Decimal;
      quotaLimit: number;
    },
  ): Promise<void> {
    const updated = await tx.khuyenMai.updateMany({
      where: {
        khuyenMaiId: input.promotionId,
        trangThai: 'HOAT_DONG',
        soLuotDaSuDung: { lt: input.quotaLimit },
      },
      data: { soLuotDaSuDung: { increment: 1 } },
    });

    if (updated.count !== 1) this.promotionUnavailable();

    try {
      await tx.suDungKhuyenMai.create({
        data: {
          khuyenMaiId: input.promotionId,
          phieuDatVeId: input.bookingId,
          khachHangId: input.customerId,
          soDienThoaiChuanHoa: input.phoneNormalized,
          soTienGiam: input.discountAmount,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          error: 'PROMOTION_ALREADY_USED',
          message: 'Mã khuyến mãi đã được sử dụng cho khách hàng này.',
        });
      }
      throw error;
    }
  }

  private async evaluatePromotion(
    client: Pick<Prisma.TransactionClient, 'khuyenMai' | 'suDungKhuyenMai'>,
    input: PromotionQuoteInput,
  ): Promise<PromotionQuote> {
    const code = input.code.trim().toUpperCase();
    if (!code) this.promotionCodeInvalid();

    const promotion = await client.khuyenMai.findFirst({
      where: { maKhuyenMai: code, nhaXeId: input.nhaXeId },
    });
    if (!promotion) this.promotionCodeInvalid();
    const calculated = this.calculatePromotion(promotion, input);

    const identityParts = [
      ...(input.phoneNormalized
        ? [{ soDienThoaiChuanHoa: input.phoneNormalized }]
        : []),
      ...(input.khachHangId ? [{ khachHangId: input.khachHangId }] : []),
    ];
    if (
      identityParts.length > 0 &&
      (await client.suDungKhuyenMai.findFirst({
        where: {
          khuyenMaiId: promotion.khuyenMaiId,
          OR: identityParts,
        },
        select: { suDungKhuyenMaiId: true },
      }))
    ) {
      this.promotionAlreadyUsed();
    }

    return {
      ...calculated,
      identityChecked:
        Boolean(input.phoneNormalized) || Boolean(input.khachHangId),
    };
  }

  private calculatePromotion(
    promotion: KhuyenMai,
    input: PromotionQuoteInput,
  ): Omit<PromotionQuote, 'identityChecked'> {
    if (!hasValidPromotionConfiguration(promotion)) {
      throw new ConflictException({
        error: 'PROMOTION_LEGACY_UNCONFIGURED',
        message: 'Mã khuyến mãi chưa được cấu hình để áp dụng cho đặt vé.',
      });
    }
    if (promotion.trangThai !== 'HOAT_DONG') this.promotionUnavailable();

    const businessDate = getBusinessDate();
    if (businessDate < dateOnly(promotion.tuNgay)) {
      throw new ConflictException({
        error: 'PROMOTION_NOT_STARTED',
        message: 'Chương trình khuyến mãi chưa bắt đầu.',
      });
    }
    if (businessDate > dateOnly(promotion.denNgay)) {
      throw new ConflictException({
        error: 'PROMOTION_EXPIRED',
        message: 'Mã khuyến mãi đã hết hạn sử dụng.',
      });
    }
    if (promotion.soLuotDaSuDung >= promotion.soLuotToiDa) {
      throw new ConflictException({
        error: 'PROMOTION_QUOTA_EXHAUSTED',
        message: 'Mã khuyến mãi đã hết lượt sử dụng.',
      });
    }
    if (
      promotion.giaTriDonToiThieu &&
      input.ticketOriginalTotal.lt(promotion.giaTriDonToiThieu)
    ) {
      throw new ConflictException({
        error: 'PROMOTION_MINIMUM_NOT_MET',
        message: 'Tổng tiền vé chưa đạt mức tối thiểu để dùng mã này.',
      });
    }

    let discountAmount: Prisma.Decimal;
    if (promotion.loaiGiamGia === 'PHAN_TRAM') {
      discountAmount = input.ticketOriginalTotal
        .mul(promotion.giaTriGiam)
        .div(100)
        .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
      if (promotion.giamToiDa) {
        const roundedMaximum = promotion.giamToiDa.toDecimalPlaces(
          0,
          Prisma.Decimal.ROUND_HALF_UP,
        );
        if (discountAmount.gt(roundedMaximum)) {
          discountAmount = roundedMaximum;
        }
      }
    } else {
      discountAmount = promotion.giaTriGiam.toDecimalPlaces(
        0,
        Prisma.Decimal.ROUND_HALF_UP,
      );
    }

    return {
      promotionId: promotion.khuyenMaiId,
      code: promotion.maKhuyenMai,
      discountAmount: Prisma.Decimal.min(
        input.ticketOriginalTotal,
        discountAmount,
      ),
      quotaLimit: promotion.soLuotToiDa,
    };
  }

  private async hasUsageWithCurrentRead(
    tx: Prisma.TransactionClient,
    promotionId: number,
    input: PromotionQuoteInput,
  ): Promise<boolean> {
    const conditions = [
      ...(input.phoneNormalized
        ? [Prisma.sql`soDienThoaiChuanHoa = ${input.phoneNormalized}`]
        : []),
      ...(input.khachHangId
        ? [Prisma.sql`khachHangId = ${input.khachHangId}`]
        : []),
    ];
    if (conditions.length === 0) return false;

    const rows = await tx.$queryRaw<Array<{ suDungKhuyenMaiId: number }>>(
      Prisma.sql`
        SELECT suDungKhuyenMaiId
        FROM SuDungKhuyenMai
        WHERE khuyenMaiId = ${promotionId}
          AND (${Prisma.join(conditions, ' OR ')})
        LIMIT 1
        FOR UPDATE
      `,
    );
    return rows.length > 0;
  }

  private promotionAlreadyUsed(): never {
    throw new ConflictException({
      error: 'PROMOTION_ALREADY_USED',
      message: 'Mã khuyến mãi đã được sử dụng cho khách hàng này.',
    });
  }

  private promotionCodeInvalid(): never {
    throw new ConflictException({
      error: 'PROMOTION_CODE_INVALID',
      message: 'Mã khuyến mãi không hợp lệ cho chuyến xe này.',
    });
  }

  private promotionUnavailable(): never {
    throw new ConflictException({
      error: 'PROMOTION_UNAVAILABLE',
      message: 'Mã khuyến mãi hiện không khả dụng.',
    });
  }

  private promotionNotFound(): NotFoundException {
    return new NotFoundException({
      error: 'PROMOTION_NOT_FOUND',
      message: 'Không tìm thấy chương trình khuyến mãi.',
    });
  }

  private promotionCodeExists(): ConflictException {
    return new ConflictException({
      error: 'PROMOTION_CODE_EXISTS',
      message: 'Mã khuyến mãi đã tồn tại trong nhà xe này.',
    });
  }
}
