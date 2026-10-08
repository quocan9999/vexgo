import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { IsDateOnly } from '../../common/validators/is-date-only.validator.js';

export const ADMIN_BOOKING_STATUSES = [
  'CHO_THANH_TOAN',
  'DA_THANH_TOAN',
  'HOAN_THANH',
  'DA_HUY',
] as const;

export const ADMIN_TICKET_STATUSES = ['DA_DAT', 'HUY'] as const;

@ValidatorConstraint({ name: 'dateRangeStartBeforeOrEqualEnd', async: false })
class DateRangeStartBeforeOrEqualEnd implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const otherProperty = args.constraints[0] as string;
    const otherValue = (args.object as Record<string, unknown>)[otherProperty];
    if (value == null || otherValue == null) return true;
    if (typeof value !== 'string' || typeof otherValue !== 'string')
      return true;
    return value <= otherValue;
  }

  defaultMessage(args: ValidationArguments): string {
    const otherProperty = args.constraints[0] as string;
    return `${args.property} must be on or before ${otherProperty}.`;
  }
}

abstract class AdminBookingTicketFiltersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare search?: string;

  @IsOptional()
  @IsDateOnly({ message: 'Ngày đặt không hợp lệ.' })
  @Validate(DateRangeStartBeforeOrEqualEnd, ['bookedTo'])
  bookedFrom?: string;

  @IsOptional()
  @IsDateOnly({ message: 'Ngày đặt không hợp lệ.' })
  bookedTo?: string;

  @IsOptional()
  @IsDateOnly({ message: 'Ngày khởi hành không hợp lệ.' })
  @Validate(DateRangeStartBeforeOrEqualEnd, ['departureTo'])
  departureFrom?: string;

  @IsOptional()
  @IsDateOnly({ message: 'Ngày khởi hành không hợp lệ.' })
  departureTo?: string;
}

export class AdminBookingQueryDto extends AdminBookingTicketFiltersDto {
  @IsOptional()
  @IsIn(ADMIN_BOOKING_STATUSES, {
    message: 'Trạng thái phiếu đặt vé không hợp lệ.',
  })
  status?: (typeof ADMIN_BOOKING_STATUSES)[number];

  @IsOptional()
  @IsIn(['bookedAt', 'departureTime', 'totalTicketAmount'])
  declare sortBy?: 'bookedAt' | 'departureTime' | 'totalTicketAmount';
}

export class AdminTicketQueryDto extends AdminBookingTicketFiltersDto {
  @IsOptional()
  @IsIn(ADMIN_TICKET_STATUSES, { message: 'Trạng thái vé không hợp lệ.' })
  status?: (typeof ADMIN_TICKET_STATUSES)[number];

  @IsOptional()
  @IsIn(['bookedAt', 'departureTime', 'ticketPrice'])
  declare sortBy?: 'bookedAt' | 'departureTime' | 'ticketPrice';
}

export class AdminHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 100;
}
