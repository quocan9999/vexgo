import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isDateOnly } from '../../fare-prices/fare-price-integrity.js';

export function IsPromotionDateOnly(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isPromotionDateOnly',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isDateOnly(value);
        },
        defaultMessage() {
          return 'must be a valid YYYY-MM-DD date.';
        },
      },
    });
  };
}
