import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  Validate,
} from 'class-validator';
import {
  IsDateOnlyConstraint,
  ValidFarePriceDateRangeConstraint,
} from '../fare-price.dto-validators.js';
import { FARE_PRICE_STATUSES } from '../fare-price.domain.js';

export class CreateFarePriceDto {
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId!: number;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleTypeId!: number;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  listedPrice!: number;

  @IsDefined()
  @Validate(IsDateOnlyConstraint)
  validFrom!: string;

  @IsOptional()
  @Validate(IsDateOnlyConstraint)
  @Validate(ValidFarePriceDateRangeConstraint)
  validTo?: string | null;

  @IsDefined()
  @IsIn(FARE_PRICE_STATUSES)
  status!: (typeof FARE_PRICE_STATUSES)[number];
}
