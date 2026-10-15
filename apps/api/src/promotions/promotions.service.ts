import {
  BadRequestException,
  ConflictException,
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
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.KhuyenMaiWhereInput = {
      nhaXeId,
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
  }) {
    const cleanCode = (params.code || '').trim().toUpperCase();
    if (!cleanCode) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: 'Mã khuyến mãi không hợp lệ.',
      };
    }

    let nhaXeId = params.nhaXeId;
    if (!nhaXeId && params.tripId) {
      const trip = await this.prisma.chuyenXe.findUnique({
        where: { chuyenXeId: params.tripId },
        select: { nhaXeId: true },
      });
      if (trip) {
        nhaXeId = trip.nhaXeId;
      }
    }

    // Bắt buộc xác định tenant (nhà xe) - không cho phép tìm kiếm toàn cục
    if (!nhaXeId) {
      throw new BadRequestException({
        error: 'TENANT_SCOPE_REQUIRED',
        message:
          'Vui lòng cung cấp nhaXeId hoặc tripId để xác định nhà xe áp dụng mã khuyến mãi.',
      });
    }

    const promo = await this.prisma.khuyenMai.findFirst({
      where: {
        maKhuyenMai: cleanCode,
        nhaXeId,
        trangThai: 'HOAT_DONG',
      },
    });

    if (!promo) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: 'Mã khuyến mãi không tồn tại hoặc không áp dụng cho nhà xe này.',
      };
    }

    const now = new Date();
    if (promo.tuNgay && new Date(promo.tuNgay) > now) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: 'Chương trình khuyến mãi chưa bắt đầu.',
      };
    }

    if (promo.denNgay && new Date(promo.denNgay) < now) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: 'Mã khuyến mãi đã hết hạn sử dụng.',
      };
    }

    const originalTotal = Number(params.totalAmount || 0);
    if (
      promo.giaTriDonToiThieu &&
      originalTotal < Number(promo.giaTriDonToiThieu)
    ) {
      return {
        code: cleanCode,
        isValid: false,
        discountAmount: 0,
        message: `Đơn hàng tối thiểu ${Number(promo.giaTriDonToiThieu).toLocaleString('vi-VN')}đ để sử dụng mã này.`,
      };
    }

    let discountAmount = 0;
    if (promo.loaiGiamGia === 'PHAN_TRAM') {
      const percentage = Number(promo.giaTriGiam);
      discountAmount = Math.round((originalTotal * percentage) / 100);
      if (
        promo.giamToiDa &&
        discountAmount > Number(promo.giamToiDa)
      ) {
        discountAmount = Number(promo.giamToiDa);
      }
    } else {
      discountAmount = Number(promo.giaTriGiam);
    }

    return {
      code: cleanCode,
      isValid: true,
      discountAmount: Math.min(originalTotal, discountAmount),
      promotionId: promo.khuyenMaiId,
      message: 'Áp dụng mã khuyến mãi thành công.',
    };
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
