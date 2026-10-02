import { Transform } from 'class-transformer';
import { IsOptional, Matches, MaxLength, MinLength } from 'class-validator';

export class PromotionCodeDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+$/)
  promotionCode?: string;
}
