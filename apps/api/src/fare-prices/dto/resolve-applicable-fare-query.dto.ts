import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  Max,
  Min,
  Validate,
} from 'class-validator';
import { IsDateOnlyConstraint } from '../fare-price.dto-validators.js';

export class ResolveApplicableFareQueryDto {
  @IsDefined()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId!: number;

  @IsDefined()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleTypeId!: number;

  @IsDefined()
  @Validate(IsDateOnlyConstraint)
  date!: string;
}
