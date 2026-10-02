import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import {
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { PrismaService } from '../prisma/prisma.service.js';

const PROMOTION_SELECT = {
  khuyenMaiId: true,
  nhaXeId: true,
  maKhuyenMai: true,
  tenChuongTrinh: true,
  phamViApDung: true,
  hinhThucApDung: true,
  loaiGiamGia: true,
  giaTriGiam: true,
  giamToiDa: true,
  giaTriDonToiThieu: true,
  dieuKienApDung: true,
  tuNgay: true,
  denNgay: true,
  trangThai: true,
} satisfies Prisma.KhuyenMaiSelect;

type PromotionRecord = Prisma.KhuyenMaiGetPayload<{
  select: typeof PROMOTION_SELECT;
}>;
type PromotionClient = Pick<Prisma.TransactionClient, 'khuyenMai'>;

export type ResolveBookingPromotionInput = {
  nhaXeId: number;
  subtotal: Prisma.Decimal;
  businessDate?: string;
  promotionCode?: string | null;
};

export type BookingPromotionQuote = {
  promotionId: number | null;
  promotionCode: string | null;
  promotionName: string | null;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
};

function toUtcDate(dateOnly: string): Date {
  const parsed = new Date(`${dateOnly}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ||
    !Number.isFinite(parsed.getTime())
  ) {
    throw new BadRequestException({
      error: 'PROMOTION_CONTEXT_INVALID',
      message: 'Ngày áp dụng khuyến mãi không hợp lệ.',
    });
  }
  return parsed;
}

function hasOpaqueCondition(promotion: PromotionRecord): boolean {
  return Boolean(promotion.dieuKienApDung?.trim());
}

function isMinimumMet(
  promotion: PromotionRecord,
  subtotal: Prisma.Decimal,
): boolean {
  return (
    promotion.giaTriDonToiThieu === null ||
    subtotal.greaterThanOrEqualTo(promotion.giaTriDonToiThieu)
  );
}

function promotionError(
  error: string,
  message: string,
): UnprocessableEntityException {
  return new UnprocessableEntityException({ error, message });
}

function calculateDiscount(
  promotion: PromotionRecord,
  subtotal: Prisma.Decimal,
): Prisma.Decimal {
  if (!promotion.giaTriGiam.greaterThan(0)) {
    throw new Error(
      `Promotion invariant violated: non-positive discount ${promotion.khuyenMaiId}.`,
    );
  }

  let discount: Prisma.Decimal;
  if (promotion.loaiGiamGia === 'PHAN_TRAM') {
    if (promotion.giaTriGiam.greaterThan(100)) {
      throw new Error(
        `Promotion invariant violated: percentage exceeds 100 ${promotion.khuyenMaiId}.`,
      );
    }
    discount = subtotal.mul(promotion.giaTriGiam).div(100);
  } else if (promotion.loaiGiamGia === 'SO_TIEN') {
    discount = promotion.giaTriGiam;
  } else {
    throw new Error(
      `Promotion invariant violated: unknown discount type ${promotion.khuyenMaiId}.`,
    );
  }

  if (promotion.giamToiDa !== null) {
    if (!promotion.giamToiDa.greaterThan(0)) {
      throw new Error(
        `Promotion invariant violated: non-positive cap ${promotion.khuyenMaiId}.`,
      );
    }
    discount = Prisma.Decimal.min(discount, promotion.giamToiDa);
  }

  return Prisma.Decimal.min(discount, subtotal).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
}

@Injectable()
export class PromotionsService {
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async resolveBookingPromotion(
    input: ResolveBookingPromotionInput,
    client: PromotionClient = this.prisma,
  ): Promise<BookingPromotionQuote> {
    if (!input.subtotal.greaterThanOrEqualTo(0)) {
      throw new BadRequestException({
        error: 'PROMOTION_CONTEXT_INVALID',
        message: 'Giá trị đơn hàng không hợp lệ.',
      });
    }

    const businessDate =
      input.businessDate ?? getBusinessDate(this.businessTimeZone);
    const date = toUtcDate(businessDate);
    const code = input.promotionCode?.trim().toUpperCase() || undefined;
    const promotions = await client.khuyenMai.findMany({
      where: {
        nhaXeId: input.nhaXeId,
        trangThai: 'DANG_HOAT_DONG',
        phamViApDung: { in: ['DAT_VE', 'CA_HAI'] },
        hinhThucApDung: code ? 'NHAP_MA' : 'TU_DONG',
        tuNgay: { lte: date },
        OR: [{ denNgay: null }, { denNgay: { gte: date } }],
        ...(code ? { maKhuyenMai: code } : {}),
      },
      orderBy: { khuyenMaiId: 'asc' },
      select: PROMOTION_SELECT,
    });

    if (code) {
      if (promotions.length === 0) {
        throw promotionError(
          'PROMOTION_NOT_APPLICABLE',
          'Mã khuyến mãi không áp dụng cho đơn đặt vé này.',
        );
      }
      if (promotions.length > 1) {
        throw new Error(
          `Promotion invariant violated: duplicate code ${code} for company ${input.nhaXeId}.`,
        );
      }
      const promotion = promotions[0]!;
      if (!isMinimumMet(promotion, input.subtotal)) {
        throw promotionError(
          'PROMOTION_MINIMUM_NOT_MET',
          'Đơn hàng chưa đạt giá trị tối thiểu của mã khuyến mãi.',
        );
      }
      if (hasOpaqueCondition(promotion)) {
        throw promotionError(
          'PROMOTION_CONDITION_UNSUPPORTED',
          'Không thể xác minh điều kiện khuyến mãi đang lưu dưới dạng văn bản.',
        );
      }
      return this.toQuote(promotion, input.subtotal);
    }

    const eligible = promotions.filter(
      (promotion) =>
        isMinimumMet(promotion, input.subtotal) &&
        !hasOpaqueCondition(promotion),
    );
    if (eligible.length === 0) return this.noPromotion(input.subtotal);
    if (eligible.length > 1) {
      throw new ConflictException({
        error: 'PROMOTION_AMBIGUOUS',
        message:
          'Có nhiều khuyến mãi tự động phù hợp và chưa có quy tắc ưu tiên.',
      });
    }
    return this.toQuote(eligible[0]!, input.subtotal);
  }

  private toQuote(
    promotion: PromotionRecord,
    subtotal: Prisma.Decimal,
  ): BookingPromotionQuote {
    const discountAmount = calculateDiscount(promotion, subtotal);
    return {
      promotionId: promotion.khuyenMaiId,
      promotionCode: promotion.maKhuyenMai,
      promotionName: promotion.tenChuongTrinh,
      subtotal,
      discountAmount,
      totalAmount: subtotal.minus(discountAmount),
    };
  }

  private noPromotion(subtotal: Prisma.Decimal): BookingPromotionQuote {
    return {
      promotionId: null,
      promotionCode: null,
      promotionName: null,
      subtotal,
      discountAmount: new Prisma.Decimal(0),
      totalAmount: subtotal,
    };
  }
}
