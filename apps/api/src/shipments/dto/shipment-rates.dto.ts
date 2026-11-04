import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const SHIPMENT_RATE_STATUSES = ['HOAT_DONG', 'TAM_NGUNG'] as const;
export type ShipmentRateStatus = (typeof SHIPMENT_RATE_STATUSES)[number];

export const SHIPMENT_RATE_EFFECTIVE_STATES = [
  'CHUA_HIEU_LUC',
  'DANG_HIEU_LUC',
  'HET_HIEU_LUC',
  'TAM_NGUNG',
] as const;
export type ShipmentRateEffectiveState =
  (typeof SHIPMENT_RATE_EFFECTIVE_STATES)[number];

export const SHIPMENT_RATE_SORT_FIELDS = [
  'fee',
  'weightFrom',
  'validFrom',
  'validTo',
  'status',
] as const;
export type ShipmentRateSortField = (typeof SHIPMENT_RATE_SORT_FIELDS)[number];

export function isShipmentRateDateOnly(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  return day <= daysInMonth;
}

@ValidatorConstraint({ name: 'isShipmentRateDateOnly', async: false })
export class IsShipmentRateDateOnlyConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    return isShipmentRateDateOnly(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} phải là ngày hợp lệ định dạng YYYY-MM-DD.`;
  }
}

@ValidatorConstraint({ name: 'validShipmentRateDateRange', async: false })
export class ValidShipmentRateDateRangeConstraint
  implements ValidatorConstraintInterface
{
  validate(validTo: unknown, args: ValidationArguments): boolean {
    const { validFrom } = args.object as { validFrom?: unknown };
    if (validTo === null || validTo === undefined) return true;
    if (!isShipmentRateDateOnly(validFrom) || !isShipmentRateDateOnly(validTo)) {
      return true;
    }
    return validTo >= validFrom;
  }

  defaultMessage(): string {
    return 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
  }
}

export class QueryShipmentRatesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Trường sắp xếp danh sách bảng cước gửi hàng',
    enum: SHIPMENT_RATE_SORT_FIELDS,
    default: 'weightFrom',
  })
  @IsOptional()
  @IsIn(SHIPMENT_RATE_SORT_FIELDS)
  sortBy: ShipmentRateSortField = 'weightFrom';

  @ApiPropertyOptional({ description: 'Lọc theo ID tuyến xe', example: 1 })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo ID loại hàng hóa', example: 1 })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  cargoTypeId?: number;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái',
    enum: SHIPMENT_RATE_STATUSES,
  })
  @IsOptional()
  @IsIn(SHIPMENT_RATE_STATUSES)
  status?: ShipmentRateStatus;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái hiệu lực hiện tại',
    enum: SHIPMENT_RATE_EFFECTIVE_STATES,
  })
  @IsOptional()
  @IsIn(SHIPMENT_RATE_EFFECTIVE_STATES)
  effectiveState?: ShipmentRateEffectiveState;
}

export class CreateShipmentRateDto {
  @ApiProperty({ description: 'ID tuyến xe áp dụng bảng cước', example: 1 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId!: number;

  @ApiProperty({ description: 'ID loại hàng hóa áp dụng', example: 1 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  cargoTypeId!: number;

  @ApiProperty({ description: 'Khối lượng từ (kg)', example: 0 })
  @IsDefined()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999)
  weightFrom!: number;

  @ApiPropertyOptional({
    description: 'Khối lượng đến (kg) — để trống hoặc null nếu không giới hạn trần',
    example: 5,
  })
  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99_999_999)
  weightTo?: number | null;

  @ApiProperty({ description: 'Mức cước niêm yết (VND)', example: 50000 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  fee!: number;

  @ApiProperty({
    description: 'Ngày bắt đầu có hiệu lực (YYYY-MM-DD)',
    example: '2026-09-01',
  })
  @IsDefined()
  @Validate(IsShipmentRateDateOnlyConstraint)
  validFrom!: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc hiệu lực (YYYY-MM-DD) hoặc null',
    example: null,
  })
  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @Validate(IsShipmentRateDateOnlyConstraint)
  @Validate(ValidShipmentRateDateRangeConstraint)
  validTo?: string | null;

  @ApiProperty({
    description: 'Trạng thái hoạt động',
    enum: SHIPMENT_RATE_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsDefined()
  @IsIn(SHIPMENT_RATE_STATUSES)
  status!: ShipmentRateStatus;
}

export class UpdateShipmentRateDto {
  @ApiPropertyOptional({ description: 'Khối lượng từ mới (kg)', example: 0 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999)
  weightFrom?: number;

  @ApiPropertyOptional({
    description: 'Khối lượng đến mới (kg) hoặc null',
    example: 5,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99_999_999)
  weightTo?: number | null;

  @ApiPropertyOptional({ description: 'Mức cước mới (VND)', example: 55000 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  fee?: number;

  @ApiPropertyOptional({
    description: 'Ngày bắt đầu hiệu lực mới (YYYY-MM-DD)',
    example: '2026-09-01',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Validate(IsShipmentRateDateOnlyConstraint)
  validFrom?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc hiệu lực mới (YYYY-MM-DD) hoặc null',
    example: null,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @Validate(IsShipmentRateDateOnlyConstraint)
  @Validate(ValidShipmentRateDateRangeConstraint)
  validTo?: string | null;
}

export class UpdateShipmentRateStatusDto {
  @ApiProperty({
    description: 'Trạng thái mới của mức cước gửi hàng',
    enum: SHIPMENT_RATE_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsDefined()
  @IsIn(SHIPMENT_RATE_STATUSES)
  status!: ShipmentRateStatus;
}
