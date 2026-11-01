import { ApiPropertyOptional } from '@nestjs/swagger';
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

export const ADMIN_TICKET_STATUSES = [
  'DA_DAT',
  'DA_THANH_TOAN',
  'HUY',
] as const;

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
  @ApiPropertyOptional({ description: 'Trang truy vấn', default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang phải lớn hơn hoặc bằng 1.' })
  @Max(10_000, { message: 'Trang không được vượt quá 10000.' })
  declare page: number;

  @ApiPropertyOptional({ description: 'Số lượng bản ghi trên một trang', default: 10, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng mục trên trang phải là số nguyên.' })
  @Min(1, { message: 'Số lượng mục trên trang phải lớn hơn hoặc bằng 1.' })
  @Max(100, { message: 'Số lượng mục trên trang không được vượt quá 100.' })
  declare pageSize: number;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (mã đơn, họ tên, số điện thoại)', example: '0912345678' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare search?: string;

  @ApiPropertyOptional({ description: 'Đặt vé từ ngày (DD-MM-YYYY hoặc YYYY-MM-DD)', example: '01-10-2026' })
  @IsOptional()
  @IsDateOnly({ message: 'Ngày đặt không hợp lệ.' })
  @Validate(DateRangeStartBeforeOrEqualEnd, ['bookedTo'])
  bookedFrom?: string;

  @ApiPropertyOptional({ description: 'Đặt vé đến ngày (DD-MM-YYYY hoặc YYYY-MM-DD)', example: '31-10-2026' })
  @IsOptional()
  @IsDateOnly({ message: 'Ngày đặt không hợp lệ.' })
  bookedTo?: string;

  @ApiPropertyOptional({ description: 'Khởi hành từ ngày', example: '01-11-2026' })
  @IsOptional()
  @IsDateOnly({ message: 'Ngày khởi hành không hợp lệ.' })
  @Validate(DateRangeStartBeforeOrEqualEnd, ['departureTo'])
  departureFrom?: string;

  @ApiPropertyOptional({ description: 'Khởi hành đến ngày', example: '30-11-2026' })
  @IsOptional()
  @IsDateOnly({ message: 'Ngày khởi hành không hợp lệ.' })
  departureTo?: string;
}

export class AdminBookingQueryDto extends AdminBookingTicketFiltersDto {
  @ApiPropertyOptional({
    description: 'Trạng thái đơn đặt vé',
    enum: ADMIN_BOOKING_STATUSES,
    example: 'DA_THANH_TOAN',
  })
  @IsOptional()
  @IsIn(ADMIN_BOOKING_STATUSES, {
    message: 'Trạng thái phiếu đặt vé không hợp lệ.',
  })
  status?: (typeof ADMIN_BOOKING_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Trường sắp xếp',
    enum: ['bookedAt', 'departureTime', 'totalTicketAmount'],
    default: 'bookedAt',
    example: 'bookedAt',
  })
  @IsOptional()
  @IsIn(['bookedAt', 'departureTime', 'totalTicketAmount'])
  declare sortBy?: 'bookedAt' | 'departureTime' | 'totalTicketAmount';
}

export class AdminTicketQueryDto extends AdminBookingTicketFiltersDto {
  @ApiPropertyOptional({
    description: 'Trạng thái vé xe',
    enum: ADMIN_TICKET_STATUSES,
    example: 'DA_THANH_TOAN',
  })
  @IsOptional()
  @IsIn(ADMIN_TICKET_STATUSES, { message: 'Trạng thái vé không hợp lệ.' })
  status?: (typeof ADMIN_TICKET_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Trường sắp xếp',
    enum: ['bookedAt', 'departureTime', 'ticketPrice'],
    default: 'bookedAt',
    example: 'bookedAt',
  })
  @IsOptional()
  @IsIn(['bookedAt', 'departureTime', 'ticketPrice'])
  declare sortBy?: 'bookedAt' | 'departureTime' | 'ticketPrice';
}

export class AdminHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Trang truy vấn lịch sử', default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang phải lớn hơn hoặc bằng 1.' })
  @Max(10_000, { message: 'Trang không được vượt quá 10000.' })
  page = 1;

  @ApiPropertyOptional({ description: 'Số bản ghi lịch sử trên một trang', default: 100, example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng mục trên trang phải là số nguyên.' })
  @Min(1, { message: 'Số lượng mục trên trang phải lớn hơn hoặc bằng 1.' })
  @Max(100, { message: 'Số lượng mục trên trang không được vượt quá 100.' })
  pageSize = 100;
}
