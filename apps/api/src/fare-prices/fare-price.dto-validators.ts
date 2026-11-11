import {
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { isDateOnly } from './fare-price-integrity.js';

@ValidatorConstraint({ name: 'isDateOnly', async: false })
export class IsDateOnlyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isDateOnly(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid YYYY-MM-DD date.`;
  }
}

@ValidatorConstraint({ name: 'validFarePriceDateRange', async: false })
export class ValidFarePriceDateRangeConstraint
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
