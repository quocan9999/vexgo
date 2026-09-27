import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { isDateOnly } from '../fare-price-integrity.js';
import { FARE_PRICE_STATUSES } from '../fare-price.domain.js';

@ValidatorConstraint({ name: 'isDateOnly', async: false })
class IsDateOnlyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isDateOnly(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid YYYY-MM-DD date.`;
  }
}

@ValidatorConstraint({ name: 'validFarePriceDateRange', async: false })
class ValidFarePriceDateRangeConstraint
  implements ValidatorConstraintInterface
{
  validate(validTo: unknown, args: ValidationArguments): boolean {
    const { validFrom } = args.object as { validFrom?: unknown };
    if (validTo === null || validTo === undefined) return true;
    if (!isDateOnly(validFrom) || !isDateOnly(validTo)) return true;
    return validTo >= validFrom;
  }

  defaultMessage(): string {
    return 'validTo must be on or after validFrom.';
  }
}

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
