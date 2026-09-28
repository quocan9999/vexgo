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
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  listedPrice?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Validate(IsDateOnlyConstraint)
  validFrom?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @Validate(IsDateOnlyConstraint)
  @Validate(ValidFarePriceDateRangeConstraint)
  validTo?: string | null;
}
