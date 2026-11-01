import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  Max,
  Min,
  Validate,
  ValidateIf,
} from 'class-validator';
import {
  IsDateOnlyConstraint,
  ValidFarePriceDateRangeConstraint,
} from '../fare-price.dto-validators.js';

export class UpdateFarePriceDto {
  @ApiPropertyOptional({ description: 'Giá vé niêm yết mới (VNĐ)', example: 280000 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  listedPrice?: number;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu hiệu lực mới (DD-MM-YYYY hoặc YYYY-MM-DD)', example: '15-06-2026' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Validate(IsDateOnlyConstraint)
  validFrom?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc hiệu lực mới (DD-MM-YYYY hoặc YYYY-MM-DD)', example: '31-12-2026' })
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @Validate(IsDateOnlyConstraint)
  @Validate(ValidFarePriceDateRangeConstraint)
  validTo?: string | null;
}
