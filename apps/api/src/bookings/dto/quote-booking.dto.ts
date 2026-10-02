import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PromotionCodeDto } from '../../promotions/dto/promotion-code.dto.js';

export class BookingSelectionDto extends PromotionCodeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  tripId!: number;

  @Type(() => Number)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2_147_483_647, { each: true })
  seatIds!: number[];
}

export class QuoteBookingDto extends BookingSelectionDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  holdToken?: string;
}
