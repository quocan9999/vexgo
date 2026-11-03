import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { CargoItemInputDto } from './create-shipment.dto.js';

export function parseShipmentDate(value: string): Date {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value ?? '');
  if (match) {
    const [, d, m, y] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (
      date.getUTCFullYear() === Number(y) &&
      date.getUTCMonth() + 1 === Number(m) &&
      date.getUTCDate() === Number(d)
    )
      return date;
  }
  throw new BadRequestException({
    error: 'SHIPMENT_SEND_DATE_INVALID',
    message: 'Ngày gửi phải là ngày lịch hợp lệ theo DD-MM-YYYY.',
  });
}

@ValidatorConstraint({ name: 'shipmentCalendarDate', async: false })
export class ShipmentCalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    try {
      if (typeof value !== 'string') return false;
      parseShipmentDate(value);
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage(): string {
    return 'Ngày gửi phải là ngày lịch hợp lệ theo DD-MM-YYYY.';
  }
}

export class ShipmentOptionsQueryDto extends PaginationQueryDto {
  @IsString() @IsNotEmpty() from!: string;
  @IsString() @IsNotEmpty() to!: string;
  @Validate(ShipmentCalendarDateConstraint) sendDate!: string;
}

export class ShipmentQuoteDto {
  @IsInt() @Min(1) routeId!: number;
  @Validate(ShipmentCalendarDateConstraint) sendDate!: string;
  @IsInt() @Min(1) senderPointId!: number;
  @IsInt() @Min(1) receiverPointId!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CargoItemInputDto)
  items!: CargoItemInputDto[];
  @IsOptional() @IsBoolean() isFragile?: boolean;
  @IsOptional() @IsBoolean() isValuable?: boolean;
}

export class ShipmentMeasurementDto {
  @IsInt() @Min(1) cargoId!: number;
  @IsNumber() @Min(0.01) weight!: number;
  @IsOptional() @IsNumber() @Min(0.01) length?: number;
  @IsOptional() @IsNumber() @Min(0.01) width?: number;
  @IsOptional() @IsNumber() @Min(0.01) height?: number;
}
export class AcceptShipmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShipmentMeasurementDto)
  items!: ShipmentMeasurementDto[];
  @IsBoolean() confirmPriceChange!: boolean;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class AssignShipmentDto {
  @IsInt() @Min(1) tripId!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class CollectShipmentPaymentDto {
  @IsNumber({ maxDecimalPlaces: 0 }) @Min(1) amount!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class ResolveShipmentMoneyCaseDto {
  @IsString() @IsNotEmpty() @MaxLength(400) note!: string;
  @IsIn(['REFUNDED', 'NO_PAYMENT']) outcome!: 'REFUNDED' | 'NO_PAYMENT';
  @IsOptional() @IsNumber({ maxDecimalPlaces: 0 }) @Min(1) amount?: number;
  @IsOptional() @IsString() @MaxLength(191) reference?: string;
}
