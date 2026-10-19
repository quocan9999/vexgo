import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { IsPromotionDateOnly } from './promotion-validators.js';

const DECIMAL_AMOUNT_PATTERN = /^\d{1,16}(?:\.\d{1,2})?$/;

export class CreatePromotionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 150)
  name!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{2,49}$/)
  code!: string;

  @IsIn(['PHAN_TRAM', 'SO_TIEN'])
  discountType!: 'PHAN_TRAM' | 'SO_TIEN';

  @IsString()
  @Matches(DECIMAL_AMOUNT_PATTERN)
  discountValue!: string;

  @IsOptional()
  @IsString()
  @Matches(DECIMAL_AMOUNT_PATTERN)
  maxDiscount?: string | null;

  @IsOptional()
  @IsString()
  @Matches(DECIMAL_AMOUNT_PATTERN)
  minimumTicketAmount?: string | null;

  @IsString()
  @IsPromotionDateOnly()
  startsOn!: string;

  @IsString()
  @IsPromotionDateOnly()
  endsOn!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit!: number;
}
